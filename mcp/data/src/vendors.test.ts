import { describe, expect, it } from "vitest";
import { vendorById, vendors } from "./vendors.js";

describe("data market vendors", () => {
  it("prices every vendor below one cent", () => {
    expect(vendors.length).toBeGreaterThan(0);
    for (const vendor of vendors) {
      expect(vendor.priceBaseUnits).toBeGreaterThan(0);
      expect(vendor.priceBaseUnits).toBeLessThan(10_000); // < $0.01
    }
  });

  it("gives every vendor a unique id", () => {
    expect(new Set(vendors.map((v) => v.id)).size).toBe(vendors.length);
  });

  it("rejects a call missing its required input field", async () => {
    const market = vendorById("market-data");
    expect(market).toBeDefined();
    await expect(market?.fetch({})).rejects.toThrow(/Missing required string field/);
  });

  it("has no vendor for an unknown id", () => {
    expect(vendorById("nonexistent")).toBeUndefined();
  });
});
