"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  listMarkets, getMarket, getMarketState, getTotalCollateral,
  getOrders, formatUsdc, formatExpiry, type MarketConfig, type Order,
} from "@/lib/contracts";
import { useWallet } from "@/hooks";
import { ArrowUpDown, Filter } from "lucide-react";
import LiveRiskMonitor from "@/app/components/LiveRiskMonitor";

// ── Market metadata (assets available on Stellar) ─────────────────────────
const ASSET_META: Record<string, { logo: string; symbol: string; name: string; threshold: number }> = {
  USDC:  { logo: "/usdclogo.svg",  symbol: "USDC",  name: "USD Coin",  threshold: 0.995 },
  EURC:  { logo: "/eurclogo.svg",  symbol: "EURC",  name: "Euro Coin", threshold: 0.995 },
  PYUSD: { logo: "/pyusdlogo.svg", symbol: "PYUSD", name: "PayPal USD", threshold: 0.995 },
  MGUSD: { logo: "/mgusdlogo.jpg", symbol: "MGUSD", name: "MoneyGram USD", threshold: 0.995 },
};

function assetFromLabel(label: string): string {
  const upper = label.toUpperCase();
  for (const key of Object.keys(ASSET_META)) {
    if (upper.includes(key)) return key;
  }
  return label.split(" ")[0].toUpperCase();
}

// ── Risk color logic ──────────────────────────────────────────────────────
function riskColor(pct: number | null): string {
  if (pct === null) return "#3f3f5a";
  if (pct > 2)   return "#ef4444";
  if (pct > 0.5) return "#f59e0b";
  return "#22c55e";
}

// Badge label: state-first, implied risk only when meaningful
function marketBadgeLabel(state: string, pct: number | null): string {
  if (state === "Settled") return "YES WON";
  if (state === "Expired") return "NO WON";
  // Open market
  if (pct === null) return "OPEN";
  if (pct > 2)   return "ELEVATED";
  if (pct > 0.5) return "WATCH";
  return "OPEN";
}

function riskBadgeStyle(state: string, pct: number | null) {
  if (state === "Settled") return { bg: "rgba(239,68,68,0.15)",    text: "#ef4444" };
  if (state === "Expired") return { bg: "rgba(136,136,136,0.1)",   text: "#888" };
  if (pct === null)        return { bg: "rgba(34,197,94,0.1)",     text: "#22c55e" };
  if (pct > 2)   return { bg: "rgba(239,68,68,0.15)",    text: "#ef4444" };
  if (pct > 0.5) return { bg: "rgba(245,158,11,0.15)",   text: "#f59e0b" };
  return              { bg: "rgba(34,197,94,0.12)",    text: "#22c55e" };
}

// ── Enriched market type ──────────────────────────────────────────────────
interface EnrichedMarket {
  config: MarketConfig;
  state: string;
  collateral: bigint;
  orders: Order[];
  asset: string;
  impliedPct: number | null; // implied probability %
  bestAskBps: number | null;
}

