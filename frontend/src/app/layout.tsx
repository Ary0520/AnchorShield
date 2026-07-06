import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AnchorShield — Hedge Stablecoin Risk on Stellar",
  description: "On-chain hedging for stablecoin depegs on Stellar. Pay a small premium. Get an automatic payout if the peg breaks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
