"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/hooks";
import {
  listMarkets,
  getMarket,
  getMarketState,
  type MarketConfig,
  formatExpiry,
} from "@/lib/contracts";
import MarketDetail from "./components/MarketDetail";
import AcrDashboard from "./components/AcrDashboard";
import StatsPage from "./components/StatsPage";

type Tab = "markets" | "acr" | "stats";

export default function Home() {
  const wallet = useWallet();
  const [tab, setTab] = useState<Tab>("markets");
  const [markets, setMarkets] = useState<MarketConfig[]>([]);
  const [marketStates, setMarketStates] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<MarketConfig | null>(null);

  useEffect(() => {
    loadMarkets();
  }, []);

  async function loadMarkets() {
    setLoading(true);
    setError(null);
    try {
      const ids = await listMarkets();
      const configs = await Promise.all(ids.map(getMarket));
      setMarkets(configs);

      // Load states in parallel
      const states = await Promise.all(
        configs.map((m) =>
          getMarketState(m.market_contract).catch(() => "Unknown")
        )
      );
      const stateMap: Record<number, string> = {};
      configs.forEach((m, i) => {
        stateMap[m.market_id] = states[i];
      });
      setMarketStates(stateMap);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load markets");
    } finally {
      setLoading(false);
    }
  }

  if (selectedMarket) {
    return (
      <MarketDetail
        market={selectedMarket}
        wallet={wallet}
        onBack={() => setSelectedMarket(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-mono">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <span className="text-lg font-bold">AnchorShield</span>
          <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
            testnet
          </span>
        </div>

        <div className="flex items-center gap-3">
          {wallet.networkPassphrase && (
            <span className="text-xs text-gray-400">
              {wallet.networkPassphrase.includes("Test") ? "Testnet" : "Mainnet"}
            </span>
          )}
          {wallet.publicKey ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-green-700 bg-green-100 px-3 py-1 rounded">
                ✓ {wallet.shortKey}
              </span>
              <button
                onClick={wallet.disconnect}
                className="text-xs text-gray-500 hover:text-gray-800"
              >
                disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={wallet.connect}
              disabled={wallet.isConnecting}
              className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {wallet.isConnecting ? "connecting..." : "Connect Freighter"}
            </button>
          )}
        </div>
      </header>

      {/* Wallet error */}
      {wallet.error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
          {wallet.error}
        </div>
      )}

      {/* Tabs */}
      <div className="px-6 pt-6">
        <div className="flex gap-4 border-b border-gray-200 mb-6">
          {(["markets", "acr", "stats"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              {t === "markets" ? "Insurance Markets" : t === "acr" ? "Anchor ACR Scores" : "Protocol Stats"}
            </button>
          ))}
          <button
            onClick={loadMarkets}
            className="ml-auto text-xs text-gray-400 hover:text-gray-600 pb-2"
          >
            ↺ refresh
          </button>
        </div>

        {tab === "markets" && (
          <div>
            {loading && (
              <p className="text-gray-500 text-sm">Loading markets...</p>
            )}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
                {error}
              </div>
            )}
            {!loading && !error && markets.length === 0 && (
              <p className="text-gray-500 text-sm">No markets found.</p>
            )}
            <div className="grid gap-4">
              {markets.map((m) => (
                <MarketRow
                  key={m.market_id}
                  market={m}
                  state={marketStates[m.market_id] ?? "..."}
                  onClick={() => setSelectedMarket(m)}
                />
              ))}
            </div>
          </div>
        )}

        {tab === "acr" && <AcrDashboard />}

        {tab === "stats" && <StatsPage />}
      </div>
    </div>
  );
}

function stateColor(state: string) {
  if (state === "Open") return "bg-green-100 text-green-800";
  if (state === "Settled") return "bg-red-100 text-red-800";
  if (state === "Expired") return "bg-gray-100 text-gray-600";
  return "bg-yellow-100 text-yellow-700";
}

function MarketRow({
  market,
  state,
  onClick,
}: {
  market: MarketConfig;
  state: string;
  onClick: () => void;
}) {
  return (
    <div
      className="bg-white border border-gray-200 rounded p-4 cursor-pointer hover:border-blue-400 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <span className="text-sm font-semibold">{market.label}</span>
          <div className="mt-1 text-xs text-gray-400 space-x-3">
            <span>id: {market.market_id}</span>
            <span>expires: {formatExpiry(market.expiry_timestamp)}</span>
            <span className="truncate">
              contract: {market.market_contract.slice(0, 8)}...
            </span>
          </div>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded font-medium ${stateColor(state)}`}
        >
          {state}
        </span>
      </div>
    </div>
  );
}
