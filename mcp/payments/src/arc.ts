/**
 * Arc testnet chain definition and shared client setup.
 *
 * Arc is Circle's payments-focused L1 where USDC is the native gas asset.
 * Obol's wallet and every micropayment it makes settle here.
 */
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { createPublicClient, defineChain, http, type Account } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { repoRoot } from "./repoRoot.js";

loadEnv({ path: resolve(repoRoot(), ".env") });

const RPC_URL = process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network";
const CHAIN_ID = Number(process.env.ARC_CHAIN_ID ?? 5042002);

/**
 * Arc testnet — chain 5042002, USDC-denominated gas.
 *
 * Two decimal scales coexist on Arc and must not be confused:
 *   - **Native gas** is 18-decimal (EVM wei convention). The `nativeCurrency`
 *     below describes the gas asset only — it's what `walletStatus.ts` reads
 *     for the gas balance.
 *   - **ERC-20 USDC** is 6-decimal. Every payment Obol makes (x402 / EIP-3009
 *     `transferWithAuthorization`) uses the ERC-20 contract, so all
 *     `priceBaseUnits` / `budget` math in this repo is 6-decimal.
 */
export const arcTestnet = defineChain({
  id: CHAIN_ID,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: {
    default: { name: "Arcscan", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
});

/** USDC ERC-20 contract on Arc testnet — the token used for x402 payments. */
export function usdcAddress(): `0x${string}` {
  const addr = process.env.ARC_USDC_ADDRESS;
  if (!addr) {
    throw new Error(
      "ARC_USDC_ADDRESS is not set. Add the Arc testnet USDC contract to .env.",
    );
  }
  return addr as `0x${string}`;
}

/** A read-only client for balance checks and receipt confirmation. */
export const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(RPC_URL),
});

/** Loads Obol's spending account from the runtime environment only. */
export function obolAccount(): Account {
  const key = process.env.OBOL_WALLET_PRIVATE_KEY;
  if (!key) {
    throw new Error(
      "OBOL_WALLET_PRIVATE_KEY is not set. Run `npm run wallet:create` first.",
    );
  }
  return privateKeyToAccount(key as `0x${string}`);
}

export const chainId = CHAIN_ID;

export const explorerTxUrl = (hash: string): string =>
  `https://testnet.arcscan.app/tx/${hash}`;
