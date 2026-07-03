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
import { ChevronRight, Hammer, Wallet } from "lucide-react";

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

// ── Stat pill in the header bar ──────────────────────────────────────────
function StatPill({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className="flex flex-col px-4 py-2 rounded-lg"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <span className="text-[10px] uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>
        {label}
      </span>
      <span
        className="text-sm font-semibold mt-0.5"
        style={{ color: accent ? "#00e5ff" : "rgba(255,255,255,0.9)" }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
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

  // Trade panel
  const [tradeTab, setTradeTab]           = useState<"cover" | "underwrite">("cover");
  const [coverAmount, setCoverAmount]     = useState("100");
  const [coverLimitBps, setCoverLimitBps] = useState("");
  const [coverOrderType, setCoverOrderType] = useState<"market" | "limit">("market");
  const [uwAmount, setUwAmount]           = useState("");
  const [uwPremiumBps, setUwPremiumBps]   = useState("150");

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
      setState(s);
      setCollateral(col);
      setOrders(ords as Order[]);
      if (wallet.publicKey) {
        const b = await getBalances(cfg.market_contract, wallet.publicKey)
          .catch(() => ({ yes: 0n, no: 0n }));
        setBalances(b);
      }
    } catch (e) {
      setTxError(e instanceof Error ? e.message : "Failed to load market");
    } finally {
      setLoading(false);
    }
  }, [marketId, wallet.publicKey]);

  useEffect(() => { refresh(); }, [refresh]);

  async function runTx(fn: () => Promise<string>, label: string) {
    if (!wallet.publicKey) { setTxError("Connect wallet first"); return; }
    setTxStatus(`Sending ${label}...`);
    setTxError(null);
    try {
      const hash = await fn();
      setTxStatus(`✓ ${label} confirmed — ${hash.slice(0, 12)}...`);
      await refresh();
    } catch (e) {
      setTxError(e instanceof Error ? e.message : `${label} failed`);
      setTxStatus(null);
    }
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="flex flex-col h-full" style={{ background: "#0a0a12" }}>
        <div className="p-5 space-y-3">
          {[120, 320, 80].map((h, i) => (
            <div key={i} className="rounded-xl animate-pulse w-full"
              style={{ height: h, background: "rgba(255,255,255,0.04)" }} />
          ))}
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-6 text-sm" style={{ background: "#0a0a12", color: "rgba(255,255,255,0.4)" }}>
        Market not found.{" "}
        <Link href="/app" style={{ color: "#00e5ff" }}>← Back to Risk Curve</Link>
      </div>
    );
  }

  // Derived values
  const asset = assetFromLabel(config.label);
  const meta  = ASSET_META[asset] ?? { logo: null, symbol: asset, threshold: 0.995 };

  const sellOrders = (orders as Order[])
    .filter(o => !o.is_buy)
    .sort((a, b) => Number(a.price_bps) - Number(b.price_bps));
  const buyOrders = (orders as Order[])
    .filter(o => o.is_buy)
    .sort((a, b) => Number(b.price_bps) - Number(a.price_bps));

  const bestAskBps = sellOrders[0] ? Number(sellOrders[0].price_bps) : null;
  const bestBidBps = buyOrders[0]  ? Number(buyOrders[0].price_bps)  : null;
  const midBps = bestAskBps !== null && bestBidBps !== null
    ? Math.round((bestAskBps + bestBidBps) / 2)
    : bestAskBps ?? bestBidBps;

  const yesPrice  = bestAskBps !== null ? `${(bestAskBps / 100).toFixed(1)}¢` : "—";
  const noPrice   = bestAskBps !== null ? `${((10000 - bestAskBps) / 100).toFixed(1)}¢` : "—";
  const riskPct   = bestAskBps !== null ? `${(bestAskBps / 100).toFixed(1)}%` : "—";

  const isOpen     = state === "Open";
  const isSettled  = state === "Settled" || state === "Expired";
  const yesWon     = state === "Settled";

  // Cover preview
  const coverAmt    = parseFloat(coverAmount) || 0;
  const premiumFrac = bestAskBps !== null ? bestAskBps / 10000 : 0;
  const premiumCost = coverAmt * premiumFrac;

  // Underwrite preview
  const uwAmt      = parseFloat(uwAmount) || 0;
  const uwPremBps  = parseInt(uwPremiumBps) || 0;
  const uwEarned   = uwAmt * uwPremBps / 10000;

  function stateBg(s: string)    { if (s === "Open") return "rgba(34,197,94,0.15)"; if (s === "Settled") return "rgba(239,68,68,0.15)"; return "rgba(255,255,255,0.07)"; }
  function stateText(s: string)  { if (s === "Open") return "#22c55e"; if (s === "Settled") return "#ef4444"; return "rgba(255,255,255,0.5)"; }
