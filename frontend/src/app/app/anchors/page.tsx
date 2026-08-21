"use client";

import { useState, useEffect } from "react";
import { getAllMetrics, formatUsdc, AnchorMetrics } from "@/lib/contracts";

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

type RatingLabel = "AAA" | "AA" | "A" | "BBB" | "C" | "—";
const RATING_CONFIG: { label: RatingLabel; color: string; bg: string; min: number }[] = [
  { label: "AAA", color: "#00ffc2", bg: "rgba(0,255,194,0.12)",   min: 9500 },
  { label: "AA",  color: "#00ffc2", bg: "rgba(0,255,194,0.09)",   min: 9000 },
  { label: "A",   color: "#22c55e", bg: "rgba(34,197,94,0.1)",    min: 8000 },
  { label: "BBB", color: "#ffb800", bg: "rgba(255,184,0,0.12)",   min: 7000 },
  { label: "C",   color: "#ff4444", bg: "rgba(255,68,68,0.08)",   min: 0    },
];

function getRating(bps: bigint) {
  const n = Number(bps);
  return RATING_CONFIG.find(r => n >= r.min) ?? RATING_CONFIG[RATING_CONFIG.length - 1];
}

function fmtAcr(bps: bigint): string {
  return `${(Number(bps) / 100).toFixed(2)}%`;
}

interface AcrEntry { anchor: string; metrics: AnchorMetrics; acr: bigint }

export default function AnchorTrustPage() {
  const [entries, setEntries] = useState<AcrEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const acrData = await getAllMetrics();
        setEntries(acrData);
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
      <div className="p-6 space-y-6 max-w-[1280px] w-full mx-auto">

        {/* ── Page header ──────────────────────────────────── */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 26, color: "white", letterSpacing: "-0.52px", margin: 0, textTransform: "uppercase" }}>
              ACR - Operational Risk Registry
            </h1>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: "rgba(0,255,194,0.1)" }}>
            <div className="w-2 h-2 rounded-full" style={{ background: "#00ffc2", boxShadow: "0 0 8px #00ffc2", animation: "pulse 2s infinite" }} />
            <span style={{ ...mono, fontSize: 10, color: "#00ffc2", letterSpacing: "0.05em" }}>LIVE RISK ORACLE SYNC</span>
          </div>
        </div>

        {/* ── Developer Integration ────────────────────────── */}
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #1a1a1a", background: "#111" }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid #1a1a1a" }}>
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"><path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/></svg>
              <span style={{ ...mono, fontSize: 11, color: "#888", letterSpacing: "0.05em" }}>DEVELOPER INTEGRATION</span>
            </div>
            <button className="text-[#888] hover:text-white transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
          </div>
          <div className="px-4 py-4">
            <code style={{ ...mono, fontSize: 13, color: "#e5e5e5" }}>
              <span style={{ color: "#c678dd" }}>let</span> acr = env.invoke_contract(&risk_registry, &<span style={{ color: "#e5c07b" }}>Symbol</span>::<span style={{ color: "#61afef" }}>new</span>(&env, <span style={{ color: "#98c379" }}>"get_acr"</span>), (anchor,));
            </code>
          </div>
        </div>

        {/* ── Error ────────────────────────────────────────── */}
        {error && (
          <div className="p-4 rounded-lg text-sm" style={{ background: "rgba(105,0,5,0.1)", border: "1px solid rgba(105,0,5,0.3)", color: "#ff6b6b", ...mono }}>
            {error}
          </div>
        )}

        {/* ── Table ────────────────────────────────────────── */}
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #1a1a1a", background: "#111" }}>
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #1a1a1a" }}>
            <h2 style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: 18, color: "white", margin: 0 }}>Anchor Registry</h2>
            <select className="bg-transparent border-none text-[#888] text-sm outline-none cursor-pointer" style={mono}>
              <option>All Anchors</option>
            </select>
          </div>
          
          <table className="w-full text-left" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1a1a1a" }}>
                <th className="px-5 py-3 font-normal" style={{ ...mono, fontSize: 10, color: "#666", letterSpacing: "0.05em" }}>ANCHOR ENTITY</th>
                <th className="px-5 py-3 font-normal" style={{ ...mono, fontSize: 10, color: "#666", letterSpacing: "0.05em" }}>SEP-24 SUCCESS</th>
                <th className="px-5 py-3 font-normal" style={{ ...mono, fontSize: 10, color: "#666", letterSpacing: "0.05em" }}>AVG LATENCY</th>
                <th className="px-5 py-3 font-normal" style={{ ...mono, fontSize: 10, color: "#666", letterSpacing: "0.05em" }}>ORACLE UPTIME</th>
                <th className="px-5 py-3 font-normal" style={{ ...mono, fontSize: 10, color: "#666", letterSpacing: "0.05em" }}>COMPOSITE ACR</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center" style={{ color: "#666", ...mono }}>Loading registry data...</td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center" style={{ color: "#666", ...mono }}>No anchors registered yet.<br/>(Run the Watcher to push metrics)</td>
                </tr>
              ) : (
                entries.map(e => {
                  const meta = ANCHOR_NAMES[e.anchor] || { name: "Unknown Anchor", shortAddr: e.anchor.slice(0,6) + "..." + e.anchor.slice(-4), logo: null };
                  const rating = getRating(e.acr);
                  return (
                    <tr key={e.anchor} style={{ borderBottom: "1px solid #1a1a1a" }} className="hover:bg-[#151515] transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                            {meta.logoSrc ? <img src={meta.logoSrc} className="w-6 h-6 object-contain" /> : <span style={{ color: "#888", fontSize: 14 }}>{meta.logo || "?"}</span>}
                          </div>
                          <div>
                            <div style={{ color: "white", fontSize: 14, fontFamily: "Inter, sans-serif" }}>{meta.name}</div>
                            <div style={{ color: "#666", fontSize: 11, ...mono }}>{meta.shortAddr}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4" style={{ color: "#ccc", ...mono, fontSize: 13 }}>
                        {(e.metrics.success_rate_bps / 100).toFixed(2)}%
                      </td>
                      <td className="px-5 py-4" style={{ color: "#ccc", ...mono, fontSize: 13 }}>
                        {e.metrics.avg_latency_seconds}s
                      </td>
                      <td className="px-5 py-4" style={{ color: "#ccc", ...mono, fontSize: 13 }}>
                        {(e.metrics.oracle_uptime_bps / 100).toFixed(2)}%
                      </td>
                      <td className="px-5 py-4">
                        <div className="inline-flex items-center gap-3 px-3 py-1.5 rounded" style={{ background: rating.bg, border: `1px solid ${rating.color}20` }}>
                          <span style={{ color: rating.color, ...mono, fontSize: 13 }}>{fmtAcr(e.acr)}</span>
                          <span style={{ color: rating.color, opacity: 0.3 }}>|</span>
                          <span style={{ color: rating.color, ...mono, fontSize: 11, fontWeight: 600 }}>{rating.label}</span>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* CSS for pulsing dot */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse {
          0% { opacity: 1; box-shadow: 0 0 8px #00ffc2; }
          50% { opacity: 0.5; box-shadow: 0 0 2px #00ffc2; }
          100% { opacity: 1; box-shadow: 0 0 8px #00ffc2; }
        }
      `}} />
    </div>
  );
}
