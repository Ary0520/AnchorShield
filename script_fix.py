import sys
import re

with open('frontend/src/app/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

markets_preview = """// ── MARKETS PREVIEW ────────────────────────────────────────────────
function MarketsPreview() {
  const markets = [
    { asset: "USDC",  symbol: "USDC",  logo: "/usdclogo.svg",  expires: "Jul 30 2026",  marketId: 0 },
    { asset: "EURC",  symbol: "EURC",  logo: "/eurclogo.svg",  expires: "Sep 28 2026",  marketId: 1 },
    { asset: "PYUSD", symbol: "PYUSD",  logo: "/pyusdlogo.svg", expires: "Sep 28 2026",  marketId: 3 },
    { asset: "MGUSD", symbol: "MGUSD",   logo: "/mgusdlogo.jpg",             expires: "Sep 28 2026",  marketId: 2 },
  ];

  return (
    <section className="py-28 border-t border-[#262626]">
      <div className="max-w-7xl mx-auto px-6">

        {/* Section header — more assertive */}
        <FadeIn className="mb-12">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[#525252] text-xs font-mono uppercase tracking-[0.2em] mb-4">
                LIVE MARKETS
              </p>
              <h2 className={`text-4xl md:text-5xl font-bold text-white leading-[1.1] tracking-tight ${GeistSans.className}`}>
                Pick the market.<br />
                <span className="text-[#a3a3a3]">Hedge the risk.</span>
              </h2>
            </div>
            <Link
              href="/app"
              className="hidden lg:flex items-center gap-2 text-sm text-[#a3a3a3] font-mono uppercase tracking-widest
                         hover:text-white transition-colors shrink-0 mt-2 ml-8 border-b border-[#262626]
                         hover:border-[#525252] pb-1"
            >
              View all
            </Link>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0">
          {markets.map((m, i) => (
            <FadeIn key={m.asset} delay={i * 0.07}>
              <MarketCard {...m} delay={i * 400} />
            </FadeIn>
          ))}
        </div>

      </div>
    </section>
  );
}

"""

new_content = content.replace('// ── CTA BANNER ─────────────────────────────────────────────────────\nfunction CtaBanner() {', markets_preview + '// ── CTA BANNER ─────────────────────────────────────────────────────\nfunction CtaBanner() {')

with open('frontend/src/app/page.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)
    print("Success")
