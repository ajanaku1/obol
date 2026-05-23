/**
 * Read-only view of Obol's ledger.
 *
 * The agent process writes the canonical records (and settles on Arc); the
 * frontend only reads this SQLite index to render the live work view.
 */
import "server-only";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import type { ReceiptItem, RunEvent, WorkView } from "./types";
import { priceBaseUnits as priceOf } from "./pricing";


function repoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, ".env.example"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

let cached: Database.Database | null = null;

function dbFilePath(): string {
  return resolve(repoRoot(), "data", "runs", "obol.db");
}

function db(): Database.Database | null {
  if (cached) return cached;
  const path = dbFilePath();
  if (!existsSync(path)) return null;
  cached = new Database(path, { readonly: true, fileMustExist: true });
  return cached;
}

/** A run's spend + settlement state — what the unlock flow needs server-side. */
export function getRunSettlement(
  runId: string,
): { totalSpentBaseUnits: number; paid: boolean; status: string } | null {
  const handle = db();
  if (!handle) return null;
  const row = handle
    .prepare("SELECT total_spent_base_units, paid, status FROM runs WHERE id = ?")
    .get(runId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    totalSpentBaseUnits: Number(row.total_spent_base_units),
    paid: Boolean(row.paid),
    status: String(row.status),
  };
}

/** Marks a run paid (a separate writable connection — the cached one is read-only). */
export function markRunPaid(runId: string, paymentTx: string): void {
  const write = new Database(dbFilePath());
  try {
    write.prepare("UPDATE runs SET paid = 1, payment_tx = ? WHERE id = ?").run(paymentTx, runId);
  } finally {
    write.close();
  }
}

const usdc = (baseUnits: number): string => `$${(baseUnits / 1_000_000).toFixed(6)}`;

/** Assembles the full work view for a run, or null if it is not yet recorded. */
export function getWorkView(runId: string): WorkView | null {
  const handle = db();
  if (!handle) return null;

  const run = handle.prepare("SELECT * FROM runs WHERE id = ?").get(runId) as
    | Record<string, unknown>
    | undefined;
  if (!run) return null;

  const budget = Number(run.budget_base_units);
  const spent = Number(run.total_spent_base_units);
  const paid = Boolean(run.paid);
  const price = priceOf(spent);
  // Obol fronts the work; if it spent on an answer, that answer stays locked
  // until the user settles cost + markup. A run that spent nothing (e.g. every
  // vendor failed) has nothing to charge for, so its answer is shown freely.
  const requiresPayment = spent > 0 && !paid;

  const payments = handle
    .prepare("SELECT * FROM payments WHERE run_id = ? ORDER BY id ASC")
    .all(runId) as Record<string, unknown>[];
  const events = handle
    .prepare("SELECT * FROM events WHERE run_id = ? ORDER BY id ASC")
    .all(runId) as Record<string, unknown>[];

  const items: ReceiptItem[] = payments.map((p) => ({
    vendorName: String(p.vendor_name),
    endpoint: String(p.endpoint),
    amountUsdc: usdc(Number(p.amount_base_units)),
    settlementRef: String(p.tx_hash),
    resultSummary: p.result_summary == null ? null : String(p.result_summary),
    at: Number(p.created_at),
  }));

  const log: RunEvent[] = events.map((e) => ({
    id: Number(e.id),
    kind: e.kind as RunEvent["kind"],
    text: String(e.text),
    createdAt: Number(e.created_at),
  }));

  return {
    runId,
    question: String(run.question),
    status: run.status as WorkView["status"],
    answer: requiresPayment ? null : run.answer == null ? null : String(run.answer),
    budgetUsdc: usdc(budget),
    totalSpentUsdc: usdc(spent),
    remainingUsdc: usdc(Math.max(0, budget - spent)),
    spentFraction: budget > 0 ? Math.min(1, spent / budget) : 0,
    paymentCount: payments.length,
    items,
    events: log,
    paid,
    requiresPayment,
    priceUsdc: usdc(price),
    priceBaseUnits: price,
  };
}
