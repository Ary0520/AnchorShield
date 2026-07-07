"use client";

/**
 * OracleChart — Area chart of oracle (Reflector) price for a stablecoin.
 *
 * Design intent: the chart is the emotional core of the market page.
 * When the line approaches the red threshold, the gradient shifts from
 * cool teal to red — communicating urgency without a word.
 *
 * Uses lightweight-charts v5 (TradingView) with an AreaSeries.
 * Must be imported { ssr: false } — uses canvas/document.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import {
  fetchOraclePriceHistory,
  type PricePoint,
} from "@/lib/oracle";
import {
  createChart,
  AreaSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  type DeepPartial,
  type AreaStyleOptions,
  type SeriesOptionsCommon,
} from "lightweight-charts";

const mono = "'JetBrains Mono', 'Fira Code', monospace";

type Range = "1H" | "6H" | "1D";

// Reflector testnet only returns data for up to ~11 records before returning NULL.
// All ranges fetch 11 and display whatever the oracle has.
// When mainnet is used (more history), these can be increased.
const RANGE_RECORDS: Record<Range, number> = {
  "1H": 11,
  "6H": 11,
  "1D": 11,
};

interface Props {
  symbol: string;
  threshold: number; // e.g. 0.995
}

export default function OracleChart({ symbol, threshold }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const seriesRef    = useRef<ISeriesApi<"Area"> | null>(null);

  const [range, setRange]         = useState<Range>("1D");
  const [loading, setLoading]     = useState(true);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [lastTime, setLastTime]   = useState<string | null>(null);
  const [isBelow, setIsBelow]     = useState(false);

  // ── Create chart once on mount ──────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { color: "#0a0a0a" },
        textColor: "rgba(255,255,255,0.35)",
        fontFamily: mono,
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      crosshair: {
        mode: 1, // magnet — snaps to data
        vertLine: {
          color: "rgba(255,255,255,0.25)",
          width: 1,
          style: 3,
          labelVisible: true,
          labelBackgroundColor: "#1c1b1b",
        },
        horzLine: {
          color: "rgba(255,255,255,0.25)",
          width: 1,
          style: 3,
          labelVisible: true,
          labelBackgroundColor: "#1c1b1b",
        },
      },
      rightPriceScale: {
        borderVisible: false,
        textColor: "rgba(255,255,255,0.35)",
        scaleMargins: { top: 0.12, bottom: 0.08 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      handleScroll: false,
      handleScale: false,
    });

    // Area series — the main price line with gradient fill
    const series = chart.addSeries(AreaSeries, {
      lineColor: "#00ffc2",
      lineWidth: 2,
      topColor: "rgba(0,255,194,0.12)",
      bottomColor: "rgba(0,255,194,0.01)",
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 5,
      crosshairMarkerBorderColor: "#00ffc2",
      crosshairMarkerBackgroundColor: "#0a0a0a",
      priceFormat: {
        type: "price",
        precision: 4,
        minMove: 0.0001,
      },
      lastValueVisible: true,
      priceLineVisible: false,
    } as DeepPartial<AreaStyleOptions & SeriesOptionsCommon>);

    // Depeg threshold — dashed red reference line
    series.createPriceLine({
      price:            threshold,
      color:            "rgba(239,83,80,0.7)",
      lineWidth:        1,
      lineStyle:        1, // dashed
      axisLabelVisible: true,
      title:            "",
    });

    chartRef.current  = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current  = null;
      seriesRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load data and update series colours based on proximity ──
  const loadData = useCallback(async () => {
    if (!seriesRef.current || !chartRef.current) return;
    setLoading(true);

    try {
      const records = RANGE_RECORDS[range];
      const points: PricePoint[] = await fetchOraclePriceHistory(symbol, records);

      // Re-check after async fetch — component may have unmounted during the request
      if (!seriesRef.current || !chartRef.current) return;

      if (points.length === 0) return;

      // Plot every raw oracle tick as a point — no OHLC grouping for area chart
      const data = points.map(p => ({
        time:  p.timestamp as UTCTimestamp,
        value: p.price,
      }));

      seriesRef.current.setData(data);
      chartRef.current.timeScale().fitContent();

      // Update header
      const latest = points[points.length - 1];
      setLastPrice(latest.price);
      const age = Math.floor(Date.now() / 1000) - latest.timestamp;
      setLastTime(age < 120 ? `${age}s ago` : `${Math.floor(age / 60)}m ago`);

      // Shift chart colours based on how close price is to threshold
      const distance = latest.price - threshold; // positive = safe, negative = breached
      const proximity = Math.max(0, Math.min(1, 1 - distance / 0.01)); // 0 = safe, 1 = at/below threshold

      const below = latest.price < threshold;
      setIsBelow(below);

      // Interpolate line/fill color: teal → amber → red as it approaches threshold
      let lineColor: string;
      let topColor: string;
      if (below) {
        lineColor = "#ef5350";
        topColor  = "rgba(239,83,80,0.18)";
      } else if (proximity > 0.7) {
        lineColor = "#ffb800";
        topColor  = "rgba(255,184,0,0.12)";
      } else {
        lineColor = "#00ffc2";
        topColor  = "rgba(0,255,194,0.1)";
      }

      // Final null check before touching refs (unmount could have happened during color compute)
      if (!seriesRef.current) return;
      seriesRef.current.applyOptions({
        lineColor,
        topColor,
        bottomColor: "rgba(0,0,0,0.01)",
      });

    } finally {
      setLoading(false);
    }
  }, [symbol, range, threshold]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    const id = setInterval(loadData, 30_000);
    return () => clearInterval(id);
  }, [loadData]);

  return (
    <div className="flex flex-col rounded-lg overflow-hidden" style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", height: "100%" }}>

      {/* ── Top bar ─────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-5 py-3 shrink-0"
        style={{ borderBottom: "1px solid #1a1a1a" }}
      >
        {/* Left: current price */}
        <div className="flex items-center gap-3">
          {loading ? (
            <span style={{ fontFamily: mono, fontSize: 13, color: "#444" }}>—</span>
          ) : (
            <>
              <span
                style={{
                  fontFamily: mono,
                  fontSize: 16,
                  fontWeight: 700,
                  color: isBelow ? "#ef5350" : lastPrice !== null && (lastPrice - threshold) < 0.003 ? "#ffb800" : "white",
                  letterSpacing: "-0.5px",
                }}
              >
                ${lastPrice?.toFixed(4) ?? "—"}
              </span>
              {lastTime && (
                <span style={{ fontFamily: mono, fontSize: 10, color: "#444" }}>
                  {lastTime}
                </span>
              )}
              {isBelow && (
                <span
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    color: "#ef5350",
                    background: "rgba(239,83,80,0.12)",
                    border: "1px solid rgba(239,83,80,0.25)",
                    padding: "2px 6px",
                    borderRadius: 3,
                  }}
                >
                  BELOW THRESHOLD
                </span>
              )}
            </>
          )}
        </div>

        {/* Right: range selector */}
        <div
          className="flex items-center gap-0 rounded"
          style={{ background: "#111", border: "1px solid #1a1a1a", padding: 2 }}
        >
          {(["1H", "6H", "1D"] as Range[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                padding: "3px 14px",
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 700,
                fontFamily: "Inter, sans-serif",
                letterSpacing: "0.06em",
                background: range === r ? "#222" : "transparent",
                color:      range === r ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.25)",
                border: "none",
                cursor: "pointer",
                transition: "all 0.12s",
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* ── Canvas ──────────────────────────────────── */}
      <div className="relative flex-1 min-h-0">
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

        {/* Threshold label — positioned in chart at threshold price */}
        <div
          className="absolute right-[52px] pointer-events-none"
          style={{
            bottom: "10%", // approximate — not pixel-perfect but close enough
            fontSize: 9,
            fontFamily: mono,
            color: "rgba(239,83,80,0.5)",
          }}
        >
          ${threshold} depeg threshold
        </div>

        {/* Loading shimmer */}
        {loading && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "rgba(10,10,10,0.5)" }}
          />
        )}
      </div>
    </div>
  );
}
