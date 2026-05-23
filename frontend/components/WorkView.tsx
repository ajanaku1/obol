import type { RunEvent } from "@/lib/types";

const MARK: Record<RunEvent["kind"], { icon: string; tone: string }> = {
  discovery: { icon: "◇", tone: "text-verdigris" },
  decision: { icon: "→", tone: "text-parchment" },
  payment: { icon: "◉", tone: "text-bronze" },
  note: { icon: "·", tone: "text-muted" },
  error: { icon: "!", tone: "text-danger" },
};

const time = (ms: number): string =>
  new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** The live reasoning feed — Obol thinking, discovering, and spending in order. */
export function WorkView({ events, live }: { events: RunEvent[]; live: boolean }) {
  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <span className="label">Work log</span>
        {live && (
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-verdigris">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-verdigris" />
            working
          </span>
        )}
      </div>

      {events.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          Obol is waking up and reaching for its purse…
        </p>
      ) : (
        <ol className="mt-4 space-y-3.5">
          {events.map((event) => {
            const mark = MARK[event.kind] ?? MARK.note;
            return (
              <li key={event.id} className="flex gap-3 text-sm">
                <span className={`mt-0.5 font-mono ${mark.tone}`}>{mark.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap leading-relaxed text-parchment">
                    {event.text}
                  </p>
                  <span className="font-mono text-[10px] tracking-wide text-muted">
                    {time(event.createdAt)}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
