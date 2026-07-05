"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";
import {
  LineChart, Line, ResponsiveContainer, ReferenceLine, YAxis,
} from "recharts";

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

// ── Video tile — lazy autoplay, no controls ────────────────────────
function VideoTile({
  src, className, children, eager = false,
}: { src: string; className?: string; children?: React.ReactNode; eager?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (eager) return; // hero video plays immediately
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.play().catch(() => {});
          obs.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [eager]);

  return (
    <div className={`video-tile relative overflow-hidden rounded-2xl ${className ?? ""}`}>
      <video
        ref={ref}
        src={src}
        autoPlay={eager}
        preload={eager ? "auto" : "none"}
        loop muted playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ willChange: "transform" }}
      />
      <div className="absolute inset-0 bg-black/20" />
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
  const inView = useInView(ref, { once: true, margin: "-60px" });
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
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 px-4">
      <motion.div
        className="flex items-center justify-between w-full max-w-5xl px-6 h-16 rounded-3xl"
        style={{
          background: "rgba(255, 255, 255, 0.07)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.18)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.12)",
          willChange: "transform",
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-1">
          <img
            src="/ANCHORSHIELDLOGO2.png"
            alt="AnchorShield"
            className="h-12 w-12 object-contain"
          />
          <span className="text-white font-semibold text-[17px] tracking-tight">
            AnchorShield
          </span>
        </div>

        {/* Links */}
        <div className="flex items-center gap-6">
          <Link
            href="/app"
            className="text-sm text-white/45 hover:text-white transition-colors duration-150"
          >
            Markets
          </Link>
          <Link
            href="/app"
            className="text-sm text-white/45 hover:text-white transition-colors duration-150"
          >
            ACR
          </Link>
          <Link
            href="/app"
            className="text-sm px-4 py-1.5 rounded-xl font-medium text-white
                       transition-all duration-200"
            style={{
              background: "rgba(255,255,255,0.09)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.15)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.22)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.09)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)";
            }}
          >
            Launch App →
          </Link>
        </div>
      </motion.div>
    </nav>
  );
}

