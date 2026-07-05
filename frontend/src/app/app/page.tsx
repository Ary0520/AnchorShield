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

function riskLabel(pct: number | null): string {
  if (pct === null) return "No market";
  if (pct > 2)   return "ALERT";
  if (pct > 0.5) return "ELEVATED";
  return "OPEN";
}

function riskBadgeStyle(pct: number | null) {
  if (pct === null) return { bg: "rgba(255,255,255,0.06)", text: "rgba(255,255,255,0.4)" };
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

  // Sorted + filtered market list
  const sorted = [...markets]
    .filter((m) => !openOnly || m.state === "Open")
    .filter((m) => m.asset !== "USDT")
    .sort((a, b) => {
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
            <div
              key={i}
              className="rounded-xl h-64 animate-pulse"
              style={{ background: "rgba(255,255,255,0.03)" }}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sorted.map((m) => (
            <MarketCard key={m.config.market_id} market={m} wallet={wallet} />
          ))}
          {sorted.length === 0 && (
            <div
              className="col-span-3 text-center py-16 text-sm"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
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
  const badgeStyle = riskBadgeStyle(market.impliedPct);
  const label = riskLabel(market.impliedPct);
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
          {isSettled ? "YES WON" : isExpired ? "NO WON" : label}
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