"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  getMarket, getMarketState, getTotalCollateral, getOrders,
  getBalances, mintCompleteSet, placeOrder, trySettle, claim,
  formatUsdc, formatExpiry,
  type MarketConfig, type Order,
} from "@/lib/contracts";
import { useWallet } from "@/hooks";
import { ChevronRight } from "lucide-react";

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

  async function runTx(fn: () => Promise<string>, label: string) {
    if (!wallet.publicKey) { setTxError("Connect wallet first"); return; }
    setTxStatus(`Sending ${label}...`); setTxError(null);
    try {
      const hash = await fn();
      setTxStatus(`✓ ${label} confirmed — ${hash.slice(0, 12)}...`);
      await refresh();
    } catch (e) {
      setTxError(e instanceof Error ? e.message : `${label} failed`);
      setTxStatus(null);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full p-6 gap-3" style={{ background: "#0a0a0a" }}>
        {[100, 300, 60].map((h, i) => (
          <div key={i} className="rounded-lg animate-pulse w-full" style={{ height: h, background: "#161616" }} />
        ))}
      </div>
    );
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
      <div className="flex flex-1 overflow-hidden gap-3 p-4" style={{ zIndex: 1 }}>

        {/* LEFT column */}
        <div className="flex flex-col gap-6 flex-1 min-w-0 overflow-y-auto">

          {/* Chart card */}
          <div
            className="flex flex-col rounded-lg shrink-0"
            style={{ height: 300, background: "#161616", border: "1px solid #222" }}
          >
            {/* Chart header bar */}
            <div
              className="flex items-center justify-between px-4 py-3 shrink-0 rounded-tl-lg rounded-tr-lg"
              style={{ background: "#1c1b1b", borderBottom: "1px solid #222" }}
            >
              {/* Price + timestamp */}
              <div
                className="flex items-center gap-2 px-2 py-1 rounded"
                style={{ background: "#0a0a0a", border: "1px solid #222" }}
              >
                <span style={{ ...mono, fontSize: 13, color: "white" }}>$1.0003</span>
                <span style={{ ...mono, fontSize: 10, color: "#888" }}>· 2 min ago</span>
              </div>
              {/* Time range buttons */}
              <div className="flex items-center p-0.5 rounded gap-0" style={{ background: "#0a0a0a", border: "1px solid #222" }}>
                {(["1H","6H","1D","1W"] as const).map((r) => (
                  <button
                    key={r}
                    className="px-3 py-1 rounded text-xs font-bold transition-all"
                    style={{
                      background: r === "1D" ? "#2a2a2a" : "transparent",
                      color: r === "1D" ? "white" : "#888",
                      letterSpacing: "0.55px",
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Chart body — empty canvas ready for real chart */}
            <div
              className="flex-1 relative rounded-bl-lg rounded-br-lg overflow-hidden"
              style={{ background: "#0d0d0d" }}
            >
              {/* Y-axis labels */}
              <div className="absolute right-4 top-4 bottom-6 flex flex-col justify-between items-end">
                {["$1.010","$1.005","$1.000","$0.995","$0.990","$0.980"].map((l, i) => (
                  <span key={l} style={{ ...mono, fontSize: 10, color: i === 3 ? "#690005" : "#888" }}>{l}</span>
                ))}
              </div>
              {/* X-axis labels */}
              <div className="absolute bottom-2 left-4 right-12 flex justify-between">
                {["00:00","06:00","12:00","18:00","24:00"].map((t) => (
                  <span key={t} style={{ ...mono, fontSize: 10, color: "#888" }}>{t}</span>
                ))}
              </div>
              {/* Threshold label */}
              <div className="absolute" style={{ bottom: "35%", left: 0, right: 48, borderTop: "1px dashed rgba(105,0,5,0.7)" }}>
                <span
                  className="absolute left-4 -top-3 px-2 py-0.5 rounded text-xs"
                  style={{ background: "#0d0d0d", border: "1px solid rgba(105,0,5,0.3)", color: "#690005", fontSize: 9 }}
                >
                  Depeg threshold
                </span>
              </div>
              {/* Chart renders here — plug in Recharts/real data later */}
            </div>
          </div>

          {/* Section B & C row */}
          <div className="flex gap-3 shrink-0">
            {/* How this market settles */}
            <div
              className="flex flex-col flex-1 rounded-lg"
              style={{ background: "#161616", border: "1px solid #222" }}
            >
              <div className="px-4 py-4 shrink-0" style={{ borderBottom: "1px solid #222" }}>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 18 }}>⚒</span>
                  <span className="font-semibold text-white" style={{ fontSize: 18, letterSpacing: "-0.18px" }}>
                    How this market settles
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-3 p-4 flex-1">
                {[
                  { label: "Trigger",   value: `${meta.symbol}/USD < $${meta.threshold}`, mono: true, valueColor: "white" },
                  { label: "Duration",  value: "1 continuous hour", mono: true, valueColor: "white" },
                  { label: "YES wins",  value: "Each YES redeems $1.00 USDC", mono: false, valueColor: "white", labelColor: "#ffb800" },
                  { label: "NO wins",   value: `No breach before ${formatExpiry(config.expiry_timestamp)} — NO redeems $1.00`, mono: false, valueColor: "white", labelColor: "#888" },
                ].map((row, i) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between text-xs pb-3"
                    style={i < 3 ? { borderBottom: "1px solid rgba(34,34,34,0.5)" } : {}}
                  >
                    <span style={{ color: row.labelColor ?? "#888", fontSize: 12 }}>{row.label}</span>
                    <span style={{ ...(row.mono ? mono : {}), color: row.valueColor, fontSize: 12 }}>{row.value}</span>
                  </div>
                ))}
              </div>
              <div
                className="flex items-start gap-2 px-3 py-3 rounded-bl-lg rounded-br-lg"
                style={{ background: "#1c1b1b", borderTop: "1px solid #222" }}
              >
                <span style={{ fontSize: 16, color: "#888", lineHeight: 1.2 }}>ⓘ</span>
                <span style={{ ...mono, fontSize: 10, color: "#888", lineHeight: 1.5 }}>
                  Settlement is permissionless. Watcher calls{" "}
                  <span
                    className="px-1 rounded"
                    style={{ background: "#0a0a0a", border: "1px solid rgba(34,34,34,0.5)", color: "white" }}
                  >
                    try_settle()
                  </span>{" "}
                  every 60 seconds.
                </span>
              </div>
            </div>

            {/* Order Book */}
            <OrderBook buyOrders={buyOrders} sellOrders={sellOrders} midBps={midBps} formatUsdc={formatUsdc} />
          </div>
        </div>

        {/* RIGHT column — trade panel */}
        <div
          className="w-[320px] shrink-0 flex flex-col gap-3"
          style={{ height: "100%", overflowY: "auto" }}
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
    </div>
  );
}

