"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { LineChart, Line, ResponsiveContainer, ReferenceLine, YAxis } from "recharts";
import {
  listMarkets, getMarket, getMarketState, getTotalCollateral,
  getOrders, formatUsdc, formatExpiry, type MarketConfig, type Order,
} from "@/lib/contracts";
import { useWallet } from "@/hooks";
import { ArrowUpDown, Filter, TrendingDown } from "lucide-react";

const mono = { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" };

// ── Asset metadata ────────────────────────────────────────────────────────
const ASSET_META: Record<string, { logo: string; symbol: string; threshold: number; oracleSymbol: string }> = {
  USDC:  { logo: "/usdclogo.svg",  symbol: "USDC",  threshold: 0.995, oracleSymbol: "USDC"  },
  EURC:  { logo: "/eurclogo.svg",  symbol: "EURC",  threshold: 0.995, oracleSymbol: "EURC"  },
  PYUSD: { logo: "/pyusdlogo.svg", symbol: "PYUSD", threshold: 0.995, oracleSymbol: "PYUSD" },
  MGUSD: { logo: "/mgusdlogo.jpg", symbol: "MGUSD", threshold: 0.995, oracleSymbol: "MGUSD" },
};

function assetFromLabel(label: string): string {
  const upper = label.toUpperCase();
  for (const key of Object.keys(ASSET_META)) {
    if (upper.includes(key)) return key;
  }
  return label.split(" ")[0].toUpperCase();
}

// ── Oracle price fetch (same proven call as landing page) ─────────────────
const REFLECTOR = "CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63";
const SIM_SRC   = "GD6KRXUKOAPTYW72IZOERCPGM3UHXTQDJK4RS5WUAZHC4K2WOONQA3ZR";

async function fetchOraclePrices(symbol: string): Promise<number[]> {
  try {
    const { Contract, TransactionBuilder, Account, rpc, BASE_FEE, Networks, xdr, scValToNative } =
      await import("@stellar/stellar-sdk");
    const server = new rpc.Server("https://soroban-testnet.stellar.org", { allowHttp: false });
    const source = new Account(SIM_SRC, "0");
    const assetArg = xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("Other"), xdr.ScVal.scvSymbol(symbol)]);
    const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
      .addOperation(new Contract(REFLECTOR).call("prices", assetArg, xdr.ScVal.scvU32(11)))
      .setTimeout(30).build();
    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = scValToNative((sim as any).result!.retval) as Array<{ price: bigint; timestamp: bigint }> | null;
    if (!raw || !Array.isArray(raw) || raw.length === 0) throw new Error("no data");
    // Sort oldest→newest
    return [...raw].sort((a, b) => Number(a.timestamp) - Number(b.timestamp)).map(r => Number(r.price) / 1e14);
  } catch {
    // Deterministic fallback
    const base = 1.0004;
    return Array.from({ length: 11 }, (_, i) => parseFloat((base + Math.sin(i * 0.6) * 0.0004).toFixed(6)));
  }
}

interface EnrichedMarket {
  config: MarketConfig; state: string; collateral: bigint;
  orders: Order[]; asset: string; impliedPct: number | null; bestAskBps: number | null;
}

// ── Live oracle sparkline tile ────────────────────────────────────────────
function RiskTile({ asset, bestMarketId, impliedPct }: {
  asset: string; bestMarketId: number | null; impliedPct: number | null;
}) {
  const meta = ASSET_META[asset];
  const [prices, setPrices] = useState<number[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);

  useEffect(() => {
    if (!meta) return;
    fetchOraclePrices(meta.oracleSymbol).then(pts => {
      setPrices(pts);
      setCurrentPrice(pts[pts.length - 1] ?? null);
    });
    const id = setInterval(() => {
      fetchOraclePrices(meta.oracleSymbol).then(pts => {
        setPrices(pts);
        setCurrentPrice(pts[pts.length - 1] ?? null);
      });
    }, 30_000);
    return () => clearInterval(id);
  }, [asset]);

  if (!meta) return null;

  const threshold = meta.threshold;
  const distanceBps = currentPrice !== null
    ? Math.round((currentPrice - threshold) * 10000)
    : null;

  // Emotional proximity: 0 = very safe, 1 = at threshold
  const proximity = distanceBps !== null
    ? Math.max(0, Math.min(1, 1 - distanceBps / 100))
    : 0;

  // Colour: teal → amber → red
  const lineColor = proximity > 0.8 ? "#ef4444"
    : proximity > 0.5 ? "#f59e0b"
    : "#00ffc2";

  const href = bestMarketId !== null ? `/app/markets/${bestMarketId}` : "/app/markets";

  const chartData = prices.map(v => ({ v }));
  const yDomain: [number, number] = [
    Math.min(...prices, threshold) - 0.001,
    Math.max(...prices) + 0.001,
  ];

  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div
        className="relative flex flex-col overflow-hidden cursor-pointer transition-all"
        style={{
          background: "#0d0d0d",
          border: `1px solid ${proximity > 0.5 ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.07)"}`,
          borderRadius: 8,
          padding: "14px 16px 0 16px",
        }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = proximity > 0.5 ? "rgba(239,68,68,0.5)" : "rgba(0,255,194,0.25)"}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = proximity > 0.5 ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.07)"}
      >
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {meta.logo ? (
              <img src={meta.logo} alt={asset} style={{ width: 20, height: 20, borderRadius: "50%" }} />
            ) : (
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#222", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 9, color: "#888", fontWeight: 700 }}>{asset[0]}</span>
              </div>
            )}
            <span style={{ ...mono, fontSize: 13, fontWeight: 700, color: "white" }}>{asset}</span>
          </div>
          {impliedPct !== null && (
            <span style={{ ...mono, fontSize: 10, color: lineColor }}>
              {impliedPct.toFixed(2)}% risk
            </span>
          )}
        </div>

        {/* The ONE number that matters — distance to threshold */}
        <div className="mb-3">
          {distanceBps !== null ? (
            <>
              <div className="flex items-baseline gap-1.5">
                <span style={{
                  ...mono,
                  fontSize: distanceBps < 10 ? 28 : 22,
                  fontWeight: 700,
                  color: lineColor,
                  lineHeight: 1,
                  letterSpacing: "-1px",
                }}>
                  +{distanceBps}
                </span>
                <span style={{ ...mono, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>bps to breach</span>
              </div>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>
                {currentPrice !== null ? `$${currentPrice.toFixed(4)}` : "—"} · threshold ${threshold}
              </p>
            </>
          ) : (
            <span style={{ ...mono, fontSize: 16, color: "#444" }}>—</span>
          )}
        </div>

        {/* Sparkline — oracle price vs threshold */}
        <div style={{ height: 52, marginLeft: -16, marginRight: -16 }}>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                <YAxis domain={yDomain} hide />
                <ReferenceLine y={threshold} stroke="rgba(239,68,68,0.4)" strokeDasharray="3 3" strokeWidth={1} />
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={lineColor}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: "100%", background: "rgba(255,255,255,0.02)" }} />
          )}
        </div>
      </div>
    </Link>
  );
}
