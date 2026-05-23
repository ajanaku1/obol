import { describe, expect, it } from "vitest";
import { createRun, finishRun, recordEvent, recordPayment } from "./db.js";
import { buildReceipt, buildWorkView, formatUsdc } from "./receipt.js";

describe("ledger receipt", () => {
  it("itemizes payments and tallies the spend against the budget", () => {
    createRun("run-a", "What is Arc?", 50_000);
    recordEvent("run-a", "discovery", "Surveyed 5 vendors.");
    recordPayment({
      runId: "run-a",
      vendorId: "entity-brief",
      vendorName: "Entity Brief",
      endpoint: "http://localhost:4020/vendor/entity-brief",
      amountBaseUnits: 1_000,
      txHash: "0xabc",
      payTo: "0xdead",
    });
    recordPayment({
      runId: "run-a",
      vendorId: "deep-research",
      vendorName: "Deep Research",
      endpoint: "http://localhost:4020/vendor/deep-research",
      amountBaseUnits: 5_000,
      txHash: "0xdef",
      payTo: "0xdead",
    });
    finishRun("run-a", "answered", "Arc is Circle's payments L1.");

    const receipt = buildReceipt("run-a");
    expect(receipt?.paymentCount).toBe(2);
    expect(receipt?.totalSpentUsdc).toBe(formatUsdc(6_000));
    expect(receipt?.remainingUsdc).toBe(formatUsdc(44_000));
    expect(receipt?.status).toBe("answered");
    expect(receipt?.items[0]?.settlementRef).toContain("0xabc");
  });

  it("returns undefined for an unknown run", () => {
    expect(buildReceipt("missing")).toBeUndefined();
  });

  it("includes the reasoning log in the work view", () => {
    createRun("run-b", "Price of ETH?", 20_000);
    recordEvent("run-b", "decision", "Buying the market-data vendor.");
    const view = buildWorkView("run-b");
    expect(view?.events.some((e) => e.kind === "decision")).toBe(true);
  });
});
