import { describe, expect, it } from "vitest";
import { BudgetTracker, toUsdc, usdcToBaseUnits } from "./budget.js";

describe("BudgetTracker", () => {
  it("tracks spend and reports what remains", () => {
    const budget = new BudgetTracker(50_000); // $0.05
    budget.commit(2_000);
    budget.commit(5_000);
    expect(budget.spent).toBe(7_000);
    expect(budget.remaining).toBe(43_000);
  });

  it("affords a payment that fits and refuses one that does not", () => {
    const budget = new BudgetTracker(10_000);
    expect(budget.canAfford(10_000)).toBe(true);
    expect(budget.canAfford(10_001)).toBe(false);
    expect(budget.canAfford(0)).toBe(false);
  });

  it("blocks a commit that would breach the budget", () => {
    const budget = new BudgetTracker(10_000);
    budget.commit(8_000);
    expect(() => budget.commit(3_000)).toThrow(/Budget breach blocked/);
    expect(budget.spent).toBe(8_000); // unchanged after the blocked commit
  });

  it("rejects a non-positive budget", () => {
    expect(() => new BudgetTracker(0)).toThrow(/positive/);
  });

  it("converts between USDC and base units", () => {
    expect(usdcToBaseUnits(0.05)).toBe(50_000);
    expect(toUsdc(50_000)).toBe("$0.050000");
  });
});