// ── Main component ────────────────────────────────────────────────────────
export default function RiskCurvePage() {
  const wallet = useWallet();
  const [markets, setMarkets] = useState<EnrichedMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<"risk-desc" | "risk-asc" | "expiry">("risk-desc");
  const [openOnly, setOpenOnly] = useState(false);

  const load = useCallback(async () => {
    try {
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
            ? sellOrders.reduce((min, o) =>
                Number(o.price_bps) < min ? Number(o.price_bps) : min,
                Number(sellOrders[0].price_bps)
              )
            : null;
          const impliedPct = bestAsk !== null ? bestAsk / 100 : null;
          return { config, state, collateral, orders: orders as Order[], asset, impliedPct, bestAskBps: bestAsk };
        })
      );
      setMarkets(enriched);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load markets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  // Deduplicate: keep only the best market per asset (highest collateral)
  // Filter out DAI (no oracle on Stellar), USDT (not on Stellar)
  // For each unique asset, pick the market with most collateral (most active)
  const EXCLUDED_ASSETS = new Set(["DAI", "USDT"]);

  const deduped = (() => {
    const byAsset = new Map<string, EnrichedMarket>();
    const expiredByAsset = new Map<string, EnrichedMarket>();

    for (const m of markets) {
      if (EXCLUDED_ASSETS.has(m.asset)) continue;

      if (m.state === "Open") {
        const existing = byAsset.get(m.asset);
        // If collateral is tied (e.g. both 0), prefer the newest market ID
        if (!existing || m.collateral > existing.collateral || (m.collateral === existing.collateral && m.config.market_id > existing.config.market_id)) {
          byAsset.set(m.asset, m);
        }
      } else {
        const existing = expiredByAsset.get(m.asset);
        if (!existing || m.collateral > existing.collateral || (m.collateral === existing.collateral && m.config.market_id > existing.config.market_id)) {
          expiredByAsset.set(m.asset, m);
        }
      }
    }

    // Merge: open markets first, then up to 2 expired markets
    const openList = [...byAsset.values()];
    const closedList = [...expiredByAsset.values()]
      .sort((a, b) => Number(b.collateral) - Number(a.collateral))
      .slice(0, 2);

    return [...openList, ...closedList];
  })();

  // Sorted + filtered market list — Open markets first, then expired/settled
  const sorted = [...deduped]
    .filter((m) => !openOnly || m.state === "Open")
    .sort((a, b) => {
      // Open always before non-open
      const aOpen = a.state === "Open" ? 0 : 1;
      const bOpen = b.state === "Open" ? 0 : 1;
      if (aOpen !== bOpen) return aOpen - bOpen;
      // Within same state, apply chosen sort
      if (sort === "risk-desc") return (b.impliedPct ?? -1) - (a.impliedPct ?? -1);
      if (sort === "risk-asc")  return (a.impliedPct ?? 9999) - (b.impliedPct ?? 9999);
      return Number(a.config.expiry_timestamp) - Number(b.config.expiry_timestamp);
    });

  return (
    <div className="p-6 space-y-6 min-h-full" style={{ background: "#0a0a12" }}>
      {/* ── Live Risk Monitor ────────────────────────────── */}
      <LiveRiskMonitor
        impliedBySymbol={Object.fromEntries(
          markets.map(m => [m.asset, m.impliedPct])
        )}
      />

      {/* ── Sort + Filter controls ───────────────────────────── */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <ArrowUpDown size={12} style={{ color: "rgba(255,255,255,0.4)" }} />
          <span style={{ color: "rgba(255,255,255,0.4)" }}>Sort:</span>
          {(["risk-desc", "risk-asc", "expiry"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className="px-2 py-0.5 rounded text-xs transition-all"
              style={{
                background: sort === s ? "rgba(0,229,255,0.12)" : "transparent",
                color: sort === s ? "#00e5ff" : "rgba(255,255,255,0.45)",
              }}
            >
              {s === "risk-desc" ? "Highest risk" : s === "risk-asc" ? "Lowest risk" : "Expiry soonest"}
            </button>
          ))}
        </div>
        <button
          onClick={() => setOpenOnly(!openOnly)}
          className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg transition-all"
          style={{
            background: openOnly ? "rgba(0,229,255,0.08)" : "rgba(255,255,255,0.04)",
            border: openOnly ? "1px solid rgba(0,229,255,0.2)" : "1px solid rgba(255,255,255,0.07)",
            color: openOnly ? "#00e5ff" : "rgba(255,255,255,0.4)",
          }}
        >
          <Filter size={12} />
          Open only
        </button>
      </div>

      {/* ── Error ───────────────────────────────────────────────── */}
      {error && (
        <div
          className="text-xs px-4 py-3 rounded-lg"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}
        >
          {error}
        </div>
      )}

      {/* ── Market cards grid ────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3].map((i) => (
            <MarketCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sorted.map((m) => (
            <MarketCard key={m.config.market_id} market={m} wallet={wallet} />
          ))}
          {/* Static coming-soon cards for assets not yet live */}
          <ComingSoonCard
            symbol="PYUSD"
            name="PayPal USD"
            logo="/pyusdlogo.svg"
            question="Will PYUSD lose its $1 peg?"
          />
          <ComingSoonCard
            symbol="MGUSD"
            name="MoneyGram USD"
            logo="/mgusdlogo.jpg"
            question="Will MGUSD lose its $1 peg?"
          />
          {sorted.length === 0 && (
            <div className="col-span-3 text-center py-16 text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
              No markets found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Market Card ─────────────────────────────────────────────────────────
function MarketCard({ market, wallet }: { market: EnrichedMarket; wallet: ReturnType<typeof useWallet> }) {
  const meta = ASSET_META[market.asset] ?? { logo: null, symbol: market.asset, name: market.asset, threshold: 0.995 };
  const badgeStyle = riskBadgeStyle(market.state, market.impliedPct);
  const badgeLabel = marketBadgeLabel(market.state, market.impliedPct);
  const isOpen = market.state === "Open";
  const isExpired = market.state === "Expired";
  const isSettled = market.state === "Settled";

  const coverCost = market.bestAskBps !== null
    ? `$${((market.bestAskBps / 100) * 10).toFixed(2)}`
    : "No asks yet";

  const question = `Will ${meta.symbol} lose its $1 peg?`;

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-4 transition-all duration-200"
      style={{
        background: "#0f0f1e",
        border: `1px solid ${
          isSettled ? "rgba(239,68,68,0.3)" :
          isExpired ? "rgba(255,255,255,0.07)" :
          "rgba(255,255,255,0.07)"
        }`,
        opacity: isExpired ? 0.75 : 1,
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {meta.logo ? (
            <img src={meta.logo} alt={meta.symbol} className="w-8 h-8 rounded-full" />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: "rgba(255,255,255,0.1)" }}
            >
              {meta.symbol[0]}
            </div>
          )}
          <div>
            <p className="text-white font-semibold text-sm">{meta.symbol} Depeg</p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{question}</p>
          </div>
        </div>
        {/* State badge */}
        <span
          className="text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide"
          style={{ background: badgeStyle.bg, color: badgeStyle.text }}
        >
          {badgeLabel}
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        <StatRow
          label="Implied prob"
          value={market.impliedPct !== null ? `${market.impliedPct.toFixed(2)}%` : "No asks yet"}
          valueColor={riskColor(market.impliedPct)}
        />
        <StatRow
          label={`Cover $100`}
          value={market.bestAskBps !== null ? `$${((market.bestAskBps / 100) * 1).toFixed(2)}` : "—"}
        />
        <StatRow
          label="Collateral"
          value={`$${formatUsdc(market.collateral)}`}
        />
        <StatRow
          label="Expires"
          value={formatExpiry(market.config.expiry_timestamp)}
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mt-auto">
        {isOpen ? (
          <>
            <Link
              href={`/app/markets/${market.config.market_id}`}
              className="flex-1 text-center text-xs font-semibold py-2.5 rounded-lg transition-all"
              style={{
                background: "rgba(0,229,255,0.1)",
                border: "1px solid rgba(0,229,255,0.2)",
                color: "#00e5ff",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(0,229,255,0.18)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(0,229,255,0.1)";
              }}
            >
              Buy Cover
            </Link>
            <Link
              href={`/app/markets/${market.config.market_id}`}
              className="flex-1 text-center text-xs font-semibold py-2.5 rounded-lg transition-all"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.7)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.09)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
              }}
            >
              Underwrite
            </Link>
          </>
        ) : (
          <Link
            href={`/app/markets/${market.config.market_id}`}
            className="flex-1 text-center text-xs font-semibold py-2.5 rounded-lg"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            {wallet.publicKey ? "Claim Winnings" : "View Market"}
          </Link>
        )}
      </div>
    </div>
  );
}

function StatRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
        {label}
      </p>
      <p className="text-sm font-medium" style={{ color: valueColor ?? "rgba(255,255,255,0.85)" }}>
        {value}
      </p>
    </div>
  );
}

// ── Market Card Skeleton ──────────────────────────────────────────────────
function MarketCardSkeleton() {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-4"
      style={{ background: "#0f0f1e", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full skeleton-shimmer" />
          <div className="flex flex-col gap-1.5">
            <div className="h-3.5 w-24 rounded skeleton-shimmer" />
            <div className="h-2.5 w-32 rounded skeleton-shimmer" />
          </div>
        </div>
        <div className="h-5 w-14 rounded-full skeleton-shimmer" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {[1,2,3,4].map((i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="h-2 w-16 rounded skeleton-shimmer" />
            <div className="h-3.5 w-20 rounded skeleton-shimmer" />
          </div>
        ))}
      </div>

      {/* Fetching label */}
      <div className="flex items-center gap-2 mt-1">
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ background: "#00e5ff", boxShadow: "0 0 6px #00e5ff", animation: "pulse 1.5s ease-in-out infinite" }}
        />
        <span style={{ fontSize: 10, color: "rgba(0,229,255,0.5)", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.05em" }}>
          Fetching from Stellar…
        </span>
      </div>

      {/* Buttons */}
      <div className="flex gap-2 mt-auto">
        <div className="flex-1 h-9 rounded-lg skeleton-shimmer" />
        <div className="flex-1 h-9 rounded-lg skeleton-shimmer" />
      </div>
    </div>
  );
}
function ComingSoonCard({
  symbol, name, logo, question,
}: { symbol: string; name: string; logo: string; question: string }) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-4 relative overflow-hidden select-none"
      style={{
        background: "#0f0f1e",
        border: "1px solid rgba(255,255,255,0.07)",
        opacity: 0.75,
        cursor: "not-allowed",
      }}
    >
      {/* Coming soon ribbon — top-right diagonal */}
      <div
        className="absolute top-4 right-[-22px] text-[9px] font-bold tracking-widest uppercase"
        style={{
          background: "rgba(255,255,255,0.08)",
          color: "rgba(255,255,255,0.5)",
          padding: "3px 28px",
          transform: "rotate(45deg)",
          transformOrigin: "center",
          fontFamily: "'General Sans', sans-serif",
          letterSpacing: "0.12em",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        Soon
      </div>

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src={logo}
            alt={symbol}
            className="w-8 h-8 rounded-full"
            style={{ filter: "grayscale(100%) opacity(0.5)" }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
          <div>
            <p className="font-semibold text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
              {symbol} Depeg
            </p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>{question}</p>
          </div>
        </div>
        <span
          className="text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide"
          style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" }}
        >
          Coming Soon
        </span>
      </div>

      {/* Placeholder stats */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        {[["Implied prob", "—"], ["Cover $100", "—"], ["Collateral", "—"], ["Expires", "—"]].map(([l, v]) => (
          <div key={l}>
            <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>{l}</p>
            <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.25)" }}>{v}</p>
          </div>
        ))}
      </div>

      {/* Disabled buttons */}
      <div className="flex gap-2 mt-auto">
        <div
          className="flex-1 text-center text-xs font-semibold py-2.5 rounded-lg"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.2)" }}
        >
          Buy Cover
        </div>
        <div
          className="flex-1 text-center text-xs font-semibold py-2.5 rounded-lg"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.2)" }}
        >
          Underwrite
        </div>
      </div>
    </div>
  );
}
