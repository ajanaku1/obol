"use client";

import { useState } from "react";
import { useWallet } from "@/lib/useWallet";
import type { WorkView } from "@/lib/types";

type Phase = "idle" | "paying" | "verifying";

/**
 * The pay-to-unlock gate. Obol has already done the work and fronted the cost;
 * this shows what it spent and the unlock price (cost + markup), takes one USDC
 * payment to Obol, verifies it on Arc, and reveals the answer.
 */
export function UnlockGate({ view, onUnlocked }: { view: WorkView; onUnlocked: () => void }) {
  const { status, connect, payObol } = useWallet();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  const connected = status === "connected";
  const amountUsdc = view.priceBaseUnits / 1_000_000;

  async function unlock() {
    setError(null);
    try {
      if (!connected) {
        await connect();
        return;
      }
      setPhase("paying");
      const txHash = await payObol(amountUsdc);
      setPhase("verifying");
      const res = await fetch(`/api/run/${view.runId}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash }),
      });
      const data = (await res.json()) as { paid?: boolean; error?: string };
      if (!res.ok || !data.paid) throw new Error(data.error ?? "Unlock failed.");
      onUnlocked();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(/user rejected|denied|4001/i.test(message) ? "Payment cancelled in your wallet." : message);
      setPhase("idle");
    }
  }

  const label =
    phase === "paying"
      ? "Approve the payment…"
      : phase === "verifying"
        ? "Confirming on Arc…"
        : connected
          ? `Pay ${view.priceUsdc} & unlock →`
          : "Connect wallet to unlock →";

  return (
    <div className="card overflow-hidden">
      <div className="h-px bg-gradient-to-r from-transparent via-bronze to-transparent" />
      <div className="p-5 sm:p-6">
        <span className="label">Answer ready — locked</span>
        <p className="mt-3 font-body text-lg leading-relaxed text-parchment">
          Obol found an answer and fronted <span className="text-bronze">{view.totalSpentUsdc}</span>{" "}
          buying the data across {view.paymentCount} paid call{view.paymentCount === 1 ? "" : "s"}.
          Pay what it spent plus 15% to unlock the full answer.
        </p>

        <div className="mt-4 flex items-baseline justify-between border-t border-edge pt-4">
          <span className="label">Unlock price</span>
          <span className="font-mono text-2xl tabular-nums text-bronze">{view.priceUsdc}</span>
        </div>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <button
          type="button"
          onClick={unlock}
          disabled={phase !== "idle"}
          className="mt-5 w-full rounded-md bg-bronze py-3 font-mono text-sm font-medium
            uppercase tracking-[0.14em] text-ink transition-all hover:bg-[#dab66a]
            disabled:cursor-wait disabled:opacity-60"
        >
          {label}
        </button>
      </div>
    </div>
  );
}
