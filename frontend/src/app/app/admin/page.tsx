"use client";

import { useWallet } from "@/hooks";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { invokeContract, FACTORY_ID, listMarkets, getMarket, MarketConfig, formatExpiry } from "@/lib/contracts";
import { nativeToScVal, Address, xdr } from "@stellar/stellar-sdk";
import { Trash2 } from "lucide-react";

const PRESETS: Record<string, { threshold: string, oracle: string, anchor: string }> = {
  "USDC": {
    threshold: "0.995",
    oracle: "CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63",
    anchor: process.env.NEXT_PUBLIC_ANCHOR_STAKE_ID || "",
  },
  "EURC": {
    threshold: "0.985",
    oracle: "CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63",
    anchor: process.env.NEXT_PUBLIC_ANCHOR_STAKE_ID || "",
  }
};

export default function AdminPage() {
  const wallet = useWallet();
  const [asset, setAsset] = useState<"USDC" | "EURC">("USDC");
  const [duration, setDuration] = useState("3600"); // 1 hour in seconds
  const [expiryOffset, setExpiryOffset] = useState("3600"); // 1 Hour
  const [loading, setLoading] = useState(false);
  const [markets, setMarkets] = useState<MarketConfig[]>([]);
  const [marketsLoading, setMarketsLoading] = useState(true);
  
  const isAdmin = wallet.publicKey === process.env.NEXT_PUBLIC_ADMIN_PUBKEY;

  useEffect(() => {
    if (!isAdmin) return;
    loadMarkets();
  }, [isAdmin]);

  const loadMarkets = async () => {
    setMarketsLoading(true);
    try {
      const ids = await listMarkets();
      const fetched = await Promise.all(ids.map(id => getMarket(id).catch(() => null)));
      setMarkets(fetched.filter(Boolean) as MarketConfig[]);
    } catch (e) {
      console.error(e);
    }
    setMarketsLoading(false);
  };

  if (!isAdmin) {
    return (
      <div className="flex-1 overflow-y-auto" style={{ background: "#0a0a12", minHeight: "100%" }}>
        <div className="p-6 h-full flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full border border-red-500/30 flex items-center justify-center mb-4 bg-red-500/10">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h1 style={{ fontFamily: "var(--font-geist-sans)", fontWeight: 700, fontSize: 24, color: "white", margin: 0 }}>Access Denied</h1>
          <p style={{ fontFamily: "'General Sans', sans-serif", fontSize: 14, color: "#888", marginTop: 8 }}>
            You must be connected with the admin wallet to view this page.
          </p>
        </div>
      </div>
    );
  }

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet.publicKey) {
      alert("Connect wallet first!");
      return;
    }
    
    setLoading(true);
    
    try {
      const preset = PRESETS[asset];
      const usdcAddress = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";
      
      const thresholdVal = BigInt(Math.floor(parseFloat(preset.threshold) * 100000000000000));
      const durationHours = parseInt(duration) / 3600;
      const expiryTimestamp = BigInt(Math.floor(Date.now() / 1000) + parseInt(expiryOffset));
      
      let anchorIdScVal;
      if (preset.anchor && preset.anchor.trim() !== "") {
        anchorIdScVal = new Address(preset.anchor).toScVal();
      } else {
        anchorIdScVal = xdr.ScVal.scvVoid();
      }

      const expiryDays = parseInt(expiryOffset) / 86400;
      const expiryText = expiryDays >= 1 ? `${Math.round(expiryDays)}d` : `${Math.round(parseInt(expiryOffset)/3600)}h`;
      const label = asset + " depeg under $" + preset.threshold + " (Expires " + expiryText + ")";
      
      const args = [
        nativeToScVal(label), 
        new Address(usdcAddress).toScVal(), 
        xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("Other"), xdr.ScVal.scvSymbol(asset)]), 
        new Address(preset.oracle).toScVal(), 
        nativeToScVal(thresholdVal, { type: "i128" }), 
        nativeToScVal(parseInt(duration), { type: "u64" }), 
        nativeToScVal(expiryTimestamp, { type: "u64" }), 
        anchorIdScVal 
      ];

      alert("Please sign the transaction in Freighter to deploy the market.");
      const txHash = await invokeContract(wallet.publicKey, FACTORY_ID, "create_market", args);
      alert("Transaction successful! Hash: " + txHash + "\nMarket for " + asset + " deployed!");
      loadMarkets();
    } catch (err: any) {
      console.error(err);
      alert("Error deploying market: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (marketId: number) => {
    if (!wallet.publicKey) return;
    if (!window.confirm("Are you absolutely sure you want to permanently delete this market? This will remove it from the factory registry entirely.")) return;
    
    try {
      alert("Please sign the deletion transaction in Freighter.");
      await invokeContract(wallet.publicKey, FACTORY_ID, "delete_market", [
        nativeToScVal(marketId, { type: "u32" })
      ]);
      alert("Market deleted successfully!");
      loadMarkets();
    } catch (err: any) {
      console.error(err);
      alert("Error deleting market: " + err.message);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: "#0a0a12", minHeight: "100%" }}>
      <div className="p-6 space-y-8 max-w-4xl mx-auto pt-10 pb-20">
        
        {/* Header */}
        <div>
          <h1 style={{ fontFamily: "var(--font-geist-sans)", fontWeight: 700, fontSize: 28, color: "white", letterSpacing: "-0.56px", margin: 0 }}>
            Admin Dashboard
          </h1>
          <p style={{ fontFamily: "'General Sans', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
            Deploy targeted parametric markets with verified configurations.
          </p>
        </div>

        {/* Deploy Market Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: 16,
            padding: 24,
          }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-md bg-[#00ffc2]/10 flex items-center justify-center border border-[#00ffc2]/20">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00ffc2" strokeWidth="2" strokeLinecap="round">
                <path d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h2 style={{ fontFamily: "var(--font-geist-sans)", fontWeight: 600, fontSize: 18, color: "white", margin: 0 }}>Create Hedging Market</h2>
          </div>

          <form onSubmit={handleDeploy} className="space-y-6">
            
            {/* Core Market Parameters */}
            <div className="space-y-4">
              <h3 style={{ fontFamily: "'General Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "white", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #222", paddingBottom: 8 }}>Market Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label style={{ display: "block", fontFamily: "'General Sans', sans-serif", fontSize: 12, color: "#888", marginBottom: 8, fontWeight: 500 }}>
                    Target Asset
                  </label>
                  <select 
                    value={asset}
                    onChange={e => setAsset(e.target.value as "USDC" | "EURC")}
                    style={{
                      width: "100%", background: "#111", border: "1px solid #333", borderRadius: 8, padding: "12px 16px",
                      color: "white", fontFamily: "'General Sans', sans-serif", fontSize: 14, outline: "none", appearance: "none"
                    }}
                    onFocus={e => e.target.style.borderColor = "#00ffc2"}
                    onBlur={e => e.target.style.borderColor = "#333"}
                  >
                    <option value="USDC">USDC (Pre-configured)</option>
                    <option value="EURC">EURC (Pre-configured)</option>
                  </select>
                </div>
                
                <div>
                  <label style={{ display: "block", fontFamily: "'General Sans', sans-serif", fontSize: 12, color: "#888", marginBottom: 8, fontWeight: 500 }}>
                    Depeg Threshold Price
                  </label>
                  <input 
                    type="text" 
                    value={"$" + PRESETS[asset].threshold}
                    disabled
                    style={{
                      width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid #222", borderRadius: 8, padding: "12px 16px",
                      color: "rgba(255,255,255,0.5)", fontFamily: "'General Sans', sans-serif", fontSize: 14, outline: "none", cursor: "not-allowed"
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label style={{ display: "block", fontFamily: "'General Sans', sans-serif", fontSize: 12, color: "#888", marginBottom: 8, fontWeight: 500 }}>
                    Sustained Breach Duration (Prevents Flash-Crash)
                  </label>
                  <select 
                    value={duration}
                    onChange={e => setDuration(e.target.value)}
                    style={{
                      width: "100%", background: "#111", border: "1px solid #333", borderRadius: 8, padding: "12px 16px",
                      color: "white", fontFamily: "'General Sans', sans-serif", fontSize: 14, outline: "none", appearance: "none"
                    }}
                    onFocus={e => e.target.style.borderColor = "#00ffc2"}
                    onBlur={e => e.target.style.borderColor = "#333"}
                  >
                    <option value="900">15 Minutes</option>
                    <option value="1800">30 Minutes</option>
                    <option value="3600">1 Hour</option>
                    <option value="14400">4 Hours</option>
                    <option value="86400">24 Hours</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontFamily: "'General Sans', sans-serif", fontSize: 12, color: "#888", marginBottom: 8, fontWeight: 500 }}>
                    Market Lifespan (Time until expiration)
                  </label>
                  <select 
                    value={expiryOffset}
                    onChange={e => setExpiryOffset(e.target.value)}
                    style={{
                      width: "100%", background: "#111", border: "1px solid #333", borderRadius: 8, padding: "12px 16px",
                      color: "white", fontFamily: "'General Sans', sans-serif", fontSize: 14, outline: "none", appearance: "none"
                    }}
                    onFocus={e => e.target.style.borderColor = "#00ffc2"}
                    onBlur={e => e.target.style.borderColor = "#333"}
                  >
                    <option value="3600">1 Hour</option>
                    <option value="14400">4 Hours</option>
                    <option value="86400">24 Hours</option>
                    <option value="604800">7 Days</option>
                    <option value="2592000">30 Days</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <button 
                type="submit"
                disabled={loading}
                style={{
                  width: "100%", background: "white", color: "black", borderRadius: 8, padding: "16px",
                  fontFamily: "'General Sans', sans-serif", fontWeight: 600, fontSize: 15, border: "none", cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1, transition: "all 0.2s"
                }}
              >
                {loading ? "Deploying Contract..." : "Deploy Market"}
              </button>
            </div>
          </form>

        </motion.div>

        {/* Manage Active Markets */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: 16,
            padding: 24,
          }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-md bg-[#3b82f6]/10 flex items-center justify-center border border-[#3b82f6]/20">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round">
                <path d="M4 6h16M4 12h16M4 18h7" />
              </svg>
            </div>
            <h2 style={{ fontFamily: "var(--font-geist-sans)", fontWeight: 600, fontSize: 18, color: "white", margin: 0 }}>Manage Active Markets</h2>
          </div>

          {marketsLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white/20"></div>
            </div>
          ) : markets.length === 0 ? (
            <div className="text-center py-10" style={{ fontFamily: "'General Sans', sans-serif", fontSize: 14, color: "#888" }}>
              No active markets deployed.
            </div>
          ) : (
            <div className="space-y-3">
              {markets.map(market => (
                <div key={market.market_id} className="flex items-center justify-between p-4 rounded-xl" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div>
                    <h3 style={{ fontFamily: "'General Sans', sans-serif", fontSize: 15, fontWeight: 600, color: "white" }}>{market.label}</h3>
                    <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#666", marginTop: 4 }}>
                      ID: {market.market_id} • Expires: {formatExpiry(market.expiry_timestamp)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(market.market_id)}
                    className="p-2 rounded-md hover:bg-red-500/20 text-red-500/70 hover:text-red-500 transition-colors"
                    title="Delete Market"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
