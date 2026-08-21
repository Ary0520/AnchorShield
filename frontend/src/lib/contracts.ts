/**
 * contracts.ts
 * Wrappers for every AnchorShield contract call.
 *
 * Read-only calls: simulate only (no signing needed).
 * Write calls: build XDR → Freighter signs → submit.
 */

import {
  Contract,
  TransactionBuilder,
  Account,
  rpc as SorobanRpc,
  BASE_FEE,
  nativeToScVal,
  scValToNative,
  xdr,
  Networks,
  Address,
} from "@stellar/stellar-sdk";
import { signTransaction } from "@stellar/freighter-api";

// ── Network config ─────────────────────────────────────────────────────────

export const NETWORK_PASSPHRASE = Networks.TESTNET;
export const RPC_URL =
  process.env.NEXT_PUBLIC_STELLAR_RPC_URL ||
  "https://soroban-testnet.stellar.org";

export const FACTORY_ID = process.env.NEXT_PUBLIC_MARKET_FACTORY_ID!;
export const ANCHOR_STAKE_ID = process.env.NEXT_PUBLIC_ANCHOR_STAKE_ID!;

export const server = new SorobanRpc.Server(RPC_URL, { allowHttp: false });

// Placeholder public key used for read-only simulations.
// The RPC only needs a valid-format source account to build the envelope —
// it does NOT need to be funded or exist on-chain for simulate calls.
const SIM_SOURCE = "GD6KRXUKOAPTYW72IZOERCPGM3UHXTQDJK4RS5WUAZHC4K2WOONQA3ZR";

// ── Types mirroring contract storage structs ───────────────────────────────

export interface MarketConfig {
  market_id: number;
  label: string;
  collateral_token: string;
  covered_asset: unknown;
  oracle_contract: string;
  depeg_threshold: bigint;
  breach_duration_seconds: bigint;
  expiry_timestamp: bigint;
  anchor_id: string | null;
  market_contract: string;
}

export interface Order {
  order_id: bigint;
  owner: string;
  is_buy: boolean;
  price_bps: bigint;
  amount: bigint;
  filled: bigint;
}

// ── Internal helpers ───────────────────────────────────────────────────────

/**
 * Simulates a read-only contract call and returns the native JS value.
 * Uses a zero-sequence Account — no network fetch needed.
 */
