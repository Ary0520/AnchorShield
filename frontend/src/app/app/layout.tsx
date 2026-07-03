"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/hooks";
import {
  BarChart2,
  TrendingUp,
  Anchor,
  Activity,
  BookOpen,
  Github,
  Shield,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/app", label: "Risk Curve", icon: TrendingUp, exact: true },
  { href: "/app/markets", label: "Hedge Markets", icon: Shield },
  { href: "/app/anchors", label: "Anchor Trust", icon: Anchor },
  { href: "/app/stats", label: "Protocol Stats", icon: Activity },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const wallet = useWallet();

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <div className="flex h-screen bg-[#0a0a12] text-white overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside
        className="w-[220px] shrink-0 flex flex-col border-r"
        style={{ borderColor: "rgba(255,255,255,0.07)", background: "#0d0d18" }}
      >
        {/* Logo */}
        <div className="px-5 pt-6 pb-5 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-2">
            <img src="/ANCHORSHIELDLOGO2.PNG" alt="AnchorShield" className="h-8 w-8 object-contain" />
            <div>
              <p className="text-white font-semibold text-[15px] leading-none">AnchorShield</p>
              <p className="text-[10px] mt-0.5 font-mono" style={{ color: "rgba(255,255,255,0.25)" }}>
                V2.0.4-STABLE
              </p>
            </div>
          </div>
        </div>

        {/* Primary nav */}
        <nav className="flex-1 px-3 pt-4 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href, item.exact);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150"
                style={{
                  background: active ? "rgba(0,229,255,0.08)" : "transparent",
                  color: active ? "#00e5ff" : "rgba(255,255,255,0.55)",
                  borderLeft: active ? "2px solid #00e5ff" : "2px solid transparent",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                    (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.85)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                    (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.55)";
                  }
                }}
              >
                <Icon size={15} strokeWidth={active ? 2 : 1.5} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom links */}
        <div
          className="px-3 pb-5 pt-3 border-t space-y-0.5"
          style={{ borderColor: "rgba(255,255,255,0.07)" }}
        >
          <a
            href="https://developers.stellar.org"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150"
            style={{ color: "rgba(255,255,255,0.35)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.7)";
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.35)";
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <BookOpen size={14} />
            <span>Docs</span>
          </a>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150"
            style={{ color: "rgba(255,255,255,0.35)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.7)";
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.35)";
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <Github size={14} />
            <span>GitHub</span>
          </a>
        </div>
      </aside>

      {/* ── Main area ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header
          className="h-12 shrink-0 flex items-center justify-end gap-3 px-6 border-b"
          style={{
            borderColor: "rgba(255,255,255,0.07)",
            background: "#0d0d18",
          }}
        >
          {/* Network badge */}
          <div
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
            style={{
              background: "rgba(74,222,128,0.1)",
              border: "1px solid rgba(74,222,128,0.2)",
              color: "#4ade80",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Testnet
          </div>

          {/* Wallet button */}
          {wallet.publicKey ? (
            <div className="flex items-center gap-2">
              <button
                className="text-xs px-3 py-1.5 rounded-lg font-mono transition-all"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.75)",
                }}
                onClick={wallet.disconnect}
              >
                {wallet.shortKey}
              </button>
            </div>
          ) : (
            <button
              onClick={wallet.connect}
              disabled={wallet.isConnecting}
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all disabled:opacity-50"
              style={{
                background: "rgba(0,229,255,0.1)",
                border: "1px solid rgba(0,229,255,0.2)",
                color: "#00e5ff",
              }}
            >
              {wallet.isConnecting ? "Connecting..." : "Connect Wallet"}
            </button>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
