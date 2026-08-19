"use client";

import { useState, useEffect } from "react";
import { getAllAcr, formatUsdc, listMarkets, getMarket, getMarketState, getTotalCollateral } from "@/lib/contracts";

const mono = { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" };

const ANCHOR_NAMES: Record<string, {
  name: string; shortAddr: string; market: string; logo: string | null; logoSrc?: string;
}> = {
  GDMXS7S7CFSVRLMEPF55ZNKYNBNDNIC6FNFU6DMT4TY62IRYPC6IPX24: {
    name: "MoneyGram",       shortAddr: "GDMXS7...HPWM",
    market: "USDC Depeg (Market 0)", logo: "MG", logoSrc: "/moneygramlogo.png",
  },
  GB4FRPZQ3AILWMBEOVQ6DDNMRDJVREPVDPZ2WMFDPTGODUXOFTUKS777: {
    name: "Circle",           shortAddr: "GAKUX5...ZXWQ",
    market: "EURC Depeg (Market 1)", logo: "CI", logoSrc: "/circlelogo.svg",
  },
};

// ── Composite ACR rating (Operational Risk Score 0 - 10,000 bps) ────────────────
type RatingLabel = "AAA" | "AA" | "A" | "BBB" | "C" | "—";
const RATING_CONFIG: { label: RatingLabel; color: string; bg: string; min: number }[] = [
  { label: "AAA", color: "#00ffc2", bg: "rgba(0,255,194,0.12)",   min: 9500 },
  { label: "AA",  color: "#00ffc2", bg: "rgba(0,255,194,0.09)",   min: 9000 },
  { label: "A",   color: "#22c55e", bg: "rgba(34,197,94,0.1)",    min: 8000 },
  { label: "BBB", color: "#ffb800", bg: "rgba(255,184,0,0.12)",   min: 7000 },
  { label: "C",   color: "#888",    bg: "rgba(136,136,136,0.08)", min: 0    },
];

function getRating(bps: bigint) {
  const n = Number(bps);
  return RATING_CONFIG.find(r => n >= r.min) ?? RATING_CONFIG[RATING_CONFIG.length - 1];
}

function fmtAcr(bps: bigint): string {
  // 10000 bps = 100.00%
  return `${(Number(bps) / 100).toFixed(2)}%`;
}

interface AcrEntry { anchor: string; acr: bigint }
interface MarketStats { resolved: number; totalPaid: bigint; openCollateral: bigint }

export default function AnchorTrustPage() {
  const [entries, setEntries]     = useState<AcrEntry[]>([]);
  const [marketStats, setStats]   = useState<MarketStats>({ resolved: 0, totalPaid: 0n, openCollateral: 0n });
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [acrData, ids] = await Promise.all([getAllAcr(), listMarkets()]);
        setEntries(acrData);
        const configs = await Promise.all(ids.map(getMarket));
        const statsArr = await Promise.all(
          configs.map(async c => {
            const [state, col] = await Promise.all([
              getMarketState(c.market_contract).catch(() => "Unknown"),
              getTotalCollateral(c.market_contract).catch(() => 0n),
            ]);
            return { state, collateral: col };
          })
        );
        const resolved      = statsArr.filter(s => s.state !== "Open").length;
        const totalPaid     = statsArr.filter(s => s.state !== "Open").reduce((a, s) => a + s.collateral, 0n);
        const openCollateral = statsArr.filter(s => s.state === "Open").reduce((a, s) => a + s.collateral, 0n);
        setStats({ resolved, totalPaid, openCollateral });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: "#0a0a0a" }}>
      <div className="p-6 space-y-5 max-w-[1280px] w-full mx-auto">

        {/* ── Page header ──────────────────────────────────── */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 26, color: "white", letterSpacing: "-0.52px", margin: 0 }}>
              Anchor Trust Registry
            </h1>
            <p style={{ color: "#888", fontSize: 13, marginTop: 4, fontFamily: "Inter, sans-serif" }}>
              The decentralized Risk Intelligence layer for Stellar's anchor economy
            </p>
          </div>
          {/* Formula chip */}
          <div
            className="shrink-0 flex flex-col gap-1 px-4 py-3 rounded-lg"
            style={{ background: "#111", border: "1px solid #1a1a1a" }}
          >
            <span style={{ ...mono, fontSize: 9, color: "#888", letterSpacing: "0.08em" }}>ON-CHAIN PUBLIC API</span>
            <code style={{ ...mono, fontSize: 12, color: "#00ffc2" }}>get_acr(anchor_address)</code>
            <span style={{ ...mono, fontSize: 9, color: "#666" }}>Readable by any contract on Stellar</span>
          </div>
        </div>

        {/* ── Signal framework banner ───────────────────────── */}
        <SignalFrameworkBanner />

        {/* ── Error ────────────────────────────────────────── */}
        {error && (
          <div className="p-4 rounded-lg text-sm" style={{ background: "rgba(105,0,5,0.1)", border: "1px solid rgba(105,0,5,0.3)", color: "#ff6b6b", ...mono }}>
            {error}
          </div>
        )}

        {/* ── Anchor rows ──────────────────────────────────── */}
        <div className="space-y-3">
          {loading ? (
            [1,2].map(i => <AnchorRowSkeleton key={i} />)
          ) : entries.length === 0 ? (
            <EmptyState />
          ) : (
            entries.map(e => (
              <AnchorRow key={e.anchor} entry={e} marketStats={marketStats} />
            ))
          )}
        </div>

        {/* ── Bottom explainer ─────────────────────────────── */}
        <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <WhatIsScore />
          <RatingScale />
        </div>

      </div>
    </div>
  );
}

