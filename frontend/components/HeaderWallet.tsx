"use client";

import { useWallet } from "@/lib/useWallet";

const short = (addr: string): string => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

/** The connect-wallet control — pinned top-right in the header. */
export function HeaderWallet() {
  const { status, account, connect, disconnect } = useWallet();

  if (status === "connected" && account) {
    return (
      <button
        onClick={disconnect}
        title={`${account} — click to disconnect`}
        aria-label="Disconnect wallet"
        className="group flex items-center gap-2 rounded-full border border-edge
          bg-stone2 px-3 py-1.5 font-mono text-xs text-parchment transition-colors
          hover:border-danger hover:text-danger"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-verdigris group-hover:bg-danger" />
        <span className="group-hover:hidden">{short(account)}</span>
        <span className="hidden group-hover:inline">Disconnect ✕</span>
      </button>
    );
  }

  return (
    <button
      onClick={connect}
      disabled={status === "connecting"}
      className="group rounded-full border border-bronzeDim bg-stone2 px-4 py-1.5
        font-mono text-xs uppercase tracking-[0.16em] text-bronze transition-colors
        hover:border-bronze hover:bg-bronze hover:text-ink disabled:opacity-50"
    >
      {status === "connecting" ? "Connecting…" : "Connect wallet"}
    </button>
  );
}
