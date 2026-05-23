/** Shared shapes for the run work view, mirrored from the ledger. */

export type RunStatus = "running" | "answered" | "budget_exhausted" | "failed";

export interface ReceiptItem {
  vendorName: string;
  endpoint: string;
  amountUsdc: string;
  settlementRef: string;
  resultSummary: string | null;
  at: number;
}

export interface RunEvent {
  id: number;
  kind: "discovery" | "decision" | "payment" | "note" | "error";
  text: string;
  createdAt: number;
}

export interface WorkView {
  runId: string;
  question: string;
  status: RunStatus;
  /** Null until the user unlocks it (pay-to-unlock) — see `requiresPayment`. */
  answer: string | null;
  budgetUsdc: string;
  totalSpentUsdc: string;
  remainingUsdc: string;
  spentFraction: number;
  paymentCount: number;
  items: ReceiptItem[];
  events: RunEvent[];
  /** Pay-to-unlock state. */
  paid: boolean;
  /** True when Obol has spent on an answer that's still locked behind payment. */
  requiresPayment: boolean;
  /** Unlock price (Obol's spend + markup). */
  priceUsdc: string;
  priceBaseUnits: number;
}

export const isTerminal = (status: RunStatus): boolean => status !== "running";
