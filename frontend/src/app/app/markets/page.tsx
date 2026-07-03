"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  listMarkets, getMarket, getMarketState, getTotalCollateral,
  getOrders, formatUsdc, formatExpiry, type MarketConfig, type Order,
} from "@/lib/contracts";
import { ArrowRight, Shield } from "lucide-react";

const ASSET_META: Record<string, { logo: string; symbol: string; threshold: number }> = {
  USDC:  { logo: "/usdclogo.svg",  symbol: "USDC",  threshold: 0.995 },
  EURC:  { logo: "/eurclogo.svg",  symbol: "EURC",  threshold: 0.995 },
  PYUSD: { logo: "/pyusdlogo.svg", symbol: "PYUSD", threshold: 0.995 },
  MGUSD: { logo: "/mgusdlogo.jpg", symbol: "MGUSD", threshold: 0.995 },
};

function assetFromLabel(label: string): string {
  const upper = label.toUpperCase();
  for (const key of Object.keys(ASSET_META)) {
    if (upper.includes(key)) return key;
  }
  return label.split(" ")[0].toUpperCase();
}

interface EnrichedMarket {
  config: MarketConfig;
  state: string;
  collateral: bigint;
  orders: Order[];
  asset: string;
  impliedPct: number | null;
  bestAskBps: number | null;
}

export default function HedgeMarketsPage() {
  const [markets, setMarkets] = useState<EnrichedMarket[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const ids = await listMarkets();
    const configs = await Promise.all(ids.map(getMarket));
    const enriched = await Promise.all(
      configs.map(async (config) => {
        const [state, collateral, orders] = await Promise.all([
          getMarketState(config.market_contract).catch(() => "Unknown"),
          getTotalCollateral(config.market_contract).catch(() => 0n),
          getOrders(config.market_contract).catch(() => [] as Order[]),
        ]);
        const asset = assetFromLabel(config.label);
        const sellOrders = (orders as Order[]).filter((o) => !o.is_buy);
        const bestAsk = sellOrders.length
          ? sellOrders.reduce((min, o) => Math.min(min, Number(o.price_bps)), Number(sellOrders[0].price_bps))
          : null;
        return { config, state, collateral, orders: orders as Order[], asset, impliedPct: bestAsk !== null ? bestAsk / 100 : null, bestAskBps: bestAsk };
      })
    );
    setMarkets(enriched.filter((m) => m.asset !== "USDT"));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function stateStyle(state: string) {
    if (state === "Open")     return { bg: "rgba(34,197,94,0.12)",  text: "#22c55e" };
    if (state === "Settled")  return { bg: "rgba(239,68,68,0.12)",  text: "#ef4444" };
    if (state === "Expired")  return { bg: "rgba(255,255,255,0.06)", text: "rgba(255,255,255,0.4)" };
    return { bg: "rgba(245,158,11,0.12)", text: "#f59e0b" };
  }

  return (
    <div className="p-6 space-y-6" style={{ background: "#0a0a12", minHeight: "100%" }}>
      <div>
        <h1 className="text-xl font-semibold text-white">Hedge Markets</h1>
        <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
          Binary outcome contracts for stablecoin depeg events. Buy cover or underwrite.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map((i) => (
            <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.03)" }} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {markets.map((m) => {
            const meta = ASSET_META[m.asset] ?? { logo: null, symbol: m.asset, threshold: 0.995 };
            const s = stateStyle(m.state);
            return (
              <Link
                key={m.config.market_id}
                href={`/app/markets/${m.config.market_id}`}
                className="flex items-center gap-5 px-5 py-4 rounded-xl transition-all duration-150 group"
                style={{
                  background: "#0f0f1e",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,229,255,0.2)"}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"}
              >
                {meta.logo ? (
                  <img src={meta.logo} alt={meta.symbol} className="w-9 h-9 rounded-full shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ background: "rgba(255,255,255,0.08)" }}>
                    {meta.symbol[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm">{m.config.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                    Expires {formatExpiry(m.config.expiry_timestamp)} · ${formatUsdc(m.collateral)} collateral
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Implied risk</p>
                    <p className="text-sm font-medium text-white">
                      {m.impliedPct !== null ? `${m.impliedPct.toFixed(2)}%` : "—"}
                    </p>
                  </div>
                  <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase" style={{ background: s.bg, color: s.text }}>
                    {m.state}
                  </span>
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" style={{ color: "rgba(255,255,255,0.3)" }} />
                </div>
              </Link>
            );
          })}
          {markets.length === 0 && (
            <div className="text-center py-16 text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
              No markets available.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
