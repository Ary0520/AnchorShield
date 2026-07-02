"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import Link from "next/link";

// ── Animated sparkline (live USDC price vs threshold) ──────────────
function HeroSparkline() {
  const points = [
    1.0012, 1.0008, 0.9998, 1.0003, 1.0015, 1.0009, 1.0001,
    0.9997, 1.0005, 1.0011, 0.9999, 1.0007, 1.0003, 1.0010,
    0.9996, 1.0002, 1.0008, 1.0014, 1.0006, 1.0001,
  ];
  const W = 400; const H = 80;
  const min = 0.998; const max = 1.003;
  const toY = (v: number) => H - ((v - min) / (max - min)) * H;
  const toX = (i: number) => (i / (points.length - 1)) * W;
  const d = points
    .map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`)
    .join(" ");
  const thresholdY = toY(0.995);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-full"
      preserveAspectRatio="none"
    >
      {/* threshold line */}
      <line
        x1="0" y1={thresholdY} x2={W} y2={thresholdY}
        stroke="#ef4444" strokeWidth="1" strokeDasharray="4 4"
        className="threshold-line"
      />
      {/* price line */}
      <motion.path
        d={d} fill="none" stroke="#00e5ff" strokeWidth="1.5"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 2, ease: "easeOut", delay: 0.5 }}
      />
      {/* current price dot */}
      <motion.circle
        cx={toX(points.length - 1)} cy={toY(points[points.length - 1])}
        r="3" fill="#00e5ff"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 2.5, duration: 0.3 }}
      />
    </svg>
  );
}

// ── Video tile — no controls, no player chrome ─────────────────────
function VideoTile({
  src, className, children,
}: { src: string; className?: string; children?: React.ReactNode }) {
  return (
    <div className={`video-tile relative overflow-hidden rounded-2xl ${className ?? ""}`}>
      <video
        src={src} autoPlay loop muted playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-black/40" />
      {children && (
        <div className="relative z-10 h-full">{children}</div>
      )}
    </div>
  );
}

// ── Fade-in on scroll ───────────────────────────────────────────────
function FadeIn({
  children, delay = 0, className = "",
}: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref} className={className}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

// ── Live stat counter ───────────────────────────────────────────────
function StatCounter({ value, label }: { value: string; label: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  return (
    <div ref={ref} className="text-center">
      <motion.div
        className="text-3xl font-bold stat-glow text-white mb-1"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={inView ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 0.5, ease: "backOut" }}
      >
        {value}
      </motion.div>
      <div className="text-xs text-white/40 uppercase tracking-widest">{label}</div>
    </div>
  );
}

// ── Nav ────────────────────────────────────────────────────────────
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);
  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? "glass border-b border-white/[0.06]" : ""
    }`}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-white font-semibold text-lg tracking-tight">AnchorShield</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-white/10 text-white/30 uppercase tracking-widest">
            Testnet
          </span>
        </div>
        <div className="flex items-center gap-8">
          <Link href="/app" className="text-sm text-white/50 hover:text-white transition-colors">
            Markets
          </Link>
          <Link href="/app" className="text-sm text-white/50 hover:text-white transition-colors">
            ACR
          </Link>
          <Link
            href="/app"
            className="text-sm px-4 py-2 rounded-full border border-white/10 text-white/80
                       hover:border-white/30 hover:text-white transition-all duration-200"
          >
            Launch App →
          </Link>
        </div>
      </div>
    </nav>
  );
}