async function queryContract(
  contractId: string,
  method: string,
  args: xdr.ScVal[] = []
): Promise<unknown> {
  const source = new Account(SIM_SOURCE, "0");
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation error [${method}]: ${sim.error}`);
  }

  const successSim = sim as SorobanRpc.Api.SimulateTransactionSuccessResponse;
  if (!successSim.result) return null;
  return scValToNative(successSim.result.retval);
}

/**
 * Builds a transaction, simulates it (to get the resource footprint),
 * assembles it, then hands the XDR to Freighter for signing and submits.
 */
export async function invokeContract(
  publicKey: string,
  contractId: string,
  method: string,
  args: xdr.ScVal[] = []
): Promise<string> {
  const account = await server.getAccount(publicKey);
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(300) // 5 minutes — enough time for user to approve in Freighter
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation error [${method}]: ${sim.error}`);
  }

  const prepared = SorobanRpc.assembleTransaction(tx, sim).build();
  const { signedTxXdr, error } = await signTransaction(prepared.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
    address: publicKey,
  });

  if (error) throw new Error(`Freighter signing error: ${error}`);

  let signedTx;
  try {
    signedTx = TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE);
  } catch (parseErr) {
    throw new Error(`XDR parse failed: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
  }

  let result;
  try {
    result = await server.sendTransaction(signedTx);
  } catch (sendErr) {
    throw new Error(`sendTransaction failed: ${sendErr instanceof Error ? sendErr.message : String(sendErr)}`);
  }

  if (result.status === "ERROR") {
    throw new Error(`Send error: ${JSON.stringify(result.errorResult)}`);
  }

  // Poll via raw JSON-RPC to avoid stellar-sdk v13 XDR parsing bug on getTransaction
  const hash = result.hash;
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const pollRes = await fetch(RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTransaction",
          params: { hash },
        }),
      });
      const pollJson = await pollRes.json() as { result?: { status: string } };
      const status = pollJson.result?.status;
      if (status === "SUCCESS") return hash;
      if (status === "FAILED") throw new Error(`Transaction failed: ${hash}`);
    } catch (pollErr) {
      if (pollErr instanceof Error && pollErr.message.startsWith("Transaction failed")) {
        throw pollErr;
      }
    }
  }
  throw new Error(`Transaction timeout: ${hash}`);
}

// ── Market Factory reads ───────────────────────────────────────────────────

export async function listMarkets(): Promise<number[]> {
  const result = await queryContract(FACTORY_ID, "list_markets");
  if (!Array.isArray(result)) return [];
  return result.map(Number);
}

export async function getMarket(marketId: number): Promise<MarketConfig> {
  const result = await queryContract(FACTORY_ID, "get_market", [
    nativeToScVal(marketId, { type: "u32" }),
  ]);
  return result as MarketConfig;
}

// ── Insurance Market reads ─────────────────────────────────────────────────

export async function getMarketState(marketContract: string): Promise<string> {
  const result = await queryContract(marketContract, "get_state");
  // scValToNative on a Soroban contracttype enum (scvVec) returns ["Expired"], ["Open"], etc.
  if (Array.isArray(result) && result.length > 0) return String(result[0]);
  if (typeof result === "string") return result;
  if (result && typeof result === "object") {
    const key = Object.keys(result as object)[0];
    return key ?? String(result);
  }
  const map: Record<number, string> = { 0: "Open", 1: "Settled", 2: "Expired" };
  return map[Number(result)] ?? String(result);
}

export async function getBalances(
  marketContract: string,
  holder: string
): Promise<{ yes: bigint; no: bigint }> {
  const result = await queryContract(marketContract, "get_balances", [
    nativeToScVal(Address.fromString(holder), { type: "address" }),
  ]);
  if (Array.isArray(result) && result.length === 2) {
    return { yes: BigInt(result[0]), no: BigInt(result[1]) };
  }
  return { yes: 0n, no: 0n };
}

export async function getTotalCollateral(marketContract: string): Promise<bigint> {
  const result = await queryContract(marketContract, "get_total_collateral");
  return BigInt(result as string | number);
}

export async function getOrders(marketContract: string): Promise<Order[]> {
  const result = await queryContract(marketContract, "get_orders");
  if (!result || typeof result !== "object") return [];
  const entries =
    result instanceof Map
      ? Array.from((result as Map<unknown, unknown>).values())
      : Object.values(result as object);
  return entries as Order[];
}

// ── Insurance Market writes ────────────────────────────────────────────────

/** Approve the market contract to spend USDC on behalf of the user. 
 *  Must be called before mint_complete_set.
 *  amount: the exact amount to approve in stroops.
 *  expiration_ledger: how long the approval is valid (current ledger + ~1000 is fine for testing).
 */
export async function approveUsdc(
  publicKey: string,
  spenderContract: string,
  amountStroops: bigint,
  collateralToken: string
): Promise<string> {
  // Get current ledger to set expiration
  const ledger = await server.getLatestLedger();
  const expirationLedger = ledger.sequence + 1000;

  return invokeContract(publicKey, collateralToken, "approve", [
    nativeToScVal(Address.fromString(publicKey), { type: "address" }),   // from
    nativeToScVal(Address.fromString(spenderContract), { type: "address" }), // spender
    nativeToScVal(amountStroops, { type: "i128" }),                      // amount
    nativeToScVal(expirationLedger, { type: "u32" }),                    // expiration_ledger
  ]);
}

/** Mint a complete set. amount = USDC in stroops (7 decimals: 1 USDC = 10_000_000). */
export async function mintCompleteSet(
  publicKey: string,
  marketContract: string,
  amountStroops: bigint
): Promise<string> {
  return invokeContract(publicKey, marketContract, "mint_complete_set", [
    nativeToScVal(Address.fromString(publicKey), { type: "address" }),
    nativeToScVal(amountStroops, { type: "i128" }),
  ]);
}

/** Place a limit order. price_bps 1–9999. amount in USDC stroops. */
export async function placeOrder(
  publicKey: string,
  marketContract: string,
  isBuy: boolean,
  priceBps: number,
  amountStroops: bigint
): Promise<string> {
  return invokeContract(publicKey, marketContract, "place_order", [
    nativeToScVal(Address.fromString(publicKey), { type: "address" }),
    xdr.ScVal.scvBool(isBuy),
    nativeToScVal(priceBps, { type: "i64" }),
    nativeToScVal(amountStroops, { type: "i128" }),
  ]);
}

/** Cancel an order by id. */
export async function cancelOrder(
  publicKey: string,
  marketContract: string,
  orderId: bigint
): Promise<string> {
  return invokeContract(publicKey, marketContract, "cancel_order", [
    nativeToScVal(Address.fromString(publicKey), { type: "address" }),
    nativeToScVal(orderId, { type: "u64" }),
  ]);
}

/** Match orders — anyone can call. */
export async function fillOrders(
  publicKey: string,
  marketContract: string,
  maxFills = 10
): Promise<string> {
  return invokeContract(publicKey, marketContract, "fill_orders", [
    nativeToScVal(Address.fromString(publicKey), { type: "address" }),
    nativeToScVal(maxFills, { type: "u32" }),
  ]);
}

/** Attempt settlement — permissionless. */
export async function trySettle(
  publicKey: string,
  marketContract: string
): Promise<string> {
  return invokeContract(publicKey, marketContract, "try_settle", []);
}

/** Claim winnings after settlement. */
export async function claim(
  publicKey: string,
  marketContract: string
): Promise<string> {
  return invokeContract(publicKey, marketContract, "claim", [
    nativeToScVal(Address.fromString(publicKey), { type: "address" }),
  ]);
}

// ── Anchor Stake reads ─────────────────────────────────────────────────────

export async function getAllAcr(): Promise<
  Array<{ anchor: string; acr: bigint }>
> {
  const result = await queryContract(ANCHOR_STAKE_ID, "get_all_acr");
  if (!Array.isArray(result)) return [];
  return result.map((item: unknown) => {
    const pair = item as [string, unknown];
    return { anchor: pair[0], acr: BigInt(pair[1] as string | number) };
  });
}

export interface AnchorMetrics {
  success_rate_bps: number;
  avg_latency_seconds: number;
  failed_withdrawals: number;
  oracle_uptime_bps: number;
  historical_payouts: bigint;
}

export async function getAllMetrics(): Promise<
  Array<{ anchor: string; metrics: AnchorMetrics; acr: bigint }>
> {
  const result = await queryContract(ANCHOR_STAKE_ID, "get_all_metrics");
  if (!Array.isArray(result)) return [];
  return result.map((item: unknown) => {
    const tuple = item as [string, Record<string, unknown>, unknown];
    const rawMetrics = tuple[1];
    return {
      anchor: tuple[0],
      metrics: {
        success_rate_bps: Number(rawMetrics.success_rate_bps),
        avg_latency_seconds: Number(rawMetrics.avg_latency_seconds),
        failed_withdrawals: Number(rawMetrics.failed_withdrawals),
        oracle_uptime_bps: Number(rawMetrics.oracle_uptime_bps),
        historical_payouts: BigInt(rawMetrics.historical_payouts as string | number),
      },
      acr: BigInt(tuple[2] as string | number),
    };
  });
}

export async function getAcr(anchorAddress: string): Promise<bigint> {
  const result = await queryContract(ANCHOR_STAKE_ID, "get_acr", [
    nativeToScVal(Address.fromString(anchorAddress), { type: "address" }),
  ]);
  return BigInt(result as string | number);
}

// ── Formatting helpers ─────────────────────────────────────────────────────

/** USDC stroops (7 decimals) → human readable. */
export function formatUsdc(stroops: bigint): string {
  const whole = stroops / 10_000_000n;
  const frac = (stroops % 10_000_000n).toString().padStart(7, "0");
  return `${whole}.${frac.slice(0, 2)}`;
}

/** ACR basis points (10_000 = 1.00x) → display string. */
export function formatAcr(bps: bigint): string {
  const whole = bps / 10_000n;
  const frac = (bps % 10_000n).toString().padStart(4, "0").slice(0, 2);
  return `${whole}.${frac}x`;
}

/** Unix timestamp → readable date. */
export function formatExpiry(ts: bigint): string {
  return new Date(Number(ts) * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
