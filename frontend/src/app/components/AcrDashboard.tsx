"use client";

import { useEffect, useState } from "react";
import { getAllAcr, formatAcr, ANCHOR_STAKE_ID } from "@/lib/contracts";

// Known anchor addresses → display names
// In production this would come from an on-chain registry or TOML files
const ANCHOR_NAMES: Record<string, { name: string; domain: string; logo: string }> = {
  GDMXS7S7CFSVRLMEPF55ZNKYNBNDNIC6FNFU6DMT4TY62IRYPC6IPX24: {
    name: "MoneyGram",
    domain: "moneygram.com",
    logo: "MG",
  },
  GB4FRPZQ3AILWMBEOVQ6DDNMRDJVREPVDPZ2WMFDPTGODUXOFTUKS777: {
    name: "Bitso",
    domain: "bitso.com",
    logo: "BI",
  },
};

interface AcrEntry {
  anchor: string;
  acr: bigint;
}

function acrRating(bps: bigint): { label: string; color: string; bg: string } {
  if (bps >= 20_000n) return { label: "AAA", color: "#16a34a", bg: "#dcfce7" };
  if (bps >= 10_000n) return { label: "AA",  color: "#15803d", bg: "#f0fdf4" };
  if (bps >= 5_000n)  return { label: "A",   color: "#ca8a04", bg: "#fef9c3" };
  if (bps >= 1_000n)  return { label: "BBB", color: "#d97706", bg: "#fff7ed" };
  return               { label: "C",   color: "#dc2626", bg: "#fef2f2" };
}

export default function AcrDashboard() {
  const [entries, setEntries] = useState<AcrEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAllAcr()
      .then(setEntries)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load ACR data")
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded p-4">
        <h2 className="text-sm font-semibold mb-1">Anchor Confidence Ratio (ACR)</h2>
        <p className="text-xs text-gray-500 leading-relaxed">
          Anchors stake their own USDC as collateral against their market.
          ACR = staked USDC ÷ total YES tokens outstanding.
          Higher ACR = more skin in the game = more trustworthy anchor.
          This data is published on-chain and readable by any contract or wallet on Stellar.
        </p>
        <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
          {[
            { rating: "AAA", desc: "2.0x+", color: "#16a34a" },
            { rating: "AA",  desc: "1.0–2.0x", color: "#15803d" },
            { rating: "A",   desc: "0.5–1.0x", color: "#ca8a04" },
            { rating: "BBB", desc: "0.1–0.5x", color: "#d97706" },
          ].map(r => (
            <div key={r.rating} className="text-center p-2 bg-gray-50 rounded">
              <div className="font-bold" style={{ color: r.color }}>{r.rating}</div>
              <div className="text-gray-400">{r.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Anchor cards */}
      {loading && <p className="text-xs text-gray-400">Loading anchor data...</p>}
      {error && <p className="text-xs text-red-600 break-all">{error}</p>}
      {!loading && !error && entries.length === 0 && (
        <div className="bg-white border border-gray-200 rounded p-6 text-center text-xs text-gray-400">
          No anchors have staked yet.
        </div>
      )}

      {entries.map((e) => {
        const rating = acrRating(e.acr);
        const known = ANCHOR_NAMES[e.anchor];
        const barPct = Math.min(Number(e.acr) / 20_000 * 100, 100); // 20000 bps = full bar

        return (
          <div key={e.anchor} className="bg-white border border-gray-200 rounded p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                {/* Logo / avatar */}
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                  style={{ background: rating.color }}
                >
                  {known?.logo ?? e.anchor.slice(0, 2)}
                </div>
                <div>
                  <div className="text-sm font-semibold">
                    {known?.name ?? `${e.anchor.slice(0, 8)}...${e.anchor.slice(-4)}`}
                  </div>
                  {known && (
                    <div className="text-xs text-gray-400">{known.domain}</div>
                  )}
                  <div className="text-xs text-gray-400 font-mono mt-0.5">
                    {e.anchor.slice(0, 10)}...{e.anchor.slice(-6)}
                  </div>
                </div>
              </div>
              <div
                className="text-sm font-bold px-3 py-1 rounded-full"
                style={{ color: rating.color, background: rating.bg }}
              >
                {rating.label}
              </div>
            </div>

            {/* ACR bar */}
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${barPct}%`, background: rating.color }}
              />
            </div>

            <div className="flex justify-between text-xs text-gray-500">
              <span>ACR: <strong>{formatAcr(e.acr)}</strong></span>
              <span>stake / cover outstanding</span>
            </div>

            {/* What this means */}
            <div className="mt-2 text-xs text-gray-400 bg-gray-50 rounded p-2">
              {Number(e.acr) >= 10_000
                ? "✓ Anchor has staked more than the total cover sold — strong confidence signal"
                : Number(e.acr) >= 5_000
                ? "✓ Anchor covers at least half the outstanding YES tokens with their own stake"
                : Number(e.acr) >= 1_000
                ? "→ Anchor has partial coverage — some skin in the game"
                : "⚠ Low stake relative to cover outstanding — limited confidence signal"}
            </div>
          </div>
        );
      })}

      {/* On-chain note */}
      {entries.length > 0 && (
        <div className="text-xs text-gray-400 text-center py-2">
          Data sourced live from anchor-stake contract{" "}
          <span className="font-mono">{ANCHOR_STAKE_ID.slice(0, 8)}...</span>
          {" "}— readable by any contract on Stellar
        </div>
      )}
    </div>
  );
}