// ── Order Book ────────────────────────────────────────────────────────────
function OrderBook({
  buyOrders, sellOrders, midBps, formatUsdc: fmt,
}: {
  buyOrders: Order[]; sellOrders: Order[]; midBps: number | null;
  formatUsdc: (v: bigint) => string;
}) {
  const rows = 5;
  return (
    <div
      className="flex flex-col flex-1 rounded-lg overflow-hidden"
      style={{ background: "#161616", border: "1px solid #222" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-4 shrink-0"
        style={{ borderBottom: "1px solid #222" }}
      >
        <span className="font-semibold text-white" style={{ fontSize: 18, letterSpacing: "-0.18px" }}>
          Order Book
        </span>
        <span
          className="px-2 py-1 rounded font-bold"
          style={{ background: "#1c1b1b", color: "#888", fontSize: 11, letterSpacing: "0.55px" }}
        >
          YES TOKENS
        </span>
      </div>

      {/* Column headers */}
      <div
        className="grid shrink-0 px-4 py-2"
        style={{ gridTemplateColumns: "1fr 1fr 1px 1fr 1fr", borderBottom: "1px solid rgba(34,34,34,0.5)", gap: 0 }}
      >
        <span style={{ ...mono, fontSize: 11, color: "#888" }}>Size{"\n"}(USDC)</span>
        <span style={{ ...mono, fontSize: 11, color: "#888", textAlign: "right" }}>Price{"\n"}(bps)</span>
        <div />
        <span style={{ ...mono, fontSize: 11, color: "#888", paddingLeft: 8 }}>Price{"\n"}(bps)</span>
        <span style={{ ...mono, fontSize: 11, color: "#888", textAlign: "right" }}>Size{"\n"}(USDC)</span>
      </div>

      {/* Rows */}
      <div className="flex flex-1">
        {/* Buy side */}
        <div className="flex-1 flex flex-col py-1" style={{ borderRight: "1px solid rgba(34,34,34,0.5)" }}>
          {Array.from({ length: rows }, (_, i) => {
            const o = buyOrders[i];
            const maxSize = buyOrders[0] ? Number(buyOrders[0].amount - buyOrders[0].filled) : 1;
            const size = o ? Number(o.amount - o.filled) : 0;
            const barPct = maxSize > 0 ? (size / maxSize) * 100 : 0;
            return (
              <div key={i} className="relative flex items-center justify-between px-4 py-1">
                {o && (
                  <div
                    className="absolute inset-y-0 right-0"
                    style={{ left: `${100 - barPct}%`, background: "rgba(0,255,194,0.1)" }}
                  />
                )}
                <span className="relative z-10" style={{ ...mono, fontSize: 11, color: o ? "white" : "transparent" }}>
                  {o ? parseInt(fmt(o.amount - o.filled)).toLocaleString() : "·"}
                </span>
                <span className="relative z-10" style={{ ...mono, fontSize: 11, color: "#00ffc2" }}>
                  {o ? String(o.price_bps) : ""}
                </span>
              </div>
            );
          })}
        </div>

        {/* Sell side */}
        <div className="flex-1 flex flex-col py-1">
          {Array.from({ length: rows }, (_, i) => {
            const o = sellOrders[i];
            const maxSize = sellOrders[0] ? Number(sellOrders[0].amount - sellOrders[0].filled) : 1;
            const size = o ? Number(o.amount - o.filled) : 0;
            const barPct = maxSize > 0 ? (size / maxSize) * 100 : 0;
            return (
              <div key={i} className="relative flex items-center justify-between px-4 py-1">
                {o && (
                  <div
                    className="absolute inset-y-0 left-0"
                    style={{ right: `${100 - barPct}%`, background: "rgba(105,0,5,0.1)" }}
                  />
                )}
                <span className="relative z-10" style={{ ...mono, fontSize: 11, color: "#690005" }}>
                  {o ? String(o.price_bps) : ""}
                </span>
                <span className="relative z-10" style={{ ...mono, fontSize: 11, color: o ? "white" : "transparent" }}>
                  {o ? parseInt(fmt(o.amount - o.filled)).toLocaleString() : "·"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mid price */}
      <div
        className="flex items-center justify-center py-2 rounded-bl-lg rounded-br-lg"
        style={{ background: "#353534", borderTop: "1px solid #222" }}
      >
        <span
          className="px-3 py-1 rounded-full"
          style={{ background: "#0a0a0a", border: "1px solid #222", ...mono, fontSize: 11, color: "white" }}
        >
          {midBps !== null ? (
            <>{midBps.toFixed(1)} bps <span style={{ color: "#888" }}>mid</span></>
          ) : (
            <span style={{ color: "#888" }}>No orders</span>
          )}
        </span>
      </div>
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
  runTx: (fn: () => Promise<string>, label: string) => void;
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
    await runTx(() => mintCompleteSet(wallet.publicKey!, config.market_contract, stroops), "Mint");
    if (uwPremBps > 0) {
      runTx(() => placeOrder(wallet.publicKey!, config.market_contract, false, uwPremBps, stroops), "Place Sell Order");
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
        style={{ background: "#161616", border: "1px solid #222" }}
      >
        {/* Tabs */}
        <div
          className="flex shrink-0"
          style={{ background: "#1c1b1b", borderBottom: "1px solid #222" }}
        >
          {(["cover", "underwrite"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setTradeTab(tab)}
              className="flex-1 py-4 text-sm font-bold transition-all"
              style={{
                background: tradeTab === tab ? "#161616" : "transparent",
                color: tradeTab === tab ? "white" : "#888",
                borderBottom: tradeTab === tab ? "2px solid white" : "2px solid transparent",
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
                  className="font-bold"
                  style={{ color: "#888", fontSize: 11, letterSpacing: "0.55px", fontFamily: "Inter, sans-serif" }}
                >
                  I WANT TO PROTECT
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
                style={{ background: "#1c1b1b", border: "1px solid #222" }}
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
          style={{ background: "#161616", border: "1px solid #222" }}
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
          {isSettled && (balances.yes > 0n || balances.no > 0n) && (
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
