import { NextResponse } from "next/server";
import { startRun } from "@/lib/runner";
import { ceilingToBudget } from "@/lib/pricing";

export const runtime = "nodejs";

const MIN_CEILING = 0.001;
// Per-query cap: Obol fronts from one shared Gateway balance, so no single
// run may commit more than this — it bounds how fast the purse can drain.
const MAX_CEILING = 0.1;
const MAX_QUESTION = 500;

/**
 * POST /api/run — start a new Obol run.
 *
 * The user sets a ceiling: the most they'll pay to unlock the answer. Obol
 * fronts the work and may spend up to `ceiling / MARKUP`, so the final unlock
 * price (spend + markup) never exceeds the ceiling.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: { question?: unknown; ceiling?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  const ceiling = Number(body.ceiling);

  if (!question || question.length > MAX_QUESTION) {
    return NextResponse.json(
      { error: `Ask a question between 1 and ${MAX_QUESTION} characters.` },
      { status: 400 },
    );
  }
  if (!Number.isFinite(ceiling) || ceiling < MIN_CEILING || ceiling > MAX_CEILING) {
    return NextResponse.json(
      { error: `Set a ceiling between $${MIN_CEILING} and $${MAX_CEILING} USDC.` },
      { status: 400 },
    );
  }

  const runId = startRun(question, ceilingToBudget(ceiling));
  return NextResponse.json({ runId }, { status: 202 });
}
