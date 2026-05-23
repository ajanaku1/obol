/**
 * Builds the itemized spend receipt for a run — the artifact a stranger can
 * verify, line by line. Each payment is a Circle Gateway nanopayment; the
 * `settlementRef` is Gateway's settlement id (the on-chain settlement is
 * batched, so it lands asynchronously rather than as a per-call tx hash).
 */
import { getEvents, getPayments, getRun, type Run } from "./db.js";

/** Base units (6 decimals) to a human USDC string. */
export const formatUsdc = (baseUnits: number): string =>
  `$${(baseUnits / 1_000_000).toFixed(6)}`;

export interface ReceiptItem {
  vendorName: string;
  endpoint: string;
  amountUsdc: string;
  amountBaseUnits: number;
  settlementRef: string;
  resultSummary: string | null;
  at: number;
}

export interface Receipt {
  runId: string;
  question: string;
  status: Run["status"];
  answer: string | null;
  budgetUsdc: string;
  totalSpentUsdc: string;
  remainingUsdc: string;
  paymentCount: number;
  items: ReceiptItem[];
}

/** Assembles the full receipt for a run, or undefined if the run is unknown. */
export function buildReceipt(runId: string): Receipt | undefined {
  const run = getRun(runId);
  if (!run) return undefined;
  const payments = getPayments(runId);
  const remaining = run.budgetBaseUnits - run.totalSpentBaseUnits;

  return {
    runId,
    question: run.question,
    status: run.status,
    answer: run.answer,
    budgetUsdc: formatUsdc(run.budgetBaseUnits),
    totalSpentUsdc: formatUsdc(run.totalSpentBaseUnits),
    remainingUsdc: formatUsdc(Math.max(0, remaining)),
    paymentCount: payments.length,
    items: payments.map((p) => ({
      vendorName: p.vendorName,
      endpoint: p.endpoint,
      amountUsdc: formatUsdc(p.amountBaseUnits),
      amountBaseUnits: p.amountBaseUnits,
      settlementRef: p.txHash,
      resultSummary: p.resultSummary,
      at: p.createdAt,
    })),
  };
}

/** The live work view: run state, the receipt so far, and the reasoning log. */
export function buildWorkView(runId: string) {
  const receipt = buildReceipt(runId);
  if (!receipt) return undefined;
  return { ...receipt, events: getEvents(runId) };
}
