import type { WorkView } from "@/lib/types";

/** The budget bar — how much of the purse Obol has spent, and what's left. */
export function SpendMeter({ view }: { view: WorkView }) {
  const pct = Math.round(view.spentFraction * 100);
  const nearLimit = view.spentFraction > 0.85;

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-baseline justify-between">
        <span className="label">Spent on Arc</span>
        <span className="font-mono text-[11px] text-muted">
          {view.paymentCount} payment{view.paymentCount === 1 ? "" : "s"} settled
        </span>
      </div>

      <div className="mt-3 flex items-baseline gap-2.5">
        <span className="font-mono text-3xl tabular-nums text-bronze">
          {view.totalSpentUsdc}
        </span>
        <span className="font-mono text-sm text-muted">of {view.budgetUsdc} budget</span>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-ink">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            nearLimit ? "bg-danger" : "bg-bronze"
          }`}
          style={{ width: `${Math.max(pct, 1.5)}%` }}
        />
      </div>

      <p className="mt-2.5 font-mono text-[11px] text-muted">
        {view.remainingUsdc} remaining · {pct}% of the purse used
      </p>
    </div>
  );
}
