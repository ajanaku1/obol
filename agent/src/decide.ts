/**
 * Decision policy — the deterministic rails around Obol's reasoning.
 *
 * Choosing *which* vendor to buy and *whether the answer is good enough* is
 * Obol's own judgement, made in the loop by the model. This module enforces
 * the limits that judgement is not allowed to cross: a spending reserve, a cap
 * on the number of purchases, and a cap on reasoning steps.
 */
import { BudgetTracker, toUsdc } from "./budget.js";

export const POLICY = {
  /** Keep this fraction of the budget in reserve unless one call resolves it. */
  reserveFraction: 0.1,
  /** Hard cap on the number of paid vendor calls in a run. */
  maxPaidCalls: 12,
  /** Hard cap on reasoning steps, so a run always terminates. */
  maxIterations: 24,
} as const;

export interface RunState {
  budget: BudgetTracker;
  paidCalls: number;
  iterations: number;
}

export interface FinalizeSignal {
  finalize: true;
  reason: string;
}

/**
 * Returns a finalize signal when the loop must stop spending and force Obol to
 * deliver its answer — or null when the run may continue.
 *
 * `cheapestPrice` is the lowest vendor price Obol has discovered; when even
 * that no longer fits the budget, there is nothing left worth doing.
 */
export function mustFinalize(
  state: RunState,
  cheapestPrice: number | undefined,
): FinalizeSignal | null {
  if (state.iterations >= POLICY.maxIterations) {
    return { finalize: true, reason: "reached the reasoning-step cap" };
  }
  if (state.paidCalls >= POLICY.maxPaidCalls) {
    return { finalize: true, reason: "reached the cap on paid calls" };
  }
  if (cheapestPrice !== undefined && !state.budget.canAfford(cheapestPrice)) {
    return { finalize: true, reason: "budget cannot afford any further vendor" };
  }
  return null;
}

/** The reserve amount, in base units — the cushion Obol should protect. */
export const reserveBaseUnits = (budget: BudgetTracker): number =>
  Math.floor(budget.total * POLICY.reserveFraction);

/**
 * A one-line budget briefing injected before each turn, so Obol always
 * reasons against current, accurate numbers rather than a stale memory.
 */
export function budgetBriefing(state: RunState): string {
  const { budget } = state;
  return [
    `Budget: ${toUsdc(budget.total)} total`,
    `spent ${toUsdc(budget.spent)}`,
    `remaining ${toUsdc(budget.remaining)}`,
    `(suggested reserve ${toUsdc(reserveBaseUnits(budget))})`,
    `· ${state.paidCalls}/${POLICY.maxPaidCalls} paid calls used`,
  ].join(" · ");
}
