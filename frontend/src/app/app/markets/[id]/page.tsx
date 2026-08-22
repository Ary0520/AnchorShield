"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  getMarket, getMarketState, getTotalCollateral, getOrders,
  getBalances, mintCompleteSet, placeOrder, cancelOrder, trySettle, claim,
  formatUsdc, formatExpiry,
  type MarketConfig, type Order,
} from "@/lib/contracts";
import { useWallet } from "@/hooks";
import { ChevronRight } from "lucide-react";
import dynamic from "next/dynamic";

// lightweight-charts uses canvas/document — must disable SSR
const OracleChart = dynamic(
  () => import("@/app/components/OracleChart"),
  { ssr: false, loading: () => (
    <div
      className="rounded-lg shrink-0 animate-pulse"
      style={{ height: 300, background: "#161616", border: "1px solid #222" }}
    />
  )}
);

// ── Asset metadata ────────────────────────────────────────────────────────
const ASSET_META: Record<string, { logo: string | null; symbol: string; threshold: number }> = {
  USDC:  { logo: "/usdclogo.svg",  symbol: "USDC",  threshold: 0.995 },
  EURC:  { logo: "/eurclogo.svg",  symbol: "EURC",  threshold: 0.995 },
  PYUSD: { logo: "/pyusdlogo.svg", symbol: "PYUSD", threshold: 0.995 },
  MGUSD: { logo: "/mgusdlogo.jpg", symbol: "MGUSD", threshold: 0.995 },
  DAI:   { logo: null,             symbol: "DAI",   threshold: 0.995 },
};

function assetFromLabel(label: string): string {
  const upper = label.toUpperCase();
  for (const key of Object.keys(ASSET_META)) {
    if (upper.includes(key)) return key;
  }
  return label.split(" ")[0].toUpperCase();
}

