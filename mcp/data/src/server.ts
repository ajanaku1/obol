/**
 * Obol data market — an HTTP server hosting the x402-paywalled vendors.
 *
 * Obol reaches these endpoints through its payments MCP server: it discovers
 * them at `/.well-known/x402/vendors`, then pays per call. Each vendor wraps a
 * real public API; every call costs a sub-cent USDC micropayment on Arc.
 *
 *   npm run start --workspace=@obol/data
 */
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import express from "express";
import { repoRoot } from "./repoRoot.js";
import { vendors } from "./vendors.js";
import { paywall } from "./x402.js";

loadEnv({ path: resolve(repoRoot(), ".env") });

const PORT = Number(process.env.DATA_SERVER_PORT ?? 4020);
const PUBLIC_URL = process.env.DATA_SERVER_URL ?? `http://localhost:${PORT}`;

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true, vendors: vendors.length }));

/** x402 discovery — the market catalogue Obol surveys before it buys. */
app.get("/.well-known/x402/vendors", (_req, res) => {
  res.json({
    x402Version: 1,
    vendors: vendors.map((v) => ({
      id: v.id,
      name: v.name,
      description: v.description,
      endpoint: `${PUBLIC_URL}/vendor/${v.id}`,
      priceBaseUnits: String(v.priceBaseUnits),
      inputSchema: v.inputSchema,
    })),
  });
});

for (const vendor of vendors) {
  app.post(`/vendor/${vendor.id}`, paywall(vendor));
}

app.listen(PORT, () => {
  console.log(`Obol data market listening on ${PUBLIC_URL} (${vendors.length} vendors)`);
});
