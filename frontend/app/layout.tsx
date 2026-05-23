import type { Metadata } from "next";
import { Cormorant_Garamond, JetBrains_Mono, Spectral } from "next/font/google";
import { CoinMark } from "@/components/CoinMark";
import { HeaderWallet } from "@/components/HeaderWallet";
import { WalletProvider } from "@/lib/useWallet";
import "./globals.css";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-display",
});
const body = Spectral({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-body",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Obol — an agent that buys knowledge",
  description:
    "Give Obol a question and a USDC budget. It shops a market of data vendors, " +
    "pays per call on Arc, and returns an answer with an itemized on-chain receipt.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-screen antialiased">
        <WalletProvider>
          <div className="mx-auto max-w-3xl px-5 py-7 sm:px-6">
            <header className="flex items-center justify-between gap-4">
              <a href="/" className="group flex items-center gap-3" aria-label="Obol home">
                <CoinMark className="h-9 w-9" />
                <span className="flex flex-col leading-none">
                  <span className="font-display text-xl font-semibold tracking-[0.18em] text-parchment">
                    OBOL
                  </span>
                  <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                    buys knowledge
                  </span>
                </span>
              </a>
              <HeaderWallet />
            </header>

            <div className="mt-3 hairline" />

            <main className="py-9">{children}</main>

            <div className="hairline" />
            <footer className="flex flex-wrap items-center justify-between gap-2 pt-4 font-mono text-[11px] text-muted">
              <span>Payments clear through Circle Gateway, settled in USDC on Arc testnet.</span>
              <a
                href="https://testnet.arcscan.app"
                target="_blank"
                rel="noreferrer"
                className="text-bronzeDim transition-colors hover:text-bronze"
              >
                testnet.arcscan.app ↗
              </a>
            </footer>
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}
