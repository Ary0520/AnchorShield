"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getMarketState,
  getBalances,
  getTotalCollateral,
  getOrders,
  mintCompleteSet,
  placeOrder,
  cancelOrder,
  fillOrders,
  trySettle,
  claim,
  formatUsdc,
  formatExpiry,
  type MarketConfig,
  type Order,
} from "@/lib/contracts";
import type { WalletState } from "@/hooks";

interface Props {
  market: MarketConfig;
  wallet: WalletState & {
    shortKey: string | null;
    connect: () => Promise<void>;
    disconnect: () => void;
  };
  onBack: () => void;
}

export default function MarketDetail({ market, wallet, onBack }: Props) {
  const [state, setState] = useState("...");
  const [balances, setBalances] = useState({ yes: 0n, no: 0n });
  const [totalCollateral, setTotalCollateral] = useState(0n);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  // Form state
  const [mintAmount, setMintAmount] = useState("");
  const [orderIsBuy, setOrderIsBuy] = useState(true);
  const [orderPrice, setOrderPrice] = useState("");
  const [orderAmount, setOrderAmount] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [s, col, ords] = await Promise.all([
        getMarketState(market.market_contract),
        getTotalCollateral(market.market_contract),
        getOrders(market.market_contract),
      ]);
      setState(s);
      setTotalCollateral(col);
      setOrders(ords);

      if (wallet.publicKey) {
        const b = await getBalances(market.market_contract, wallet.publicKey);
        setBalances(b);
      }
    } catch (e: unknown) {
      setTxError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [market.market_contract, wallet.publicKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function runTx(fn: () => Promise<string>, label: string) {
    if (!wallet.publicKey) {
      setTxError("Connect wallet first");
      return;
    }
    setTxStatus(`Sending ${label}...`);
    setTxError(null);
    try {
      const hash = await fn();
      setTxStatus(`✓ ${label} confirmed — tx: ${hash.slice(0, 12)}...`);
      await refresh();
    } catch (e: unknown) {
      setTxError(e instanceof Error ? e.message : `${label} failed`);
      setTxStatus(null);
    }
  }

  const handleMint = async () => {
    if (!wallet.publicKey) { setTxError("Connect wallet first"); return; }
    const stroops = BigInt(Math.round(parseFloat(mintAmount) * 10_000_000));
    runTx(
      () => mintCompleteSet(wallet.publicKey!, market.market_contract, stroops),
      "mint_complete_set"
    );
  };

  const handlePlaceOrder = async () => {
    if (!wallet.publicKey) { setTxError("Connect wallet first"); return; }
    const priceBps = parseInt(orderPrice);
    const stroops = BigInt(Math.round(parseFloat(orderAmount) * 10_000_000));
    runTx(
      () => placeOrder(wallet.publicKey!, market.market_contract, orderIsBuy, priceBps, stroops),
      "place_order"
    );
  };

  const handleCancelOrder = (orderId: bigint) => {
    runTx(
      () => cancelOrder(wallet.publicKey!, market.market_contract, orderId),
      "cancel_order"
    );
  };

  const handleFillOrders = () => {
    runTx(
      () => fillOrders(wallet.publicKey!, market.market_contract),
      "fill_orders"
    );
  };

  const handleTrySettle = () => {
    runTx(
      () => trySettle(wallet.publicKey!, market.market_contract),
      "try_settle"
    );
  };

  const handleClaim = () => {
    runTx(
      () => claim(wallet.publicKey!, market.market_contract),
      "claim"
    );
  };

  const isSettled = state === "Settled" || state === "Expired";

  return (
    <div className="min-h-screen bg-gray-50 font-mono">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <button
          onClick={onBack}
          className="text-sm text-gray-500 hover:text-gray-800"
        >
          ← back
        </button>
        <span className="font-bold">{market.label}</span>
        <span
          className={`text-xs px-2 py-0.5 rounded font-medium ${
            state === "Open"
              ? "bg-green-100 text-green-800"
              : state === "Settled"
              ? "bg-red-100 text-red-800"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {state}
        </span>
        <span className="ml-auto text-xs text-gray-400">
          {wallet.shortKey ? `wallet: ${wallet.shortKey}` : "not connected"}
        </span>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* Status messages */}
        {txStatus && (
          <div className="p-3 bg-blue-50 border border-blue-200 text-blue-700 text-sm rounded">
            {txStatus}
          </div>
        )}
        {txError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded break-all">
            ✗ {txError}
          </div>
        )}

        {/* Market info */}
        <section className="bg-white border border-gray-200 rounded p-4">
          <h2 className="text-sm font-semibold mb-3">Market Info</h2>
          {loading ? (
            <p className="text-xs text-gray-400">Loading...</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div>
                <span className="text-gray-400">contract: </span>
                {market.market_contract.slice(0, 16)}...
              </div>
              <div>
                <span className="text-gray-400">expires: </span>
                {formatExpiry(market.expiry_timestamp)}
              </div>
              <div>
                <span className="text-gray-400">total collateral: </span>
                {formatUsdc(totalCollateral)} USDC
              </div>
              <div>
                <span className="text-gray-400">state: </span>
                {state}
              </div>
              {wallet.publicKey && (
                <>
                  <div>
                    <span className="text-gray-400">your YES: </span>
                    {formatUsdc(balances.yes)}
                  </div>
                  <div>
                    <span className="text-gray-400">your NO: </span>
                    {formatUsdc(balances.no)}
                  </div>
                </>
              )}
            </div>
          )}
        </section>

        {/* Actions (only when market Open) */}
        {!isSettled && (
          <>
            {/* Mint complete set */}
            <section className="bg-white border border-gray-200 rounded p-4">
              <h2 className="text-sm font-semibold mb-1">
                Mint Complete Set (Underwrite)
              </h2>
              <p className="text-xs text-gray-400 mb-3">
                Deposit USDC → receive equal YES + NO tokens. Then sell YES to
                collect premium.
              </p>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="USDC amount (e.g. 10)"
                  value={mintAmount}
                  onChange={(e) => setMintAmount(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-2 text-sm flex-1"
                />
                <button
                  onClick={handleMint}
                  disabled={!mintAmount || !wallet.publicKey}
                  className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-40"
                >
                  Mint
                </button>
              </div>
            </section>

            {/* Place order */}
            <section className="bg-white border border-gray-200 rounded p-4">
              <h2 className="text-sm font-semibold mb-1">Place Order</h2>
              <p className="text-xs text-gray-400 mb-3">
                Buy YES = buy insurance cover (pay USDC). Sell YES = collect
                premium as underwriter (locks YES tokens).
              </p>
              <div className="flex gap-2 flex-wrap">
                <select
                  value={orderIsBuy ? "buy" : "sell"}
                  onChange={(e) => setOrderIsBuy(e.target.value === "buy")}
                  className="border border-gray-300 rounded px-3 py-2 text-sm"
                >
                  <option value="buy">Buy YES (buy cover)</option>
                  <option value="sell">Sell YES (collect premium)</option>
                </select>
                <input
                  type="number"
                  placeholder="Price in bps (e.g. 150 = 1.5%)"
                  value={orderPrice}
                  onChange={(e) => setOrderPrice(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-2 text-sm w-52"
                />
                <input
                  type="number"
                  placeholder="Amount USDC (e.g. 5)"
                  value={orderAmount}
                  onChange={(e) => setOrderAmount(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-2 text-sm w-44"
                />
                <button
                  onClick={handlePlaceOrder}
                  disabled={!orderPrice || !orderAmount || !wallet.publicKey}
                  className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-40"
                >
                  Place
                </button>
              </div>
            </section>

            {/* Order book */}
            <section className="bg-white border border-gray-200 rounded p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">Open Orders</h2>
                <button
                  onClick={handleFillOrders}
                  disabled={!wallet.publicKey}
                  className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded disabled:opacity-40"
                >
                  Fill Orders (match)
                </button>
              </div>
              {orders.length === 0 ? (
                <p className="text-xs text-gray-400">No open orders.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400 text-left border-b border-gray-100">
                      <th className="pb-1">id</th>
                      <th className="pb-1">side</th>
                      <th className="pb-1">price bps</th>
                      <th className="pb-1">amount</th>
                      <th className="pb-1">filled</th>
                      <th className="pb-1">owner</th>
                      <th className="pb-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr
                        key={String(o.order_id)}
                        className="border-b border-gray-50"
                      >
                        <td className="py-1">{String(o.order_id)}</td>
                        <td
                          className={`py-1 font-medium ${
                            o.is_buy ? "text-green-700" : "text-red-700"
                          }`}
                        >
                          {o.is_buy ? "BUY" : "SELL"}
                        </td>
                        <td className="py-1">{String(o.price_bps)}</td>
                        <td className="py-1">{formatUsdc(o.amount)}</td>
                        <td className="py-1">{formatUsdc(o.filled)}</td>
                        <td className="py-1">
                          {String(o.owner).slice(0, 8)}...
                        </td>
                        <td className="py-1">
                          {wallet.publicKey &&
                            String(o.owner) === wallet.publicKey && (
                              <button
                                onClick={() => handleCancelOrder(o.order_id)}
                                className="text-red-500 hover:text-red-700"
                              >
                                cancel
                              </button>
                            )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            {/* Try settle */}
            <section className="bg-white border border-gray-200 rounded p-4">
              <h2 className="text-sm font-semibold mb-1">Settlement</h2>
              <p className="text-xs text-gray-400 mb-3">
                Reads oracle price and checks breach condition. If market is
                past expiry with no breach, settles NO wins. Anyone can call
                this.
              </p>
              <button
                onClick={handleTrySettle}
                disabled={!wallet.publicKey}
                className="bg-yellow-500 text-white text-sm px-4 py-2 rounded hover:bg-yellow-600 disabled:opacity-40"
              >
                Try Settle
              </button>
            </section>
          </>
        )}

        {/* Claim (after settlement) */}
        {isSettled && (
          <section className="bg-white border border-gray-200 rounded p-4">
            <h2 className="text-sm font-semibold mb-1">Claim Winnings</h2>
            <p className="text-xs text-gray-400 mb-3">
              {state === "Settled"
                ? "YES wins (depeg confirmed). YES holders claim $1 USDC per token."
                : "NO wins (no depeg). NO holders claim $1 USDC per token."}
            </p>
            {wallet.publicKey && (
              <p className="text-xs text-gray-600 mb-3">
                Your{" "}
                {state === "Settled"
                  ? `YES: ${formatUsdc(balances.yes)} USDC`
                  : `NO: ${formatUsdc(balances.no)} USDC`}
              </p>
            )}
            <button
              onClick={handleClaim}
              disabled={!wallet.publicKey}
              className="bg-green-600 text-white text-sm px-4 py-2 rounded hover:bg-green-700 disabled:opacity-40"
            >
              Claim
            </button>
          </section>
        )}

        <button
          onClick={refresh}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          ↺ refresh data
        </button>
      </div>
    </div>
  );
}
