"use client";

/**
 * TopLoader — thin progress bar at the top of the viewport.
 * Fires on Next.js soft navigations via the native `navigate` event
 * (App Router equivalent of router events).
 *
 * No external dependencies. Accent color matches the app's #ffffff theme.
 */

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function TopLoader() {
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  const [visible, setVisible]     = useState(false);
  const [width, setWidth]         = useState(0);
  const [fading, setFading]       = useState(false);

  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef  = useRef(false);

  // Clear all pending timers
  function clearTimers() {
    if (timerRef.current)    clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }

  // Kick off the fake progress crawl
  function startLoad() {
    clearTimers();
    setFading(false);
    setWidth(0);
    setVisible(true);

    // Rapidly get to 20%, then crawl slowly — gives illusion of progress
    setTimeout(() => setWidth(20), 50);
    setTimeout(() => setWidth(50), 200);

    // Slow crawl: inch toward 85% over the next several seconds
    let w = 50;
    intervalRef.current = setInterval(() => {
      w = Math.min(w + (85 - w) * 0.08, 84);
      setWidth(w);
    }, 300);
  }

  // Complete and fade out
  function finishLoad() {
    clearTimers();
    setWidth(100);
    timerRef.current = setTimeout(() => {
      setFading(true);
      timerRef.current = setTimeout(() => {
        setVisible(false);
        setWidth(0);
        setFading(false);
      }, 300); // match CSS transition
    }, 150);
  }

  // Detect route change: pathname or searchParams changing = navigation complete
  useEffect(() => {
    if (!mountedRef.current) {
      // Skip the very first render (initial page load)
      mountedRef.current = true;
      return;
    }
    finishLoad();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  // Listen for link clicks to start the loader immediately on user intent
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href) return;

      // Only internal soft-nav links (no external, no hash-only)
      if (href.startsWith("/") && !href.startsWith("//")) {
        // Don't start if navigating to the same page
        const currentPath = window.location.pathname + window.location.search;
        if (href !== currentPath) {
          startLoad();
        }
      }
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup on unmount
  useEffect(() => () => clearTimers(), []);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        zIndex: 9999,
        pointerEvents: "none",
        opacity: fading ? 0 : 1,
        transition: fading ? "opacity 0.3s ease" : "none",
      }}
    >
      {/* Track */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.08)" }} />

      {/* Bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          height: "100%",
          width: `${width}%`,
          background: "linear-gradient(90deg, #ffffff, #cccccc)",
          boxShadow: "0 0 10px rgba(255,255,255,0.6), 0 0 4px rgba(255,255,255,0.4)",
          transition: width === 100
            ? "width 0.15s ease"
            : width <= 20
            ? "width 0.15s ease"
            : "width 0.3s ease-out",
          borderRadius: "0 2px 2px 0",
        }}
      />

      {/* Glow tip */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: `${width}%`,
          transform: "translate(-50%, -50%)",
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "#ffffff",
          boxShadow: "0 0 8px 3px rgba(255,255,255,0.7)",
          opacity: width > 0 && width < 100 ? 1 : 0,
          transition: "opacity 0.15s",
        }}
      />
    </div>
  );
}
