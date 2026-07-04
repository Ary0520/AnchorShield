"use client";

import { useState, useEffect } from "react";
import { getAllAcr, getAcr, formatUsdc, ANCHOR_STAKE_ID } from "@/lib/contracts";

// ── Same mono token as hedge markets page ─────────────────────────────────
const mono = { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" };

// ── Known anchor display names ────────────────────────────────────────────
const ANCHOR_NAMES: Record<string, { name: string; shortAddr: string; market: string; logo: string }> = {
  GDMXS7S7CFSVRLMEPF55ZNKYNBNDNIC6FNFU6DMT4TY62IRYPC6IPX24: {
    name: "MoneyGram",
    shortAddr: "GDMXS7...HPWM",
    market: "USDC Depeg (Market 0)",
    logo: "MG",
  },
  GB4FRPZQ3AILWMBEOVQ6DDNMRDJVREPVDPZ2WMFDPTGODUXOFTUKS777: {
    name: "Circle",
    shortAddr: "GAKUX5...ZXWQ",
    market: "EURC Depeg (Market 1)",
    logo: "CI",
  },
};

// ── ACR rating helpers — same scale as existing AcrDashboard component ────
type Rating = { label: string; color: string; bgColor: string; min: number };
const RATINGS: Rating[] = [
  { label: "AAA", color: "#00ffc2", bgColor: "rgba(0,255,194,0.15)",  min: 20000 },
  { label: "AA",  color: "#00ffc2", bgColor: "rgba(0,255,194,0.12)",  min: 10000 },
  { label: "A",   color: "#22c55e", bgColor: "rgba(34,197,94,0.12)",  min: 5000  },
  { label: "BBB", color: "#ffb800", bgColor: "rgba(255,184,0,0.15)",  min: 1000  },
  { label: "C",   color: "#888",    bgColor: "rgba(136,136,136,0.1)", min: 0     },
];

function getRating(bps: bigint): Rating {
  const n = Number(bps);
  for (const r of RATINGS) {
    if (n >= r.min) return r;
  }
  return RATINGS[RATINGS.length - 1];
}

function formatAcr(bps: bigint): string {
  const n = Number(bps);
  return `${(n / 10000).toFixed(2)}x`;
}

// ACR bar: 20000 bps = 2.0x = full bar
function acrBarPct(bps: bigint): number {
  return Math.min((Number(bps) / 20000) * 100, 100);
}

function acrSentence(name: string, bps: bigint): string {
  const dollars = (Number(bps) / 10000).toFixed(2);
  return `${name} has $${dollars} at stake per $1.00 of cover sold`;
}

interface AcrEntry { anchor: string; acr: bigint }

export default function AnchorTrustPage() {
  const [entries, setEntries] = useState<AcrEntry[]>([]);
  const [loading, setLoading]  = useState(true);
  const [error, setError]      = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    getAllAcr()
      .then(setEntries)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load ACR data"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: "#0a0a0a" }}>
      <div className="p-6 space-y-6 max-w-[1200px] w-full mx-auto">

        {/* ── Page header ─────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div>
            <h1
              style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 28, color: "white", letterSpacing: "-0.56px", margin: 0 }}
            >
              Anchor Trust
            </h1>
            <p style={{ color: "#888", fontSize: 13, marginTop: 4, fontFamily: "Inter, sans-serif" }}>
              How much skin each anchor has in the game
            </p>
          </div>
          <div className="text-right" style={{ flexShrink: 0 }}>
            <p style={{ ...mono, color: "#888", fontSize: 11 }}>
              ACR = staked USDC ÷ cover outstanding
            </p>
            <p style={{ ...mono, color: "#888", fontSize: 11, marginTop: 2 }}>
              ∞ Readable on-chain via{" "}
              <span style={{ color: "#00ffc2" }}>get_acr()</span>
            </p>
          </div>
        </div>

        {/* ── Dismissible info banner ──────────────────────────── */}
        {!bannerDismissed && (
          <div
            className="relative flex items-start gap-3 p-4 rounded-lg"
            style={{ background: "rgba(0,255,194,0.06)", border: "1px solid rgba(0,255,194,0.2)" }}
          >
            <span style={{ color: "#00ffc2", fontSize: 18, flexShrink: 0, marginTop: 1 }}>ⓘ</span>
            <div>
              <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 14, color: "#00ffc2", marginBottom: 6 }}>
                Skin in the Game Mechanism
              </p>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.6, margin: 0 }}>
                Anchors earn premiums by staking capital against their own markets. A higher Anchor Coverage Ratio (ACR)
                indicates more direct capital at risk per dollar of user cover, aligning incentives and providing a
                primary tranche of backstop liquidity.
              </p>
            </div>
            <button
              onClick={() => setBannerDismissed(true)}
              style={{ position: "absolute", top: 12, right: 12, background: "transparent", border: "none", color: "#888", fontSize: 18, cursor: "pointer", lineHeight: 1 }}
            >
              ×
            </button>
          </div>
        )}

        {/* ── Loading / Error ──────────────────────────────────── */}
        {loading && (
          <div className="grid grid-cols-3 gap-4">
            {[1,2,3].map(i => (
              <div key={i} className="rounded-lg animate-pulse" style={{ height: 200, background: "#161616" }} />
            ))}
          </div>
        )}
        {error && (
          <div className="p-4 rounded-lg text-sm" style={{ background: "rgba(105,0,5,0.1)", border: "1px solid rgba(105,0,5,0.3)", color: "#ff6b6b", ...mono }}>
            {error}
          </div>
        )}

        {/* ── Anchor cards grid ────────────────────────────────── */}
        {!loading && !error && entries.length === 0 && (
          <div
            className="flex flex-col items-center justify-center py-16 rounded-lg text-center"
            style={{ background: "#161616", border: "1px solid #222" }}
          >
            <p style={{ color: "white", fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 16, marginBottom: 8 }}>
              No anchors have staked yet
            </p>
            <p style={{ color: "#888", fontFamily: "Inter, sans-serif", fontSize: 13, maxWidth: 420 }}>
              ACR infrastructure is live — anchors can register via the contract. The on-chain primitive exists regardless.
            </p>
            <code
              className="mt-4 px-3 py-2 rounded"
              style={{ ...mono, fontSize: 11, color: "#00ffc2", background: "#0a0a0a", border: "1px solid #222" }}
            >
              anchor_stake.register_anchor(&anchor_address, market_id)
            </code>
          </div>
        )}

        {!loading && !error && entries.length > 0 && (
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {entries.map(e => <AnchorCard key={e.anchor} entry={e} />)}
          </div>
        )}

        {/* ── What is ACR? + Trust Rating Scale ───────────────── */}
        <div className="grid grid-cols-1 gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <WhatIsAcr />
          <TrustRatingScale />
        </div>

      </div>
    </div>
  );
}

