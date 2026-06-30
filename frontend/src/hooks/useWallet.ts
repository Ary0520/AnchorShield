"use client";

import { useState, useEffect, useCallback } from "react";
import {
  isConnected,
  isAllowed,
  requestAccess,
  getAddress,
  getNetworkDetails,
} from "@stellar/freighter-api";

export interface WalletState {
  publicKey: string | null;
  isConnecting: boolean;
  error: string | null;
  networkPassphrase: string | null;
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    publicKey: null,
    isConnecting: false,
    error: null,
    networkPassphrase: null,
  });

  // On mount: check if Freighter is already connected + allowed
  useEffect(() => {
    (async () => {
      try {
        const { isConnected: connected } = await isConnected();
        if (!connected) return;

        const { isAllowed: allowed } = await isAllowed();
        if (!allowed) return;

        const { address, error } = await getAddress();
        if (error || !address) return;

        const details = await getNetworkDetails();
        setState((s) => ({
          ...s,
          publicKey: address,
          networkPassphrase: details.networkPassphrase ?? null,
        }));
      } catch {
        // Freighter not installed or unavailable — silent
      }
    })();
  }, []);

  const connect = useCallback(async () => {
    setState((s) => ({ ...s, isConnecting: true, error: null }));
    try {
      const { isConnected: connected } = await isConnected();
      if (!connected) {
        setState((s) => ({
          ...s,
          isConnecting: false,
          error: "Freighter extension not found. Please install it.",
        }));
        return;
      }

      // requestAccess opens the Freighter popup
      const { address, error } = await requestAccess();
      if (error) {
        setState((s) => ({
          ...s,
          isConnecting: false,
          error: String(error),
        }));
        return;
      }

      const details = await getNetworkDetails();
      setState({
        publicKey: address,
        isConnecting: false,
        error: null,
        networkPassphrase: details.networkPassphrase ?? null,
      });
    } catch (err: unknown) {
      setState((s) => ({
        ...s,
        isConnecting: false,
        error: err instanceof Error ? err.message : "Failed to connect wallet",
      }));
    }
  }, []);

  const disconnect = useCallback(() => {
    setState({
      publicKey: null,
      isConnecting: false,
      error: null,
      networkPassphrase: null,
    });
  }, []);

  const shortKey = state.publicKey
    ? `${state.publicKey.slice(0, 4)}...${state.publicKey.slice(-4)}`
    : null;

  return { ...state, shortKey, connect, disconnect };
}
