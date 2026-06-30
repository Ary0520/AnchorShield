import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AnchorShield — Parametric Insurance on Stellar",
  description: "Decentralized parametric insurance for stablecoin depegs on Stellar Soroban.",
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
