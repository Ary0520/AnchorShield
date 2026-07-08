import { Contract, TransactionBuilder, Account, rpc, BASE_FEE, Networks, nativeToScVal, scValToNative } from "@stellar/stellar-sdk";

const RPC = "https://soroban-testnet.stellar.org";
const SIM = "GD6KRXUKOAPTYW72IZOERCPGM3UHXTQDJK4RS5WUAZHC4K2WOONQA3ZR";
const server = new rpc.Server(RPC, { allowHttp: false });

const FACTORY      = "CDPLCH2HKDALDYNYDK22BTDNCHGB63S4WZCP7WJXYXIHKSCA3BG2B47R";
const ANCHOR_STAKE = "CDROZ7YDBYJVKUD5ZVDE627KK4D6I6WLC4BE22XBXK6GQ6VZA7PN34DD";
const USDC_SAC     = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";
const ORACLE       = "CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63";

async function query(contractId, method, args = []) {
  const source = new Account(SIM, "0");
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30).build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`SIM ERROR: ${sim.error.split('\n')[0]}`);
  return scValToNative(sim.result.retval);
}

console.log("Verifying AnchorShield testnet contracts...\n");

// 1. Market Factory — list_markets()
try {
  const ids = await query(FACTORY, "list_markets");
  console.log(`✓ Market Factory (${FACTORY.slice(0,8)}...): ${ids.length} markets → IDs: ${JSON.stringify(ids)}`);
  // Get first market label
  if (ids.length > 0) {
    const m = await query(FACTORY, "get_market", [nativeToScVal(ids[0], { type: "u32" })]);
    console.log(`  Market 0 label: "${m.label}"`);
    console.log(`  Market 0 contract: ${m.market_contract}`);
  }
} catch(e) { console.error(`✗ Market Factory: ${e.message}`); }

// 2. Anchor Stake — get_all_acr()
try {
  const acrs = await query(ANCHOR_STAKE, "get_all_acr");
  console.log(`✓ Anchor Stake (${ANCHOR_STAKE.slice(0,8)}...): ${acrs.length} anchors registered`);
  if (acrs.length > 0) {
    for (const [addr, bps] of acrs) {
      console.log(`  ${String(addr).slice(0,10)}... ACR=${(Number(bps)/10000).toFixed(2)}x`);
    }
  }
} catch(e) { console.error(`✗ Anchor Stake: ${e.message}`); }

// 3. Testnet USDC SAC — decimals()
try {
  const dec = await query(USDC_SAC, "decimals");
  console.log(`✓ USDC SAC (${USDC_SAC.slice(0,8)}...): decimals=${dec} (should be 7)`);
} catch(e) { console.error(`✗ USDC SAC: ${e.message}`); }

// 4. Reflector Oracle — lastprice(USDC)
try {
  const { xdr } = await import("@stellar/stellar-sdk");
  const assetArg = xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("Other"), xdr.ScVal.scvSymbol("USDC")]);
  const source = new Account(SIM, "0");
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(new Contract(ORACLE).call("lastprice", assetArg))
    .setTimeout(30).build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error.split('\n')[0]);
  const raw = scValToNative(sim.result.retval);
  if (raw) {
    console.log(`✓ Reflector Oracle (${ORACLE.slice(0,8)}...): USDC/USD = $${(Number(raw.price)/1e14).toFixed(6)}`);
  } else {
    console.log(`✓ Reflector Oracle (${ORACLE.slice(0,8)}...): responded but no price (null)`);
  }
} catch(e) { console.error(`✗ Reflector Oracle: ${e.message}`); }

console.log("\nAll checks done.");
