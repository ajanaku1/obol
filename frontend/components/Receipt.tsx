import type { WorkView } from "@/lib/types";

const STATUS_NOTE: Record<WorkView["status"], string> = {
  running: "Obol is still working.",
  answered: "Obol stopped once the answer held up.",
  budget_exhausted: "Obol stopped — the budget ran out.",
  failed: "The run did not finish.",
};

const short = (ref: string): string =>
  ref.length > 20 ? `${ref.slice(0, 10)}…${ref.slice(-8)}` : ref;

/** The answer and the itemized Circle Gateway spend receipt. */
export function Receipt({ view }: { view: WorkView }) {
  return (
    <div className="space-y-5">
      {view.answer && (
        <div className="card overflow-hidden">
          <div className="h-px bg-gradient-to-r from-transparent via-bronze to-transparent" />
          <div className="p-5 sm:p-6">
            <span className="label">The answer</span>
            <p className="mt-3 whitespace-pre-wrap font-body text-lg leading-relaxed text-parchment">
              {view.answer}
            </p>
          </div>
        </div>
      )}

      <div className="card p-5 sm:p-6">
        <div className="flex items-baseline justify-between gap-3">
          <span className="label">Spend receipt</span>
          <span className="font-mono text-[11px] text-muted">{STATUS_NOTE[view.status]}</span>
        </div>

        {view.items.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No payments settled yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-edge">
            {view.items.map((item) => (
              <li key={item.settlementRef} className="py-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex items-baseline gap-2.5">
                    <span className="text-bronzeDim">◉</span>
                    <span className="font-display text-lg text-parchment">
                      {item.vendorName}
                    </span>
                  </span>
                  <span className="font-mono text-sm tabular-nums text-bronze">
                    {item.amountUsdc}
                  </span>
                </div>
                {item.resultSummary && (
                  <p className="mt-1 pl-5 text-sm text-muted">{item.resultSummary}</p>
                )}
                <span
                  className="hash mt-1 inline-block pl-5 text-muted"
                  title="Circle Gateway settlement reference (batched on-chain)"
                >
                  Gateway {short(item.settlementRef)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex items-baseline justify-between border-t border-edge pt-4">
          <span className="label">Total via Circle Gateway</span>
          <span className="font-mono text-2xl tabular-nums text-bronze">
            {view.totalSpentUsdc}
          </span>
        </div>
      </div>
    </div>
  );
}
