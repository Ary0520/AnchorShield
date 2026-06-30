"use client";

import { useEffect, useState } from "react";
import { getAllAcr, formatAcr } from "@/lib/contracts";

interface AcrEntry {
  anchor: string;
  acr: bigint;
}

function acrLabel(bps: bigint): { label: string; color: string } {
  if (bps >= 20_000n) return { label: "AAA", color: "text-green-700" };
  if (bps >= 10_000n) return { label: "AA", color: "text-green-600" };
  if (bps >= 5_000n) return { label: "A", color: "text-yellow-600" };
  if (bps >= 1_000n) return { label: "BBB", color: "text-orange-600" };
  return { label: "C", color: "text-red-600" };
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
    <div className="bg-white border border-gray-200 rounded p-4">
      <h2 className="text-sm font-semibold mb-1">Anchor Confidence Ratio</h2>
      <p className="text-xs text-gray-400 mb-4">
        ACR = anchor staked USDC / total YES tokens outstanding. Higher = more
        confident anchor. Readable by any contract or wallet on Stellar.
      </p>

      {loading && <p className="text-xs text-gray-400">Loading...</p>}
      {error && (
        <p className="text-xs text-red-600 break-all">{error}</p>
      )}
      {!loading && !error && entries.length === 0 && (
        <p className="text-xs text-gray-400">
          No anchors have staked yet.
        </p>
      )}

      <div className="space-y-3">
        {entries.map((e) => {
          const { label, color } = acrLabel(e.acr);
          const barPct = Math.min(Number(e.acr) / 200, 100); // 20000 bps = 100%
          return (
            <div key={e.anchor} className="text-xs">
              <div className="flex justify-between mb-1">
                <span className="text-gray-600 truncate max-w-xs">
                  {e.anchor.slice(0, 12)}...{e.anchor.slice(-6)}
                </span>
                <div className="flex gap-2 items-center">
                  <span className={`font-bold ${color}`}>{label}</span>
                  <span className="text-gray-500">{formatAcr(e.acr)}</span>
                </div>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${barPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