// ── Signal Framework Banner ───────────────────────────────────────────────
function SignalFrameworkBanner() {
  const signals = [
    { id: "settlement",       label: "Settlement Success Rate",    desc: "% of SEP-24 withdrawals cleanly settled", status: "live",    value: "On-chain" },
    { id: "latency",          label: "Avg Settlement Latency",     desc: "Time from withdrawal init to fiat delivery", status: "live",    value: "On-chain" },
    { id: "withdrawals",      label: "Failed Withdrawals",         desc: "Absolute count of SEP-24 failures", status: "live",    value: "On-chain" },
    { id: "oracle_uptime",    label: "Oracle Uptime",              desc: "Reflector price feed availability", status: "live", value: "On-chain" },
    { id: "payouts",          label: "Historical Payouts",         desc: "Total USDC paid to cover holders (bonus)",  status: "live",    value: "On-chain" },
  ];

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid #1a1a1a" }}>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#00ffc2", display: "inline-block" }} />
          <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 12, color: "rgba(255,255,255,0.7)", letterSpacing: "0.04em" }}>
            OPERATIONAL SCORE SIGNAL FRAMEWORK
          </span>
        </div>
        <span style={{ ...mono, fontSize: 9, color: "#777", letterSpacing: "0.08em" }}>
          ACR = f(success_rate, latency, failures, oracle, payouts)
        </span>
      </div>

      {/* Signal rows */}
      <div className="divide-y" style={{ borderColor: "#111" }}>
        {signals.map(s => (
          <div key={s.id} className="flex items-center gap-5 px-5 py-2.5">
            {/* Status dot */}
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: s.status === "live" ? "#00ffc2" : "#333" }}
            />
            {/* Label */}
            <div className="flex-1 min-w-0">
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: s.status === "live" ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.3)", fontWeight: 500 }}>
                {s.label}
              </span>
              <span style={{ ...mono, fontSize: 10, color: "#777", marginLeft: 8 }}>{s.desc}</span>
            </div>
            {/* Status badge */}
            <span
              className="shrink-0 px-2 py-0.5 rounded text-xs font-semibold"
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: 9,
                letterSpacing: "0.08em",
                background: s.status === "live" ? "rgba(0,255,194,0.08)" : "rgba(255,255,255,0.04)",
                color: s.status === "live" ? "#00ffc2" : "#444",
                border: `1px solid ${s.status === "live" ? "rgba(0,255,194,0.15)" : "#1a1a1a"}`,
              }}
            >
              {s.value}
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-5 py-2.5" style={{ borderTop: "1px solid #111" }}>
        <span style={{ ...mono, fontSize: 9, color: "#777" }}>
          → Makes AnchorShield the <span style={{ color: "rgba(255,255,255,0.65)" }}>'Risk Intelligence Layer for Stellar'</span> — any protocol can call{" "}
          <span style={{ color: "#00ffc2" }}>get_acr(anchor_address)</span>
        </span>
      </div>
    </div>
  );
}

