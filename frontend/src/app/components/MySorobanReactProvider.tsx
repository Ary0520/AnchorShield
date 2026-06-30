import React from "react";

// No-op: soroban-react-stellar-wallets-kit has been removed.
// Wallet connection is handled directly via @stellar/freighter-api in useWallet.ts.
export default function MySorobanReactProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
