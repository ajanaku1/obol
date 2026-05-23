"use client";

import { CoinMark } from "@/components/CoinMark";
import { ARC, addressUrl } from "@/lib/arc";
import { useWallet } from "@/lib/useWallet";

const short = (addr: string): string => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

/** Obol's purse — its live balance on Arc, and where this run's funding comes from. */
export function WalletPanel() {
  const { obol, status, account, error } = useWallet();
  const connected = status === "connected" && account;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-4">
          <CoinMark className="h-11 w-11 shrink-0" />
          <div>
            <span className="label">Obol&apos;s purse</span>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="font-mono text-2xl tabular-nums text-bronze">
                {obol ? Number(obol.balanceUsdc).toFixed(4) : "—·—"}
              </span>
              <span className="font-mono text-xs text-muted">USDC · Arc</span>
            </div>
          </div>
        </div>
        {obol && (
          <a
            href={addressUrl(obol.address)}
            target="_blank"
            rel="noreferrer"
            className="hash shrink-0 hover:text-bronze"
          >
            {short(obol.address)} ↗
          </a>
        )}
      </div>

      <div className="hairline" />
      {error && (
        <p className="border-l-2 border-danger bg-danger/5 px-5 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}
      <p className="px-5 py-3 text-sm text-muted">
        {connected ? (
          <>
            This run will be funded from your wallet{" "}
            <span className="font-mono text-xs text-verdigris">{short(account)}</span> —
            you&apos;ll sign one payment to Obol.
          </>
        ) : obol && !obol.funded ? (
          <>
            The purse is empty. Connect a wallet to fund a run, or{" "}
            <a
              href={ARC.faucet}
              target="_blank"
              rel="noreferrer"
              className="text-bronzeDim hover:text-bronze"
            >
              top it up from the Circle faucet ↗
            </a>
          </>
        ) : (
          "Connect a wallet (top right) to fund a run yourself — otherwise it runs on the purse above."
        )}
      </p>
    </div>
  );
}
