/**
 * register-anchor.mjs
 *
 * Registers a demo anchor and stakes USDC to generate real ACR data.
 * The anchor IS the deployer key for demo purposes.
 *
 * In production: each anchor (MoneyGram, Bitso, etc.) would run this themselves,
 * signing with their own keypair.
 *
 * Run: node scripts/register-anchor.mjs
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
  Address,
} from '@stellar/stellar-sdk';

const RPC_URL      = 'https://soroban-testnet.stellar.org';
const NETWORK      = Networks.TESTNET;
const ANCHOR_STAKE = 'CDROZ7YDBYJVKUD5ZVDE627KK4D6I6WLC4BE22XBXK6GQ6VZA7PN34DD';
const USDC_SAC     = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';

// Demo anchors — each uses the deployer key for testnet simplicity.
// In production each anchor has their own keypair.
// We use different "display" names but all sign with the same key for demo.
// To simulate multiple anchors, we'd need funded accounts for each.
const DEPLOYER_SECRET = 'SCA2JKE3LORJ2NIRY3U4A4IEKA43RMS7AFW2TYBWUGWKJBUUV55YTV5G';

// For demo: use the deployer as "MoneyGram" on market 0
// and skip the watcher key (no USDC trustline yet)
const ANCHORS = [
  {
    secret: 'SCA2JKE3LORJ2NIRY3U4A4IEKA43RMS7AFW2TYBWUGWKJBUUV55YTV5G', // deployer
    marketId: 0,
    stakeUsdc: 5,
    displayName: 'MoneyGram (demo)',
  },
];

const server = new SorobanRpc.Server(RPC_URL, { allowHttp: false });
const sleep  = ms => new Promise(r => setTimeout(r, ms));

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
    if (status === 'FAILED')  throw new Error(`TX failed: ${hash}\n${JSON.stringify(json.result)}`);
  }
  throw new Error(`TX timeout: ${hash}`);
}

async function invokeAs(keypair, contractId, method, args) {
  const account  = await server.getAccount(keypair.publicKey());
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(300)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`Sim error [${method}]: ${sim.error.split('\n')[0]}`);
  }

  const prepared = SorobanRpc.assembleTransaction(tx, sim).build();
  prepared.sign(keypair);

  const send = await server.sendTransaction(prepared);
  if (send.status === 'ERROR') throw new Error(`Send error: ${JSON.stringify(send)}`);
  console.log(`    tx: ${send.hash}`);
  await pollTx(send.hash);
}

async function getAcrAll() {
  const source = new Account('GD6KRXUKOAPTYW72IZOERCPGM3UHXTQDJK4RS5WUAZHC4K2WOONQA3ZR', '0');
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: NETWORK })
    .addOperation(new Contract(ANCHOR_STAKE).call('get_all_acr'))
    .setTimeout(30).build();
  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) return [];
  return scValToNative(sim.result.retval);
}

async function fundWithUsdc(keypair, amountUsdc) {
  // Check current USDC balance via Horizon
  const res = await fetch(
    `https://horizon-testnet.stellar.org/accounts/${keypair.publicKey()}`
  );
  const data = await res.json();
  const usdcBalance = data.balances?.find(b =>
    b.asset_code === 'USDC' && b.asset_issuer === 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
  );
  const bal = parseFloat(usdcBalance?.balance ?? '0');
  console.log(`    USDC balance: ${bal}`);
  if (bal < amountUsdc) {
    console.log(`    ⚠ Insufficient USDC (need ${amountUsdc}, have ${bal})`);
    console.log(`    → Get testnet USDC at https://faucet.circle.com`);
    return false;
  }
  return true;
}

async function main() {
  console.log('=== AnchorShield — Register Demo Anchors ===\n');

  for (const anchor of ANCHORS) {
    const kp = Keypair.fromSecret(anchor.secret);
    console.log(`→ ${anchor.displayName}`);
    console.log(`  address : ${kp.publicKey()}`);
    console.log(`  market  : ${anchor.marketId}`);
    console.log(`  stake   : ${anchor.stakeUsdc} USDC`);

    // Check USDC balance
    const hasFunds = await fundWithUsdc(kp, anchor.stakeUsdc);
    if (!hasFunds) {
      console.log(`  ✗ Skipping — fund this account first\n`);
      continue;
    }

    // Step 1: register_anchor(anchor, market_id)
    try {
      console.log(`  registering...`);
      await invokeAs(kp, ANCHOR_STAKE, 'register_anchor', [
        nativeToScVal(kp.publicKey(), { type: 'address' }),
        nativeToScVal(anchor.marketId, { type: 'u32' }),
      ]);
      console.log(`  ✓ registered`);
    } catch (e) {
      // Already registered is fine
      if (e.message.includes('already') || e.message.includes('exists')) {
        console.log(`  already registered, continuing`);
      } else {
        console.error(`  ✗ register failed: ${e.message.split('\n')[0]}`);
        continue;
      }
    }

    await sleep(5000);

    // Step 2: stake(anchor, amount_in_stroops)
    const stroops = BigInt(anchor.stakeUsdc * 10_000_000);
    try {
      console.log(`  staking ${anchor.stakeUsdc} USDC...`);
      await invokeAs(kp, ANCHOR_STAKE, 'stake', [
        nativeToScVal(kp.publicKey(), { type: 'address' }),
        nativeToScVal(stroops, { type: 'i128' }),
      ]);
      console.log(`  ✓ staked`);
    } catch (e) {
      console.error(`  ✗ stake failed: ${e.message.split('\n')[0]}`);
      continue;
    }

    console.log('');
    await sleep(5000);
  }

  // Show final ACR scores
  console.log('=== Final ACR Scores ===');
  const scores = await getAcrAll();
  if (!Array.isArray(scores) || scores.length === 0) {
    console.log('No scores yet — check for errors above');
  } else {
    scores.forEach(([addr, bps]) => {
      const acr = Number(bps) / 10_000;
      const rating = acr >= 2 ? 'AAA' : acr >= 1 ? 'AA' : acr >= 0.5 ? 'A' : 'BBB';
      console.log(`  ${addr.slice(0,8)}... ACR=${acr.toFixed(2)}x (${rating})`);
    });
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
