import { describe, expect, it } from "vitest";
import { BudgetTracker } from "./budget.js";
import { POLICY, mustFinalize, reserveBaseUnits, type RunState } from "./decide.js";

const stateWith = (overrides: Partial<RunState> & { budget: BudgetTracker }): RunState => ({
  paidCalls: 0,
  iterations: 0,
  ...overrides,
});

describe("mustFinalize", () => {
  it("lets a healthy run continue", () => {
    const state = stateWith({ budget: new BudgetTracker(50_000) });
    expect(mustFinalize(state, 2_000)).toBeNull();
  });

  it("finalizes when the budget cannot afford the cheapest vendor", () => {
    const budget = new BudgetTracker(10_000);
    budget.commit(9_000);
    const signal = mustFinalize(stateWith({ budget }), 2_000);
    expect(signal?.reason).toMatch(/budget/);
  });

  it("finalizes at the paid-call cap", () => {
    const state = stateWith({
      budget: new BudgetTracker(1_000_000),
      paidCalls: POLICY.maxPaidCalls,
    });
    expect(mustFinalize(state, 1_000)?.reason).toMatch(/paid calls/);
  });

  it("finalizes at the reasoning-step cap", () => {
    const state = stateWith({
      budget: new BudgetTracker(1_000_000),
      iterations: POLICY.maxIterations,
    });
    expect(mustFinalize(state, 1_000)?.reason).toMatch(/reasoning-step/);
  });

  it("does not finalize on budget when no vendors are known yet", () => {
    const state = stateWith({ budget: new BudgetTracker(100) });
    expect(mustFinalize(state, undefined)).toBeNull();
  });
});

describe("reserveBaseUnits", () => {
  it("reserves the policy fraction of the budget", () => {
    expect(reserveBaseUnits(new BudgetTracker(100_000))).toBe(10_000);
  });
});
