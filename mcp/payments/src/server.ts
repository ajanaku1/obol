/**
 * Payments MCP server.
 *
 * Exposes Obol's spending tools over stdio: discover the x402 market, quote a
 * vendor's price, pay a vendor on Arc, and read the wallet balance. Every
 * `pay_and_fetch` call settles a real USDC micropayment on Arc testnet.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { formatUnits } from "viem";
import { gatewayBalances } from "./gateway.js";
import { discoverVendors, payAndFetch, quote } from "./client.js";

const server = new McpServer({ name: "obol-payments", version: "0.1.0" });

const ok = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});
const fail = (err: unknown) => ({
  content: [
    { type: "text" as const, text: err instanceof Error ? err.message : String(err) },
  ],
  isError: true,
});

server.tool(
  "discover_vendors",
  "List the paid data vendors currently open in the x402 market, with their prices.",
  {},
  async () => {
    try {
      const vendors = await discoverVendors();
      return ok({
        count: vendors.length,
        vendors: vendors.map((v) => ({
          ...v,
          priceUsdc: formatUnits(BigInt(v.priceBaseUnits), 6),
        })),
      });
    } catch (err) {
      return fail(err);
    }
  },
);

server.tool(
  "get_quote",
  "Ask one vendor endpoint its price in USDC without paying.",
  { endpoint: z.string().url().describe("The vendor endpoint URL to quote.") },
  async ({ endpoint }) => {
    try {
      const requirement = await quote(endpoint);
      return ok({
        endpoint,
        priceUsdc: formatUnits(BigInt(requirement.amountBaseUnits), 6),
        priceBaseUnits: requirement.amountBaseUnits,
        description: requirement.description,
      });
    } catch (err) {
      return fail(err);
    }
  },
);

server.tool(
  "pay_and_fetch",
  "Pay a vendor on Arc and fetch its data. Settles a real USDC micropayment; " +
    "returns the data and an on-chain settlement receipt.",
  {
    endpoint: z.string().url().describe("The vendor endpoint URL to pay and call."),
    input: z
      .record(z.unknown())
      .default({})
      .describe("The query parameters this vendor expects."),
  },
  async ({ endpoint, input }) => {
    try {
      const result = await payAndFetch(endpoint, input);
      return ok({
        endpoint,
        amountUsdc: formatUnits(BigInt(result.amountBaseUnits), 6),
        amountBaseUnits: result.amountBaseUnits,
        paidTo: result.payTo,
        settlement: result.settlement,
        data: result.data,
      });
    } catch (err) {
      return fail(err);
    }
  },
);

server.tool(
  "wallet_balance",
  "Read Obol's USDC balances on Arc testnet — wallet and Circle Gateway.",
  {},
  async () => {
    try {
      const balances = await gatewayBalances();
      return ok(balances);
    } catch (err) {
      return fail(err);
    }
  },
);

await server.connect(new StdioServerTransport());
console.error("obol-payments MCP server ready on stdio");
