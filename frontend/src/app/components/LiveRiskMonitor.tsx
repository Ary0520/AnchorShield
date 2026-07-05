"use client";

/**
 * LiveRiskMonitor
 *
 * Replaces the bar chart in the Risk Curve page.
 * Institutional design pattern: each asset row shows oracle price,
 * distance-to-threshold in bps, implied probability, and a runway bar
 * that fills as the price approaches the depeg line.
 *
 * Psychology: "47 bps of runway" triggers more visceral response than
 * "0.31% implied probability". Distance to danger, not abstract %.
 * Ambient panel background shifts with overall ecosystem risk state.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { fetchOracleLastPrice } from "@/lib/oracle";

const mono = { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" };
const THRESHOLD = 0.995;

// Assets to monitor — symbols must match Reflector oracle
const ASSETS = [
  { symbol: "USDC",  logo: "/usdclogo.svg",  name: "USD Coin" },
  { symbol: "EURC",  logo: "/eurclogo.svg",  name: "Euro Coin" },
  { symbol: "PYUSD", logo: "/pyusdlogo.svg", name: "PayPal USD" },
  { symbol: "MGUSD", logo: "/mgusdlogo.jpg", name: "MoneyGram USD" },
];

interface AssetRisk {
  symbol: string;
  logo: string;
  name: string;
  price: number | null;
  timestamp: number | null;
  // derived
  distanceBps: number | null;   // bps above threshold. negative = breached
  regime: "SAFE" | "WATCH" | "ALERT" | "BREACH" | "LOADING" | "NO DATA";
}

// How many bps above threshold triggers regime change
const WATCH_BPS  = 50;   // 0.5% above threshold
const ALERT_BPS  = 20;   // 0.2% above threshold

function computeRegime(price: number | null): AssetRisk["regime"] {
  if (price === null) return "NO DATA";
  const distanceBps = Math.round((price - THRESHOLD) * 10000);
  if (distanceBps < 0)        return "BREACH";
  if (distanceBps <= ALERT_BPS) return "ALERT";
  if (distanceBps <= WATCH_BPS) return "WATCH";
  return "SAFE";
}

function regimeStyle(regime: AssetRisk["regime"]): { color: string; bg: string; glow: string } {
  switch (regime) {
    case "BREACH":  return { color: "#ef4444", bg: "rgba(239,68,68,0.12)",   glow: "rgba(239,68,68,0.4)" };
    case "ALERT":   return { color: "#f97316", bg: "rgba(249,115,22,0.1)",   glow: "rgba(249,115,22,0.3)" };
    case "WATCH":   return { color: "#f59e0b", bg: "rgba(245,158,11,0.1)",   glow: "rgba(245,158,11,0.25)" };
    case "SAFE":    return { color: "#22c55e", bg: "rgba(34,197,94,0.08)",   glow: "transparent" };
    default:        return { color: "#444",    bg: "rgba(255,255,255,0.03)", glow: "transparent" };
  }
}

// Runway bar: width = how far price is from a "danger zone" top (1.010)
// When price = 1.010 → 100% runway. When price = 0.995 → 0% runway.
// Fills left-to-right, color changes as it empties.
function runwayPct(price: number | null): number {
  if (price === null) return 0;
  const MAX_SAFE = 1.010;
  const pct = ((price - THRESHOLD) / (MAX_SAFE - THRESHOLD)) * 100;
  return Math.max(0, Math.min(100, pct));
}

function runwayColor(pct: number): string {
  if (pct <= 0)   return "#ef4444";
  if (pct <= 15)  return "#f97316";
  if (pct <= 35)  return "#f59e0b";
  return "#22c55e";
}

function formatAge(timestamp: number | null): string {
  if (!timestamp) return "—";
  const age = Math.floor(Date.now() / 1000) - timestamp;
  if (age < 60)  return `${age}s ago`;
  if (age < 3600) return `${Math.floor(age / 60)}m ago`;
  return `${Math.floor(age / 3600)}h ago`;
}

interface Props {
  // implied probabilities from order book, keyed by symbol
  impliedBySymbol: Record<string, number | null>;
}

export default function LiveRiskMonitor({ impliedBySymbol }: Props) {
  const [assets, setAssets] = useState<AssetRisk[]>(
    ASSETS.map(a => ({ ...a, price: null, timestamp: null, distanceBps: null, regime: "LOADING" as const }))
  );
  const [lastRefresh, setLastRefresh] = useState<number>(0);
  const [mounted, setMounted] = useState(false);
  const tickRef = useRef<number>(0);

  useEffect(() => { setMounted(true); }, []);

  const fetchAll = useCallback(async () => {
    const results = await Promise.all(
      ASSETS.map(async (a) => {
        const point = await fetchOracleLastPrice(a.symbol);
        const price = point?.price ?? null;
        const distanceBps = price !== null ? Math.round((price - THRESHOLD) * 10000) : null;
        return {
          ...a,
          price,
          timestamp: point?.timestamp ?? null,
          distanceBps,
          regime: computeRegime(price),
        } as AssetRisk;
      })
    );
    setAssets(results);
    setLastRefresh(Date.now());
    tickRef.current += 1;
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => {
    const id = setInterval(fetchAll, 30_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  // Ambient bg: most severe regime across all assets drives the panel colour
  const worstRegime = assets.reduce<AssetRisk["regime"]>((worst, a) => {
    const order: AssetRisk["regime"][] = ["BREACH","ALERT","WATCH","SAFE","NO DATA","LOADING"];
    return order.indexOf(a.regime) < order.indexOf(worst) ? a.regime : worst;
  }, "SAFE");

  const ambientBg = worstRegime === "BREACH" ? "rgba(239,68,68,0.04)"
    : worstRegime === "ALERT" ? "rgba(249,115,22,0.03)"
    : worstRegime === "WATCH" ? "rgba(245,158,11,0.02)"
    : "transparent";

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-1000"
      style={{
        background: `linear-gradient(180deg, #0f0f1a 0%, #0a0a12 100%)`,
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: worstRegime === "BREACH" ? "0 0 40px rgba(239,68,68,0.06) inset"
          : worstRegime === "ALERT"  ? "0 0 40px rgba(249,115,22,0.04) inset"
          : worstRegime === "WATCH"  ? "0 0 40px rgba(245,158,11,0.03) inset"
          : "none",
      }}
    >
      {/* ── Header ──────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-3">
          {/* Live pulse dot */}
          <span className="relative flex h-2 w-2">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
              style={{ background: worstRegime === "BREACH" ? "#ef4444" : worstRegime === "WATCH" || worstRegime === "ALERT" ? "#f59e0b" : "#22c55e" }}
            />
            <span
              className="relative inline-flex rounded-full h-2 w-2"
              style={{ background: worstRegime === "BREACH" ? "#ef4444" : worstRegime === "WATCH" || worstRegime === "ALERT" ? "#f59e0b" : "#22c55e" }}
            />
          </span>
          <div>
            <span
              style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 12, color: "rgba(255,255,255,0.85)", letterSpacing: "0.08em" }}
            >
              LIVE RISK SIGNAL
            </span>
            <span
              style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.25)", marginLeft: 10 }}
            >
              Reflector oracle · 5min updates{mounted && lastRefresh > 0 ? ` · ${new Date(lastRefresh).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}
            </span>
          </div>
        </div>

        {/* Overall ecosystem state */}
        <div className="flex items-center gap-2">
          <span style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em" }}>
            ECOSYSTEM STATE
          </span>
          <span
            className="px-2.5 py-1 rounded font-bold"
            style={{
              ...mono,
              fontSize: 10,
              letterSpacing: "0.1em",
              background: regimeStyle(worstRegime).bg,
              color: regimeStyle(worstRegime).color,
              border: `1px solid ${regimeStyle(worstRegime).color}33`,
            }}
          >
            {worstRegime}
          </span>
        </div>
      </div>

      {/* ── Column headers ───────────────────────────────── */}
      <div
        className="grid px-5 py-2"
        style={{
          gridTemplateColumns: "2fr 1.5fr 1.5fr 1.5fr 1fr 1fr",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        {["Asset", "Oracle Price", "Runway", "Threshold Gap", "Implied Risk", "Regime"].map(h => (
          <span key={h} style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: "0.08em" }}>
            {h.toUpperCase()}
          </span>
        ))}
      </div>

      {/* ── Asset rows ───────────────────────────────────── */}
      <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.03)" }}>
        {assets.map((a) => {
          const pct = runwayPct(a.price);
          const rColor = runwayColor(pct);
          const rs = regimeStyle(a.regime);
          const implied = impliedBySymbol[a.symbol];
          const isLoading = a.regime === "LOADING";

          return (
            <div
              key={a.symbol}
              className="grid px-5 py-3 items-center transition-all duration-500"
              style={{
                gridTemplateColumns: "2fr 1.5fr 1.5fr 1.5fr 1fr 1fr",
                background: a.regime === "BREACH" ? "rgba(239,68,68,0.04)"
                  : a.regime === "ALERT" ? "rgba(249,115,22,0.02)"
                  : "transparent",
              }}
            >
              {/* Asset */}
              <div className="flex items-center gap-2.5">
                <img
                  src={a.logo}
                  alt={a.symbol}
                  className="w-6 h-6 rounded-full"
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
                <div>
                  <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 13, color: "white", lineHeight: 1 }}>
                    {a.symbol}
                  </p>
                  <p style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                    {a.name}
                  </p>
                </div>
              </div>

              {/* Oracle price + age */}
              <div>
                {isLoading ? (
                  <div className="h-3 w-16 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.06)" }} />
                ) : (
                  <>
                    <p style={{
                      ...mono,
                      fontSize: 14,
                      fontWeight: 700,
                      color: a.regime === "BREACH" ? "#ef4444" : a.regime === "ALERT" ? "#f97316" : a.regime === "WATCH" ? "#f59e0b" : "rgba(255,255,255,0.9)",
                    }}>
                      {a.price !== null ? `$${a.price.toFixed(4)}` : "—"}
                    </p>
                    <p style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>
                      {formatAge(a.timestamp)}
                    </p>
                  </>
                )}
              </div>

              {/* Runway bar */}
              <div className="pr-4">
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.06)" }}
                >
                  {!isLoading && (
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: rColor, boxShadow: pct < 30 ? `0 0 6px ${rColor}` : "none" }}
                    />
                  )}
                </div>
                <p style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.25)", marginTop: 3 }}>
                  {a.price !== null ? `${pct.toFixed(0)}% of runway` : "—"}
                </p>
              </div>

              {/* Threshold gap in bps */}
              <div>
                {isLoading ? (
                  <div className="h-3 w-12 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.06)" }} />
                ) : a.distanceBps !== null ? (
                  <>
                    <p style={{
                      ...mono,
                      fontSize: 14,
                      fontWeight: 700,
                      color: a.distanceBps < 0 ? "#ef4444"
                        : a.distanceBps <= ALERT_BPS ? "#f97316"
                        : a.distanceBps <= WATCH_BPS ? "#f59e0b"
                        : "rgba(255,255,255,0.75)",
                    }}>
                      {a.distanceBps < 0
                        ? `▼ ${Math.abs(a.distanceBps)} bps`
                        : `▲ ${a.distanceBps} bps`}
                    </p>
                    <p style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>
                      {a.distanceBps < 0 ? "below threshold" : "above $0.995"}
                    </p>
                  </>
                ) : (
                  <span style={{ ...mono, fontSize: 13, color: "rgba(255,255,255,0.2)" }}>—</span>
                )}
              </div>

              {/* Implied probability from order book */}
              <div>
                {implied !== null && implied !== undefined ? (
                  <>
                    <p style={{ ...mono, fontSize: 14, fontWeight: 700, color: implied > 2 ? "#ef4444" : implied > 0.5 ? "#f59e0b" : "rgba(255,255,255,0.75)" }}>
                      {implied.toFixed(2)}%
                    </p>
                    <p style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>
                      market-implied
                    </p>
                  </>
                ) : (
                  <span style={{ ...mono, fontSize: 11, color: "rgba(255,255,255,0.2)" }}>no orders</span>
                )}
              </div>

              {/* Regime badge */}
              <div>
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded"
                  style={{
                    ...mono,
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    background: rs.bg,
                    color: rs.color,
                    border: `1px solid ${rs.color}44`,
                    boxShadow: a.regime !== "SAFE" && a.regime !== "LOADING" && a.regime !== "NO DATA"
                      ? `0 0 8px ${rs.glow}`
                      : "none",
                  }}
                >
                  {a.regime}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Footer ───────────────────────────────────────── */}
      <div
        className="px-5 py-2.5 flex items-center justify-between"
        style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
      >
        <span style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.2)" }}>
          Threshold: $0.995 · Breach window: 1 continuous hour · Runway = distance to depeg in basis points
        </span>
        <span style={{ ...mono, fontSize: 9, color: "rgba(255,255,255,0.2)" }}>
          1 bps = $0.0001
        </span>
      </div>
    </div>
  );
}
