/**
 * create-test-market.mjs
 * Creates a single USDC depeg market that expires in 10 minutes.
 * Used for end-to-end testing of the full buy → underwrite → settle → claim flow.
 *
 * Run: node scripts/create-test-market.mjs
 */

import {
  Account, Contract, Keypair, TransactionBuilder,
  BASE_FEE, Networks, rpc as SorobanRpc,
  xdr, nativeToScVal, scValToNative,
} from '@stellar/stellar-sdk';

const RPC_URL      = 'https://soroban-testnet.stellar.org';
const NETWORK      = Networks.TESTNET;
const ADMIN_SECRET = 'SCA2JKE3LORJ2NIRY3U4A4IEKA43RMS7AFW2TYBWUGWKJBUUV55YTV5G';
const FACTORY      = 'CDPLCH2HKDALDYNYDK22BTDNCHGB63S4WZCP7WJXYXIHKSCA3BG2B47R';
const USDC_SAC     = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';
const ORACLE       = 'CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63';

const now    = BigInt(Math.floor(Date.now() / 1000));
const expiry = now + 600n; // 10 minutes from now

const server  = new SorobanRpc.Server(RPC_URL, { allowHttp: false });
const keypair = Keypair.fromSecret(ADMIN_SECRET);
const sleep   = ms => new Promise(r => setTimeout(r, ms));

async function pollTx(hash) {
  for (let i = 0; i < 15; i++) {
    await sleep(3000);
    const res  = await fetch(RPC_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTransaction', params: { hash } }),
    });
    const { result } = await res.json();
    if (result?.status === 'SUCCESS') return;
    if (result?.status === 'FAILED')  throw new Error(`TX failed: ${hash}`);
  }
  throw new Error(`TX timeout: ${hash}`);
}

async function main() {
  console.log('Creating 10-minute USDC test market...');
  console.log(`Expires: ${new Date(Number(expiry) * 1000).toUTCString()}`);

  const account = await server.getAccount(keypair.publicKey());

  const args = [
    nativeToScVal('USDC test — expires in 10 min', { type: 'string'  }),
    nativeToScVal(USDC_SAC,                         { type: 'address' }),
    xdr.ScVal.scvVec([xdr.ScVal.scvSymbol('Other'), xdr.ScVal.scvSymbol('USDC')]),
    nativeToScVal(ORACLE,                           { type: 'address' }),
    nativeToScVal(99_500_000_000_000n,              { type: 'i128'    }), // $0.995
    nativeToScVal(60n,                              { type: 'u64'     }), // 60s breach window
    nativeToScVal(expiry,                           { type: 'u64'     }),
    xdr.ScVal.scvVoid(), // anchor_id = None
  ];

  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK })
    .addOperation(new Contract(FACTORY).call('create_market', ...args))
    .setTimeout(300).build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) throw new Error(`Sim error: ${sim.error}`);

  const prepared = SorobanRpc.assembleTransaction(tx, sim).build();
  prepared.sign(keypair);

  const send = await server.sendTransaction(prepared);
  if (send.status === 'ERROR') throw new Error(`Send error: ${JSON.stringify(send)}`);
  console.log(`TX submitted: ${send.hash}`);

  await pollTx(send.hash);

  // Read back the new market ID
  const source = new Account(keypair.publicKey(), '0');
  const listTx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: NETWORK })
    .addOperation(new Contract(FACTORY).call('list_markets'))
    .setTimeout(30).build();
  const listSim = await server.simulateTransaction(listTx);
  const ids = scValToNative(listSim.result.retval);
  const newId = Math.max(...ids);

  console.log(`\n✓ Market created! ID: ${newId}`);
  console.log(`  Expires at: ${new Date(Number(expiry) * 1000).toUTCString()}`);
  console.log(`  Breach window: 60 seconds (not 1hr — faster for testing)`);
  console.log(`  Threshold: $0.995`);
  console.log(`\n→ Open: http://localhost:3000/app/markets/${newId}`);
  console.log('\nYou have 10 minutes to:');
  console.log('  1. Browser A: Underwrite — deposit USDC, place sell order');
  console.log('  2. Browser B: Buy Cover — fill the sell order');
  console.log('  3. Wait 10 min for expiry → watcher calls try_settle()');
  console.log('  4. Both browsers: Claim Winnings (NO wins since USDC held peg)');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
