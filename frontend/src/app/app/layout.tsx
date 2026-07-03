"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/hooks";

// Nav items matching the Figma design exactly
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
      <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
        <path d="M8 1L1 5v5c0 4.4 3 8.5 7 9.5 4-1 7-5.1 7-9.5V5L8 1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: "/app/anchors",
    label: "Anchor Trust",
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
      <svg width="19" height="18" viewBox="0 0 19 18" fill="none">
        <rect x="1" y="10" width="4" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="7.5" y="6" width="4" height="11" rx="1" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="14" y="2" width="4" height="15" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const wallet = useWallet();

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0a0a0a", color: "white", overflow: "hidden" }}>

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside
        style={{
          width: 240,
          flexShrink: 0,
          display: "flex",
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
            <p
              style={{
                fontFamily: "Inter, sans-serif",
                fontWeight: 700,
                fontSize: 24,
                color: "white",
                letterSpacing: "-1.2px",
                lineHeight: "32px",
                margin: 0,
              }}
            >
              AnchorShield
            </p>
            <p
              style={{
                fontFamily: "Inter, sans-serif",
                fontWeight: 400,
                fontSize: 12,
                color: "#888",
                lineHeight: "16px",
                margin: 0,
              }}
            >
              Terminal v1.2.0
            </p>
          </div>

          {/* Nav links */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingLeft: 16, paddingRight: 16 }}>
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href, item.exact);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    paddingLeft: 16,
                    paddingRight: active ? 18 : 16,
                    paddingTop: 12,
                    paddingBottom: 12,
                    borderRadius: 0,
                    background: active ? "#1c1b1b" : "transparent",
                    borderRight: active ? "2px solid #00ffc2" : "2px solid transparent",
                    color: active ? "#00ffc2" : "#888",
                    textDecoration: "none",
                    transition: "all 0.12s ease",
                    width: "100%",
                    boxSizing: "border-box",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.75)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.color = "#888";
                    }
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", flexShrink: 0, width: active ? 16 : 18, height: active ? 20 : 18 }}>
                    {item.icon}
                  </span>
                  <span
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontWeight: 400,
                      fontSize: 14,
                      lineHeight: "20px",
                    }}
                  >
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
            <a
              href="https://developers.stellar.org"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", gap: 12,
                paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8,
                color: "#888", textDecoration: "none", fontSize: 14, fontFamily: "Inter, sans-serif",
                transition: "color 0.12s",
              }}
              onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.75)"}
              onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = "#888"}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M10 6v4l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Settings
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", gap: 12,
                paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8,
                color: "#888", textDecoration: "none", fontSize: 14, fontFamily: "Inter, sans-serif",
                transition: "color 0.12s",
              }}
              onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.75)"}
              onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = "#888"}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 1.5C5.3 1.5 1.5 5.3 1.5 10c0 3.75 2.43 6.93 5.8 8.06.42.08.57-.18.57-.4v-1.4c-2.35.51-2.84-1.13-2.84-1.13-.39-1-.95-1.26-.95-1.26-.77-.53.06-.52.06-.52.85.06 1.3.87 1.3.87.75 1.29 1.97.92 2.45.7.08-.54.3-.92.54-1.13-1.87-.21-3.84-.94-3.84-4.17 0-.92.33-1.67.87-2.26-.09-.21-.38-1.07.08-2.23 0 0 .71-.23 2.33.87A8.1 8.1 0 0110 5.8c.72 0 1.44.1 2.12.28 1.62-1.1 2.33-.87 2.33-.87.46 1.16.17 2.02.08 2.23.54.59.87 1.34.87 2.26 0 3.24-1.97 3.96-3.85 4.17.3.26.57.77.57 1.55v2.3c0 .22.15.48.58.4A8.51 8.51 0 0018.5 10c0-4.7-3.8-8.5-8.5-8.5z" fill="currentColor"/>
              </svg>
              Support
            </a>
          </div>

          {/* Connect Wallet button */}
          <div style={{ paddingTop: 16 }}>
            {wallet.publicKey ? (
              <button
                onClick={wallet.disconnect}
                style={{
                  width: "100%",
                  background: "#1c1b1b",
                  border: "1px solid #333",
                  color: "#00ffc2",
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 700,
                  fontSize: 14,
                  padding: "8px 16px",
                  cursor: "pointer",
                  textAlign: "center",
                  letterSpacing: "-0.14px",
                }}
              >
                {wallet.shortKey}
              </button>
            ) : (
              <button
                onClick={wallet.connect}
                disabled={wallet.isConnecting}
                style={{
                  width: "100%",
                  background: "white",
                  border: "none",
                  color: "#111",
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 700,
                  fontSize: 14,
                  padding: "8px 16px",
                  cursor: wallet.isConnecting ? "not-allowed" : "pointer",
                  opacity: wallet.isConnecting ? 0.6 : 1,
                  textAlign: "center",
                }}
              >
                {wallet.isConnecting ? "Connecting..." : "Connect Wallet"}
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main area ─────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top bar — network + wallet (only when connected, acts as status strip) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 8,
            padding: "8px 24px",
            borderBottom: "1px solid #222",
            background: "#111",
            flexShrink: 0,
            minHeight: 40,
          }}
        >
          {/* Testnet badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              background: "rgba(0,230,118,0.1)",
              border: "1px solid rgba(0,230,118,0.2)",
              borderRadius: 9999,
              fontSize: 11,
              color: "#00e676",
              fontFamily: "Inter, sans-serif",
              fontWeight: 500,
            }}
          >
            <span
              style={{
                width: 6, height: 6, borderRadius: "50%",
                background: "#00e676",
                display: "inline-block",
                animation: "pulse 2s ease-in-out infinite",
              }}
            />
            Testnet
          </div>

          {/* Wallet address */}
          {wallet.publicKey && (
            <button
              onClick={wallet.disconnect}
              style={{
                padding: "4px 10px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 6,
                color: "rgba(255,255,255,0.75)",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              {wallet.shortKey}
            </button>
          )}
        </div>

        {/* Page content */}
        <main style={{ flex: 1, overflow: "auto" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
