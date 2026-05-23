/**
 * Budget tracking.
 *
 * The budget is a hard ceiling. This tracker is the safety net that sits
 * underneath Obol's reasoning: even if the agent's judgement slips, a payment
 * that would exceed the budget cannot be committed here.
 *
 * All amounts are USDC base units (6 decimals).
 */
export class BudgetTracker {
  private spentBaseUnits = 0;

  constructor(private readonly totalBaseUnits: number) {
    if (totalBaseUnits <= 0) throw new Error("Budget must be positive.");
  }

  get total(): number {
    return this.totalBaseUnits;
  }

  get spent(): number {
    return this.spentBaseUnits;
  }

  get remaining(): number {
    return this.totalBaseUnits - this.spentBaseUnits;
  }

  /** True if a payment of `priceBaseUnits` fits within what remains. */
  canAfford(priceBaseUnits: number): boolean {
    return priceBaseUnits > 0 && priceBaseUnits <= this.remaining;
  }

  /**
   * Commits a spent amount. Throws if it would breach the budget — callers
   * must check `canAfford` first; this throw means a bug, not a soft limit.
   */
  commit(amountBaseUnits: number): void {
    if (amountBaseUnits > this.remaining) {
      throw new Error(
        `Budget breach blocked: tried to spend ${amountBaseUnits}, ` +
          `only ${this.remaining} base units remain.`,
      );
    }
    this.spentBaseUnits += amountBaseUnits;
  }
}

export const toUsdc = (baseUnits: number): string =>
  `$${(baseUnits / 1_000_000).toFixed(6)}`;

export const usdcToBaseUnits = (usdc: number): number => Math.round(usdc * 1_000_000);
