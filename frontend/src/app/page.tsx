"use client";

import { useState, useCallback } from "react";
import { Shield, Wallet, Zap } from "lucide-react";
import { useAccount, useIsMounted, connectFreighter } from "@/hooks";

export default function Home() {
  const mounted = useIsMounted();
  const account = useAccount();
  const [, forceUpdate] = useState(0);

  const handleConnect = useCallback(async () => {
    const addr = await connectFreighter();
    if (addr) {
      forceUpdate((n) => n + 1);
    }
  }, []);

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-semibold tracking-tight">AnchorShield</span>
          </div>
          {mounted && account ? (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-100 text-green-800 border border-green-200">
              <Wallet className="w-4 h-4" />
              <span>{account.displayName}</span>
            </div>
          ) : (
            <button
              onClick={handleConnect}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900 text-white hover:bg-gray-800 transition-colors"
            >
              <Wallet className="w-4 h-4" />
              <span>Connect Wallet</span>
            </button>
          )}
        </div>
      </header>
      <section className="px-6 pt-16 pb-12">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 text-blue-800 mb-6">
            <Zap className="w-4 h-4" />
            <span className="text-sm font-medium">Live on Stellar Testnet</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold max-w-4xl mx-auto mb-6 tracking-tight">
            Parametric Insurance for Stablecoins
          </h1>
          <p className="text-gray-600 text-lg md:text-xl max-w-2xl mx-auto">
            Protect your assets from depeg risk with fully transparent, oracle-driven insurance
            markets built on Stellar Soroban.
          </p>
        </div>
      </section>
    </main>
  );
}
