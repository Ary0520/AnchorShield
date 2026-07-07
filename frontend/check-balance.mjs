import { Contract, TransactionBuilder, Account, rpc, BASE_FEE, Networks, nativeToScVal, scValToNative, Address } from "@stellar/stellar-sdk";

const USDC = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";
const RPC  = "https://soroban-testnet.stellar.org";
const SIM  = "GD6KRXUKOAPTYW72IZOERCPGM3UHXTQDJK4RS5WUAZHC4K2WOONQA3ZR";

// Pass wallet address as argument
const wallet = process.argv[2];
if (!wallet) { console.error("Usage: node check-balance.mjs <STELLAR_ADDRESS>"); process.exit(1); }

const server = new rpc.Server(RPC, { allowHttp: false });
const source = new Account(SIM, "0");

const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
  .addOperation(new Contract(USDC).call("balance", nativeToScVal(Address.fromString(wallet), { type: "address" })))
  .setTimeout(30).build();

const sim = await server.simulateTransaction(tx);
if (rpc.Api.isSimulationError(sim)) { console.error("Error:", sim.error); process.exit(1); }

const raw = scValToNative(sim.result.retval);
const usdc = Number(raw) / 10_000_000;
console.log(`${wallet.slice(0,8)}...${wallet.slice(-4)}: ${usdc.toFixed(2)} USDC`);