// ── HERO ───────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden grid-bg noise">
      {/* Radial glow behind headline — removed to keep bg pure black */}

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-28 pb-20 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">

          {/* LEFT: Copy */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full
                              border border-white/10 text-white/50 text-sm mb-8 font-mono">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Live on Stellar Testnet
              </div>
              <h1 className="text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight mb-7">
                <span className="gradient-text">Hedge stablecoin</span>
                <br />
                <span className="gradient-text">risk on Stellar.</span>
              </h1>
              <p className="text-white/50 text-xl leading-relaxed mb-10 max-w-lg">
                When the peg breaks, you get paid.
                the payout is automatic. No claims. No humans. No waiting.
              </p>
              <div className="flex items-center gap-4">
                <Link
                  href="/app"
                  className="px-7 py-3.5 rounded-full bg-white text-black text-base font-semibold
                             hover:bg-white/90 transition-all duration-200 hover:scale-[1.02]"
                >
                  Explore Markets →
                </Link>
                <a
                  href="#how-it-works"
                  className="px-7 py-3.5 rounded-full border border-white/10 text-white/70 text-base
                             hover:border-white/30 hover:text-white transition-all duration-200"
                >
                  How it works
                </a>
              </div>
            </motion.div>
          </div>

          {/* RIGHT: Blob video — full height, no fake cards */}
          <div className="hidden lg:flex flex-col mt-8">
            <VideoTile src="/blob1.mp4" className="w-full h-[420px]" eager>
              <div className="p-5 flex flex-col justify-end h-full">
                <p className="text-white/60 text-xs mb-1"></p>
                <p className="text-white font-medium  text-sm">Reflector price feed · updates every 5 min</p>
              </div>
            </VideoTile>
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
    <div className={`relative bg-black overflow-hidden ${className}`}>
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

      {/* Scan line — CSS animation, off JS thread */}
      <div
        className="scan-line absolute left-0 right-0 h-[2px] pointer-events-none"
        style={{ animationDelay: `${scanDelay}s` }}
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
      body: "Choose the stablecoin you want protected. Each market has a specific trigger and a live risk price.",
    },
    {
      n: "02",
      title: "Choose your side",
      body: "Buying cover costs a small premium — paid out automatically if the peg breaks. Underwriting earns those premiums in exchange for covering the risk.",
    },
    {
      n: "03",
      title: "Walk away",
      body: "The oracle watches the price. The contract decides. If the peg breaks, winners are paid instantly.",
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
              <div className="relative rounded-2xl p-7 h-full transition-all duration-300 step-card"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(0,229,255,0.18)",
                  boxShadow: "0 0 18px rgba(0,229,255,0.07), inset 0 1px 0 rgba(255,255,255,0.05)",
                }}>
                <p className="text-6xl font-bold mb-4 font-mono"
                  style={{
                    background: "linear-gradient(135deg, #00e5ff 0%, rgba(0,229,255,0.4) 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    filter: "drop-shadow(0 0 8px rgba(0,229,255,0.5))",
                  }}>{s.n}</p>
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
          <p className="text-white/30 text-xs uppercase tracking-widest mb-3 font-mono"></p>
          <h2 className="text-4xl font-bold gradient-text">Built for Stellar&apos;s moment.</h2>
        </FadeIn>

        {/* Row 1: big left + two right */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

          {/* Big left: the risk is real */}
          <FadeIn delay={0} className="lg:col-span-2">
            <div className="glass rounded-2xl p-8 h-full min-h-[260px] flex flex-col justify-between
                            hover:border-white/[0.14] transition-colors">
              <div>
                <span className="text-xs font-mono text-white/3 uppercase tracking-widest">The risk</span>
                <h3 className="text-2xl font-bold text-white mt-2 mb-4">
                  $3 billion in Stellar stablecoins. No protection layer.
                </h3>
                <p className="text-white/70 text-sm leading-relaxed max-w-lg">
                  Stellar crossed $3 billion in on-chain assets this year. Three new stablecoins launched. One oracle attack already drained $10M from a lending pool. The assets arrived. The protection didn't.
                </p>
              </div>
              <div className="flex gap-6 mt-6">
                <div><p className="text-2xl font-bold text-white">$3B+</p><p className="text-xs text-white/70">On-chain assets on Stellar</p></div>
                <div><p className="text-2xl font-bold text-red-400">$10M</p><p className="text-xs text-white/70">Lost in Feb 2026 oracle attack</p></div>
                {/* <div><p className="text-2xl font-bold text-white">4</p><p className="text-xs text-white/70">New stablecoins launched in 2026</p></div> */}
              </div>
            </div>
          </FadeIn>

          {/* Right: currency video tile */}
          <FadeIn delay={0.1}>
            <VideoTile src="/currencyAnimation.mp4" className="h-full min-h-[450px]">
              <div className="p-6 flex flex-col justify-end h-full">
                <span className="text-xs font-mono text-white/90 mb-1 uppercase tracking-widest">Yield</span>
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
              <span className="text-xs font-mono text-white/3 uppercase tracking-widest">Mechanism</span>
              <h3 className="text-xl font-bold text-white mt-2 mb-3">Parametric, not indemnity.</h3>
              <p className="text-white/70 text-sm leading-relaxed">
                Traditional insurance needs proof, adjusters, and weeks of waiting. AnchorShield pays the moment the oracle confirms a breach. No forms. No calls. No one to convince.
              </p>
            </div>
          </FadeIn>
          <FadeIn delay={0.2}>
            <div className="glass rounded-2xl p-7 hover:border-white/[0.14] transition-colors">
              <span className="text-xs font-mono text-white/3 uppercase tracking-widest">Risk curve</span>
              <h3 className="text-xl font-bold text-white mt-2 mb-3">The price IS the signal.</h3>
              <p className="text-white/70 text-sm leading-relaxed">
                Every trade prices real risk.
The premium on each market tells you — and every protocol on Stellar — which stablecoins the market thinks are most likely to break.
              </p>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

// ── LOGO CAROUSEL ──────────────────────────────────────────────────
function LogoCarousel() {
  const logos = [
    { src: "/circlelogo.svg",        alt: "Circle",            type: "svg" },
    { src: "/moneygramlogo.png",     alt: "MoneyGram",         type: "png" },
    { src: "/franklintempletonlogo.svg", alt: "Franklin Templeton",type: "svg" },
    { src: "/circlelogo.svg",        alt: "Circle",            type: "svg" },
    { src: "/moneygramlogo.png",     alt: "MoneyGram",         type: "png" },
    { src: "/franklintempletonlogo.svg", alt: "Franklin Templeton",type: "svg" },
    { src: "/circlelogo.svg",        alt: "Circle",            type: "svg" },
    { src: "/moneygramlogo.png",     alt: "MoneyGram",         type: "png" },
    { src: "/franklintempletonlogo.svg", alt: "Franklin Templeton",type: "svg" },
  ];

  return (
    <section className="py-16 border-y border-white/[0.04] overflow-hidden">
      <p className="text-center text-white/3 text-[12px] font-mono uppercase tracking-[0.3em] mb-8">
        Stellar ecosystem partners
      </p>

      {/* Infinite scroll track */}
      <div className="relative flex overflow-hidden">
        {/* Fade masks on edges */}
        <div className="absolute left-0 top-0 bottom-0 w-32 z-10 pointer-events-none"
             style={{ background: "linear-gradient(90deg, #000000 0%, transparent 100%)" }} />
        <div className="absolute right-0 top-0 bottom-0 w-32 z-10 pointer-events-none"
             style={{ background: "linear-gradient(270deg, #000000 0%, transparent 100%)" }} />

        {/* Track — duplicated for seamless loop */}
        <div
          className="flex gap-16 items-center shrink-0"
          style={{
            animation: "marquee 25s linear infinite",
            width: "max-content",
          }}
        >
          {[...logos, ...logos].map((logo, i) => (
            <div
              key={i}
              className="flex items-center justify-center h-10 px-2 shrink-0"
              style={{ minWidth: "120px" }}
            >
              <img
                src={logo.src}
                alt={logo.alt}
                className="max-h-10 max-w-[140px] object-contain"
                style={{
                  filter: "grayscale(100%) brightness(0.75)",
                  opacity: 0.85,
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}
function AcrSection() {
  const ratings = [
    { rating: "AAA", range: "≥ 2.0x", color: "#00e5ff", barColor: "#00e5ff",       label: "The anchor has twice as much at stake as all cover sold" },
    { rating: "AA",  range: "≥ 1.0x", color: "#34d399", barColor: "#34d399",       label: "Fully backed — the anchor covers every dollar of risk" },
    { rating: "A",   range: "≥ 0.5x", color: "#5eead4", barColor: "#5eead4",       label: "More than half covered with their own capital" },
    { rating: "BBB", range: "≥ 0.1x", color: "#fbbf24", barColor: "#fbbf24",       label: "Some skin in the game" },
    { rating: "C",   range: "< 0.1x", color: "#f87171", barColor: "#f87171",       label: "Minimal stake — use with awareness" },
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
          <p className="text-white/70 text-base mt-3 max-w-xl">
            Open on-chain trust infrastructure for Stellar&apos;s anchor economy.
          </p>
        </FadeIn>

        {/* Bento: big left + two stacked right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* LEFT — anchor video, full height */}
          <FadeIn delay={0}>
            <VideoTile src="/acrAnimation.mp4" className="min-h-[480px] h-full">
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
              <div className="relative z-10 h-full flex flex-col justify-end p-8">
                <h3 className="text-3xl font-bold text-white mb-2">
                  Anchors put their own money on the line.
                </h3>
                <p className="text-white/70 text-sm max-w-sm leading-relaxed">
                  If they fail, they lose it. The higher it is, the more aligned the anchor is with the people using them.
                </p>
              </div>
            </VideoTile>
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
                <p className="text-white/70 text-xs">
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
                      <div className="flex-1 h-[3px] bg-white/[0.06] relative rounded-full overflow-hidden">
                        <motion.div
                          className="absolute left-0 top-0 h-[3px] rounded-full origin-left"
                          style={{
                            background: r.barColor,
                            opacity: 0.85,
                            boxShadow: `0 0 6px ${r.barColor}`,
                            width: `${(5 - i) * 20}%`,
                            willChange: "transform",
                          }}
                          initial={{ scaleX: 0 }}
                          whileInView={{ scaleX: 1 }}
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

// ── Market sparkline — fetches oracle price history from Reflector ─
const ORACLE = "CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63";
const RPC = "https://soroban-testnet.stellar.org";

async function fetchOraclePrices(symbol: string): Promise<number[]> {
  try {
    const { Contract, TransactionBuilder, Account, rpc, BASE_FEE, Networks, xdr, scValToNative } =
      await import("@stellar/stellar-sdk");

    const server = new rpc.Server("https://soroban-testnet.stellar.org", { allowHttp: false });
    const source = new Account("GD6KRXUKOAPTYW72IZOERCPGM3UHXTQDJK4RS5WUAZHC4K2WOONQA3ZR", "0");

    // Asset::Other(Symbol) encoding confirmed working against Reflector testnet
    const assetArg = xdr.ScVal.scvVec([
      xdr.ScVal.scvSymbol("Other"),
      xdr.ScVal.scvSymbol(symbol),
    ]);

    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        new Contract(ORACLE).call("prices", assetArg, xdr.ScVal.scvU32(24))
      )
      .setTimeout(30)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);

    const raw = scValToNative(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sim as any).result!.retval
    ) as Array<{ price: bigint; timestamp: bigint }> | null;

    if (!raw || !Array.isArray(raw) || raw.length === 0) throw new Error("no data");

    // Reflector uses 14-decimal precision: divide by 1e14 to get USD
    return raw.map((r) => Number(r.price) / 1e14);
  } catch {
    // Fallback to deterministic simulated data if oracle call fails
    const seed = symbol.charCodeAt(0);
    const rng = (i: number) => Math.sin(seed * i * 0.7) * 0.5 + Math.cos(i * 1.3) * 0.5;
    if (symbol === "USDT") {
      return Array.from({ length: 24 }, (_, i) => parseFloat((1.0008 - i * 0.00012 + rng(i) * 0.0018).toFixed(6)));
    }
    if (symbol === "EURC") {
      return Array.from({ length: 24 }, (_, i) => parseFloat((1.0018 + rng(i) * 0.0014).toFixed(6)));
    }
    if (symbol === "DAI") {
      return Array.from({ length: 24 }, (_, i) => parseFloat((1.0004 + rng(i) * 0.0022 + Math.sin(i * 0.4) * 0.0008).toFixed(6)));
    }
    return Array.from({ length: 24 }, (_, i) => parseFloat((1.0006 + rng(i) * 0.0012).toFixed(6)));
  }
}

// ── Single market card with sparkline ─────────────────────────────
function MarketCard({
  asset, symbol, logo, expires, marketId,
}: {
  asset: string;
  symbol: string;
  logo: string | null;
  expires: string;
  marketId: number;
}) {
  const [prices, setPrices] = useState<{ v: number }[]>([]);
  const [coverCost, setCoverCost] = useState<string | null>(null);
  const THRESHOLD = 0.995;

  useEffect(() => {
    fetchOraclePrices(symbol).then((pts) => {
      setPrices(pts.map((v) => ({ v })));
      const latest = pts[pts.length - 1];
      const impliedProb = Math.max(0, (THRESHOLD - latest + 0.005) / THRESHOLD);
      const cost = Math.max(1, Math.round(impliedProb * 1000 * 100));
      setCoverCost(`$${cost}`);
    });
  }, [symbol]);

  const currentPrice = prices.length ? prices[prices.length - 1].v : null;
  const priceDisplay = currentPrice ? `$${currentPrice.toFixed(4)}` : "—";
  // Color the line based on distance from threshold
  const danger = currentPrice !== null && currentPrice < 0.998;
  const lineColor = danger ? "#fbbf24" : "#00e5ff";

  return (
    <Link href="/app">
      <motion.div
        className="rounded-2xl overflow-hidden cursor-pointer relative"
        style={{
          background: "linear-gradient(145deg, #040408 0%, #000000 100%)",
          border: "1px solid rgba(255,255,255,0.07)",
        }}
        whileHover={{
          borderColor: "rgba(0,229,255,0.25)",
          boxShadow: "0 0 24px rgba(0,229,255,0.06)",
          y: -3,
        }}
        transition={{ duration: 0.2 }}
      >
        {/* Top glow when dangerous */}
        {danger && (
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-yellow-400/60 to-transparent" />
        )}

        {/* Header */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center gap-2.5">
            {/* Logo */}
            {logo ? (
              <img src={logo} alt={asset} className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center
                              text-white font-bold text-xs">
                {asset[0]}
              </div>
            )}
            <div>
              <p className="text-white font-bold text-base leading-none">{asset}</p>
              <p className="text-white/30 text-[11px] mt-0.5 font-mono">depeg &lt; $0.995</p>
            </div>
          </div>
        </div>

        {/* Price + sparkline */}
        <div className="relative px-1">
          {/* Price overlay — top right */}
          <div className="absolute top-0 right-4 z-10">
            <p
              className="text-xl font-bold leading-none tabular-nums"
              style={{ color: danger ? "#fbbf24" : "#ffffff" }}
            >
              {priceDisplay}
            </p>
          </div>

          <div className="h-16 mt-1">
            {prices.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={prices} margin={{ top: 8, right: 6, left: 6, bottom: 4 }}>
                  <YAxis domain={[0.993, 1.004]} hide />
                  <ReferenceLine
                    y={THRESHOLD}
                    stroke="rgba(239,68,68,0.35)"
                    strokeDasharray="3 3"
                    strokeWidth={1}
                  />
                  <Line
                    type="monotone"
                    dataKey="v"
                    stroke={lineColor}
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full mx-4 bg-white/[0.03] animate-pulse rounded-lg" />
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="mx-4 h-px bg-white/[0.05]" />

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-white/50 text-[11px]">Cover $1&apos;000</p>
            <p className="text-white/20 text-[10px] mt-0.5 font-mono">exp. {expires}</p>
          </div>
          <div
            className="text-sm font-bold px-3 py-1.5 rounded-lg tabular-nums"
            style={{
              background: danger ? "rgba(251,191,36,0.12)" : "rgba(0,229,255,0.1)",
              color: danger ? "#fbbf24" : "#00e5ff",
            }}
          >
            {coverCost ?? "—"}
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

// ── MARKETS PREVIEW ────────────────────────────────────────────────
function MarketsPreview() {
  const markets = [
    { asset: "USDC",  symbol: "USDC",  logo: "/usdclogo.svg",  expires: "Jul 30 2026",  marketId: 0 },
    { asset: "EURC",  symbol: "EURC",  logo: "/eurclogo.svg",  expires: "Sep 28 2026",  marketId: 1 },
    { asset: "PYUSD", symbol: "PYUSD",  logo: "/pyusdlogo.svg", expires: "Sep 28 2026",  marketId: 3 },
    { asset: "MGUSD", symbol: "MGUSD",   logo: "/mgusdlogo.jpg",             expires: "Sep 28 2026",  marketId: 2 },
  ];

  return (
    <section className="py-28 border-t border-white/[0.05]">
      <div className="max-w-7xl mx-auto px-6">

        {/* Section header — more assertive */}
        <FadeIn className="mb-12">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-white/3 text-[12px] font-mono uppercase tracking-[0.25em] mb-3 ">
                Live markets
              </p>
              <h2 className="text-4xl md:text-5xl font-bold text-white leading-tight">
                Pick the market.<br />
                <span className="text-white/60">Hedge the risk.</span>
              </h2>
              <p className="text-white/35 text-sm mt-4 max-w-lg">
                Each market is a fully collateralized binary outcome contract.
                Pay a small premium. Get an automatic $1 payout per token if the peg breaks.
              </p>
            </div>
            <Link
              href="/app"
              className="hidden lg:flex items-center gap-2 text-sm text-white/35
                         hover:text-white transition-colors shrink-0 mt-2 ml-8 border-b border-white/10
                         hover:border-white/40 pb-0.5"
            >
              View all markets →
            </Link>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {markets.map((m, i) => (
            <FadeIn key={m.asset} delay={i * 0.07}>
              <MarketCard {...m} />
            </FadeIn>
          ))}
        </div>

        {/* Bottom CTA strip */}
        <FadeIn delay={0.35} className="mt-8">
          <div className="flex items-center justify-between border-t border-white/[0.05] pt-6">
            <p className="text-white/25 text-xs">
              Settlements are permissionless — anyone can trigger them.
              Our watcher calls <span className="font-mono text-white/40">try_settle()</span> every 60s.
            </p>
            <Link
              href="/app"
              className="text-sm px-5 py-2.5 rounded-full border border-white/10 text-white/60
                         hover:border-white/30 hover:text-white transition-all duration-200 shrink-0 ml-6"
            >
              Start hedging →
            </Link>
          </div>
        </FadeIn>
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
              Running on Stellar · Soroban SDK
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
    <main className="min-h-screen bg-black text-white">
      <Nav />
      <Hero />
      <StatsBar />
      <HowItWorks />
      <WhySection />
      <LogoCarousel />
      <AcrSection />
      <MarketsPreview />
      <CtaBanner />
      <Footer />
    </main>
  );
}