// ── HERO ───────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden grid-bg noise">
      {/* Radial glow behind headline */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                        w-[900px] h-[600px] rounded-full opacity-[0.07]
                        bg-[radial-gradient(ellipse,#00e5ff_0%,transparent_70%)]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-28 pb-20 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

          {/* LEFT: Copy */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full
                              border border-white/10 text-white/40 text-xs mb-8 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Live on Stellar Testnet · Reflector oracle active
              </div>
              <h1 className="text-5xl lg:text-6xl font-bold leading-[1.08] tracking-tight mb-6">
                <span className="gradient-text">Hedge stablecoin</span>
                <br />
                <span className="gradient-text">risk on Stellar.</span>
              </h1>
              <p className="text-white/50 text-lg leading-relaxed mb-8 max-w-lg">
                Fully on-chain, oracle-driven hedging for stablecoin depegs.
                Pay a small premium. Get an automatic payout if the peg breaks.
                No claims. No humans. No waiting.
              </p>
              <div className="flex items-center gap-4">
                <Link
                  href="/app"
                  className="px-6 py-3 rounded-full bg-white text-black text-sm font-semibold
                             hover:bg-white/90 transition-all duration-200 hover:scale-[1.02]"
                >
                  Explore Markets →
                </Link>
                <a
                  href="#how-it-works"
                  className="px-6 py-3 rounded-full border border-white/10 text-white/70 text-sm
                             hover:border-white/30 hover:text-white transition-all duration-200"
                >
                  How it works
                </a>
              </div>
            </motion.div>
          </div>

          {/* RIGHT: Bento grid with blob video + sparkline */}
          <div className="hidden lg:grid grid-cols-2 gap-3 h-[480px]">
            {/* Big tile: blob video */}
            <VideoTile src="/blob1.mp4" className="col-span-2 h-56">
              <div className="p-5 flex flex-col justify-end h-full">
                <p className="text-white/60 text-xs mb-1">Real-time oracle</p>
                <p className="text-white font-medium text-sm">Reflector price feed · updates every 5 min</p>
              </div>
            </VideoTile>

            {/* Sparkline tile */}
            <motion.div
              className="glass rounded-2xl p-4 flex flex-col justify-between"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
            >
              <div>
                <p className="text-white/40 text-xs mb-1">USDC / USD</p>
                <p className="text-white font-semibold text-sm">Live price vs threshold</p>
              </div>
              <div className="h-16 mt-2">
                <HeroSparkline />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] text-red-400 font-mono">— $0.995 threshold</span>
              </div>
            </motion.div>

            {/* Stats tile */}
            <motion.div
              className="glass rounded-2xl p-4 flex flex-col justify-between"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
            >
              <p className="text-white/40 text-xs">Testnet live</p>
              <div className="space-y-2 mt-2">
                <div>
                  <p className="text-2xl font-bold text-white">4</p>
                  <p className="text-white/40 text-xs">Active markets</p>
                </div>
                <div>
                  <p className="text-lg font-semibold gradient-text-accent">USDC · EURC · USDT · DAI</p>
                  <p className="text-white/40 text-xs">Covered stablecoins</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Techy HUD card — corner brackets, scan line ───────────────────
function HudCard({
  children,
  className = "",
  scanDelay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  scanDelay?: number;
}) {
  return (
    <div className={`relative bg-[#0a0a12] overflow-hidden ${className}`}>
      {/* Corner brackets — bigger, brighter */}
      <span className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white/60" />
      <span className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white/60" />
      <span className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white/60" />
      <span className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white/60" />

      {/* Dot grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Scan line — bright cyan */}
      <motion.div
        className="absolute left-0 right-0 h-[2px] pointer-events-none"
        style={{
          background: "linear-gradient(90deg, transparent 0%, rgba(0,229,255,0.7) 20%, rgba(0,229,255,0.9) 50%, rgba(0,229,255,0.7) 80%, transparent 100%)",
          boxShadow: "0 0 12px 2px rgba(0,229,255,0.4)",
        }}
        initial={{ top: "0%" }}
        animate={{ top: "100%" }}
        transition={{
          duration: 2.5,
          delay: scanDelay,
          repeat: Infinity,
          repeatDelay: 3,
          ease: "linear",
        }}
      />

      <div className="relative z-10 p-8 h-full">{children}</div>
    </div>
  );
}

// ── STATS — HUD cards, pure typography ────────────────────────────
function StatsBar() {
  return (
    <section className="py-20">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* LEFT — big square: $3B+ */}
          <HudCard className="min-h-[340px] flex flex-col justify-between" scanDelay={0}>
            <span className="text-white/25 text-[10px] font-mono uppercase tracking-[0.25em]">
              Stellar ecosystem · RWA
            </span>
            <div>
              <motion.p
                className="text-[clamp(5rem,10vw,8.5rem)] font-bold leading-none tracking-tighter text-white"
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
              >
                $3B+
              </motion.p>
              <p className="text-white/35 text-sm mt-4 max-w-xs leading-relaxed">
                In tokenized real-world assets on Stellar.
                USDC. EURC. MGUSD. USDT.
                Every dollar carries peg risk.
              </p>
            </div>
          </HudCard>

          {/* RIGHT — two stacked */}
          <div className="flex flex-col gap-4">

            {/* Top right: 4 markets */}
            <HudCard className="flex-1 flex flex-col justify-between min-h-[160px]" scanDelay={1}>
              <span className="text-white/25 text-[10px] font-mono uppercase tracking-[0.25em]">
                Live on testnet
              </span>
              <div>
                <motion.p
                  className="text-[clamp(3.5rem,7vw,6rem)] font-bold leading-none tracking-tighter text-white"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.75, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                >
                  4
                </motion.p>
                <p className="text-white/35 text-sm mt-2">
                  Active markets — USDC · EURC · USDT · DAI
                </p>
              </div>
            </HudCard>

            {/* Bottom right: $10M */}
            <HudCard className="flex-1 flex flex-col justify-between min-h-[160px]" scanDelay={2}>
              <span className="text-white/25 text-[10px] font-mono uppercase tracking-[0.25em]">
                Why this exists
              </span>
              <div>
                <motion.p
                  className="text-[clamp(3.5rem,7vw,6rem)] font-bold leading-none tracking-tighter text-white"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.75, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                >
                  $10M
                </motion.p>
                <p className="text-white/35 text-sm mt-2">
                  Drained from Stellar in Feb 2026. No hedge existed. Now one does.
                </p>
              </div>
            </HudCard>

          </div>
        </div>
      </div>
    </section>
  );
}

// ── HOW IT WORKS ───────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Pick a market",
      body: "Choose the stablecoin you want to hedge — USDC, EURC, USDT, or DAI. Each market covers a specific depeg event: for example, USDC drops below $0.995 and stays there for 1 hour.",
    },
    {
      n: "02",
      title: "Buy cover or underwrite",
      body: "Cover buyers pay a small USDC premium and receive YES tokens. If the depeg happens, each YES token redeems for $1 USDC. Underwriters deposit USDC, mint YES + NO tokens, sell YES to collect premium, and keep NO.",
    },
    {
      n: "03",
      title: "Auto-settles on-chain",
      body: "The Reflector oracle publishes prices every 5 minutes. Our settlement contract reads it automatically. No claims, no disputes. Winning tokens redeem for exactly $1 USDC.",
    },
  ];
  return (
    <section id="how-it-works" className="py-28">
      <div className="max-w-7xl mx-auto px-6">
        <FadeIn className="text-center mb-16">
          <p className="text-white/30 text-xs uppercase tracking-widest mb-3 font-mono">How it works</p>
          <h2 className="text-4xl font-bold gradient-text">Three steps. Fully automated.</h2>
        </FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((s, i) => (
            <FadeIn key={s.n} delay={i * 0.12}>
              <div className="glass rounded-2xl p-7 h-full hover:border-white/[0.14] transition-colors">
                <p className="text-6xl font-bold text-white/[0.06] mb-4 font-mono">{s.n}</p>
                <h3 className="text-white font-semibold text-lg mb-3">{s.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{s.body}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── WHY ANCHORSHIELD (bento with videos) ───────────────────────────
function WhySection() {
  return (
    <section className="py-28 border-t border-white/[0.05]">
      <div className="max-w-7xl mx-auto px-6">
        <FadeIn className="mb-16">
          <p className="text-white/30 text-xs uppercase tracking-widest mb-3 font-mono">Why AnchorShield</p>
          <h2 className="text-4xl font-bold gradient-text">Built for Stellar&apos;s moment.</h2>
        </FadeIn>

        {/* Row 1: big left + two right */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

          {/* Big left: the risk is real */}
          <FadeIn delay={0} className="lg:col-span-2">
            <div className="glass rounded-2xl p-8 h-full min-h-[260px] flex flex-col justify-between
                            hover:border-white/[0.14] transition-colors">
              <div>
                <span className="text-xs font-mono text-white/30 uppercase tracking-widest">The risk</span>
                <h3 className="text-2xl font-bold text-white mt-2 mb-4">
                  The risk is real and growing.
                </h3>
                <p className="text-white/50 text-sm leading-relaxed max-w-lg">
                  Stellar now holds over $3 billion in on-chain assets. MGUSD launched June 2026.
                  YLDS launched May 2026. In February 2026, a single oracle manipulation drained
                  $10M from a Stellar lending pool. The stablecoins are here. The risk infrastructure
                  isn&apos;t — until now.
                </p>
              </div>
              <div className="flex gap-6 mt-6">
                <div><p className="text-2xl font-bold text-white">$3B+</p><p className="text-xs text-white/30">On-chain assets on Stellar</p></div>
                <div><p className="text-2xl font-bold text-red-400">$10M</p><p className="text-xs text-white/30">Lost in Feb 2026 oracle attack</p></div>
                <div><p className="text-2xl font-bold text-white">4</p><p className="text-xs text-white/30">New stablecoins launched in 2026</p></div>
              </div>
            </div>
          </FadeIn>

          {/* Right: currency video tile */}
          <FadeIn delay={0.1}>
            <VideoTile src="/currencyAnimation.mp4" className="h-full min-h-[260px]">
              <div className="p-6 flex flex-col justify-end h-full">
                <span className="text-xs font-mono text-white/40 mb-1 uppercase tracking-widest">Yield</span>
                <p className="text-white font-semibold text-sm leading-snug">
                  Idle collateral earns yield via DeFindex while waiting for expiry.
                </p>
              </div>
            </VideoTile>
          </FadeIn>
        </div>

        {/* Row 2: parametric + price is signal */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FadeIn delay={0.15}>
            <div className="glass rounded-2xl p-7 hover:border-white/[0.14] transition-colors">
              <span className="text-xs font-mono text-white/30 uppercase tracking-widest">Mechanism</span>
              <h3 className="text-xl font-bold text-white mt-2 mb-3">Parametric, not indemnity.</h3>
              <p className="text-white/50 text-sm leading-relaxed">
                Traditional insurance requires proof of loss, adjusters, and weeks of waiting.
                AnchorShield pays instantly when a machine-verifiable condition is met.
                The oracle is the judge. The contract is the payout. Nothing else involved.
              </p>
            </div>
          </FadeIn>
          <FadeIn delay={0.2}>
            <div className="glass rounded-2xl p-7 hover:border-white/[0.14] transition-colors">
              <span className="text-xs font-mono text-white/30 uppercase tracking-widest">Risk curve</span>
              <h3 className="text-xl font-bold text-white mt-2 mb-3">The price IS the signal.</h3>
              <p className="text-white/50 text-sm leading-relaxed">
                When you buy YES at 150 bps, you&apos;re contributing to a market-implied probability.
                The YES price across all AnchorShield markets forms a live risk curve for
                Stellar&apos;s stablecoin ecosystem — readable by any protocol, wallet, or indexer.
              </p>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

// ── ACR SECTION ────────────────────────────────────────────────────
function AcrSection() {
  const ratings = [
    { rating: "AAA", range: "≥ 2.0x", color: "#4ade80", label: "Anchor staked double the cover" },
    { rating: "AA",  range: "≥ 1.0x", color: "#34d399", label: "Fully backed — complete skin in game" },
    { rating: "A",   range: "≥ 0.5x", color: "#fbbf24", label: "Covers more than half of outstanding risk" },
    { rating: "BBB", range: "≥ 0.1x", color: "#fb923c", label: "Partial stake — limited signal" },
    { rating: "C",   range: "< 0.1x", color: "#f87171", label: "Low confidence signal" },
  ];

  return (
    <section className="py-20 border-t border-white/[0.05]">
      <div className="max-w-7xl mx-auto px-6">

        {/* Section heading */}
        <FadeIn className="mb-12">
          <p className="text-white/25 text-[10px] font-mono uppercase tracking-[0.25em] mb-3">
            The differentiator
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-white leading-tight">
            Anchor Confidence Ratio.
          </h2>
          <p className="text-white/40 text-base mt-3 max-w-xl">
            Open on-chain trust infrastructure for Stellar&apos;s anchor economy.
            Not a dashboard feature — a public primitive.
          </p>
        </FadeIn>

        {/* Bento: big left + two stacked right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* LEFT — anchor video, full height */}
          <FadeIn delay={0}>
            <div className="video-tile relative overflow-hidden rounded-2xl min-h-[480px] h-full">
              <video
                src="/acrAnimation.mp4" autoPlay loop muted playsInline
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
              <div className="relative z-10 h-full flex flex-col justify-end p-8">
                <p className="text-white/40 text-xs font-mono uppercase tracking-widest mb-3">
                  Anchor Confidence Ratio
                </p>
                <h3 className="text-3xl font-bold text-white mb-2">
                  ACR = stake ÷ cover outstanding
                </h3>
                <p className="text-white/55 text-sm max-w-sm leading-relaxed">
                  Anchors stake their own USDC against their stablecoin market.
                  The ratio is published on-chain — readable by any contract, wallet, or indexer on Stellar.
                </p>
              </div>
            </div>
          </FadeIn>

          {/* RIGHT — two stacked */}
          <div className="flex flex-col gap-4">

            {/* Top right: the code call as a feature */}
            <FadeIn delay={0.1}>
              <div className="glass rounded-2xl p-8 flex flex-col justify-between min-h-[200px]">
                <p className="text-white/25 text-[10px] font-mono uppercase tracking-[0.25em] mb-4">
                  Public on-chain API
                </p>
                <div className="bg-black/50 rounded-xl px-6 py-5 border border-white/[0.06] font-mono mb-4">
                  <p className="text-white/30 text-xs mb-2">// callable from any Soroban contract</p>
                  <p className="text-[clamp(0.85rem,2vw,1.05rem)] leading-snug">
                    <span className="text-white/40">let acr = </span>
                    <span className="text-[#00e5ff]">anchor_stake</span>
                    <span className="text-white/60">.</span>
                    <span className="text-white font-semibold">get_acr</span>
                    <span className="text-white/60">(</span>
                    <span className="text-[#00ff88]">&anchor_address</span>
                    <span className="text-white/60">);</span>
                  </p>
                  <p className="text-white/30 text-xs mt-3">
                    // 10_000 = 1.0x · 20_000 = 2.0x · 5_000 = 0.5x
                  </p>
                </div>
                <p className="text-white/40 text-xs">
                  Any wallet, lending protocol, or DeFi app on Stellar can read
                  an anchor&apos;s confidence ratio in real time. No API key. No permission. Always on.
                </p>
              </div>
            </FadeIn>

            {/* Bottom right: ratings table */}
            <FadeIn delay={0.2}>
              <div className="glass rounded-2xl p-8 flex flex-col min-h-[260px]">
                <p className="text-white/25 text-[10px] font-mono uppercase tracking-[0.25em] mb-5">
                  ACR ratings
                </p>
                <div className="space-y-3 flex-1">
                  {ratings.map((r, i) => (
                    <motion.div
                      key={r.rating}
                      className="flex items-center gap-4"
                      initial={{ opacity: 0, x: -12 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.3 + i * 0.07, duration: 0.4 }}
                    >
                      {/* Rating badge */}
                      <span
                        className="font-mono font-bold text-sm w-12 shrink-0"
                        style={{ color: r.color }}
                      >
                        {r.rating}
                      </span>
                      {/* Range */}
                      <span className="text-white/30 font-mono text-xs w-14 shrink-0">{r.range}</span>
                      {/* Bar */}
                      <div className="flex-1 h-px bg-white/[0.06] relative">
                        <motion.div
                          className="absolute left-0 top-0 h-px"
                          style={{ background: r.color, opacity: 0.5 }}
                          initial={{ width: 0 }}
                          whileInView={{ width: `${(5 - i) * 20}%` }}
                          viewport={{ once: true }}
                          transition={{ delay: 0.4 + i * 0.07, duration: 0.6 }}
                        />
                      </div>
                      {/* Label */}
                      <span className="text-white/40 text-xs text-right w-44 shrink-0 hidden md:block">
                        {r.label}
                      </span>
                    </motion.div>
                  ))}
                </div>
                <div className="mt-5 pt-4 border-t border-white/[0.05]">
                  <Link
                    href="/app"
                    className="text-sm text-white/40 hover:text-white transition-colors"
                  >
                    View live anchor scores →
                  </Link>
                </div>
              </div>
            </FadeIn>

          </div>
        </div>
      </div>
    </section>
  );
}

// ── MARKETS PREVIEW ────────────────────────────────────────────────
function MarketsPreview() {
  const markets = [
    { asset: "USDC", label: "USDC depeg < $0.995 for 1hr", expires: "Jul 30 2026", risk: "Low" },
    { asset: "EURC", label: "EURC depeg < $0.995 for 1hr", expires: "Sep 28 2026", risk: "Low" },
    { asset: "USDT", label: "USDT depeg < $0.995 for 1hr", expires: "Sep 28 2026", risk: "Moderate" },
    { asset: "DAI",  label: "DAI depeg < $0.995 for 1hr",  expires: "Sep 28 2026", risk: "Low" },
  ];
  const riskColor: Record<string, string> = {
    Low: "text-green-400 bg-green-400/10",
    Moderate: "text-yellow-400 bg-yellow-400/10",
    High: "text-red-400 bg-red-400/10",
  };
  return (
    <section className="py-28 border-t border-white/[0.05]">
      <div className="max-w-7xl mx-auto px-6">
        <FadeIn className="flex items-end justify-between mb-10">
          <div>
            <p className="text-white/30 text-xs uppercase tracking-widest mb-2 font-mono">Live markets</p>
            <h2 className="text-3xl font-bold gradient-text">Live markets on Stellar testnet.</h2>
            <p className="text-white/40 text-sm mt-2">
              Each market is a fully collateralized binary outcome contract.
              1 YES + 1 NO = exactly $1 USDC.
            </p>
          </div>
          <Link
            href="/app"
            className="hidden md:flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors shrink-0 ml-8"
          >
            View all markets →
          </Link>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {markets.map((m, i) => (
            <FadeIn key={m.asset} delay={i * 0.08}>
              <Link href="/app">
                <div className="glass rounded-2xl p-5 cursor-pointer hover:border-white/[0.18]
                                hover:bg-white/[0.05] transition-all duration-200 h-full">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center
                                    text-white font-bold text-xs">
                      {m.asset[0]}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${riskColor[m.risk]}`}>
                      {m.risk}
                    </span>
                  </div>
                  <p className="text-white font-semibold text-sm mb-1">{m.asset}</p>
                  <p className="text-white/40 text-xs mb-4 leading-snug">{m.label}</p>
                  <p className="text-white/30 text-xs font-mono">Expires {m.expires}</p>
                </div>
              </Link>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── CTA BANNER ─────────────────────────────────────────────────────
function CtaBanner() {
  return (
    <section className="py-28 border-t border-white/[0.05]">
      <div className="max-w-7xl mx-auto px-6">
        <FadeIn>
          <div className="glass rounded-3xl p-12 md:p-16 text-center relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                              w-[600px] h-[400px] rounded-full opacity-[0.06]
                              bg-[radial-gradient(ellipse,#00e5ff_0%,transparent_70%)]" />
            </div>
            <p className="text-white/30 text-xs uppercase tracking-widest mb-4 font-mono">
              Ready to hedge onchain risk?
            </p>
            <h2 className="text-4xl md:text-5xl font-bold gradient-text mb-6">
              AnchorShield is live.
            </h2>
            <p className="text-white/50 text-lg max-w-xl mx-auto mb-10">
              Four markets. Real oracle data. Automatic settlement.
              Connect your Freighter wallet and start hedging in under 60 seconds.
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Link
                href="/app"
                className="px-8 py-4 rounded-full bg-white text-black font-semibold text-sm
                           hover:bg-white/90 transition-all duration-200 hover:scale-[1.02]"
              >
                Launch App →
              </Link>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 rounded-full border border-white/10 text-white/60 text-sm
                           hover:border-white/30 hover:text-white transition-all duration-200"
              >
                View on GitHub
              </a>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

// ── FOOTER ─────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t border-white/[0.05] py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <p className="text-white font-semibold mb-1">AnchorShield</p>
            <p className="text-white/30 text-xs max-w-sm">
              Parametric hedging infrastructure for Stellar&apos;s stablecoin economy.
            </p>
            <p className="text-white/20 text-xs mt-3">
              Running on Stellar Testnet · Soroban SDK v26 · Oracle: Reflector Network
            </p>
          </div>
          <div className="flex gap-6 text-xs text-white/30">
            <Link href="/app" className="hover:text-white transition-colors">App</Link>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer"
               className="hover:text-white transition-colors">GitHub</a>
            <a href="https://developers.stellar.org" target="_blank" rel="noopener noreferrer"
               className="hover:text-white transition-colors">Stellar Docs</a>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-white/[0.04]">
          <p className="text-white/20 text-xs">
            AnchorShield is a decentralized protocol. It is not a licensed insurance product.
            All outcomes are determined automatically by on-chain oracle data.
            Use at your own risk. Testnet deployment — not for production use.
          </p>
        </div>
      </div>
    </footer>
  );
}

// ── ROOT EXPORT ────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#080810] text-white">
      <Nav />
      <Hero />
      <StatsBar />
      <HowItWorks />
      <WhySection />
      <AcrSection />
      <MarketsPreview />
      <CtaBanner />
      <Footer />
    </main>
  );
}
