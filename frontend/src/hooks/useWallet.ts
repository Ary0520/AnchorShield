"use client";

import { useState, useEffect } from "react";
import { isAllowed, getPublicKey } from "@stellar/freighter-api";

export function useWallet() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if wallet is already connected
  useEffect(() => {
    const storedKey = localStorage.getItem("anchorshield_wallet");
    if (storedKey) {
      setPublicKey(storedKey);
    }
  }, []);

  const connect = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const allowed = await isAllowed();
      if (!allowed) {
        throw new Error("Freighter is not installed or not allowed.");
      }
      const pk = await getPublicKey();
      setPublicKey(pk);
      localStorage.setItem("anchorshield_wallet", pk);
    } catch (err: any) {
      setError(err?.message ?? "Failed to connect wallet");
      console.error("Wallet connect error:", err);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setPublicKey(null);
    localStorage.removeItem("anchorshield_wallet");
  };

  return {
    publicKey,
    isConnecting,
    connect,
    disconnect,
    error,
  };
}