// ── Anchor Card ───────────────────────────────────────────────────────────
function AnchorCard({ entry }: { entry: AcrEntry }) {
  const known   = ANCHOR_NAMES[entry.anchor];
  const name    = known?.name    ?? `${entry.anchor.slice(0, 8)}...${entry.anchor.slice(-4)}`;
  const shortAddr = known?.shortAddr ?? `${entry.anchor.slice(0, 6)}...${entry.anchor.slice(-4)}`;
  const market  = known?.market  ?? "Unknown Market";
  const logo    = known?.logo    ?? entry.anchor.slice(0, 2).toUpperCase();
  const rating  = getRating(entry.acr);
  const barPct  = acrBarPct(entry.acr);
  const sentence = acrSentence(name, entry.acr);

  // Fake staked/cover for demo (contract has get_stake + get_cover_outstanding)
  // In production these would be fetched; for now show ACR-derived placeholders
  const acrNum  = Number(entry.acr) / 10000;

  return (
    <div
      className="flex flex-col rounded-lg overflow-hidden"
      style={{ background: "#161616", border: "1px solid #222" }}
    >
      {/* Card header */}
      <div className="flex items-start justify-between p-4 pb-3">
        <div className="flex items-center gap-3">
          {/* Logo circle */}
          <div
            className="flex items-center justify-center rounded-full shrink-0"
            style={{ width: 40, height: 40, background: "#0a0a0a", border: "1px solid #333" }}
          >
            <span style={{ ...mono, fontSize: 11, color: "#888", fontWeight: 700 }}>{logo}</span>
          </div>
          <div>
            <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 16, color: "white", margin: 0 }}>
              {name}
            </p>
            <p style={{ ...mono, fontSize: 10, color: "#555", marginTop: 2 }}>{shortAddr}</p>
          </div>
        </div>
        {/* Rating badge */}
        <span
          className="rounded px-2 py-0.5 font-bold text-xs"
          style={{ background: rating.bgColor, color: rating.color, fontFamily: "Inter, sans-serif", letterSpacing: "0.5px" }}
        >
          {rating.label}
        </span>
      </div>

      {/* Market covered */}
      <div className="px-4 pb-3">
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "#555" }}>
          Market covered:{" "}
          <span style={{ color: "#888" }}>{market}</span>
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-0 px-4 pb-3" style={{ borderTop: "1px solid rgba(34,34,34,0.6)", paddingTop: 12 }}>
        {[
          { label: "Staked",   value: "—" },
          { label: "Cover",    value: "—" },
          { label: "ACR",      value: formatAcr(entry.acr), color: rating.color },
        ].map(s => (
          <div key={s.label}>
            <p style={{ ...mono, fontSize: 10, color: "#555", marginBottom: 4 }}>{s.label}</p>
            <p style={{ ...mono, fontSize: 14, color: s.color ?? "white", fontWeight: 700, margin: 0 }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* ACR progress bar */}
      <div className="px-4 pb-2">
        <div
          className="relative h-1.5 rounded-full overflow-hidden"
          style={{ background: "#222" }}
        >
          <div
            className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
            style={{ width: `${barPct}%`, background: rating.color }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span style={{ ...mono, fontSize: 9, color: "#444" }}>0</span>
          <span style={{ ...mono, fontSize: 9, color: "#444" }}>2.0x (AAA)</span>
        </div>
      </div>

      {/* Sentence footer */}
      <div
        className="px-4 py-3"
        style={{ borderTop: "1px solid rgba(34,34,34,0.6)" }}
      >
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: "#555", margin: 0, lineHeight: 1.5 }}>
          {sentence}
        </p>
      </div>
    </div>
  );
}