// Mono font style helper
const mono = { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" };

export default function MarketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const marketId = parseInt(id ?? "0");
  const wallet = useWallet();

  const [config, setConfig]       = useState<MarketConfig | null>(null);
  const [state, setState]         = useState("...");
  const [collateral, setCollateral] = useState(0n);
  const [orders, setOrders]       = useState<Order[]>([]);
  const [balances, setBalances]   = useState({ yes: 0n, no: 0n });
  const [loading, setLoading]     = useState(true);
  const [txStatus, setTxStatus]   = useState<string | null>(null);
  const [txError, setTxError]     = useState<string | null>(null);

  const [tradeTab, setTradeTab]             = useState<"cover" | "underwrite">("cover");
  const [coverAmount, setCoverAmount]       = useState("100");
  const [coverOrderType, setCoverOrderType] = useState<"market" | "limit">("market");
  const [coverLimitBps, setCoverLimitBps]   = useState("");
  const [uwAmount, setUwAmount]             = useState("");
  const [uwPremiumBps, setUwPremiumBps]     = useState("150");

  const [aiReport, setAiReport] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  const generateAiReport = async () => {
    if (!config || aiLoading) return;
    setIsAiModalOpen(true);
    setAiLoading(true);
    setAiReport(null);
    try {
      const res = await fetch("/api/ai-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset: asset,
          currentPrice: 1.0006, // Fallback mock or live oracle price if available
          threshold: meta.threshold,
          durationHours: 1,
          premiumPct: "2.0",
          yieldApy: "8.5",
          expiryDate: formatExpiry(config.expiry_timestamp),
          liquidity: parseInt(formatUsdc(collateral)).toLocaleString()
        })
      });
      const data = await res.json();
      setAiReport(data.text);
    } catch (e) {
      setAiReport("Failed to generate report.");
    } finally {
      setAiLoading(false);
    }
  };

  const refresh = useCallback(async () => {
    if (isNaN(marketId)) return;
    try {
      const cfg = await getMarket(marketId);
      setConfig(cfg);
      const [s, col, ords] = await Promise.all([
        getMarketState(cfg.market_contract).catch(() => "Unknown"),
        getTotalCollateral(cfg.market_contract).catch(() => 0n),
        getOrders(cfg.market_contract).catch(() => [] as Order[]),
      ]);
      setState(s); setCollateral(col); setOrders(ords as Order[]);
      if (wallet.publicKey) {
        const b = await getBalances(cfg.market_contract, wallet.publicKey).catch(() => ({ yes: 0n, no: 0n }));
        setBalances(b);
      }
    } catch (e) {
      setTxError(e instanceof Error ? e.message : "Failed to load market");
    } finally { setLoading(false); }
  }, [marketId, wallet.publicKey]);

  useEffect(() => { refresh(); }, [refresh]);

  async function runTx(fn: () => Promise<string>, label: string): Promise<boolean> {
    if (!wallet.publicKey) { setTxError("Connect wallet first"); return false; }
    setTxStatus(`Sending ${label}...`); setTxError(null);
    try {
      const hash = await fn();
      setTxStatus(`✓ ${label} confirmed — ${hash.slice(0, 12)}...`);
      await refresh();
      return true;
    } catch (e) {
      setTxError(e instanceof Error ? e.message : `${label} failed`);
      setTxStatus(null);
      return false;
    }
  }

  if (loading) {
    return <MarketDetailSkeleton />;
  }
  if (!config) {
    return (
      <div className="p-6 text-sm" style={{ background: "#0a0a0a", color: "#888" }}>
        Market not found.{" "}
        <Link href="/app" style={{ color: "#00ffc2" }}>← Back to Risk Curve</Link>
      </div>
    );
  }

  const asset = assetFromLabel(config.label);
  const meta  = ASSET_META[asset] ?? { logo: null, symbol: asset, threshold: 0.995 };

  const sellOrders = (orders as Order[]).filter(o => !o.is_buy).sort((a,b) => Number(a.price_bps) - Number(b.price_bps));
  const buyOrders  = (orders as Order[]).filter(o =>  o.is_buy).sort((a,b) => Number(b.price_bps) - Number(a.price_bps));
  const bestAskBps = sellOrders[0] ? Number(sellOrders[0].price_bps) : null;
  const bestBidBps = buyOrders[0]  ? Number(buyOrders[0].price_bps)  : null;
  const midBps = bestAskBps !== null && bestBidBps !== null ? ((bestAskBps + bestBidBps) / 2) : bestAskBps ?? bestBidBps;

  const yesPrice  = bestAskBps !== null ? `${(bestAskBps / 100).toFixed(1)}¢` : "—";
  const noPrice   = bestAskBps !== null ? `${((10000 - bestAskBps) / 100).toFixed(1)}¢` : "—";
  const riskPct   = bestAskBps !== null ? `${(bestAskBps / 100).toFixed(1)}%` : "—";
  const isOpen    = state === "Open";
  const isSettled = state === "Settled" || state === "Expired";
  const yesWon    = state === "Settled";

  const coverAmt    = parseFloat(coverAmount) || 0;
  const premiumFrac = bestAskBps !== null ? bestAskBps / 10000 : 0;
  const premiumCost = coverAmt * premiumFrac;
  const uwAmt       = parseFloat(uwAmount) || 0;
  const uwPremBps   = parseInt(uwPremiumBps) || 0;
  const uwEarned    = uwAmt * uwPremBps / 10000;

  const stateIsOpen     = state === "Open";
  const openBadge       = stateIsOpen ? { bg: "rgba(0,230,118,0.2)", border: "rgba(0,230,118,0.3)", dot: "#00e676", text: "#00e676", label: "OPEN" }
                        : state === "Settled" ? { bg: "rgba(105,0,5,0.2)", border: "rgba(105,0,5,0.3)", dot: "#690005", text: "#690005", label: "SETTLED" }
                        : { bg: "rgba(136,136,136,0.15)", border: "rgba(136,136,136,0.2)", dot: "#888", text: "#888", label: "EXPIRED" };

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "#0a0a0a" }}>

      {/* ── Sticky top header ──────────────────────────── */}
      <div
        className="shrink-0 px-6"
        style={{ background: "rgba(10,10,10,0.9)", backdropFilter: "blur(6px)", borderBottom: "1px solid #222", zIndex: 2 }}
      >
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 pt-4 pb-3" style={{ color: "#888", fontSize: 12 }}>
          <Link href="/app" style={{ color: "#888", textDecoration: "none" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "white"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#888"}
          >Risk Curve</Link>
          <ChevronRight size={11} style={{ color: "#555" }} />
          <span style={{ color: "#bbb" }}>{meta.symbol}</span>
          <ChevronRight size={11} style={{ color: "#555" }} />
          <span style={{ color: "#bbb" }}>Market</span>
        </div>

        {/* Single compact title row */}
        <div className="flex items-center justify-between pb-4 gap-4" style={{ minHeight: 48 }}>
          {/* Left: logo + name + badge */}
          <div className="flex items-center gap-3 shrink-0">
            <div
              className="relative flex items-center justify-center rounded-full shrink-0"
              style={{ width: 40, height: 40, background: "#161616", border: "1px solid #222", padding: 5 }}
            >
              {meta.logo ? (
                <img src={meta.logo} alt={meta.symbol} style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                <span style={{ color: "white", fontSize: 14, fontWeight: 700 }}>{meta.symbol[0]}</span>
              )}
              <span
                className="absolute rounded-full border-2"
                style={{ width: 14, height: 14, bottom: -3, right: -3, background: stateIsOpen ? "#00e676" : "#555", borderColor: "#0a0a0a" }}
              />
            </div>
            <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 22, color: "white", letterSpacing: "-0.44px", whiteSpace: "nowrap" }}>
              {meta.symbol} Depeg Market
            </span>
            <span
              className="flex items-center gap-1 rounded-full"
              style={{ padding: "3px 8px", background: openBadge.bg, border: `1px solid ${openBadge.border}`, color: openBadge.text, fontSize: 10, fontWeight: 700, fontFamily: "Inter, sans-serif", whiteSpace: "nowrap" }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: openBadge.dot, display: "inline-block" }} />
              {openBadge.label}
            </span>
          </div>

          {/* Right: stat pills — all inline, no wrap */}
          <div className="flex items-center shrink-0" style={{ gap: 1 }}>
            {/* YES */}
            <div style={{ background: "#161616", border: "1px solid #222", padding: "7px 13px", display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ ...mono, color: "#888", fontSize: 13 }}>YES</span>
              <span style={{ ...mono, color: "white", fontSize: 13, fontWeight: 700 }}>{yesPrice}</span>
            </div>
            {/* NO */}
            <div style={{ background: "#161616", border: "1px solid #222", padding: "7px 13px", display: "flex", gap: 8, alignItems: "center", marginLeft: -1 }}>
              <span style={{ ...mono, color: "#888", fontSize: 13 }}>NO</span>
              <span style={{ ...mono, color: "white", fontSize: 13, fontWeight: 700 }}>{noPrice}</span>
            </div>
            {/* Risk */}
            <div style={{ background: "#161616", border: "1px solid #222", padding: "7px 13px", display: "flex", gap: 8, alignItems: "center", marginLeft: -1 }}>
              <span style={{ ...mono, color: "#888", fontSize: 13 }}>Risk</span>
              <span style={{ ...mono, color: "#ffb800", fontSize: 13, fontWeight: 700 }}>{riskPct}</span>
            </div>
            {/* Collateral */}
            <div style={{ background: "#161616", border: "1px solid #222", padding: "7px 13px", display: "flex", alignItems: "center", marginLeft: -1 }}>
              <span style={{ ...mono, color: "#888", fontSize: 13 }}>${formatUsdc(collateral)} locked</span>
            </div>
            {/* Expiry */}
            <div style={{ background: "#161616", border: "1px solid #222", padding: "7px 13px", display: "flex", alignItems: "center", marginLeft: -1 }}>
              <span style={{ ...mono, color: "#888", fontSize: 13 }}>Expires {formatExpiry(config.expiry_timestamp)}</span>
            </div>
          </div>
        </div>

        {/* TX notifications */}
        {txStatus && (
          <div className="text-xs px-4 py-2 mb-3 rounded" style={{ background: "rgba(0,255,194,0.08)", border: "1px solid rgba(0,255,194,0.15)", color: "#00ffc2", ...mono }}>
            {txStatus}
          </div>
        )}
        {txError && (
          <div className="text-xs px-4 py-2 mb-3 rounded break-all" style={{ background: "rgba(105,0,5,0.1)", border: "1px solid rgba(105,0,5,0.3)", color: "#ff6b6b", ...mono }}>
            {txError}
          </div>
        )}
      </div>

      {/* ── Content grid ───────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden gap-0" style={{ zIndex: 1 }}>

        {/* LEFT column — chart dominates, secondary info below */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden" style={{ borderRight: "1px solid #1a1a1a" }}>

          {/* Chart — fills as much height as possible */}
          <div className="flex-1 min-h-0 p-4 pb-0">
            <OracleChart symbol={asset} threshold={meta.threshold} />
          </div>

          {/* Secondary row — How this settles + Order Book */}
          <div className="flex gap-0 shrink-0" style={{ height: 220, borderTop: "1px solid #1a1a1a" }}>

            {/* How this settles */}
            <div
              className="flex flex-col p-4 gap-2.5"
              style={{ width: "45%", borderRight: "1px solid #1a1a1a", overflowY: "auto" }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span style={{ fontSize: 14 }}>⚒</span>
                <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
                  How this settles
                </span>
              </div>
              {[
                { label: "Trigger",  value: `${meta.symbol}/USD < $${meta.threshold}` },
                { label: "Duration", value: "1 continuous hour" },
                { label: "YES wins", value: "Each YES → $1.00 USDC", accent: "#ffb800" },
                { label: "NO wins",  value: `No breach before ${formatExpiry(config.expiry_timestamp)}` },
              ].map((row, i) => (
                <div key={row.label} className="flex justify-between items-start gap-4">
                  <span style={{ ...mono, fontSize: 10, color: row.accent ?? "#555", flexShrink: 0 }}>{row.label}</span>
                  <span style={{ ...mono, fontSize: 10, color: "rgba(255,255,255,0.6)", textAlign: "right" }}>{row.value}</span>
                </div>
              ))}
              <div className="mt-auto pt-4 flex flex-col gap-2" style={{ borderTop: "1px solid #1a1a1a" }}>
                <button
                  onClick={generateAiReport}
                  className="relative flex items-center justify-center gap-2 w-full py-2 rounded overflow-hidden transition-all group"
                  style={{
                    background: "rgba(10, 10, 10, 0.8)",
                    border: "1px solid rgba(0, 255, 170, 0.3)",
                    color: "#00ffaa",
                    fontSize: 11,
                    fontFamily: "Inter, sans-serif",
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: "0 0 10px rgba(0, 255, 170, 0.1), inset 0 0 10px rgba(0, 255, 170, 0.05)"
                  }}
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{
                    background: "radial-gradient(circle at center, rgba(0,255,170,0.15) 0%, transparent 70%)"
                  }} />
                  <span style={{ fontSize: 13 }}>✨</span>
                  <span className="relative z-10 tracking-wide">Ask AI Risk Analyst</span>
                </button>
              </div>
            </div>

            {/* Order Book */}
            <div className="flex flex-col flex-1 min-w-0">
              <div
                className="flex items-center justify-between px-4 py-2.5 shrink-0"
                style={{ borderBottom: "1px solid #1a1a1a" }}
              >
                <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
                  Order Book
                </span>
                <span style={{ ...mono, fontSize: 9, color: "#555", letterSpacing: "0.06em" }}>YES TOKENS</span>
              </div>

              {/* Column headers */}
              <div className="grid px-4 py-1.5 shrink-0" style={{ gridTemplateColumns: "1fr 1fr 1px 1fr 1fr", borderBottom: "1px solid #111" }}>
                {["Size","Price","","Price","Size"].map((h, i) => (
                  <span key={i} style={{ ...mono, fontSize: 9, color: "#444", textAlign: i === 1 ? "right" : i === 3 ? "left" : "left", paddingLeft: i === 3 ? 8 : 0 }}>{h}</span>
                ))}
              </div>

              {/* Rows */}
              <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* BUY side — cover buyers */}
                <div className="flex-1 flex flex-col" style={{ borderRight: "1px solid #111" }}>
                  {Array.from({ length: 5 }, (_, i) => {
                    const o = buyOrders[i];
                    const isOwn = o && wallet.publicKey && String(o.owner) === wallet.publicKey;
                    return (
                      <div
                        key={i}
                        className="relative flex items-center justify-between px-3 group cursor-pointer hover:bg-white/5"
                        style={{ height: 24 }}
                        onClick={() => {
                          if (o) {
                            setTradeTab("underwrite");
                            setUwPremiumBps(String(o.price_bps));
                          }
                        }}
                      >
                        {o && <div className="absolute inset-y-0 right-0 left-[55%]" style={{ background: "rgba(38,166,154,0.08)" }} />}
                        <span style={{ ...mono, fontSize: 10, color: "rgba(255,255,255,0.5)", position: "relative" }}>
                          {o ? parseInt(formatUsdc(o.amount - o.filled)).toLocaleString() : ""}
                        </span>
                        <div className="relative flex items-center gap-1.5">
                          <span style={{ ...mono, fontSize: 10, color: "#26a69a" }}>
                            {o ? String(o.price_bps) : ""}
                          </span>
                          {isOwn && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                runTx(
                                  () => cancelOrder(wallet.publicKey!, config.market_contract, o.order_id),
                                  "Cancel order"
                                );
                              }}
                              title="Cancel your order"
                              style={{
                                width: 14, height: 14,
                                borderRadius: 2,
                                background: "rgba(239,83,80,0.15)",
                                border: "1px solid rgba(239,83,80,0.3)",
                                color: "#ef5350",
                                fontSize: 9,
                                lineHeight: 1,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                fontFamily: mono.fontFamily,
                              }}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* SELL side — underwriters */}
                <div className="flex-1 flex flex-col">
                  {Array.from({ length: 5 }, (_, i) => {
                    const o = sellOrders[i];
                    const isOwn = o && wallet.publicKey && String(o.owner) === wallet.publicKey;
                    return (
                      <div
                        key={i}
                        className="relative flex items-center justify-between px-3 group cursor-pointer hover:bg-white/5"
                        style={{ height: 24 }}
                        onClick={() => {
                          if (o) {
                            setTradeTab("cover");
                            setCoverOrderType("limit");
                            setCoverLimitBps(String(o.price_bps));
                          }
                        }}
                      >
                        {o && <div className="absolute inset-y-0 left-0 right-[55%]" style={{ background: "rgba(239,83,80,0.08)" }} />}
                        <div className="relative flex items-center gap-1.5">
                          {isOwn && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                runTx(
                                  () => cancelOrder(wallet.publicKey!, config.market_contract, o.order_id),
                                  "Cancel order"
                                );
                              }}
                              title="Cancel your order"
                              style={{
                                width: 14, height: 14,
                                borderRadius: 2,
                                background: "rgba(239,83,80,0.15)",
                                border: "1px solid rgba(239,83,80,0.3)",
                                color: "#ef5350",
                                fontSize: 9,
                                lineHeight: 1,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                fontFamily: mono.fontFamily,
                              }}
                            >
                              ×
                            </button>
                          )}
                          <span style={{ ...mono, fontSize: 10, color: "#ef5350", paddingLeft: isOwn ? 0 : 8 }}>
                            {o ? String(o.price_bps) : ""}
                          </span>
                        </div>
                        <span style={{ ...mono, fontSize: 10, color: "rgba(255,255,255,0.5)", position: "relative" }}>
                          {o ? parseInt(formatUsdc(o.amount - o.filled)).toLocaleString() : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Mid price */}
              <div
                className="flex items-center justify-center py-2 shrink-0"
                style={{ borderTop: "1px solid #1a1a1a" }}
              >
                <span style={{ ...mono, fontSize: 10, color: midBps !== null ? "rgba(255,255,255,0.5)" : "#444" }}>
                  {midBps !== null ? `${midBps.toFixed(0)} bps mid` : "no orders"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT column — trade panel */}
        <div
          className="w-[320px] shrink-0 flex flex-col gap-3"
          style={{ height: "100%", overflowY: "auto", background: "#0a0a0a" }}
        >
          <TradePanel
            isOpen={isOpen} isSettled={isSettled} yesWon={yesWon}
            tradeTab={tradeTab} setTradeTab={setTradeTab}
            coverAmount={coverAmount} setCoverAmount={setCoverAmount}
            coverOrderType={coverOrderType} setCoverOrderType={setCoverOrderType}
            coverLimitBps={coverLimitBps} setCoverLimitBps={setCoverLimitBps}
            coverAmt={coverAmt} premiumCost={premiumCost} bestAskBps={bestAskBps}
            uwAmount={uwAmount} setUwAmount={setUwAmount}
            uwPremiumBps={uwPremiumBps} setUwPremiumBps={setUwPremiumBps}
            uwAmt={uwAmt} uwPremBps={uwPremBps} uwEarned={uwEarned}
            config={config} wallet={wallet} balances={balances} runTx={runTx}
          />
        </div>
      </div>

      {/* ── AI Risk Analyst Modal ──────────────────────────── */}
      {isAiModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300"
          style={{ background: "rgba(0, 0, 0, 0.7)", backdropFilter: "blur(6px)" }}
        >
          <div 
            className="relative w-full max-w-lg rounded-xl overflow-hidden flex flex-col shadow-2xl"
            style={{
              background: "#0a0a0a",
              border: "1px solid rgba(0, 255, 170, 0.2)",
              boxShadow: "0 0 40px rgba(0, 255, 170, 0.05), inset 0 0 20px rgba(0, 255, 170, 0.02)",
              animation: "fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid #1a1a1a" }}>
              <div className="flex items-center gap-2">
                <span className="animate-pulse" style={{ fontSize: 16 }}>✨</span>
                <h3 style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 14, color: "#00ffaa", letterSpacing: "0.02em" }}>
                  AnchorShield AI Analyst
                </h3>
              </div>
              <button 
                onClick={() => setIsAiModalOpen(false)}
                className="flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                style={{ width: 24, height: 24, color: "#888" }}
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className="p-6 min-h-[160px] max-h-[75vh] overflow-y-auto flex flex-col justify-center relative" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(0,255,170,0.2) transparent" }}>
              {aiLoading ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-4 h-4 rounded-full border-2 border-t-[#00ffaa] border-r-transparent border-b-[#00ffaa]/20 border-l-[#00ffaa]/20 animate-spin" />
                    <span style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
                      Synthesizing market parameters...
                    </span>
                  </div>
                  <div className="w-full h-2 rounded bg-white/5 overflow-hidden">
                    <div className="h-full bg-[#00ffaa]/30 rounded w-1/3 animate-ping" style={{ animationDuration: '1.5s' }} />
                  </div>
                  <div className="w-3/4 h-2 rounded bg-white/5 overflow-hidden">
                    <div className="h-full bg-[#00ffaa]/20 rounded w-1/2 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.2s' }} />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5" style={{ animation: "fadeIn 0.5s ease", overflowY: "auto", paddingRight: 4 }}>
                  {aiReport?.split('\n').map((line, i) => {
                    const text = line.trim().replace(/\*/g, '');
                    if (!text) return null;
                    
                    const isHeading = ["MARKET READ", "KEY RISKS", "ECONOMIC TRADE-OFF"].some(h => text.toUpperCase().includes(h));
                    
                    if (isHeading) {
                      return (
                        <h4 key={i} style={{
                          fontFamily: "Inter, sans-serif",
                          fontWeight: 700,
                          fontSize: 11,
                          color: "#00ffaa",
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          marginTop: i > 0 ? 12 : 0,
                          marginBottom: -4,
                          animation: `fadeInUp 0.3s ease ${i * 0.05}s both`
                        }}>
                          {text}
                        </h4>
                      );
                    }
                    
                    return (
                      <p key={i} style={{ 
                        fontFamily: "Inter, sans-serif", 
                        fontSize: 13.5, 
                        color: "rgba(255,255,255,0.85)", 
                        lineHeight: 1.6,
                        animation: `fadeInUp 0.3s ease ${i * 0.05}s both`
                      }}>
                        {text}
                      </p>
                    );
                  })}
                </div>
              )}
            </div>
            
            {/* Footer gradient line */}
            <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, rgba(0,255,170,0) 0%, rgba(0,255,170,0.5) 50%, rgba(0,255,170,0) 100%)" }} />
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

// ── Market Detail Skeleton ────────────────────────────────────────────────
function MarketDetailSkeleton() {
  const [step, setStep] = useState(0);
  const steps = [
    "Connecting to Stellar testnet…",
    "Loading market config…",
    "Reading oracle prices…",
    "Fetching order book…",
  ];

  useEffect(() => {
    const id = setInterval(() => {
      setStep((s) => (s + 1) % steps.length);
    }, 1100);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col h-full" style={{ background: "#0a0a0a" }}>
      {/* Fake header bar */}
      <div style={{ borderBottom: "1px solid #222", padding: "16px 24px" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full skeleton-shimmer" />
          <div className="h-6 w-48 rounded skeleton-shimmer" />
          <div className="h-5 w-16 rounded-full skeleton-shimmer" />
        </div>
      </div>

      {/* Main content placeholder */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: chart area */}
        <div className="flex-1 flex flex-col p-4 gap-4" style={{ borderRight: "1px solid #1a1a1a" }}>
          <div className="flex-1 rounded-lg skeleton-shimmer" style={{ minHeight: 260 }} />
          <div className="h-[220px] rounded-lg skeleton-shimmer" />
        </div>
        {/* Right: trade panel */}
        <div className="w-[320px] shrink-0 flex flex-col gap-3 p-4">
          <div className="h-12 rounded-lg skeleton-shimmer" />
          <div className="h-32 rounded-lg skeleton-shimmer" />
          <div className="h-24 rounded-lg skeleton-shimmer" />
          <div className="h-10 rounded-lg skeleton-shimmer" />
        </div>
      </div>

      {/* Centered status overlay */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none"
        style={{ zIndex: 10 }}
      >
        {/* Spinning ring */}
        <div style={{ position: "relative", width: 48, height: 48 }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ animation: "spin 1.2s linear infinite" }}>
            <circle cx="24" cy="24" r="20" stroke="rgba(0,229,255,0.12)" strokeWidth="3" />
            <path d="M24 4 A20 20 0 0 1 44 24" stroke="#00e5ff" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <div
            style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00e5ff", boxShadow: "0 0 10px #00e5ff" }} />
          </div>
        </div>

        {/* Cycling status text */}
        <div style={{ textAlign: "center" }}>
          <p
            key={step}
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              color: "rgba(0,229,255,0.7)",
              letterSpacing: "0.04em",
              animation: "fadeInUp 0.35s ease",
            }}
          >
            {steps[step]}
          </p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 6, fontFamily: "Inter, sans-serif" }}>
            Stellar testnet · Soroban RPC
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ── Trade Panel ───────────────────────────────────────────────────────────
interface TradePanelProps {
  isOpen: boolean; isSettled: boolean; yesWon: boolean;
  tradeTab: "cover" | "underwrite"; setTradeTab: (t: "cover" | "underwrite") => void;
  coverAmount: string; setCoverAmount: (v: string) => void;
  coverOrderType: "market" | "limit"; setCoverOrderType: (v: "market" | "limit") => void;
  coverLimitBps: string; setCoverLimitBps: (v: string) => void;
  coverAmt: number; premiumCost: number; bestAskBps: number | null;
  uwAmount: string; setUwAmount: (v: string) => void;
  uwPremiumBps: string; setUwPremiumBps: (v: string) => void;
  uwAmt: number; uwPremBps: number; uwEarned: number;
  config: MarketConfig; wallet: ReturnType<typeof useWallet>;
  balances: { yes: bigint; no: bigint };
  runTx: (fn: () => Promise<string>, label: string) => Promise<boolean>;
}

function TradePanel({
  isOpen, isSettled, yesWon,
  tradeTab, setTradeTab,
  coverAmount, setCoverAmount, coverOrderType, setCoverOrderType, coverLimitBps, setCoverLimitBps,
  coverAmt, premiumCost, bestAskBps,
  uwAmount, setUwAmount, uwPremiumBps, setUwPremiumBps, uwAmt, uwPremBps, uwEarned,
  config, wallet, balances, runTx,
}: TradePanelProps) {

  async function handleBuyCover() {
    if (!wallet.publicKey) return;
    const stroops = BigInt(Math.round(coverAmt * 10_000_000));
    const priceBps = coverOrderType === "limit" && coverLimitBps ? parseInt(coverLimitBps) : bestAskBps ?? 100;
    runTx(() => placeOrder(wallet.publicKey!, config.market_contract, true, priceBps, stroops), "Buy Cover");
  }

  async function handleMintAndSell() {
    if (!wallet.publicKey) return;
    const stroops = BigInt(Math.round(uwAmt * 10_000_000));

    // Step 1: mint — wait for full on-chain confirmation
    const mintOk = await runTx(
      () => mintCompleteSet(wallet.publicKey!, config.market_contract, stroops),
      "Mint (1/2)"
    );

    // Only proceed to sell if mint actually succeeded
    if (!mintOk) return;

    // Step 2: place sell order against the freshly minted YES tokens
    if (uwPremBps > 0) {
      await runTx(
        () => placeOrder(wallet.publicKey!, config.market_contract, false, uwPremBps, stroops),
        "Sell order (2/2)"
      );
    }
  }

  async function handleClaim() {
    if (!wallet.publicKey) return;
    runTx(() => claim(wallet.publicKey!, config.market_contract), "Claim");
  }

  async function handleTrySettle() {
    if (!wallet.publicKey) return;
    runTx(() => trySettle(wallet.publicKey!, config.market_contract), "Try Settle");
  }

  const hasPosition = balances.yes > 0n || balances.no > 0n;

  return (
    <>
      {/* Trade card */}
      <div
        className="flex flex-col rounded-xl overflow-hidden flex-1 min-h-0"
        style={{ background: "#0d0d0d", borderLeft: "none" }}
      >
        {/* Tabs */}
        <div
          className="flex shrink-0"
          style={{ borderBottom: "1px solid #1a1a1a" }}
        >
          {(["cover", "underwrite"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setTradeTab(tab)}
              className="flex-1 py-4 text-sm font-bold transition-all"
              style={{
                background: "transparent",
                color: tradeTab === tab ? "white" : "rgba(255,255,255,0.25)",
                borderBottom: tradeTab === tab ? "2px solid #00ffc2" : "2px solid transparent",
                fontFamily: "Inter, sans-serif",
              }}
            >
              {tab === "cover" ? "Buy Cover" : "Underwrite"}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-4 p-4 overflow-y-auto flex-1 min-h-0">

          {/* ── BUY COVER ─────────────────────── */}
          {tradeTab === "cover" && (
            <>
              {/* Amount input */}
              <div className="flex flex-col gap-2">
                <span
                  className="font-bold uppercase"
                  style={{ color: "#888", fontSize: 11, letterSpacing: "0.55px", fontFamily: "Inter, sans-serif" }}
                >
                  Desired Cover Payout
                </span>
                <div
                  className="relative flex items-center rounded-lg"
                  style={{ background: "#0a0a0a", border: "1px solid #222" }}
                >
                  <input
                    type="number"
                    value={coverAmount}
                    onChange={e => setCoverAmount(e.target.value)}
                    className="flex-1 bg-transparent outline-none text-white px-4 py-3 w-0"
                    placeholder="0"
                    style={{ ...mono, fontSize: 24 }}
                  />
                  <div className="absolute right-4 flex items-center gap-2">
                    <span style={{ color: "#888", fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 16 }}>USDC</span>
                    <div
                      className="flex items-center justify-center rounded-full p-0.5"
                      style={{ background: "#161616", border: "1px solid #222", width: 24, height: 24 }}
                    >
                      <div className="w-[18px] h-[18px] rounded-full overflow-hidden bg-[#0a0a0a] flex items-center justify-center">
                        <span className="text-[8px] text-white font-bold">$</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <span style={{ ...mono, fontSize: 11, color: "#888" }}>
                    Wallet balance: {wallet.publicKey ? "— USDC" : "—"}
                  </span>
                </div>
              </div>

              {/* Preview box */}
              <div
                className="flex flex-col gap-2.5 p-3 rounded-lg"
                style={{ background: "#111", border: "1px solid #1a1a1a" }}
              >
                <PreviewRow
                  label="You pay:"
                  value={coverAmt > 0 && bestAskBps !== null ? `$${premiumCost.toFixed(2)} USDC` : coverAmt > 0 ? "— (no asks)" : "—"}
                  valueColor="white"
                  bold
                />
                <PreviewRow
                  label="You receive:"
                  value={coverAmt > 0 ? `${coverAmt.toFixed(0)} YES tokens` : "—"}
                  valueColor="white"
                />
                <div className="h-px" style={{ background: "#222" }} />
                <PreviewRow label="If depeg:" value={coverAmt > 0 ? `+$${coverAmt.toFixed(2)} payout` : "—"} valueColor="#00ffc2" bold />
                <PreviewRow label="If no depeg:" value="premium lost" valueColor="#888" />
              </div>

              {/* Order type */}
              <div className="flex flex-col gap-2">
                <span
                  className="font-bold"
                  style={{ color: "#888", fontSize: 11, letterSpacing: "0.55px", fontFamily: "Inter, sans-serif" }}
                >
                  ORDER TYPE
                </span>
                <div className="flex gap-2">
                  {(["market","limit"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setCoverOrderType(t)}
                      className="flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all"
                      style={{
                        background: coverOrderType === t ? "#0a0a0a" : "transparent",
                        border: coverOrderType === t ? "1px solid #00ffc2" : "1px solid #333",
                        color: coverOrderType === t ? "white" : "#888",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
                {coverOrderType === "limit" && (
                  <input
                    type="number"
                    placeholder="Price in bps (e.g. 150)"
                    value={coverLimitBps}
                    onChange={e => setCoverLimitBps(e.target.value)}
                    className="px-3 py-2 rounded-lg text-sm outline-none w-full"
                    style={{ background: "#0a0a0a", border: "1px solid #222", color: "white", ...mono }}
                  />
                )}
              </div>
            </>
          )}

          {/* ── UNDERWRITE ─────────────────────── */}
          {tradeTab === "underwrite" && (
            <>
              <div className="flex flex-col gap-2">
                <span style={{ color: "#888", fontSize: 11, letterSpacing: "0.55px", fontFamily: "Inter, sans-serif", fontWeight: 700 }}>
                  STEP 1 — DEPOSIT USDC
                </span>
                <p style={{ color: "#888", fontSize: 12 }}>You receive equal YES + NO tokens</p>
                <div className="relative flex items-center rounded-lg" style={{ background: "#0a0a0a", border: "1px solid #222" }}>
                  <input
                    type="number"
                    value={uwAmount}
                    onChange={e => setUwAmount(e.target.value)}
                    className="flex-1 bg-transparent outline-none text-white px-4 py-3 w-0"
                    placeholder="0"
                    style={{ ...mono, fontSize: 24 }}
                  />
                  <span className="absolute right-4" style={{ color: "#888", fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 16 }}>USDC</span>
                </div>
                {uwAmt > 0 && (
                  <p style={{ ...mono, fontSize: 11, color: "#888" }}>
                    You get: <span style={{ color: "white" }}>{uwAmt.toFixed(0)} YES + {uwAmt.toFixed(0)} NO tokens</span>
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <span style={{ color: "#888", fontSize: 11, letterSpacing: "0.55px", fontFamily: "Inter, sans-serif", fontWeight: 700 }}>
                  STEP 2 — SET PREMIUM
                </span>
                <div className="relative flex items-center rounded-lg" style={{ background: "#0a0a0a", border: "1px solid #222" }}>
                  <input
                    type="number"
                    value={uwPremiumBps}
                    onChange={e => setUwPremiumBps(e.target.value)}
                    className="flex-1 bg-transparent outline-none text-white px-4 py-3 w-0"
                    placeholder="150"
                    style={{ ...mono, fontSize: 24 }}
                  />
                  <span className="absolute right-4" style={{ color: "#888", fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 16 }}>bps</span>
                </div>
                {uwPremBps > 0 && <p style={{ ...mono, fontSize: 11, color: "#888" }}>{uwPremBps} bps = {(uwPremBps/100).toFixed(2)}¢ per YES</p>}
              </div>

              {uwAmt > 0 && (
                <div className="flex flex-col gap-3 p-3 rounded-lg" style={{ background: "#1c1b1b", border: "1px solid #222" }}>
                  <PreviewRow label="Collateral locked:" value={`$${uwAmt.toFixed(2)} USDC`} valueColor="white" />
                  <div className="h-px" style={{ background: "#222" }} />
                  <PreviewRow label="If NO wins (earned):" value={`+$${uwEarned.toFixed(2)}`} valueColor="#00ffc2" bold />
                  <PreviewRow label="If YES wins (lost):" value={`−$${uwAmt.toFixed(2)}`} valueColor="#690005" />
                </div>
              )}

              {!isSettled && wallet.publicKey && (
                <button
                  onClick={handleTrySettle}
                  className="w-full py-2 rounded-lg text-xs transition-all"
                  style={{ background: "transparent", border: "1px solid rgba(255,184,0,0.2)", color: "rgba(255,184,0,0.6)", ...mono }}
                >
                  Try Settle (permissionless)
                </button>
              )}
            </>
          )}
        </div>

        {/* ── Pinned CTA — always visible at bottom of card ── */}
        <div className="shrink-0 p-4 pt-0">
          {tradeTab === "cover" ? (
            isOpen ? (
              wallet.publicKey ? (
                <button
                  onClick={handleBuyCover}
                  disabled={coverAmt <= 0}
                  className="w-full py-4 rounded-lg text-lg font-bold flex items-center justify-center gap-2 disabled:opacity-40 transition-all"
                  style={{
                    background: "#00ffc2",
                    color: "#0a0a0a",
                    boxShadow: "0 0 12px rgba(0,255,194,0.15)",
                    fontFamily: "Inter, sans-serif",
                    letterSpacing: "-0.18px",
                  }}
                >
                  Buy Cover <span style={{ opacity: 0.7 }}>·</span> Pay {bestAskBps !== null && coverAmt > 0 ? `$${premiumCost.toFixed(2)}` : coverAmt > 0 ? "at limit" : "$0.00"}
                </button>
              ) : (
                <button
                  onClick={wallet.connect}
                  className="w-full py-4 rounded-lg text-sm font-bold"
                  style={{ background: "white", color: "#111", fontFamily: "Inter, sans-serif" }}
                >
                  Connect Wallet
                </button>
              )
            ) : (
              <div className="text-xs text-center py-3 rounded-lg" style={{ background: "#1c1b1b", color: "#888" }}>
                Market {isSettled ? (yesWon ? "settled — YES won" : "expired — NO won") : "closed"}
              </div>
            )
          ) : (
            isOpen ? (
              wallet.publicKey ? (
                <button
                  onClick={handleMintAndSell}
                  disabled={uwAmt <= 0}
                  className="w-full py-4 rounded-lg text-lg font-bold disabled:opacity-40"
                  style={{ background: "#1c1b1b", border: "1px solid #333", color: "white", fontFamily: "Inter, sans-serif" }}
                >
                  Mint + Place Sell Order
                </button>
              ) : (
                <button
                  onClick={wallet.connect}
                  className="w-full py-4 rounded-lg text-sm font-bold"
                  style={{ background: "white", color: "#111", fontFamily: "Inter, sans-serif" }}
                >
                  Connect Wallet
                </button>
              )
            ) : (
              <div className="text-xs text-center py-3 rounded-lg" style={{ background: "#1c1b1b", color: "#888" }}>
                Market closed
              </div>
            )
          )}
        </div>
      </div>

      {/* Your Position card */}
      {(hasPosition || wallet.publicKey) && (
        <div
          className="flex flex-col gap-4 p-5 rounded-lg shrink-0"
          style={{ background: "#0d0d0d", borderTop: "1px solid #1a1a1a" }}
        >
          <div className="flex items-center gap-2">
            <svg width="19" height="18" viewBox="0 0 19 18" fill="none" style={{ flexShrink: 0 }}>
              <rect x="1" y="1" width="17" height="16" rx="2" stroke="#888" strokeWidth="1.5"/>
              <rect x="4" y="5" width="4" height="8" rx="0.5" stroke="#888" strokeWidth="1.2"/>
              <rect x="10" y="8" width="5" height="5" rx="0.5" stroke="#888" strokeWidth="1.2"/>
            </svg>
            <span className="font-bold text-white" style={{ fontSize: 14, fontFamily: "Inter, sans-serif" }}>
              Your Position
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid #222" }}>
              <span style={{ ...mono, color: "#888", fontSize: 13 }}>YES Tokens (Cover)</span>
              <span style={{ ...mono, color: "white", fontSize: 13, fontWeight: 700 }}>
                {formatUsdc(balances.yes)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span style={{ ...mono, color: "#888", fontSize: 13 }}>NO Tokens (Underwrite)</span>
              <span style={{ ...mono, color: "white", fontSize: 13 }}>
                {formatUsdc(balances.no)}
              </span>
            </div>
          </div>
          {isSettled && (yesWon ? balances.yes > 0n : balances.no > 0n) && (
            <button
              onClick={handleClaim}
              className="w-full py-3 rounded-lg text-sm font-bold mt-1"
              style={{ background: "#00ffc2", color: "#0a0a0a", fontFamily: "Inter, sans-serif" }}
            >
              Claim Winnings
            </button>
          )}
        </div>
      )}
    </>
  );
}

// ── Preview row ───────────────────────────────────────────────────────────
function PreviewRow({ label, value, valueColor, bold }: { label: string; value: string; valueColor: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ ...mono, color: "#888", fontSize: 13 }}>{label}</span>
      <span style={{ ...mono, color: valueColor, fontSize: 13, fontWeight: bold ? 700 : 400 }}>{value}</span>
    </div>
  );
}
