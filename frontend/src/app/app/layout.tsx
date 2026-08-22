"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/hooks";
import { Suspense } from "react";
import TopLoader from "@/app/components/TopLoader";

const NAV_ITEMS = [
  {
    href: "/app",
    label: "Risk Curve",
    exact: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M2 14l4-5 3 3 4-6 3 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: "/app/markets",
    label: "Hedge Markets",
    icon: (
      <svg width="16" height="18" viewBox="0 0 16 18" fill="none">
        <path d="M8 1L1 5v5c0 4.4 3 8.5 7 9.5 4-1 7-5.1 7-9.5V5L8 1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: "/app/anchors",
    label: "ACR",
    icon: (
      <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
        <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M8 8v10M4 12l4 2 4-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: "/app/stats",
    label: "Protocol Stats",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="1" y="10" width="4" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="7.5" y="6" width="4" height="11" rx="1" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="14" y="2" width="4" height="15" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    href: "/app/admin",
    label: "Deploy Market",
    adminOnly: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M12 4v16m8-8H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const wallet   = useWallet();

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <div style={{ display: "flex", height: "100dvh", background: "#0a0a0a", color: "white", overflow: "hidden" }}>

      {/* ── Top loader — page transition progress bar ────── */}
      <Suspense fallback={null}>
        <TopLoader />
      </Suspense>

      {/* ── Desktop sidebar — hidden on mobile ──────────────────── */}
      <aside
        className="hidden md:flex"
        style={{
          width: 240,
          flexShrink: 0,
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#111",
          borderRight: "1px solid #222",
          paddingRight: 1,
          paddingTop: 24,
          paddingBottom: 24,
        }}
      >
        {/* Brand */}
        <div>
          <div style={{ paddingLeft: 24, paddingBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 4 }}>
              <img src="/ANCHORSHIELDLOGO2.png" alt="AnchorShield" style={{ width: 50, height: 50, objectFit: "contain", flexShrink: 0 }} />
              <p style={{ fontFamily: "'General Sans', sans-serif", fontWeight: 500, fontSize: 22, color: "white", letterSpacing: "-1.2px", lineHeight: "32px", margin: 0 }}>
                AnchorShield
              </p>
            </div>
            <p style={{ fontFamily: "'General Sans', sans-serif", fontWeight: 400, fontSize: 12, color: "#888", lineHeight: "16px", margin: 0, paddingLeft: 42 }}>
              v1 - Testnet
            </p>
          </div>

          {/* Nav links */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingLeft: 16, paddingRight: 16 }}>
            {NAV_ITEMS.filter((item) => !(item as any).adminOnly || wallet.publicKey === process.env.NEXT_PUBLIC_ADMIN_PUBKEY).map((item) => {
              const active = isActive(item.href, item.exact);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    paddingLeft: 16, paddingRight: active ? 18 : 16,
                    paddingTop: 12, paddingBottom: 12,
                    background: active ? "#1c1b1b" : "transparent",
                    borderRight: active ? "2px solid #00ffc2" : "2px solid transparent",
                    color: active ? "#00ffc2" : "#888",
                    textDecoration: "none",
                    transition: "all 0.12s ease",
                    boxSizing: "border-box",
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.75)"; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "#888"; }}
                >
                  <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ fontFamily: "'General Sans', sans-serif", fontWeight: 400, fontSize: 14, lineHeight: "20px" }}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

          {/* Footer */}
          <div style={{ borderTop: "1px solid #222", paddingTop: 17, paddingLeft: 16, paddingRight: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <a href="https://docs.anchorshield.xyz" target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, color: "#888", textDecoration: "none", fontSize: 14, fontFamily: "'General Sans', sans-serif" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.75)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#888"}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Documentation
              </a>
              <a href="mailto:anchorshieldstellar@gmail.com"
              style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, color: "#888", textDecoration: "none", fontSize: 14, fontFamily: "'General Sans', sans-serif" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.75)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#888"}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="1.5" y="3.5" width="15" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M1.5 5.5l7.5 5 7.5-5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
              Support
            </a>
          </div>
          <div style={{ paddingTop: 16 }}>
            {wallet.publicKey ? (
              <button onClick={wallet.disconnect} style={{ width: "100%", background: "#1c1b1b", border: "1px solid #333", color: "#00ffc2", fontFamily: "'General Sans', sans-serif", fontWeight: 700, fontSize: 14, padding: "8px 16px", cursor: "pointer", textAlign: "center" }}>
                {wallet.shortKey}
              </button>
            ) : (
              <button onClick={wallet.connect} disabled={wallet.isConnecting} style={{ width: "100%", background: "white", border: "none", color: "#111", fontFamily: "'General Sans', sans-serif", fontWeight: 700, fontSize: 14, padding: "8px 16px", cursor: wallet.isConnecting ? "not-allowed" : "pointer", opacity: wallet.isConnecting ? 0.6 : 1, textAlign: "center" }}>
                {wallet.isConnecting ? "Connecting..." : "Connect Wallet"}
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main area ────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 16px", borderBottom: "1px solid #222", background: "#111", flexShrink: 0, minHeight: 44 }}>
          {/* Mobile: show logo + name */}
          <div className="flex md:hidden items-center gap-0">
            <img src="/ANCHORSHIELDLOGO2.png" alt="AnchorShield" style={{ width: 26, height: 26, objectFit: "contain" }} />
            <span style={{ fontFamily: "'General Sans', sans-serif", fontWeight: 500, fontSize: 16, color: "white", letterSpacing: "-0.5px" }}>
              AnchorShield
            </span>
          </div>
          <div className="hidden md:block" />

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
            {/* Testnet badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", background: "rgba(0,230,118,0.1)", border: "1px solid rgba(0,230,118,0.2)", borderRadius: 9999, fontSize: 11, color: "#00e676", fontFamily: "'General Sans', sans-serif", fontWeight: 500 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00e676", display: "inline-block", animation: "pulse 2s ease-in-out infinite" }} />
              Testnet
            </div>
            {/* Wallet — desktop only */}
            {wallet.publicKey && (
              <button onClick={wallet.disconnect} className="hidden md:block" style={{ padding: "4px 10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "rgba(255,255,255,0.75)", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, cursor: "pointer" }}>
                {wallet.shortKey}
              </button>
            )}
          </div>
        </div>

        {/* Page content — add bottom padding on mobile so content isn't hidden under nav */}
        <main style={{ flex: 1, overflowY: "auto" }} className="pb-[68px] md:pb-0">
          {children}
        </main>
      </div>

      {/* ── Mobile bottom nav — hidden on desktop ───────────────── */}
      <nav
        className="flex md:hidden"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: "rgba(13,13,24,0.97)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div style={{ display: "flex", width: "100%" }}>
          {NAV_ITEMS.filter((item) => !(item as any).adminOnly || wallet.publicKey === process.env.NEXT_PUBLIC_ADMIN_PUBKEY).map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  paddingTop: 10,
                  paddingBottom: 10,
                  color: active ? "#00ffc2" : "rgba(255,255,255,0.35)",
                  textDecoration: "none",
                  transition: "color 0.12s",
                  position: "relative",
                }}
              >
                {/* Active indicator line at top */}
                {active && (
                  <span style={{
                    position: "absolute",
                    top: 0, left: "25%", right: "25%",
                    height: 2,
                    borderRadius: "0 0 2px 2px",
                    background: "#00ffc2",
                  }} />
                )}
                <span style={{ display: "flex", alignItems: "center" }}>
                  {item.icon}
                </span>
                <span style={{ fontFamily: "'General Sans', sans-serif", fontSize: 10, fontWeight: active ? 600 : 400, letterSpacing: "0.01em", lineHeight: 1 }}>
                  {item.label === "Hedge Markets" ? "Markets" : item.label === "Anchor Trust" ? "Anchors" : item.label === "Protocol Stats" ? "Stats" : item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

    </div>
  );
}
