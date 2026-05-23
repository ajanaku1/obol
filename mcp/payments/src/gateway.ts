/**
 * Circle Gateway client — the buyer side of Circle Nanopayments.
 *
 * Obol holds USDC in the Circle Gateway Wallet on Arc. `pay()` signs an
 * off-chain authorization that Circle Gateway verifies instantly and settles
 * on-chain in a batch, so each call is gasless and sub-cent. This replaces the
 * hand-rolled x402 signing + self-hosted facilitator Obol used before.
 */
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { GatewayClient } from "@circle-fin/x402-batching/client";
import type { Hex } from "viem";
import { repoRoot } from "./repoRoot.js";

loadEnv({ path: resolve(repoRoot(), ".env") });

/** Arc testnet, as named by the Gateway SDK's SupportedChainName. */
const CHAIN = "arcTestnet" as const;

let client: GatewayClient | undefined;

/** The buyer's Gateway client, built once from Obol's wallet key. */
export function gateway(): GatewayClient {
  if (!client) {
    const privateKey = process.env.OBOL_WALLET_PRIVATE_KEY as Hex | undefined;
    if (!privateKey) {
      throw new Error(
        "OBOL_WALLET_PRIVATE_KEY is not set. Run `npm run wallet:create` first.",
      );
    }
    const rpcUrl = process.env.ARC_RPC_URL;
    client = new GatewayClient({ chain: CHAIN, privateKey, ...(rpcUrl ? { rpcUrl } : {}) });
  }
  return client;
}

/** Deposits USDC from Obol's wallet into its Gateway balance. */
export const depositToGateway = (amountUsdc: string) =>
  gateway().deposit(amountUsdc);

/**
 * Obol's wallet and Gateway balances as a JSON-safe summary (the SDK returns
 * bigints, which don't survive JSON.stringify in the MCP tool result).
 */
export async function gatewayBalances(): Promise<{
  walletUsdc: string;
  gatewayAvailableUsdc: string;
  gatewayAvailableBaseUnits: string;
}> {
  const b = await gateway().getBalances();
  return {
    walletUsdc: b.wallet.formatted,
    gatewayAvailableUsdc: b.gateway.formattedAvailable,
    gatewayAvailableBaseUnits: b.gateway.available.toString(),
  };
}
