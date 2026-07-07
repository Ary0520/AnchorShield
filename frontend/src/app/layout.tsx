import type { Metadata } from "next";
import "./globals.css";

const BASE_URL = "https://anchorshield.vercel.app";

export const metadata: Metadata = {
  title: "AnchorShield — Hedge Stablecoin Risk on Stellar",
  description: "On-chain parametric hedging for stablecoin depegs on Stellar. Pay a small premium. Get an automatic $1 payout if the peg breaks. No claims. No humans. No waiting.",
  metadataBase: new URL(BASE_URL),
  openGraph: {
    title: "AnchorShield — Hedge Stablecoin Risk on Stellar",
    description: "On-chain parametric hedging for stablecoin depegs on Stellar. Pay a small premium. Get an automatic $1 payout if the peg breaks.",
    url: BASE_URL,
    siteName: "AnchorShield",
    images: [
      {
        url: `${BASE_URL}/herosection.png`,
        width: 1200,
        height: 630,
        alt: "AnchorShield — Hedge stablecoin risk on Stellar",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AnchorShield — Hedge Stablecoin Risk on Stellar",
    description: "On-chain parametric hedging for stablecoin depegs. Pay a small premium. Get an automatic $1 payout if the peg breaks.",
    images: [`${BASE_URL}/herosection.png`],
    site: "@anchorshield",
    creator: "@anchorshield",
  },
  robots: {
    index: true,
    follow: true,
  },
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
