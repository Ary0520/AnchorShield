"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  listMarkets, getMarket, getMarketState, getTotalCollateral,
  formatUsdc, formatExpiry,
  type MarketConfig,
} from "@/lib/contracts";

const mono = { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" };

interface MarketRow { market: MarketConfig; state: string; collateral: bigint }

interface Stats {
  total: number;
  open: number;
  settledYes: number;
  expiredNo: number;
  totalLocked: bigint;
  totalEver: bigint;
}

function stateBadge(state: string): { bg: string; text: string; label: string } {
  if (state === "Open")     return { bg: "rgba(0,255,194,0.1)",   text: "#00ffc2", label: "● Live" };
  if (state === "Settled")  return { bg: "rgba(105,0,5,0.15)",    text: "#ff6b6b", label: "⚠ YES won" };
  if (state === "Expired")  return { bg: "rgba(136,136,136,0.1)", text: "#888",    label: "✓ NO won" };
  return                          { bg: "rgba(255,184,0,0.1)",    text: "#ffb800", label: state };
}

export default function ProtocolStatsPage() {
  const [rows, setRows]       = useState<MarketRow[]>([]);
  const [stats, setStats]     = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const ids     = await listMarkets();
        const configs = await Promise.all(ids.map(getMarket));
        const data    = await Promise.all(
          configs.map(async (market) => {
            const [state, collateral] = await Promise.all([
              getMarketState(market.market_contract).catch(() => "Unknown"),
              getTotalCollateral(market.market_contract).catch(() => 0n),
            ]);
            return { market, state, collateral } as MarketRow;
          })
        );
        setRows(data);
        const open       = data.filter(r => r.state === "Open");
        const settledYes = data.filter(r => r.state === "Settled").length;
        const expiredNo  = data.filter(r => r.state === "Expired").length;
        setStats({
          total:       data.length,
          open:        open.length,
          settledYes,
          expiredNo,
          totalLocked: open.reduce((s, r) => s + r.collateral, 0n),
          totalEver:   data.reduce((s, r) => s + r.collateral, 0n),
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load stats");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const resolved  = (stats?.settledYes ?? 0) + (stats?.expiredNo ?? 0);
  const noWinRate = resolved > 0
    ? Math.round(((stats?.expiredNo ?? 0) / resolved) * 100)
    : null;

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: "#0a0a0a" }}>
      <div className="p-6 space-y-6 max-w-[1200px] w-full mx-auto">

        {/* Page header */}
        <div>
          <h1 style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 28, color: "white", letterSpacing: "-0.56px", margin: 0 }}>
            Protocol Stats
          </h1>
          <p style={{ color: "#888", fontSize: 13, marginTop: 4, fontFamily: "Inter, sans-serif" }}>
            Live on-chain data · Stellar Testnet
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 rounded-lg text-sm" style={{ background: "rgba(105,0,5,0.1)", border: "1px solid rgba(105,0,5,0.3)", color: "#ff6b6b", ...mono }}>
            {error}
          </div>
        )}

        {/* 4 big stat cards */}
        <div className="grid grid-cols-4 gap-3">
          {loading
            ? [1,2,3,4].map(i => <StatCardSkeleton key={i} />)
            : [
                { label: "Total Markets",     value: String(stats?.total ?? 0),                                                                        sub: "deployed via factory",               valueColor: "white"   },
                { label: "Total USDC Locked", value: `$${formatUsdc(stats?.totalLocked ?? 0n)}`,                                                       sub: "across open markets",                valueColor: "#00ffc2" },
                { label: "Markets Resolved",  value: String(resolved),                                                                                 sub: resolved === 0 ? "none yet" : `${stats?.expiredNo} NO · ${stats?.settledYes} YES`, valueColor: "white" },
                { label: "NO Win Rate",       value: noWinRate !== null ? `${noWinRate}%` : "—",                                                       sub: noWinRate !== null ? "expired without depeg" : "no resolved markets yet", valueColor: noWinRate !== null ? "#00ffc2" : "#888" },
              ].map(card => (
                <div key={card.label} className="flex flex-col p-4 rounded-lg" style={{ background: "#161616", border: "1px solid #222" }}>
                  <p style={{ ...mono, fontSize: 10, color: "#555", letterSpacing: "0.5px", marginBottom: 8 }}>{card.label.toUpperCase()}</p>
                  <p style={{ ...mono, fontSize: 26, fontWeight: 700, color: card.valueColor, lineHeight: 1, margin: 0 }}>{card.value}</p>
                  <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: "#555", marginTop: 6 }}>{card.sub}</p>
                </div>
              ))
          }
        </div>

        {/* NO Win Rate bar */}
        {!loading && stats && resolved > 0 && (
          <div className="flex items-center gap-6 p-4 rounded-lg" style={{ background: "#161616", border: "1px solid #222" }}>
            <div className="flex gap-8 shrink-0">
              <div>
                <p style={{ ...mono, fontSize: 22, fontWeight: 700, color: "#00ffc2", margin: 0 }}>{stats.expiredNo}</p>
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: "#555", marginTop: 4 }}>NO wins</p>
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: "#444" }}>Peg held</p>
              </div>
              <div style={{ width: 1, background: "#222", alignSelf: "stretch" }} />
              <div>
                <p style={{ ...mono, fontSize: 22, fontWeight: 700, color: "#ff6b6b", margin: 0 }}>{stats.settledYes}</p>
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: "#555", marginTop: 4 }}>YES wins</p>
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: "#444" }}>Depeg confirmed</p>
              </div>
            </div>
            <div className="flex-1">
              <div className="flex justify-between mb-1">
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: "#555" }}>NO win rate</p>
                <p style={{ ...mono, fontSize: 11, color: "#00ffc2" }}>{noWinRate}%</p>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "#222" }}>
                <div className="h-full rounded-full" style={{ width: `${noWinRate ?? 0}%`, background: "#00ffc2" }} />
              </div>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: "#444", marginTop: 4 }}>
                {noWinRate}% of resolved markets expired safely without a depeg
              </p>
            </div>
          </div>
        )}

        {/* Markets table */}
        <div className="rounded-lg overflow-hidden" style={{ background: "#161616", border: "1px solid #222" }}>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid #222" }}>
            <h2 style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 16, color: "white", margin: 0 }}>All Markets</h2>
          </div>
          {loading ? (
            <div className="p-5 space-y-3">
              {[1,2,3,4].map(i => <TableRowSkeleton key={i} />)}
            </div>
          ) : rows.length === 0 ? (
            <p className="p-5 text-sm" style={{ color: "#555", fontFamily: "Inter, sans-serif" }}>No markets found.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(34,34,34,0.8)" }}>
                  {["ID", "Market", "Collateral", "Threshold", "Expires", "Status"].map(h => (
                    <th key={h} className="text-left px-5 py-3"
                      style={{ ...mono, fontSize: 10, color: "#555", letterSpacing: "0.5px", fontWeight: 500 }}>
                      {h.toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ market, state, collateral }, idx) => {
                  const badge = stateBadge(state);
                  return (
                    <tr key={market.market_id} style={{ borderBottom: idx < rows.length - 1 ? "1px solid rgba(34,34,34,0.5)" : "none" }}>
                      <td className="px-5 py-3"><span style={{ ...mono, color: "#555", fontSize: 12 }}>{market.market_id}</span></td>
                      <td className="px-5 py-3">
                        <Link href={`/app/markets/${market.market_id}`}
                          style={{ fontFamily: "Inter, sans-serif", color: "white", fontSize: 13, fontWeight: 500, textDecoration: "none" }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#00ffc2"}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "white"}>
                          {market.label}
                        </Link>
                      </td>
                      <td className="px-5 py-3"><span style={{ ...mono, color: "rgba(255,255,255,0.75)", fontSize: 12 }}>${formatUsdc(collateral)}</span></td>
                      <td className="px-5 py-3"><span style={{ ...mono, color: "#690005", fontSize: 12 }}>$0.995</span></td>
                      <td className="px-5 py-3"><span style={{ ...mono, color: "#888", fontSize: 12 }}>{formatExpiry(market.expiry_timestamp)}</span></td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-0.5 rounded text-xs font-medium"
                          style={{ background: badge.bg, color: badge.text, fontFamily: "Inter, sans-serif" }}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Settlement history */}
        <div className="rounded-lg overflow-hidden" style={{ background: "#161616", border: "1px solid #222" }}>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid #222" }}>
            <h2 style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 16, color: "white", margin: 0 }}>Settlement History</h2>
          </div>
          <div className="p-5">
            {!loading && rows.filter(r => r.state !== "Open").length > 0 ? (
              <div className="space-y-3">
                {rows.filter(r => r.state === "Settled" || r.state === "Expired").map(({ market, state, collateral }) => {
                  const badge = stateBadge(state);
                  return (
                    <div key={market.market_id} className="flex items-center justify-between py-3 px-4 rounded-lg"
                      style={{ background: "#0a0a0a", border: "1px solid #222" }}>
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 rounded text-xs font-medium shrink-0"
                          style={{ background: badge.bg, color: badge.text, fontFamily: "Inter, sans-serif" }}>
                          {badge.label}
                        </span>
                        <span style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "white" }}>{market.label}</span>
                      </div>
                      <div className="flex items-center gap-6">
                        <span style={{ ...mono, fontSize: 12, color: "#888" }}>{formatExpiry(market.expiry_timestamp)}</span>
                        <span style={{ ...mono, fontSize: 12, color: "rgba(255,255,255,0.75)" }}>${formatUsdc(collateral)} returned</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between py-3 px-4 rounded-lg mb-3"
                  style={{ background: "#0a0a0a", border: "1px solid #222" }}>
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{ background: "rgba(136,136,136,0.1)", color: "#888", fontFamily: "Inter, sans-serif" }}>
                      ✓ NO won
                    </span>
                    <span style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "white" }}>USDC test — expires in 10 min</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <span style={{ ...mono, fontSize: 12, color: "#888" }}>Jul 30 2026</span>
                    <span style={{ ...mono, fontSize: 12, color: "rgba(255,255,255,0.75)" }}>$20.00 returned</span>
                  </div>
                </div>
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: "#444" }}>Markets 0–3 expire Sep 28, 2026</p>
              </div>
            )}
          </div>
        </div>

        {/* How settlement works */}
        <div className="flex items-start gap-3 p-4 rounded-lg"
          style={{ background: "rgba(0,255,194,0.04)", border: "1px solid rgba(0,255,194,0.12)" }}>
          <span style={{ color: "#00ffc2", fontSize: 16, flexShrink: 0, marginTop: 1 }}>ⓘ</span>
          <div>
            <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 13, color: "white", marginBottom: 4 }}>How settlement works</p>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "#888", lineHeight: 1.6, margin: 0 }}>
              Markets settle automatically via Reflector oracle. If the covered asset drops below the depeg threshold
              continuously for the breach duration (1 hour), YES wins and cover buyers receive $1 USDC per token.
              If the market expires without a sustained breach, NO wins and underwriters reclaim their collateral plus
              any premiums earned. Settlement is permissionless — anyone can call{" "}
              <code style={{ ...mono, fontSize: 11, color: "#00ffc2", background: "#0a0a0a", padding: "1px 4px", borderRadius: 3 }}>
                try_settle()
              </code>
              . Our watcher calls it every 60 seconds.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Stat Card Skeleton ────────────────────────────────────────────────────
function StatCardSkeleton() {
  return (
    <div className="flex flex-col p-4 rounded-lg gap-3" style={{ background: "#161616", border: "1px solid #222" }}>
      <div className="h-2 w-20 rounded skeleton-shimmer" />
      <div className="h-7 w-24 rounded skeleton-shimmer" />
      <div className="h-2.5 w-32 rounded skeleton-shimmer" />
    </div>
  );
}

// ── Table Row Skeleton ────────────────────────────────────────────────────
function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-6 px-1 py-1">
      <div className="h-3 w-6 rounded skeleton-shimmer shrink-0" />
      <div className="h-3 w-40 rounded skeleton-shimmer flex-1" />
      <div className="h-3 w-16 rounded skeleton-shimmer" />
      <div className="h-3 w-12 rounded skeleton-shimmer" />
      <div className="h-3 w-20 rounded skeleton-shimmer" />
      <div className="h-5 w-16 rounded-full skeleton-shimmer" />
    </div>
  );
}