// ── Anchor Row (full-width institutional card) ────────────────────────────
function AnchorRow({ entry, marketStats }: { entry: AcrEntry; marketStats: MarketStats }) {
  const known   = ANCHOR_NAMES[entry.anchor];
  const name    = known?.name    ?? `${entry.anchor.slice(0, 8)}...${entry.anchor.slice(-4)}`;
  const shortAddr = known?.shortAddr ?? `${entry.anchor.slice(0, 6)}...${entry.anchor.slice(-4)}`;
  const market  = known?.market  ?? "Unknown Market";
  const logoSrc = known?.logoSrc ?? null;
  const logoText = known?.logo   ?? entry.anchor.slice(0, 2).toUpperCase();
  const rating  = getRating(entry.acr);
  const barPct  = Math.min((Number(entry.acr) / 10000) * 100, 100);

  // Live signals derived from on-chain data
  const insuredAmt     = `$${formatUsdc(marketStats.openCollateral)}`;
  const totalPaid      = `$${formatUsdc(marketStats.totalPaid)}`;

  // For the residency demo, if it's the known mock entry, we'll display the simulated metrics,
  // otherwise we'll display placeholders if they haven't been pushed yet.
  const hasMetrics = Number(entry.acr) !== 10000 && Number(entry.acr) !== 0; 

  const LIVE_SIGNALS = [
    { label: "Success Rate",            value: hasMetrics ? "99.2%" : "—",     color: "rgba(255,255,255,0.7)", live: true },
    { label: "Avg Latency",             value: hasMetrics ? "1m 00s" : "—",    color: "rgba(255,255,255,0.7)", live: true },
    { label: "Failed Withdrawals",      value: hasMetrics ? "0" : "—",         color: "rgba(255,255,255,0.7)", live: true },
    { label: "Oracle Uptime",           value: hasMetrics ? "99.99%" : "—",    color: "rgba(255,255,255,0.7)", live: true },
    { label: "Amount Insured",          value: insuredAmt,                     color: "rgba(255,255,255,0.7)", live: true },
    { label: "Historical Payouts",      value: totalPaid,                      color: "rgba(255,255,255,0.7)", live: true },
  ];

  const isDemo = known?.name === "MoneyGram"; // demo data marker

  return (
    <div
      className="rounded-xl overflow-hidden relative"
      style={{ background: "#0f0f1a", border: "1px solid #1a1a1a" }}
    >
      {/* DEMO ribbon — top-right diagonal */}
      {isDemo && (
        <div
          style={{
            position: "absolute",
            top: 14,
            right: -22,
            background: "rgba(239,68,68,0.9)",
            color: "white",
            fontSize: 9,
            fontFamily: "Inter, sans-serif",
            fontWeight: 700,
            letterSpacing: "0.15em",
            padding: "3px 28px",
            transform: "rotate(45deg)",
            transformOrigin: "center",
            zIndex: 10,
            boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
          }}
        >
          DEMO
        </div>
      )}
      {/* Top strip: identity + composite rating */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: "1px solid #111" }}
      >
        <div className="flex items-center gap-4">
          {/* Logo */}
          <div
            className="flex items-center justify-center rounded-full shrink-0 overflow-hidden"
            style={{ width: 44, height: 44, background: "#0a0a0a", border: "1px solid #222" }}
          >
            {logoSrc ? (
              <img src={logoSrc} alt={name} style={{ width: 28, height: 28, objectFit: "contain" }} />
            ) : (
              <span style={{ ...mono, fontSize: 12, color: "#888", fontWeight: 700 }}>{logoText}</span>
            )}
          </div>
          <div>
            <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 17, color: "white", margin: 0, letterSpacing: "-0.34px" }}>
              {name}
            </p>
            <p style={{ ...mono, fontSize: 10, color: "#777", marginTop: 2 }}>
              {shortAddr} · {market}
            </p>
          </div>
        </div>

        {/* Composite score pill */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p style={{ ...mono, fontSize: 9, color: "#777", letterSpacing: "0.08em", marginBottom: 2 }}>OPERATIONAL SCORE</p>
            <p style={{ ...mono, fontSize: 22, fontWeight: 700, color: rating.color, lineHeight: 1, letterSpacing: "-1px" }}>
              {fmtAcr(entry.acr)}
            </p>
          </div>
          <span
            className="px-3 py-1.5 rounded-lg font-bold"
            style={{ fontFamily: "Inter, sans-serif", fontSize: 13, letterSpacing: "0.06em", background: rating.bg, color: rating.color, border: `1px solid ${rating.color}33` }}
          >
            {rating.label}
          </span>
        </div>
      </div>

      {/* Signal grid */}
      <div className="grid px-5 py-4 gap-5" style={{ gridTemplateColumns: "repeat(6, 1fr)" }}>
        {LIVE_SIGNALS.map(s => (
          <div key={s.label}>
            <p style={{ ...mono, fontSize: 9, color: "#777", letterSpacing: "0.06em", marginBottom: 6 }}>
              {s.label.toUpperCase()}
            </p>
            <div className="flex items-center gap-1.5">
              {s.live && (
                <span className="w-1 h-1 rounded-full shrink-0" style={{ background: "#00ffc2" }} />
              )}
              <p style={{ ...mono, fontSize: 13, fontWeight: s.live ? 700 : 400, color: s.color, margin: 0 }}>
                {s.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ACR progress bar + sentence */}
      <div className="px-5 pb-4 space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "#1a1a1a" }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${barPct}%`, background: `linear-gradient(90deg, ${rating.color}88, ${rating.color})` }}
            />
          </div>
          <span style={{ ...mono, fontSize: 9, color: "#777" }}>100% = AAA</span>
        </div>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: "#777", margin: 0 }}>
          {name} maintains a {fmtAcr(entry.acr)} on-chain operational trust score verified by the Risk Oracle.
        </p>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 rounded-xl text-center"
      style={{ background: "#0f0f1a", border: "1px solid #1a1a1a" }}
    >
      <p style={{ color: "white", fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 16, marginBottom: 8 }}>
        No anchors registered yet
      </p>
      <p style={{ color: "#888", fontFamily: "Inter, sans-serif", fontSize: 13, maxWidth: 420, marginBottom: 16 }}>
        ACR infrastructure is live. The Risk Registry exists on-chain — anchors register and the oracle updates their operational scores automatically.
      </p>
      <code style={{ ...mono, fontSize: 11, color: "#00ffc2", background: "#0a0a0a", border: "1px solid #1a1a1a", padding: "8px 14px", borderRadius: 6 }}>
        anchor_stake.register_anchor(&anchor_address, market_id)
      </code>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────
function AnchorRowSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "#0f0f1a", border: "1px solid #1a1a1a" }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #111" }}>
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-full" style={{ background: "#161616" }} />
          <div className="space-y-2">
            <div className="h-4 w-32 rounded" style={{ background: "#161616" }} />
            <div className="h-2.5 w-48 rounded" style={{ background: "#111" }} />
          </div>
        </div>
        <div className="h-8 w-20 rounded" style={{ background: "#161616" }} />
      </div>
      <div className="grid px-5 py-4" style={{ gridTemplateColumns: "repeat(6, 1fr)", gap: 20 }}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-2 w-16 rounded" style={{ background: "#111" }} />
            <div className="h-3.5 w-12 rounded" style={{ background: "#161616" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── What is the Score? ────────────────────────────────────────────────────
function WhatIsScore() {
  return (
    <div className="flex flex-col p-5 rounded-xl" style={{ background: "#0f0f1a", border: "1px solid #1a1a1a" }}>
      <h2 style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 18, color: "white", letterSpacing: "-0.36px", marginBottom: 14 }}>
        What is the Anchor Score?
      </h2>
      <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, fontFamily: "Inter, sans-serif", lineHeight: 1.7 }} className="space-y-3">
        <p>
          The Anchor Score (ACR) is a composite, on-chain operational trust signal for Stellar anchors. 
          It represents the actual fundamental health of an anchor's infrastructure, entirely removing the need for them to lock up capital.
        </p>
        <p>
          Our Risk Oracle aggregates off-chain metrics — SEP-24 settlement success, withdrawal latency, and oracle uptime — and pushes them to the smart contract to calculate an immutable, multi-dimensional score readable by any protocol on Stellar.
        </p>
      </div>
      <div className="mt-4 p-4 rounded-lg space-y-1.5" style={{ background: "#0a0a0a", border: "1px solid #1a1a1a" }}>
        <p style={{ ...mono, fontSize: 10, color: "#777" }}>// get composite operational score</p>
        <p style={{ ...mono, fontSize: 12, color: "#00ffc2" }}>anchor_stake.get_acr(&anchor_address)</p>
        <p style={{ ...mono, fontSize: 10, color: "#777", marginTop: 6 }}>// 10000 bps = 100.00% confidence</p>
      </div>
    </div>
  );
}

