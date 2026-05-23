"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Receipt } from "@/components/Receipt";
import { SpendMeter } from "@/components/SpendMeter";
import { UnlockGate } from "@/components/UnlockGate";
import { WorkView } from "@/components/WorkView";
import { isTerminal, type WorkView as WorkViewData } from "@/lib/types";

const POLL_MS = 1500;

export default function RunPage() {
  const { id } = useParams<{ id: string }>();
  const [view, setView] = useState<WorkViewData | null>(null);
  const [waiting, setWaiting] = useState(true);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await fetch(`/api/run/${id}`, { cache: "no-store" });
        if (active && res.status === 200) {
          const data = (await res.json()) as WorkViewData;
          setView(data);
          setWaiting(false);
          if (isTerminal(data.status)) return;
        }
      } catch {
        // transient — the next poll retries
      }
      if (active) timer = setTimeout(poll, POLL_MS);
    }

    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [id]);

  async function refresh() {
    const res = await fetch(`/api/run/${id}`, { cache: "no-store" });
    if (res.status === 200) setView((await res.json()) as WorkViewData);
  }

  const live = !view || view.status === "running";

  return (
    <div className="space-y-5">
      <section className="rise">
        <span className="label">The question</span>
        <h1 className="mt-2 font-display text-3xl leading-tight text-parchment">
          {view?.question ?? (waiting ? "Opening the run…" : "Run not found")}
        </h1>
      </section>

      {view && (
        <div className="rise space-y-5" style={{ animationDelay: "80ms" }}>
          <SpendMeter view={view} />
          <WorkView events={view.events} live={live} />
          {view.requiresPayment && <UnlockGate view={view} onUnlocked={refresh} />}
          <Receipt view={view} />
        </div>
      )}

      {!view && !waiting && (
        <p className="text-sm text-muted">
          This run could not be found — it may have expired.
        </p>
      )}

      <a
        href="/"
        className="inline-block font-mono text-xs uppercase tracking-[0.16em]
          text-bronzeDim transition-colors hover:text-bronze"
      >
        ← ask another question
      </a>
    </div>
  );
}
