/**
 * Seller paywall correctness — the property that protects the buyer:
 * verify → fetch → settle, and never settle (charge) when the fetch fails.
 */
import type { Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Vendor } from "./vendors.js";

const verify = vi.fn();
const settle = vi.fn();
const calls: string[] = [];

vi.mock("@circle-fin/x402-batching/server", () => ({
  BatchFacilitatorClient: class {
    verify = (...args: unknown[]) => {
      calls.push("verify");
      return verify(...args);
    };
    settle = (...args: unknown[]) => {
      calls.push("settle");
      return settle(...args);
    };
  },
}));

/** A captured Express response — records status, body, and headers. */
function fakeRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    set(key: string, value: string) {
      this.headers[key] = value;
      return this;
    },
    setHeader(key: string, value: string) {
      this.headers[key] = value;
      return this;
    },
    json(value: unknown) {
      this.body = value;
      return this;
    },
  };
  return res;
}

const paidReq = (): Request =>
  ({
    protocol: "http",
    originalUrl: "/vendor/test",
    get: (h: string) =>
      h === "host" ? "localhost:4020" : h === "payment-signature" ? "e30=" : undefined,
    body: { topic: "x" },
  }) as unknown as Request;

function vendorWith(fetchImpl: () => Promise<unknown>): Vendor {
  return {
    id: "test",
    name: "Test Vendor",
    description: "A test vendor.",
    priceBaseUnits: 1000,
    inputSchema: { topic: "string" },
    fetch: fetchImpl,
  };
}

describe("seller paywall (Circle Gateway batching)", () => {
  beforeEach(() => {
    verify.mockReset();
    settle.mockReset();
    calls.length = 0;
    process.env.VENDOR_PAYOUT_ADDRESS = "0x6f2d5245C0eF0AFCAdD9C06515e3003F9D3D2496";
    process.env.ARC_USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
  });
  afterEach(() => vi.resetModules());

  it("verifies, fetches, then settles — in that order — on success", async () => {
    verify.mockResolvedValue({ isValid: true, payer: "0xPayer" });
    settle.mockResolvedValue({ success: true, transaction: "ref-1", network: "eip155:5042002" });
    const { paywall } = await import("./x402.js");
    const res = fakeRes();
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });

    await paywall(vendorWith(fetchSpy))(paidReq(), res as unknown as Response);

    expect(calls).toEqual(["verify", "settle"]);
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(res.headers["PAYMENT-RESPONSE"]).toBeDefined();
  });

  it("never settles when the upstream fetch fails — no charge", async () => {
    verify.mockResolvedValue({ isValid: true, payer: "0xPayer" });
    const { paywall } = await import("./x402.js");
    const res = fakeRes();
    const failing = vi.fn().mockRejectedValue(new Error("upstream 404"));

    await paywall(vendorWith(failing))(paidReq(), res as unknown as Response);

    expect(calls).toEqual(["verify"]); // settle never reached
    expect(settle).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(502);
  });

  it("rejects an invalid authorization before fetching", async () => {
    verify.mockResolvedValue({ isValid: false, invalidReason: "bad sig" });
    const { paywall } = await import("./x402.js");
    const res = fakeRes();
    const fetchSpy = vi.fn();

    await paywall(vendorWith(fetchSpy))(paidReq(), res as unknown as Response);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(calls).toEqual(["verify"]);
    expect(res.statusCode).toBe(402);
  });
});