// ── What is ACR? ──────────────────────────────────────────────────────────
function WhatIsAcr() {
  return (
    <div
      className="flex flex-col p-6 rounded-lg"
      style={{ background: "#161616", border: "1px solid #222" }}
    >
      <h2
        style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 20, color: "white", letterSpacing: "-0.4px", marginBottom: 16 }}
      >
        What is ACR?
      </h2>
      <div className="space-y-3" style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontFamily: "Inter, sans-serif", lineHeight: 1.7 }}>
        <p>
          The Anchor Coverage Ratio (ACR) quantifies the exact financial exposure
          an anchor has taken upon themselves relative to the total capacity of
          insurance they are underwriting.
        </p>
        <p>
          It is calculated by dividing their directly staked collateral by the total
          outstanding cover active in the market.
        </p>
        <p>
          A higher ratio implies a more secure protocol, as the anchor stands to
          lose significant personal capital before generalized risk pools are tapped.
        </p>
        <p>
          This metric is enforced at the contract level and dynamically updates
          based on real-time staking flows and policy issuances.
        </p>
      </div>

      {/* Code block */}
      <div
        className="mt-5 p-4 rounded-lg"
        style={{ background: "#0a0a0a", border: "1px solid #2a2a2a" }}
      >
        <p style={{ ...mono, fontSize: 11, color: "#555", marginBottom: 8 }}>// Any Soroban contract can read:</p>
        <p style={{ ...mono, fontSize: 12, color: "#00ffc2", margin: 0 }}>
          anchor_stake.get_acr(&amp;anchor_address)
        </p>
        <p style={{ ...mono, fontSize: 11, color: "#555", marginTop: 8, marginBottom: 0 }}>
          // Returns: 10000 = 1.0x · 20000 = 2.0x
        </p>
      </div>
    </div>
  );
}

// ── Trust Rating Scale ────────────────────────────────────────────────────
function TrustRatingScale() {
  const rows = [
    { label: "AAA", range: "> 0.50x",         color: "#00ffc2", desc: "Exceptional capital commitment. Over-collateralized relative to historical drawdowns." },
    { label: "AA",  range: "0.25x – 0.50x",   color: "#00ffc2", desc: "Strong capital backstop. Highly resilient to correlated shock events." },
    { label: "A",   range: "0.10x – 0.25x",   color: "#22c55e", desc: "Standard coverage. Adequate buffer for isolated claim events." },
    { label: "BBB", range: "0.05x – 0.10x",   color: "#ffb800", desc: "Marginal commitment. Elevated risk of generalized pool utilization." },
    { label: "C",   range: "< 0.05x",          color: "#888",    desc: "Critically low skin-in-the-game. High systemic dependency." },
  ];

  return (
    <div
      className="flex flex-col p-6 rounded-lg"
      style={{ background: "#161616", border: "1px solid #222" }}
    >
      <h2
        style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 20, color: "white", letterSpacing: "-0.4px", marginBottom: 20 }}
      >
        Trust Rating Scale
      </h2>

      {/* Table header */}
      <div
        className="grid pb-3 mb-1"
        style={{ gridTemplateColumns: "60px 110px 1fr", borderBottom: "1px solid #222", gap: 8 }}
      >
        {["Rating", "ACR Range", "Description"].map(h => (
          <span key={h} style={{ ...mono, fontSize: 10, color: "#555", letterSpacing: "0.5px" }}>{h}</span>
        ))}
      </div>

      {/* Rows */}
      <div className="flex flex-col divide-y" style={{ borderColor: "rgba(34,34,34,0.5)" }}>
        {rows.map((r, i) => (
          <div
            key={r.label}
            className="grid py-3"
            style={{ gridTemplateColumns: "60px 110px 1fr", gap: 8, borderBottom: i < rows.length - 1 ? "1px solid rgba(34,34,34,0.5)" : "none" }}
          >
            <span
              className="font-bold rounded px-2 py-0.5 text-xs self-start text-center"
              style={{
                background: r.color === "#888" ? "rgba(136,136,136,0.1)" : `${r.color}22`,
                color: r.color,
                fontFamily: "Inter, sans-serif",
                letterSpacing: "0.5px",
                width: "fit-content",
              }}
            >
              {r.label}
            </span>
            <span style={{ ...mono, fontSize: 11, color: "#888" }}>{r.range}</span>
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>
              {r.desc}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
