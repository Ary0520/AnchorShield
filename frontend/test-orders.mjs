import { Contract, TransactionBuilder, Account, rpc, BASE_FEE, Networks, nativeToScVal, scValToNative } from "@stellar/stellar-sdk";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync("c:/Users/aryan/Desktop/WEB3 PROJECTS/canary on stellar/anchorshield/frontend/.env.local", "utf8")
    .split("\n").filter(l => l.includes("=")).map(l => l.split("=").map(s => s.trim()))
);

const FACTORY = env["NEXT_PUBLIC_MARKET_FACTORY_ID"] || env["NEXT_PUBLIC_FACTORY_ID"];
const RPC = "https://soroban-testnet.stellar.org";
const SIM = "GD6KRXUKOAPTYW72IZOERCPGM3UHXTQDJK4RS5WUAZHC4K2WOONQA3ZR";

const server = new rpc.Server(RPC, { allowHttp: false });

async function query(contractId, method, args = []) {
  const source = new Account(SIM, "0");
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30).build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  return scValToNative(sim.result.retval);
}

console.log("Checking market 0 orders...\n");
const market = await query(FACTORY, "get_market", [nativeToScVal(0, { type: "u32" })]);
console.log("Market 0 contract:", market.market_contract);

const orders = await query(market.market_contract, "get_orders");
const entries = orders instanceof Map ? [...orders.entries()] : Object.entries(orders);
console.log(`\nOpen orders (${entries.length} total):`);
for (const [id, o] of entries) {
  const stroopsToUsdc = (s) => (Number(s) / 10_000_000).toFixed(2);
  console.log(`  Order ${id}: ${o.is_buy ? "BUY" : "SELL"} | price=${o.price_bps} bps | amount=${stroopsToUsdc(o.amount)} USDC | filled=${stroopsToUsdc(o.filled)} | owner=${String(o.owner).slice(0,8)}...`);
}
