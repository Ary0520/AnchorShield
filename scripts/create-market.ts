#!/usr/bin/env ts-node
/**
 * create-market.ts — creates a new insurance market via the factory contract.
 *
 * Usage (after deploying contracts):
 *   cd scripts
 *   ts-node create-market.ts \
 *     --network testnet \
 *     --factory C... \
 *     --collateral C... \
 *     --symbol USDC \
 *     --oracle C... \
 *     --threshold 99500000000000 \
 *     --breach 3600 \
 *     --expiry 1800000000 \
 *     --label "USDC depeg < $0.995 for 1hr"
 *
 * Or set env vars matching the watcher .env and run with no flags
 * to create the default USDC market.
 */

import {
  Contract,
  Keypair,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';
import { Server, Api, assembleTransaction } from '@stellar/stellar-sdk/rpc';
import dotenv from 'dotenv';
dotenv.config();

// ── Parse CLI args ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag: string, fallback?: string): string {
  const i = args.indexOf(flag);
  if (i >= 0 && args[i + 1]) return args[i + 1];
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required argument: ${flag}`);
}

const isTestnet = getArg('--network', 'testnet') === 'testnet';
const RPC_URL     = isTestnet ? 'https://soroban-testnet.stellar.org' : 'https://mainnet.sorobanrpc.com';
const PASSPHRASE  = isTestnet ? 'Test SDF Network ; September 2015' : 'Public Global Stellar Network ; September 2015';
const FACTORY_ID  = getArg('--factory', process.env.MARKET_FACTORY_CONTRACT ?? '');
const SECRET_KEY  = process.env.DEPLOYER_SECRET_KEY ?? process.env.WATCHER_SECRET_KEY ?? '';

if (!FACTORY_ID) throw new Error('--factory or MARKET_FACTORY_CONTRACT env var required');
if (!SECRET_KEY)  throw new Error('DEPLOYER_SECRET_KEY or WATCHER_SECRET_KEY env var required');

const COLLATERAL  = getArg('--collateral', process.env.USDC_SAC ?? '');
const SYMBOL      = getArg('--symbol',     'USDC');
const ORACLE      = getArg('--oracle',     process.env.REDSTONE_CONTRACT ?? '');
// $0.995 in 14-decimal RedStone format
const THRESHOLD   = BigInt(getArg('--threshold', '99500000000000'));
const BREACH      = parseInt(getArg('--breach',  '3600'));
const EXPIRY      = parseInt(getArg('--expiry',  String(Math.floor(Date.now() / 1000) + 30 * 86400)));
const LABEL       = getArg('--label', `${SYMBOL} depeg market`);

async function main() {
  const server  = new Server(RPC_URL);
  const keypair = Keypair.fromSecret(SECRET_KEY);
  const account = await server.getAccount(keypair.publicKey());

  console.log(`Creating market on ${isTestnet ? 'testnet' : 'MAINNET'}...`);
  console.log(`  factory:   ${FACTORY_ID}`);
  console.log(`  label:     ${LABEL}`);
  console.log(`  symbol:    ${SYMBOL}`);
  console.log(`  threshold: ${THRESHOLD} (${Number(THRESHOLD) / 1e14} USD)`);
  console.log(`  breach:    ${BREACH}s`);
  console.log(`  expiry:    ${new Date(EXPIRY * 1000).toISOString()}`);

  const contract = new Contract(FACTORY_ID);

  // create_market args (anchor_id is optional → omit to pass None)
  const callArgs: xdr.ScVal[] = [
    nativeToScVal(LABEL,       { type: 'string' }),
    nativeToScVal(COLLATERAL,  { type: 'address' }),
    nativeToScVal(SYMBOL,      { type: 'symbol' }),
    nativeToScVal(ORACLE,      { type: 'address' }),
    nativeToScVal(THRESHOLD,   { type: 'i128' }),
    nativeToScVal(BigInt(BREACH),   { type: 'u64' }),
    nativeToScVal(BigInt(EXPIRY),   { type: 'u64' }),
    // anchor_id: Option<Address> → pass void for None
    xdr.ScVal.scvVoid(),
  ];

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(contract.call('create_market', ...callArgs))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed: ${sim.error}`);
  }

  const prepared = assembleTransaction(tx, sim).build();
  prepared.sign(keypair);

  const send = await server.sendTransaction(prepared);
  if (send.status !== 'PENDING') throw new Error(`Send failed: ${send.status}`);

  console.log(`Submitted: ${send.hash}`);

  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const result = await server.getTransaction(send.hash);
    if (result.status === 'SUCCESS') {
      const marketId = scValToNative(result.returnValue!);
      console.log(`\nMarket created! market_id = ${marketId}`);
      console.log('Add this market to watcher/src/config.ts MARKETS array.');
      return;
    }
    if (result.status === 'FAILED') throw new Error(`Transaction failed: ${send.hash}`);
  }
  throw new Error(`Timeout waiting for transaction: ${send.hash}`);
}

main().catch((err) => { console.error(err.message); process.exit(1); });
