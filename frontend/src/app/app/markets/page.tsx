"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  listMarkets, getMarket, getMarketState, getTotalCollateral,
  getOrders, formatUsdc, formatExpiry, type MarketConfig, type Order,
} from "@/lib/contracts";
import { ArrowRight, Lock } from "lucide-react";

const mono = { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" };

const ASSET_META: Record<string, { logo: string | null; symbol: string; threshold: number }> = {
  USDC:  { logo: "/usdclogo.svg",  symbol: "USDC",  threshold: 0.995 },
  EURC:  { logo: "/eurclogo.svg",  symbol: "EURC",  threshold: 0.995 },
  PYUSD: { logo: "/pyusdlogo.svg", symbol: "PYUSD", threshold: 0.995 },
  MGUSD: { logo: "/mgusdlogo.jpg", symbol: "MGUSD", threshold: 0.995 },
};

const EXCLUDED_ASSETS = new Set(["DAI", "USDT"]);

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
  asset: string;
  impliedPct: number | null;
}

function stateBadge(state: string, pct: number | null) {
  if (state === "Settled") return { bg: "rgba(239,68,68,0.12)",  text: "#ef4444",           label: "YES WON" };
  if (state === "Expired") return { bg: "rgba(136,136,136,0.1)", text: "rgba(255,255,255,0.4)", label: "NO WON" };
  // Open
  if (pct !== null && pct > 2)   return { bg: "rgba(239,68,68,0.12)",  text: "#ef4444",  label: "ELEVATED" };
  if (pct !== null && pct > 0.5) return { bg: "rgba(245,158,11,0.1)",  text: "#f59e0b",  label: "WATCH" };
  return { bg: "rgba(34,197,94,0.1)", text: "#22c55e", label: "OPEN" };
}

// Coming-soon assets not yet deployed as markets
const COMING_SOON = [
  { symbol: "PYUSD", logo: "/pyusdlogo.svg", name: "PayPal USD" },
  { symbol: "MGUSD", logo: "/mgusdlogo.jpg", name: "MoneyGram USD" },
];

