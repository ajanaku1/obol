/**
 * Obol's local ledger.
 *
 * On-chain settlement on Arc is the canonical record of every payment. This
 * SQLite database is a fast local index of it — it lets the live work view
 * and the final receipt render without re-reading the chain.
 *
 * All USDC amounts are stored as integer base units (6 decimals).
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { repoRoot } from "./repoRoot.js";

export type RunStatus = "running" | "answered" | "budget_exhausted" | "failed";
export type EventKind = "discovery" | "decision" | "payment" | "note" | "error";

export interface Run {
  id: string;
  question: string;
  budgetBaseUnits: number;
  status: RunStatus;
  answer: string | null;
  totalSpentBaseUnits: number;
  startedAt: number;
  finishedAt: number | null;
  /** Pay-to-unlock: the answer is revealed only after the user settles. */
  paid: boolean;
  paymentTx: string | null;
}

export interface Payment {
  id: number;
  runId: string;
  vendorId: string;
  vendorName: string;
  endpoint: string;
  amountBaseUnits: number;
  txHash: string;
  payTo: string;
  resultSummary: string | null;
  createdAt: number;
}

export interface RunEvent {
  id: number;
  runId: string;
  kind: EventKind;
  text: string;
  createdAt: number;
}

/** The ledger file path — overridable via `OBOL_DB_PATH` (tests use `:memory:`). */
function dbPath(): string {
  const override = process.env.OBOL_DB_PATH;
  if (override) return override;
  const dir = resolve(repoRoot(), "data", "runs");
  mkdirSync(dir, { recursive: true });
  return resolve(dir, "obol.db");
}

function openDb(): Database.Database {
  const db = new Database(dbPath());
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      question TEXT NOT NULL,
      budget_base_units INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      answer TEXT,
      total_spent_base_units INTEGER NOT NULL DEFAULT 0,
      started_at INTEGER NOT NULL,
      finished_at INTEGER,
      paid INTEGER NOT NULL DEFAULT 0,
      payment_tx TEXT
    );
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL REFERENCES runs(id),
      vendor_id TEXT NOT NULL,
      vendor_name TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      amount_base_units INTEGER NOT NULL,
      tx_hash TEXT NOT NULL,
      pay_to TEXT NOT NULL,
      result_summary TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL REFERENCES runs(id),
      kind TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_payments_run ON payments(run_id);
    CREATE INDEX IF NOT EXISTS idx_events_run ON events(run_id);
  `);
  // Migrate older ledgers that predate pay-to-unlock.
  for (const column of ["paid INTEGER NOT NULL DEFAULT 0", "payment_tx TEXT"]) {
    try {
      db.exec(`ALTER TABLE runs ADD COLUMN ${column}`);
    } catch {
      // Column already exists — nothing to do.
    }
  }
  return db;
}

const db = openDb();
const now = (): number => Date.now();

export function createRun(id: string, question: string, budgetBaseUnits: number): void {
  db.prepare(
    "INSERT INTO runs (id, question, budget_base_units, started_at) VALUES (?, ?, ?, ?)",
  ).run(id, question, budgetBaseUnits, now());
}

export function recordEvent(runId: string, kind: EventKind, text: string): void {
  db.prepare(
    "INSERT INTO events (run_id, kind, text, created_at) VALUES (?, ?, ?, ?)",
  ).run(runId, kind, text, now());
}

export function recordPayment(p: {
  runId: string;
  vendorId: string;
  vendorName: string;
  endpoint: string;
  amountBaseUnits: number;
  txHash: string;
  payTo: string;
  resultSummary?: string;
}): void {
  const settle = db.transaction(() => {
    db.prepare(
      `INSERT INTO payments
       (run_id, vendor_id, vendor_name, endpoint, amount_base_units, tx_hash, pay_to, result_summary, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      p.runId, p.vendorId, p.vendorName, p.endpoint,
      p.amountBaseUnits, p.txHash, p.payTo, p.resultSummary ?? null, now(),
    );
    db.prepare(
      "UPDATE runs SET total_spent_base_units = total_spent_base_units + ? WHERE id = ?",
    ).run(p.amountBaseUnits, p.runId);
    db.prepare(
      "INSERT INTO events (run_id, kind, text, created_at) VALUES (?, 'payment', ?, ?)",
    ).run(p.runId, `Paid ${p.vendorName} (${p.amountBaseUnits} base units)`, now());
  });
  settle();
}

export function finishRun(runId: string, status: RunStatus, answer: string | null): void {
  db.prepare(
    "UPDATE runs SET status = ?, answer = ?, finished_at = ? WHERE id = ?",
  ).run(status, answer, now(), runId);
}

/** Marks a run paid once the user has settled cost + markup on Arc. */
export function markPaid(runId: string, paymentTx: string): void {
  db.prepare("UPDATE runs SET paid = 1, payment_tx = ? WHERE id = ?").run(paymentTx, runId);
}

export function getRun(runId: string): Run | undefined {
  const row = db.prepare("SELECT * FROM runs WHERE id = ?").get(runId) as
    | Record<string, unknown>
    | undefined;
  return row ? toRun(row) : undefined;
}

export function listRuns(limit = 25): Run[] {
  return (db.prepare("SELECT * FROM runs ORDER BY started_at DESC LIMIT ?").all(limit) as Record<
    string,
    unknown
  >[]).map(toRun);
}

export function getPayments(runId: string): Payment[] {
  return (
    db.prepare("SELECT * FROM payments WHERE run_id = ? ORDER BY id ASC").all(runId) as Record<
      string,
      unknown
    >[]
  ).map(toPayment);
}

export function getEvents(runId: string): RunEvent[] {
  return (
    db.prepare("SELECT * FROM events WHERE run_id = ? ORDER BY id ASC").all(runId) as Record<
      string,
      unknown
    >[]
  ).map((r) => ({
    id: Number(r.id),
    runId: String(r.run_id),
    kind: r.kind as EventKind,
    text: String(r.text),
    createdAt: Number(r.created_at),
  }));
}

const toRun = (r: Record<string, unknown>): Run => ({
  id: String(r.id),
  question: String(r.question),
  budgetBaseUnits: Number(r.budget_base_units),
  status: r.status as RunStatus,
  answer: r.answer == null ? null : String(r.answer),
  totalSpentBaseUnits: Number(r.total_spent_base_units),
  startedAt: Number(r.started_at),
  finishedAt: r.finished_at == null ? null : Number(r.finished_at),
  paid: Boolean(r.paid),
  paymentTx: r.payment_tx == null ? null : String(r.payment_tx),
});

const toPayment = (r: Record<string, unknown>): Payment => ({
  id: Number(r.id),
  runId: String(r.run_id),
  vendorId: String(r.vendor_id),
  vendorName: String(r.vendor_name),
  endpoint: String(r.endpoint),
  amountBaseUnits: Number(r.amount_base_units),
  txHash: String(r.tx_hash),
  payTo: String(r.pay_to),
  resultSummary: r.result_summary == null ? null : String(r.result_summary),
  createdAt: Number(r.created_at),
});
