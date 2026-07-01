/**
 * create-markets.mjs — creates multiple insurance markets on testnet.
 * Run: node scripts/create-markets.mjs
 */

import {
  Account,
  Contract,
  Keypair,
  TransactionBuilder,
  BASE_FEE,
  Networks,
  rpc as SorobanRpc,
  xdr,
  nativeToScVal,
  scValToNative,
} from '@stellar/stellar-sdk';

const RPC_URL    = 'https://soroban-testnet.stellar.org';
const NETWORK    = Networks.TESTNET;
const ADMIN_SECRET = 'SCA2JKE3LORJ2NIRY3U4A4IEKA43RMS7AFW2TYBWUGWKJBUUV55YTV5G';
const FACTORY    = 'CDPLCH2HKDALDYNYDK22BTDNCHGB63S4WZCP7WJXYXIHKSCA3BG2B47R';
const USDC_SAC   = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';
const ORACLE     = 'CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63';

const DEPEG_THRESHOLD = 99_500_000_000_000n; // $0.995 @ 14 decimals
const BREACH_1HR  = 3600n;
const BREACH_1MIN = 60n;

const now = BigInt(Math.floor(Date.now() / 1000));
const EXPIRY_90D  = now + 7_776_000n;
const EXPIRY_10M  = now + 600n;       // 10 minutes — for settlement/claim test

const MARKETS = [
  { label: 'EURC depeg < $0.995 for 1hr',       symbol: 'EURC',  breach: BREACH_1HR,  expiry: EXPIRY_90D },
  { label: 'DAI depeg < $0.995 for 1hr',         symbol: 'DAI',   breach: BREACH_1HR,  expiry: EXPIRY_90D },
  { label: 'USDT depeg < $0.995 for 1hr',        symbol: 'USDT',  breach: BREACH_1HR,  expiry: EXPIRY_90D },
  { label: 'USDC test — expires in 10 min',      symbol: 'USDC',  breach: BREACH_1MIN, expiry: EXPIRY_10M },
];

const server  = new SorobanRpc.Server(RPC_URL, { allowHttp: false });
const keypair = Keypair.fromSecret(ADMIN_SECRET);
const sleep   = ms => new Promise(r => setTimeout(r, ms));

async function pollTx(hash) {
  for (let i = 0; i < 15; i++) {
    await sleep(3000);
    const res  = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTransaction', params: { hash } }),
    });
    const json   = await res.json();
    const status = json.result?.status;
    if (status === 'SUCCESS') return;
    if (status === 'FAILED')  throw new Error(`TX failed: ${hash}`);
  }
  throw new Error(`TX timeout: ${hash}`);
}

async function createMarket({ label, symbol, breach, expiry }) {
  console.log(`\n→ Creating: "${label}"`);
  const account = await server.getAccount(keypair.publicKey());

  // Asset::Other(Symbol) — encoding confirmed working against live Reflector testnet
  const coveredAsset = xdr.ScVal.scvVec([
    xdr.ScVal.scvSymbol('Other'),
    xdr.ScVal.scvSymbol(symbol),
  ]);

  const args = [
    nativeToScVal(label,             { type: 'string'  }),
    nativeToScVal(USDC_SAC,          { type: 'address' }),
    coveredAsset,
    nativeToScVal(ORACLE,            { type: 'address' }),
    nativeToScVal(DEPEG_THRESHOLD,   { type: 'i128'    }),
    nativeToScVal(breach,            { type: 'u64'     }),
    nativeToScVal(expiry,            { type: 'u64'     }),
    xdr.ScVal.scvVoid(),             // anchor_id = None
  ];

  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK })
    .addOperation(new Contract(FACTORY).call('create_market', ...args))
    .setTimeout(300)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`Sim error: ${sim.error.split('\n')[0]}`);
  }

  const prepared = SorobanRpc.assembleTransaction(tx, sim).build();
  prepared.sign(keypair);

  const send = await server.sendTransaction(prepared);
  if (send.status === 'ERROR') throw new Error(`Send error: ${JSON.stringify(send)}`);

  console.log(`  tx: ${send.hash}`);
  await pollTx(send.hash);
  console.log(`  ✓ Done — expires ${new Date(Number(expiry) * 1000).toUTCString()}`);
}

async function listMarkets() {
  const source = new Account(keypair.publicKey(), '0');
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: NETWORK })
    .addOperation(new Contract(FACTORY).call('list_markets'))
    .setTimeout(30).build();
  const sim = await server.simulateTransaction(tx);
  if (!SorobanRpc.Api.isSimulationError(sim)) {
    return scValToNative(sim.result.retval);
  }
  return [];
}

async function main() {
  console.log('=== AnchorShield Market Creator ===');
  console.log(`Admin : ${keypair.publicKey()}`);
  console.log(`Factory: ${FACTORY}`);

  const before = await listMarkets();
  console.log(`\nExisting markets: ${JSON.stringify(before)}`);

  for (const m of MARKETS) {
    try {
      await createMarket(m);
      await sleep(6000); // wait for ledger to avoid sequence conflicts
    } catch (e) {
      console.error(`  ✗ ${e.message}`);
    }
  }

  const after = await listMarkets();
  console.log(`\n=== All markets on-chain: ${JSON.stringify(after)} ===`);
  console.log('\nThe short-expiry test market expires in ~10 minutes.');
  console.log('Refresh the frontend and you should see all markets listed.');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
