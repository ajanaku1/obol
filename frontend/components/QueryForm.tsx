"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Ceiling presets, in USDC — the most you'd pay to unlock the answer. */
const COINS = [
  { usd: 0.01, face: "1¢" },
  { usd: 0.03, face: "3¢" },
  { usd: 0.05, face: "5¢" },
  { usd: 0.1, face: "10¢" },
];

type Phase = "idle" | "starting";

/**
 * Question + ceiling. No upfront payment: Obol fronts the work, then charges
 * what it spent plus a margin — you pay only to unlock the answer it found.
 */
export function QueryForm() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [ceiling, setCeiling] = useState(0.05);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      setPhase("starting");
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, ceiling }),
      });
      const data = (await res.json()) as { runId?: string; error?: string };
      if (!res.ok || !data.runId) throw new Error(data.error ?? "Could not start the run.");
      router.push(`/run/${data.runId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("idle");
    }
  }

  const label =
    phase === "starting" ? "Sending Obol to the market…" : "Send Obol to the market →";

  return (
    <form onSubmit={submit} className="card relative overflow-hidden">
      {/* The minted top edge — every form is a struck coin. */}
      <div className="h-px bg-gradient-to-r from-transparent via-bronze to-transparent" />

      <div className="p-5 sm:p-6">
        <label className="label" htmlFor="question">
          Ask Obol
        </label>
        <textarea
          id="question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={2}
          placeholder="What would you pay a little to find out?"
          className="mt-2 w-full resize-none rounded-md border border-edge bg-ink p-3.5
            font-body text-lg text-parchment placeholder:text-muted/70
            focus:border-bronzeDim focus:outline-none"
          required
        />

        <div className="mt-5 flex items-center justify-between">
          <span className="label">Ceiling — the most you&apos;d pay to unlock</span>
          <span className="font-mono text-sm text-bronze">${ceiling.toFixed(3)}</span>
        </div>
        <div className="mt-3 flex gap-3">
          {COINS.map((coin) => {
            const active = ceiling === coin.usd;
            return (
              <button
                key={coin.usd}
                type="button"
                onClick={() => setCeiling(coin.usd)}
                aria-pressed={active}
                className={`coin h-14 w-14 text-sm ${
                  active
                    ? "border-bronze bg-bronze text-ink shadow-coin"
                    : "border-edge bg-stone2 text-muted hover:border-bronzeDim hover:text-parchment"
                }`}
              >
                {coin.face}
              </button>
            );
          })}
        </div>

        <p className="mt-5 text-sm text-muted">
          No upfront payment. Obol fronts the cost, buys only what the answer
          needs, and charges what it spent plus 15%. You pay — and the answer
          unlocks — only if it finds one, never more than your ceiling.
        </p>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={phase !== "idle"}
          className="mt-5 w-full rounded-md bg-bronze py-3 font-mono text-sm font-medium
            uppercase tracking-[0.14em] text-ink transition-all hover:bg-[#dab66a]
            disabled:cursor-wait disabled:opacity-60"
        >
          {label}
        </button>
      </div>
    </form>
  );
}
