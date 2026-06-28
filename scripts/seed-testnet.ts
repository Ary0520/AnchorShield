#!/usr/bin/env ts-node
/**
 * seed-testnet.ts — seeds the testnet with demo data for development/testing.
 *
 * Creates:
 *   - 2 test user accounts (Alice and Bob), funded via Friendbot
 *   - USDC depeg market (short 5-minute expiry for fast testing)
 *   - Alice underwrites 10 USDC and places a sell-YES order at 200bps
 *   - Bob places a buy-YES order at 200bps (immediately fills)
 *
 * Requires:
 *   MARKET_FACTORY_CONTRACT and ANCHOR_STAKE_CONTRACT in .env
 *   The factory must have been deployed with a USDC collateral market configured.
 *
 * Usage:
 *   cd scripts
 *   MARKET_FACTORY_CONTRACT=C... ANCHOR_STAKE_CONTRACT=C... ts-node seed-testnet.ts
 */

import {
  Contract,
  Keypair,
  Networks,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  scValToNative,
  StellarToml,
} from '@stellar/stellar-sdk';
import { Server, Api, assembleTransaction } from '@stellar/stellar-sdk/rpc';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const RPC_URL    = process.env.STELLAR_RPC_URL    ?? 'https://soroban-testnet.stellar.org';
const HORIZON_URL = process.env.HORIZON_URL        ?? 'https://horizon-testnet.stellar.org';
const PASSPHRASE = process.env.NETWORK_PASSPHRASE ?? 'Test SDF Network ; September 2015';
const FACTORY_ID = process.env.MARKET_FACTORY_CONTRACT ?? '';
const USDC_SAC   = process.env.USDC_SAC ?? 'CCW67TSZV3SSS2HXMBQ5JFGCKJNFESNU4W4III5JEHE74XX53P6BYOS';

if (!FACTORY_ID) throw new Error('MARKET_FACTORY_CONTRACT not set');

const server = new Server(RPC_URL);

async function fundAccount(keypair: Keypair): Promise<void> {
  console.log(`  Funding ${keypair.publicKey()} via Friendbot...`);
  await axios.get(`https://friendbot.stellar.org?addr=${keypair.publicKey()}`);
  await new Promise((r) => setTimeout(r, 3000)); // wait for ledger close
}

async function invoke(
  keypair: Keypair,
  contractId: string,
  method: string,
  args: import('@stellar/stellar-sdk').xdr.ScVal[],
): Promise<unknown> {
  const account = await server.getAccount(keypair.publicKey());
  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: PASSPHRASE })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (Api.isSimulationError(sim)) throw new Error(`Sim failed: ${sim.error}`);

  const prepared = assembleTransaction(tx, sim).build();
  prepared.sign(keypair);
  const send = await server.sendTransaction(prepared);
  if (send.status !== 'PENDING') throw new Error(`Send failed: ${send.status}`);

  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const result = await server.getTransaction(send.hash);
    if (result.status === 'SUCCESS') return result.returnValue ? scValToNative(result.returnValue) : null;
    if (result.status === 'FAILED') throw new Error(`Failed: ${send.hash}`);
  }
  throw new Error(`Timeout: ${send.hash}`);
}

async function main() {
  console.log('AnchorShield testnet seeder\n');

  // Step 1: create test accounts
  const alice = Keypair.random();
  const bob   = Keypair.random();
  console.log(`Alice: ${alice.publicKey()}`);
  console.log(`Bob:   ${bob.publicKey()}`);

  await fundAccount(alice);
  await fundAccount(bob);
  console.log('Accounts funded\n');

  // Step 2: read markets from factory
  const ids = await invoke(alice, FACTORY_ID, 'list_markets', []) as number[];
  if (!ids || ids.length === 0) {
    console.log('No markets deployed yet — run deploy-testnet.sh with TESTNET_REDSTONE_ORACLE set first');
    return;
  }

  const cfg = await invoke(alice, FACTORY_ID, 'get_market', [
    nativeToScVal(ids[0], { type: 'u32' }),
  ]) as { market_contract: string };

  const MARKET_ID = cfg.market_contract;
  console.log(`Using market: ${MARKET_ID} (market_id=${ids[0]})\n`);

  // Step 3: Alice underwrites 10 USDC
  // Alice needs to approve the market contract to pull USDC first
  // (USDC SAC approve, then mint_complete_set)
  const TEN_USDC = BigInt(100_000_000); // 10 USDC at 7 decimals
  console.log('Alice: minting complete set (10 USDC)...');
  await invoke(alice, MARKET_ID, 'mint_complete_set', [
    nativeToScVal(alice.publicKey(), { type: 'address' }),
    nativeToScVal(TEN_USDC, { type: 'i128' }),
  ]);
  console.log('Alice: minted 10 YES + 10 NO\n');

  // Step 4: Alice places sell-YES order at 200bps (2% premium)
  console.log('Alice: placing sell-YES order at 200bps...');
  const sellOrderId = await invoke(alice, MARKET_ID, 'place_order', [
    nativeToScVal(alice.publicKey(), { type: 'address' }),
    nativeToScVal(false, { type: 'bool' }),        // is_buy = false
    nativeToScVal(200, { type: 'i64' }),            // price_bps
    nativeToScVal(TEN_USDC, { type: 'i128' }),      // amount
  ]);
  console.log(`Alice: sell order placed (id=${sellOrderId})\n`);

  // Step 5: Bob places buy-YES order at 200bps (will match Alice)
  console.log('Bob: placing buy-YES order at 200bps...');
  await invoke(bob, MARKET_ID, 'place_order', [
    nativeToScVal(bob.publicKey(), { type: 'address' }),
    nativeToScVal(true, { type: 'bool' }),          // is_buy = true
    nativeToScVal(200, { type: 'i64' }),
    nativeToScVal(TEN_USDC, { type: 'i128' }),
  ]);
  console.log('Bob: buy order placed\n');

  // Step 6: fill orders
  console.log('Filling orders...');
  await invoke(alice, MARKET_ID, 'fill_orders', [
    nativeToScVal(alice.publicKey(), { type: 'address' }),
    nativeToScVal(10, { type: 'u32' }),
  ]);
  console.log('Orders filled — Bob now holds YES tokens\n');

  console.log('Seed complete!');
  console.log(`  Alice (underwriter): ${alice.publicKey()}`);
  console.log(`  Bob (cover buyer):   ${bob.publicKey()}`);
  console.log(`  Market contract:     ${MARKET_ID}`);
  console.log('\nSave these keys if you need to interact with the accounts further.');
}

main().catch((err) => { console.error(err.message); process.exit(1); });