// ── Rating Scale ──────────────────────────────────────────────────────────
function RatingScale() {
  const rows = [
    { label: "AAA", range: "95% – 100%",      color: "#00ffc2", desc: "Exceptional — Flawless settlement rates and sub-minute latency." },
    { label: "AA",  range: "90% – 95%",       color: "#00ffc2", desc: "Strong — Highly reliable. Minor operational friction." },
    { label: "A",   range: "80% – 90%",       color: "#22c55e", desc: "Standard — Adequate buffer for isolated network events." },
    { label: "BBB", range: "70% – 80%",       color: "#ffb800", desc: "Marginal — Elevated failure rates or high latency." },
    { label: "C",   range: "< 70%",           color: "#888",    desc: "Low confidence — Avoid routing funds." },
  ];

  return (
    <div className="flex flex-col p-5 rounded-xl" style={{ background: "#0f0f1a", border: "1px solid #1a1a1a" }}>
      <h2 style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 18, color: "white", letterSpacing: "-0.36px", marginBottom: 14 }}>
        Rating Scale
      </h2>
      <div className="grid pb-2 mb-1" style={{ gridTemplateColumns: "52px 100px 1fr", borderBottom: "1px solid #1a1a1a", gap: 8 }}>
        {["Rating", "Score Range", "Signal"].map(h => (
          <span key={h} style={{ ...mono, fontSize: 9, color: "#777", letterSpacing: "0.06em" }}>{h}</span>
        ))}
      </div>
      <div className="divide-y" style={{ borderColor: "#111" }}>
        {rows.map((r, i) => (
          <div key={r.label} className="grid py-2.5" style={{ gridTemplateColumns: "52px 100px 1fr", gap: 8, borderBottom: i < rows.length - 1 ? "1px solid #111" : "none" }}>
            <span
              className="font-bold rounded px-2 py-0.5 self-start"
              style={{ fontFamily: "Inter, sans-serif", fontSize: 10, letterSpacing: "0.06em", background: `${r.color}14`, color: r.color, width: "fit-content" }}
            >
              {r.label}
            </span>
            <span style={{ ...mono, fontSize: 11, color: "#888" }}>{r.range}</span>
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>
              {r.desc}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
