/**
 * Buyer client — discovers the market and pays via Circle Gateway.
 *
 * Discovery is a plain GET against the data market. Paying is delegated to the
 * Gateway client, which handles the x402 handshake (read the 402 requirement,
 * sign an authorization, retry) and returns the data plus the settlement tx.
 */
import { gateway } from "./gateway.js";

const DATA_SERVER = process.env.DATA_SERVER_URL ?? "http://localhost:4020";

/** A paid data vendor as advertised by the x402 discovery endpoint. */
export interface Vendor {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  /** Advertised price in USDC base units (6 decimals). */
  priceBaseUnits: string;
  inputSchema: Record<string, unknown>;
}

/** A vendor's advertised price, learned from an unpaid 402 probe. */
export interface Quote {
  amountBaseUnits: string;
  payTo: string;
  description: string;
}

/** The result of a paid call: the vendor's data plus its on-Arc receipt. */
export interface PaidCallResult {
  data: unknown;
  amountBaseUnits: string;
  payTo: string;
  settlement: { transaction: string; network: string };
}

const jsonHeaders = () => ({ "Content-Type": "application/json" });

/** Lists the vendors currently open for business in the x402 market. */
export async function discoverVendors(): Promise<Vendor[]> {
  const res = await fetch(`${DATA_SERVER}/.well-known/x402/vendors`);
  if (!res.ok) throw new Error(`Discovery failed: ${res.status} ${res.statusText}`);
  const body = (await res.json()) as { vendors: Vendor[] };
  return body.vendors;
}

/**
 * Asks an endpoint its price without paying. Makes one unpaid probe and reads
 * the Gateway batching requirement out of the 402 `PAYMENT-REQUIRED` header.
 */
export async function quote(url: string): Promise<Quote> {
  const probe = await fetch(url, { method: "POST", headers: jsonHeaders(), body: "{}" });
  if (probe.status !== 402) {
    throw new Error(`Expected 402 from ${url}, got ${probe.status}`);
  }
  const header = probe.headers.get("PAYMENT-REQUIRED");
  if (!header) throw new Error(`${url} did not advertise a price`);
  const required = JSON.parse(Buffer.from(header, "base64").toString("utf8")) as {
    accepts?: { amount: string; payTo: string; description?: string }[];
  };
  const requirement = required.accepts?.[0];
  if (!requirement) throw new Error(`No payable price offered by ${url}`);
  return {
    amountBaseUnits: requirement.amount,
    payTo: requirement.payTo,
    description: requirement.description ?? "",
  };
}

/**
 * Pays for and fetches a data endpoint through Circle Gateway. The probe is
 * only to learn the recipient for the receipt — Gateway does its own handshake.
 */
export async function payAndFetch(
  url: string,
  input: Record<string, unknown>,
): Promise<PaidCallResult> {
  const requirement = await quote(url);
  const result = await gateway().pay(url, { method: "POST", body: input });
  return {
    data: result.data,
    amountBaseUnits: result.amount.toString(),
    payTo: requirement.payTo,
    settlement: { transaction: result.transaction, network: "arc-testnet" },
  };
}
