import { Market } from "@/components/Market";
import { QueryForm } from "@/components/QueryForm";

interface Vendor {
  id: string;
  name: string;
  description: string;
  priceBaseUnits: string;
}

/** Reads the live vendor market; returns an empty list if it is unreachable. */
async function loadVendors(): Promise<Vendor[]> {
  const base = process.env.DATA_SERVER_URL ?? "http://localhost:4020";
  try {
    const res = await fetch(`${base}/.well-known/x402/vendors`, { cache: "no-store" });
    if (!res.ok) return [];
    return ((await res.json()) as { vendors: Vendor[] }).vendors;
  } catch {
    return [];
  }
}

const STEPS: [string, string, string][] = [
  ["i", "It surveys", "Discovers every paid vendor via x402 before it spends a coin."],
  ["ii", "It fronts", "Buys the sources that fit from its own purse, and stops when the answer holds."],
  ["iii", "You unlock", "Pay what it spent plus 15% to reveal the answer, only if it found one."],
];

export default async function HomePage() {
  const vendors = await loadVendors();

  return (
    <div className="space-y-7">
      <section className="rise">
        <h1 className="font-display text-[2.7rem] font-medium leading-[1.04] text-parchment sm:text-5xl">
          An agent that makes
          <br />
          a market in <span className="text-bronze italic">knowledge.</span>
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
          Obol walks a live market of priced data vendors, pays each per call
          via Circle Nanopayments on Arc, and sells you the synthesized answer
          for what it spent plus a margin. It buys wholesale, sells retail, and
          settles every sub-cent transaction in USDC. Pay only if it delivers.
        </p>
      </section>

      <div className="rise space-y-5" style={{ animationDelay: "80ms" }}>
        <QueryForm />
      </div>

      <div className="rise space-y-7" style={{ animationDelay: "160ms" }}>
        <Market vendors={vendors} />

        <section>
          <span className="label">How a run unfolds</span>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            {STEPS.map(([numeral, title, body]) => (
              <div key={title} className="card p-4">
                <span className="font-display text-lg italic text-bronzeDim">{numeral}</span>
                <h2 className="mt-1 font-display text-xl text-parchment">{title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
