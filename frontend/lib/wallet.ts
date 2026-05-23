/** Server-side reads of Obol's own wallet on Arc. */
import "server-only";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { createPublicClient, erc20Abi, formatUnits, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ARC } from "./arc";

function loadRepoEnv(): void {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, ".env"))) {
      loadEnv({ path: resolve(dir, ".env") });
      return;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
}
loadRepoEnv();

const client = createPublicClient({ transport: http(process.env.ARC_RPC_URL ?? ARC.rpcUrl) });

export interface ObolWallet {
  address: string;
  balanceUsdc: string;
  balanceBaseUnits: string;
  funded: boolean;
}

/**
 * Obol's address: explicit OBOL_WALLET_ADDRESS if set, otherwise derived from
 * the private key. Deriving it means deployments need one fewer secret.
 */
function obolAddress(): `0x${string}` | null {
  const explicit = process.env.OBOL_WALLET_ADDRESS;
  if (explicit) return explicit as `0x${string}`;
  const key = process.env.OBOL_WALLET_PRIVATE_KEY;
  if (!key) return null;
  try {
    return privateKeyToAccount(key as `0x${string}`).address;
  } catch {
    return null;
  }
}

/** Reads Obol's USDC balance on Arc, or null when no wallet is configured. */
export async function getObolWallet(): Promise<ObolWallet | null> {
  const address = obolAddress();
  if (!address) return null;

  const usdc = (process.env.ARC_USDC_ADDRESS ?? ARC.usdc) as `0x${string}`;
  try {
    const balance = await client.readContract({
      address: usdc,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address],
    });
    return {
      address,
      balanceUsdc: formatUnits(balance, 6),
      balanceBaseUnits: balance.toString(),
      funded: balance > 0n,
    };
  } catch {
    return { address, balanceUsdc: "0", balanceBaseUnits: "0", funded: false };
  }
}
