/** Server-side reads of Obol's own wallet on Arc. */
import "server-only";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { privateKeyToAccount } from "viem/accounts";

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

export interface ObolWallet {
  address: string;
}

/**
 * Obol's address: explicit OBOL_WALLET_ADDRESS if set, otherwise derived from
 * the private key. Deriving it means deployments need one fewer secret.
 *
 * Obol's balance is deliberately never exposed to the client — it's a private
 * operating detail, not something users see or the agent discloses.
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

/** Obol's wallet address (the unlock-payment recipient), or null if unconfigured. */
export async function getObolWallet(): Promise<ObolWallet | null> {
  const address = obolAddress();
  return address ? { address } : null;
}