export default function HedgeMarketsPage() {
  const [markets, setMarkets] = useState<EnrichedMarket[]>([]);
  const [loading, setLoading]  = useState(true);

  const load = useCallback(async () => {
    const ids     = await listMarkets();
    const configs = await Promise.all(ids.map(getMarket));
    const enriched = await Promise.all(
      configs.map(async (config) => {
        const [state, collateral, orders] = await Promise.all([
          getMarketState(config.market_contract).catch(() => "Unknown"),
          getTotalCollateral(config.market_contract).catch(() => 0n),
          getOrders(config.market_contract).catch(() => [] as Order[]),
        ]);
        const asset = assetFromLabel(config.label);
        if (EXCLUDED_ASSETS.has(asset)) return null;
        const sellOrders = (orders as Order[]).filter(o => !o.is_buy);
        const bestAsk = sellOrders.length
          ? sellOrders.reduce((min, o) => Math.min(min, Number(o.price_bps)), Number(sellOrders[0].price_bps))
          : null;
        return { config, state, collateral, asset, impliedPct: bestAsk !== null ? bestAsk / 100 : null } as EnrichedMarket;
      })
    );

    // Deduplicate — best open per asset + up to 2 expired total
    const byAsset    = new Map<string, EnrichedMarket>();
    const expiredMap = new Map<string, EnrichedMarket>();

    for (const m of enriched) {
      if (!m) continue;
      if (m.state === "Open") {
        const ex = byAsset.get(m.asset);
        if (!ex || m.collateral > ex.collateral) byAsset.set(m.asset, m);
      } else {
        const ex = expiredMap.get(m.asset);
        if (!ex || m.collateral > ex.collateral) expiredMap.set(m.asset, m);
      }
    }

    const openList   = [...byAsset.values()];
    const closedList = [...expiredMap.values()]
      .sort((a, b) => Number(b.collateral) - Number(a.collateral))
      .slice(0, 2);

    // Sort: Open first, then closed
    const sorted = [...openList, ...closedList];

    setMarkets(sorted);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Which coming-soon symbols aren't already live?
  const liveSymbols = new Set(markets.map(m => m.asset));
  const comingSoonVisible = COMING_SOON.filter(c => !liveSymbols.has(c.symbol));

  return (
    <div className="p-6 space-y-5" style={{ background: "#0a0a12", minHeight: "100%" }}>
      {/* Header */}
      <div>
        <h1 style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 22, color: "white", letterSpacing: "-0.44px", margin: 0 }}>
          Hedge Markets
        </h1>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
          Binary outcome contracts for stablecoin depeg events. Buy cover or underwrite.
        </p>
      </div>

      {/* Section: Open markets */}
      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 3 }, (_, i) => (
            <MarketRowSkeleton key={i} />
          ))
        ) : (
          <>
            {markets.filter(m => m.state === "Open").map(m => (
              <MarketRow key={m.config.market_id} market={m} />
            ))}

            {/* Coming soon rows */}
            {comingSoonVisible.map(c => (
              <ComingSoonRow key={c.symbol} symbol={c.symbol} logo={c.logo} name={c.name} />
            ))}

            {/* Divider before closed markets */}
            {markets.some(m => m.state !== "Open") && (
              <div className="flex items-center gap-3 py-2">
                <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                <span style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em" }}>
                  CLOSED MARKETS
                </span>
                <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
              </div>
            )}

            {markets.filter(m => m.state !== "Open").map(m => (
              <MarketRow key={m.config.market_id} market={m} dimmed />
            ))}

            {markets.length === 0 && !loading && (
              <div className="text-center py-16 text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
                No markets available.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Live market row ───────────────────────────────────────────────────────
function MarketRow({ market, dimmed }: { market: EnrichedMarket; dimmed?: boolean }) {
  const meta  = ASSET_META[market.asset] ?? { logo: null, symbol: market.asset, threshold: 0.995 };
  const badge = stateBadge(market.state, market.impliedPct);

  return (
    <Link
      href={`/app/markets/${market.config.market_id}`}
      className="flex items-center gap-4 px-5 py-4 rounded-xl transition-all duration-150 group"
      style={{
        background: "#0f0f1e",
        border: "1px solid rgba(255,255,255,0.07)",
        opacity: dimmed ? 0.6 : 1,
        textDecoration: "none",
      }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = dimmed ? "rgba(255,255,255,0.1)" : "rgba(0,229,255,0.2)"}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"}
    >
      {/* Logo */}
      {meta.logo ? (
        <img src={meta.logo} alt={meta.symbol} className="w-9 h-9 rounded-full shrink-0"
          style={{ filter: dimmed ? "grayscale(60%)" : "none" }} />
      ) : (
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
          style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>
          {meta.symbol[0]}
        </div>
      )}

      {/* Label + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 14, color: dimmed ? "rgba(255,255,255,0.5)" : "white" }}>
            {market.config.label}
          </p>
          {!dimmed && (
            <span style={{ 
              background: "rgba(0, 255, 128, 0.1)", 
              color: "#00FF80", 
              padding: "2px 6px", 
              borderRadius: "4px", 
              fontSize: "9px", 
              fontWeight: 700, 
              ...mono,
              border: "1px solid rgba(0, 255, 128, 0.2)"
            }}>
              +8.5% APY Base
            </span>
          )}
        </div>
        <p style={{ ...mono, fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
          Expires {formatExpiry(market.config.expiry_timestamp)} · ${formatUsdc(market.collateral)} collateral
        </p>
      </div>

      {/* Implied risk + badge + arrow */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="text-right">
          <p style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em" }}>IMPLIED RISK</p>
          <p style={{ ...mono, fontSize: 13, fontWeight: 700, color: market.impliedPct !== null ? "white" : "rgba(255,255,255,0.3)" }}>
            {market.impliedPct !== null ? `${market.impliedPct.toFixed(2)}%` : "—"}
          </p>
        </div>
        <span
          className="text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase"
          style={{ background: badge.bg, color: badge.text, fontFamily: "Inter, sans-serif", letterSpacing: "0.06em", whiteSpace: "nowrap" }}
        >
          {badge.label}
        </span>
        <ArrowRight size={15} className="transition-transform group-hover:translate-x-1"
          style={{ color: dimmed ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.3)", flexShrink: 0 }} />
      </div>
    </Link>
  );
}

// ── Market row skeleton ───────────────────────────────────────────────────
function MarketRowSkeleton() {
  return (
    <div
      className="flex items-center gap-4 px-5 py-4 rounded-xl"
      style={{ background: "#0f0f1e", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      {/* Logo */}
      <div className="w-9 h-9 rounded-full shrink-0 skeleton-shimmer" />

      {/* Label + meta */}
      <div className="flex-1 flex flex-col gap-2">
        <div className="h-3.5 w-40 rounded skeleton-shimmer" />
        <div className="h-2.5 w-56 rounded skeleton-shimmer" />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="flex flex-col gap-1.5 items-end">
          <div className="h-2 w-16 rounded skeleton-shimmer" />
          <div className="h-3.5 w-10 rounded skeleton-shimmer" />
        </div>
        <div className="h-6 w-16 rounded-full skeleton-shimmer" />
        <div className="w-4 h-4 rounded skeleton-shimmer" />
      </div>
    </div>
  );
}
function ComingSoonRow({ symbol, logo, name }: { symbol: string; logo: string; name: string }) {
  return (
    <div
      className="flex items-center gap-4 px-5 py-4 rounded-xl"
      style={{
        background: "#0f0f1e",
        border: "1px solid rgba(255,255,255,0.06)",
        opacity: 0.75,
        cursor: "not-allowed",
      }}
    >
      <img src={logo} alt={symbol} className="w-9 h-9 rounded-full shrink-0"
        style={{ filter: "grayscale(80%) opacity(0.6)" }} />

      <div className="flex-1 min-w-0">
        <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 14, color: "rgba(255,255,255,0.45)" }}>
          {symbol} Depeg
        </p>
        <p style={{ ...mono, fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>
          {name} · Market coming soon
        </p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <p style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.2)", letterSpacing: "0.06em" }}>IMPLIED RISK</p>
          <p style={{ ...mono, fontSize: 13, color: "rgba(255,255,255,0.2)" }}>—</p>
        </div>
        <span
          className="flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase"
          style={{
            background: "rgba(255,255,255,0.05)",
            color: "rgba(255,255,255,0.35)",
            fontFamily: "Inter, sans-serif",
            letterSpacing: "0.06em",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <Lock size={9} />
          Soon
        </span>
        <ArrowRight size={15} style={{ color: "rgba(255,255,255,0.1)", flexShrink: 0 }} />
      </div>
    </div>
  );
}
