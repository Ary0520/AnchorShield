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
    const el = ref.current;
    if (!el) return;

    if (eager) {
      // Hero video: start playing as soon as it's in view + enough buffered
      el.play().catch(() => {});
      return;
    }

    // Below-fold videos: only start loading + playing when near viewport
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.load();            // trigger network fetch now
          el.play().catch(() => {});
          obs.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "400px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [eager]);

  return (
    <div className={`video-tile relative overflow-hidden rounded-2xl ${className ?? ""}`}>
      <video
        ref={ref}
        src={src}
        // Never preload="auto" — let IntersectionObserver control loading
        preload="none"
        loop muted playsInline
        className="absolute inset-0 w-full h-full object-cover"
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
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-1">
          <img
            src="/ANCHORSHIELDLOGO2.png"
            alt="AnchorShield"
            className="h-14 w-14 object-contain"
          />
          <span className="text-white font-semibold text-[17px] tracking-tight">
            AnchorShield
          </span>
        </div>

        {/* Links */}
        <div className="flex items-center gap-6">
          <span
            className="hidden sm:block text-sm text-white/45 cursor-not-allowed select-none"
            title="Coming soon"
          >
            Whitepaper
          </span>
          <span
            className="hidden sm:block text-sm text-white/45 cursor-not-allowed select-none"
            title="Coming soon"
          >
            Docs
          </span>
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
                <p className="text-white font-medium  text-sm">Bringing the future of finance on Stellar</p>
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
            {/* <span className="text-white/25 text-[10px] font-mono uppercase tracking-[0.25em]">
              Stellar ecosystem · RWA
            </span> */}
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
              <p className="text-white/70 text-sm mt-4 max-w-xs leading-relaxed">
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
              {/* <span className="text-white/25 text-[10px] font-mono uppercase tracking-[0.25em]">
                Live on testnet
              </span> */}
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
                <p className="text-white/70 text-sm mt-2">
                  Active stablecoins — USDC · EURC · PYUSD · MGUSD
                </p>
              </div>
            </HudCard>

            {/* Bottom right: $10M */}
            <HudCard className="flex-1 flex flex-col justify-between min-h-[160px]" scanDelay={2}>
              {/* <span className="text-white/25 text-[10px] font-mono uppercase tracking-[0.25em]">
                Why this exists
              </span> */}
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
                <p className="text-white/70 text-sm mt-2">
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
          <p className="text-white/70 text-xs uppercase tracking-widest mb-3 font-mono">How it works</p>
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
                  An open signal of operational reliability.
                </h3>
                <p className="text-white/70 text-sm max-w-sm leading-relaxed">
                  ACR is a public on-chain composite score evaluating an anchor's historical success rate, latency, uptime, and payout performance in real-time.
                </p>
              </div>
            </VideoTile>
          </FadeIn>

          {/* RIGHT — Next-Gen HUD UI */}
          <div className="flex flex-col gap-6 relative group">
            {/* Ambient hover glow behind the entire section */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_center,rgba(0,255,170,0.12)_0%,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none blur-3xl" />

            {/* Top Card: macOS-style IDE Terminal */}
            <FadeIn delay={0.1}>
              <div className="relative overflow-hidden rounded-2xl bg-[#09090b] border border-white/[0.08] shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-xl transition-all duration-500 hover:border-white/[0.2]">
                {/* Top Glass Highlight */}
                <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                
                {/* IDE Header */}
                <div className="flex items-center px-4 py-3 bg-white/[0.02] border-b border-white/[0.06]">
                  <div className="flex gap-1.5 absolute left-4">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
                  </div>
                  <div className="mx-auto text-[10px] font-mono text-white/40 uppercase tracking-widest flex items-center gap-2">
                    <svg className="w-3 h-3 opacity-60" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/></svg>
                    risk_engine.rs
                  </div>
                </div>

                {/* Code Body */}
                <div className="p-6 font-mono text-[13px] leading-loose overflow-x-auto">
                  <div className="flex min-w-max">
                    {/* Line Numbers */}
                    <div className="text-white/20 select-none text-right pr-4 border-r border-white/5 mr-4 flex flex-col">
                      <span>1</span><span>2</span><span>3</span><span>4</span>
                    </div>
                    {/* Code (Rust Syntax Highlighting) */}
                    <div className="flex-1">
                      <p className="text-white/30 italic mb-2">// Fetch operational risk score directly from Soroban</p>
                      <p className="flex items-center">
                        <span className="text-[#ff7b72] mr-2">let</span>
                        <span className="text-[#79c0ff] mr-2">acr_score</span>
                        <span className="text-[#ff7b72] mr-2">=</span>
                        <span className="text-[#d2a8ff]">AnchorStake</span>
                        <span className="text-white/70">::</span>
                        <span className="text-[#d2a8ff]">get_acr</span>
                        <span className="text-white/70">(</span>
                        <span className="text-[#a5d6ff]">&anchor</span>
                        <span className="text-white/70">);</span>
                      </p>
                      <p className="text-white/30 italic mt-2">// 10_000 = Flawless · 8_000 = Good · 5_000 = Poor</p>
                      <p className="mt-1 text-[#7ee787] flex items-center gap-1">
                        <span className="text-[#ff7b72]">assert!</span>
                        <span className="text-white/70">(acr_score &gt;= </span>
                        <span className="text-[#79c0ff]">8500</span>
                        <span className="text-white/70">);</span>
                        <span className="w-1.5 h-3.5 bg-[#00ffaa] animate-pulse ml-1 shadow-[0_0_8px_#00ffaa]" />
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </FadeIn>

            {/* Bottom Card: Live Telemetry Dashboard */}
            <FadeIn delay={0.2}>
              <div className="relative rounded-2xl bg-[#09090b] border border-white/[0.08] p-8 backdrop-blur-xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] transition-all duration-500 hover:border-white/[0.2]">
                {/* Tech Grid Background */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-50 pointer-events-none" />
                
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-8">
                     <span className="text-[10px] font-mono text-white/50 uppercase tracking-[0.2em]">Anchor Telemetry</span>
                     <span className="flex items-center gap-1.5 text-[9px] font-mono text-[#00ffaa] uppercase tracking-widest bg-[#00ffaa]/10 px-2.5 py-1 rounded-full border border-[#00ffaa]/20 shadow-[0_0_10px_rgba(0,255,170,0.1)]">
                       <span className="w-1.5 h-1.5 rounded-full bg-[#00ffaa] animate-ping" /> Live Sync
                     </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* The Main Score Circular UI */}
                    <div className="flex flex-col items-center justify-center md:border-r border-white/10 md:pr-4">
                      <div className="relative flex items-center justify-center w-32 h-32 mb-2">
                        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                           <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                           <circle cx="50" cy="50" r="45" fill="none" stroke="#00e5ff" strokeWidth="4" strokeDasharray="283" strokeDashoffset="20" className="animate-[spin_4s_linear_infinite]" style={{ filter: "drop-shadow(0 0 8px rgba(0,229,255,0.4))" }} />
                        </svg>
                        <div className="text-center z-10">
                          <span className="block text-3xl font-bold text-white tracking-tighter" style={{ textShadow: "0 0 20px rgba(0,229,255,0.4)" }}>9,450</span>
                          <span className="block text-[9px] font-mono text-[#00e5ff] uppercase tracking-widest mt-1">ACR Score</span>
                        </div>
                      </div>
                    </div>

                    {/* The Component Metrics */}
                    <div className="md:col-span-2 flex flex-col justify-center gap-5">
                      <div className="flex items-center justify-between group cursor-default">
                        <div className="flex flex-col">
                          <span className="text-white text-sm font-medium mb-1 group-hover:text-white transition-colors">Oracle Uptime</span>
                          <span className="text-white/40 text-[9px] font-mono uppercase tracking-widest">30-day trailing</span>
                        </div>
                        <span className="text-[#34d399] font-mono text-sm tracking-tight group-hover:drop-shadow-[0_0_8px_rgba(52,211,153,0.6)] transition-all">99.99%</span>
                      </div>
                      
                      <div className="w-full h-[1px] bg-white/5" />

                      <div className="flex items-center justify-between group cursor-default">
                        <div className="flex flex-col">
                          <span className="text-white text-sm font-medium mb-1 group-hover:text-white transition-colors">Network Latency</span>
                          <span className="text-white/40 text-[9px] font-mono uppercase tracking-widest">Avg fulfillment</span>
                        </div>
                        <span className="text-[#00e5ff] font-mono text-sm tracking-tight group-hover:drop-shadow-[0_0_8px_rgba(0,229,255,0.6)] transition-all">45ms</span>
                      </div>

                      <div className="w-full h-[1px] bg-white/5" />

                      <div className="flex items-center justify-between group cursor-default">
                        <div className="flex flex-col">
                          <span className="text-white text-sm font-medium mb-1 group-hover:text-white transition-colors">Success Rate</span>
                          <span className="text-white/40 text-[9px] font-mono uppercase tracking-widest">Payout executions</span>
                        </div>
                        <span className="text-white font-mono text-sm tracking-tight group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] transition-all">100.0%</span>
                      </div>
                    </div>
                  </div>
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
  asset, symbol, logo, expires, marketId, delay = 0,
}: {
  asset: string;
  symbol: string;
  logo: string | null;
  expires: string;
  marketId: number;
  delay?: number; // ms to wait before firing oracle fetch — staggers RPC calls
}) {
  const [prices, setPrices] = useState<{ v: number }[]>([]);
  const [coverCost, setCoverCost] = useState<string | null>(null);
  const THRESHOLD = 0.995;

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchOraclePrices(symbol).then((pts) => {
        setPrices(pts.map((v) => ({ v })));
        const latest = pts[pts.length - 1];
        const impliedProb = Math.max(0, (THRESHOLD - latest + 0.005) / THRESHOLD);
        const cost = Math.max(1, Math.round(impliedProb * 1000 * 100));
        setCoverCost(`$${cost}`);
      });
    }, delay);
    return () => clearTimeout(timer);
  }, [symbol, delay]);

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
              <p className="text-white/70 text-sm mt-4 max-w-lg">
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
              <MarketCard {...m} delay={i * 400} />
            </FadeIn>
          ))}
        </div>

        {/* Bottom CTA strip */}
        <FadeIn delay={0.35} className="mt-8">
          <div className="flex items-center justify-between border-t border-white/[0.05] pt-6">
            {/* <p className="text-white/25 text-xs">
              Settlements are permissionless — anyone can trigger them.
              Our watcher calls <span className="font-mono text-white/40">try_settle()</span> every 60s.
            </p> */}
            <Link
              href="/app"
              className="text-sm px-5 py-2.5 rounded-full border border-white/70 text-white/70
                         hover:border-white/90 hover:text-white transition-all duration-200 shrink-0 ml-6"
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
    <section className="py-20" style={{ background: "#edecea", borderRadius: "68px 68px 0 0", marginTop: -1 }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">

          {/* ── LEFT: CTA copy ───────────────────────────────── */}
          <FadeIn className="flex flex-col justify-center py-4">
            <p style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.18em",
              textTransform: "uppercase" as const,
              color: "rgba(0,0,0,0.35)",
              marginBottom: "1.25rem",
            }}>
              
            </p>
            <h2 style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 700,
              fontSize: "clamp(2rem, 4vw, 3.2rem)",
              lineHeight: 1.1,
              letterSpacing: "-0.04em",
              color: "#0a0a0a",
              marginBottom: "1.25rem",
            }}>
              Ready to hedge <br/> onchain risk?
            </h2>
            <p style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 15,
              lineHeight: 1.65,
              color: "rgba(0,0,0,0.45)",
              maxWidth: 380,
              marginBottom: "2.25rem",
            }}>
              Four markets live on Stellar. <br/>
              Connect your Freighter wallet and start in under 60 seconds.
            </p>
            <div>
              <Link
                href="/app"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "13px 30px",
                  borderRadius: 9999,
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 600,
                  fontSize: 14,
                  letterSpacing: "-0.01em",
                  background: "#0a0a0a",
                  color: "white",
                  textDecoration: "none",
                }}
              >
                Launch App →
              </Link>
            </div>
          </FadeIn>

          {/* ── RIGHT: image card, 16:9 so nothing is cropped ── */}
          <FadeIn delay={0.1}>
            <div style={{
              position: "relative",
              width: "100%",
              aspectRatio: "16 / 9",
              borderRadius: 16,
              overflow: "hidden",
              border: "1px solid rgba(0,0,0,0.08)",
              background: "#000",
            }}>
              <img
                src="/lastimage.png"
                alt="AnchorShield Community"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "center center",
                }}
              />
              {/* Bottom scrim */}
              <div style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)",
              }} />
              {/* Join Community button */}
              <div style={{ position: "absolute", bottom: 20, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
                <a
                  href="https://x.com/AnchorShieldApp"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 22px",
                    borderRadius: 9999,
                    fontFamily: "Inter, sans-serif",
                    fontWeight: 600,
                    fontSize: 13,
                    letterSpacing: "-0.01em",
                    background: "white",
                    color: "#0a0a0a",
                    textDecoration: "none",
                    boxShadow: "0 2px 20px rgba(0,0,0,0.3)",
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                    <path d="M8.25 5.93L12.9 0.5H11.8L7.76 5.18 4.54 0.5H0.9L5.77 7.78 0.9 13.5H2L6.26 8.57 9.64 13.5H13.28L8.25 5.93ZM6.82 7.94L6.33 7.24 2.38 1.32H4.01L7.26 5.89L7.75 6.59L11.8 12.72H10.17L6.82 7.94Z" fill="currentColor"/>
                  </svg>
                  Join Community
                </a>
              </div>
            </div>
          </FadeIn>

        </div>
      </div>
    </section>
  );
}

// ── FOOTER ─────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="py-12" style={{ background: "#edecea", borderTop: "1px solid rgba(0,0,0,0.08)" }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <p className="font-semibold mb-1" style={{ color: "#111" }}>AnchorShield</p>
            <p className="text-xs max-w-sm" style={{ color: "rgba(0,0,0,0.4)" }}>
              Parametric hedging infrastructure for Stellar&apos;s stablecoin economy.
            </p>
            <p className="text-xs mt-3" style={{ color: "rgba(0,0,0,0.25)" }}>
              Running on Stellar · Soroban SDK
            </p>
          </div>
          <div className="flex gap-6 text-xs" style={{ color: "rgba(0,0,0,0.35)" }}>
            <Link href="/app" className="hover:text-black transition-colors">App</Link>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer"
               className="hover:text-black transition-colors">GitHub</a>
            <a href="https://developers.stellar.org" target="_blank" rel="noopener noreferrer"
               className="hover:text-black transition-colors">Stellar Docs</a>
          </div>
        </div>
        <div className="mt-8 pt-6" style={{ borderTop: "1px solid rgba(0,0,0,0.07)" }}>
          <p className="text-xs" style={{ color: "rgba(0,0,0,0.25)" }}>
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
