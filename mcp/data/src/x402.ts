/**
 * Server-side paywall — Circle Gateway batching.
 *
 * An unpaid request gets a 402 carrying the Gateway batching payment
 * requirement. A request carrying a `payment-signature` header is verified by
 * Circle Gateway, the upstream is fetched, and only then is the payment settled
 * — so Obol is never charged for data that fails to arrive. Settlement is
 * batched on-chain by Circle Gateway, so this server holds no key and pays no
 * gas.
 */
import type { Request, Response } from "express";
import { BatchFacilitatorClient } from "@circle-fin/x402-batching/server";
import type { Vendor } from "./vendors.js";

/** Arc testnet identifiers, per the Gateway batching SDK. */
const ARC_NETWORK = "eip155:5042002";
const ARC_USDC = process.env.ARC_USDC_ADDRESS ?? "0x3600000000000000000000000000000000000000";
const GATEWAY_WALLET = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9";

const facilitator = new BatchFacilitatorClient();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not set in the data server environment.`);
  return value;
}

/** The Gateway batching payment requirement Obol must satisfy for a vendor. */
function paymentRequirements(vendor: Vendor) {
  return {
    scheme: "exact",
    network: ARC_NETWORK,
    asset: ARC_USDC,
    amount: String(vendor.priceBaseUnits),
    payTo: requireEnv("VENDOR_PAYOUT_ADDRESS"),
    // The buyer signs validBefore = now + maxTimeoutSeconds. Circle Gateway
    // rejects authorizations whose validity window is too short for batched
    // settlement (4 days was refused as "authorization_validity_too_short"),
    // so the window must be generous — 30 days.
    maxTimeoutSeconds: 2_592_000,
    extra: {
      name: "GatewayWalletBatched",
      version: "1",
      verifyingContract: GATEWAY_WALLET,
    },
  };
}

const decode = <T>(b64: string): T =>
  JSON.parse(Buffer.from(b64, "base64").toString("utf8")) as T;
const encode = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString("base64");

/** Express handler that paywalls one vendor with Circle Gateway batching. */
export function paywall(vendor: Vendor) {
  return async (req: Request, res: Response): Promise<void> => {
    const resource = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    const requirements = paymentRequirements(vendor);
    const signature = req.get("payment-signature");

    if (!signature) {
      res.status(402).set(
        "PAYMENT-REQUIRED",
        encode({
          x402Version: 2,
          resource: { url: resource, description: vendor.description, mimeType: "application/json" },
          accepts: [{ ...requirements, description: vendor.description }],
        }),
      );
      res.json({ error: "Payment required" });
      return;
    }

    let payload: Parameters<BatchFacilitatorClient["verify"]>[0];
    try {
      payload = decode(signature);
    } catch {
      res.status(400).json({ error: "Malformed payment-signature header" });
      return;
    }

    // Verify the authorization, but don't settle yet — Obol must never be
    // charged for a call whose data never arrives. A facilitator error (e.g.
    // Circle Gateway unreachable) must surface as a 5xx, never crash the server.
    let check;
    try {
      check = await facilitator.verify(payload, requirements);
    } catch (err) {
      res.status(502).json({
        error: "Payment verification unavailable",
        detail: err instanceof Error ? err.message : String(err),
      });
      return;
    }
    if (!check.isValid) {
      res.status(402).json({ error: check.invalidReason ?? "Payment authorization invalid" });
      return;
    }

    // Fetch the upstream first. A failure here costs the buyer nothing.
    let data: unknown;
    try {
      data = await vendor.fetch(req.body ?? {});
    } catch (err) {
      res.status(502).json({
        error: "Vendor upstream failed — no payment was settled",
        detail: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    // Only now, with data in hand, settle the payment via Circle Gateway.
    let settlement;
    try {
      settlement = await facilitator.settle(payload, requirements);
    } catch (err) {
      res.status(502).json({
        error: "Payment settlement unavailable",
        detail: err instanceof Error ? err.message : String(err),
      });
      return;
    }
    if (!settlement.success) {
      res.status(402).json({ error: settlement.errorReason ?? "Payment settlement failed" });
      return;
    }

    res.setHeader(
      "PAYMENT-RESPONSE",
      encode({
        success: true,
        transaction: settlement.transaction,
        network: settlement.network,
        payer: settlement.payer ?? check.payer,
        amount: requirements.amount,
      }),
    );
    res.json(data);
  };
}
