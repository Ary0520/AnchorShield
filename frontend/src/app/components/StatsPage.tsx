"use client";

import { useEffect, useState } from "react";
import {
  listMarkets,
  getMarket,
  getMarketState,
  getTotalCollateral,
  formatUsdc,
  type MarketConfig,
} from "@/lib/contracts";

interface MarketStats {
  market: MarketConfig;
  state: string;
  collateral: bigint;
}

interface AggregatedStats {
  totalMarketsCreated: number;
  openMarkets: number;
  settledYes: number;   // depeg happened — YES won
  expiredNo: number;    // no depeg — NO won
  totalCollateralLocked: bigint;
  totalCollateralProtected: bigint; // across all markets ever
}

function StatCard({
  label,
  value,
  sub,
  color = "text-gray-900",
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded p-4">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

function stateColor(state: string) {
  if (state === "Open") return "bg-green-100 text-green-700";
  if (state === "Settled") return "bg-red-100 text-red-700";
  if (state === "Expired") return "bg-gray-100 text-gray-500";
  return "bg-yellow-100 text-yellow-700";
}

function stateLabel(state: string) {
  if (state === "Settled") return "⚠ Depeg confirmed (YES won)";
  if (state === "Expired") return "✓ No depeg (NO won)";
  if (state === "Open") return "● Live";
  return state;
}

export default function StatsPage() {
  const [markets, setMarkets] = useState<MarketStats[]>([]);
  const [stats, setStats] = useState<AggregatedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const ids = await listMarkets();
        const results = await Promise.all(
          ids.map(async (id) => {
            const market = await getMarket(id);
            const [state, collateral] = await Promise.all([
              getMarketState(market.market_contract),
              getTotalCollateral(market.market_contract),
            ]);
            return { market, state, collateral };
          })
        );

        setMarkets(results);

        // Aggregate
        const agg: AggregatedStats = {
          totalMarketsCreated: results.length,
          openMarkets: results.filter((m) => m.state === "Open").length,
          settledYes: results.filter((m) => m.state === "Settled").length,
          expiredNo: results.filter((m) => m.state === "Expired").length,
          totalCollateralLocked: results
            .filter((m) => m.state === "Open")
            .reduce((acc, m) => acc + m.collateral, 0n),
          totalCollateralProtected: results.reduce(
            (acc, m) => acc + m.collateral,
            0n
          ),
        };
        setStats(agg);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load stats");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-gray-400">
        Loading stats...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
        {error}
      </div>
    );
  }

  const successRate =
    stats && stats.expiredNo + stats.settledYes > 0
      ? Math.round(
          (stats.expiredNo / (stats.expiredNo + stats.settledYes)) * 100
        )
      : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-sm font-semibold">Protocol Statistics</h2>
        <p className="text-xs text-gray-400 mt-1">
          Live on-chain data from Stellar Mainnet — All values in USDC
        </p>
      </div>

      {/* Top stats grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Total Markets"
            value={String(stats.totalMarketsCreated)}
            sub="deployed via factory"
          />
          <StatCard
            label="Total USDC Protected"
            value={`$${formatUsdc(stats.totalCollateralProtected)}`}
            sub="across all markets"
            color="text-blue-700"
          />
          <StatCard
            label="Currently Open"
            value={String(stats.openMarkets)}
            sub={`$${formatUsdc(stats.totalCollateralLocked)} locked`}
            color="text-green-700"
          />
          <StatCard
            label="Markets Resolved"
            value={String(stats.expiredNo + stats.settledYes)}
            sub={
              successRate !== null
                ? `${successRate}% expired safely (NO won)`
                : "no resolved markets yet"
            }
          />
        </div>
      )}

      {/* Settlement breakdown */}
      {stats && (stats.expiredNo + stats.settledYes > 0) && (
        <div className="bg-white border border-gray-200 rounded p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">
            Settlement History
          </h3>
          <div className="flex gap-6">
            <div>
              <div className="text-2xl font-bold text-green-700">
                {stats.expiredNo}
              </div>
              <div className="text-xs text-gray-400">NO wins</div>
              <div className="text-xs text-gray-400">
                Stablecoin held its peg
              </div>
            </div>
            <div className="border-l border-gray-100" />
            <div>
              <div className="text-2xl font-bold text-red-600">
                {stats.settledYes}
              </div>
              <div className="text-xs text-gray-400">YES wins</div>
              <div className="text-xs text-gray-400">Depeg confirmed</div>
            </div>
            <div className="border-l border-gray-100" />
            <div className="flex-1">
              <div className="text-xs text-gray-400 mb-1">
                NO win rate
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full"
                  style={{
                    width: `${successRate ?? 0}%`,
                  }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {successRate ?? 0}% of resolved markets expired safely
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Per-market table */}
      <div className="bg-white border border-gray-200 rounded p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">
          All Markets
        </h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-400 border-b border-gray-100 text-left">
              <th className="pb-2">ID</th>
              <th className="pb-2">Market</th>
              <th className="pb-2">Collateral</th>
              <th className="pb-2">Expires</th>
              <th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {markets.map(({ market, state, collateral }) => (
              <tr
                key={market.market_id}
                className="border-b border-gray-50 last:border-0"
              >
                <td className="py-2 text-gray-400">{market.market_id}</td>
                <td className="py-2 font-medium max-w-xs truncate">
                  {market.label}
                </td>
                <td className="py-2 font-mono">
                  ${formatUsdc(collateral)}
                </td>
                <td className="py-2 text-gray-400">
                  {new Date(
                    Number(market.expiry_timestamp) * 1000
                  ).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </td>
                <td className="py-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${stateColor(
                      state
                    )}`}
                  >
                    {stateLabel(state)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* How it works note */}
      <div className="text-xs text-gray-400 bg-gray-50 rounded p-3 border border-gray-100">
        <strong className="text-gray-600">How settlement works:</strong> Markets
        settle automatically via oracle. If the covered asset drops below the
        depeg threshold for the breach duration, YES wins and cover buyers are
        paid $1 USDC per token. If the market expires without a breach, NO wins
        and underwriters reclaim their collateral plus earned premiums. No humans
        involved at any step.
      </div>
    </div>
  );
}
