/**
 * Creates Obol's spending wallet.
 *
 * Generates a fresh keypair and writes it into the repo-root `.env` (which is
 * git-ignored). The private key is never printed to the console and never
 * touches a committable file. Run once, on Day 1.
 *
 *   npm run wallet:create
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { repoRoot } from "../repoRoot.js";

const ENV_PATH = resolve(repoRoot(), ".env");
const EXAMPLE_PATH = resolve(repoRoot(), ".env.example");

function loadEnvFile(): string {
  if (existsSync(ENV_PATH)) return readFileSync(ENV_PATH, "utf8");
  if (existsSync(EXAMPLE_PATH)) return readFileSync(EXAMPLE_PATH, "utf8");
  return "";
}

function upsertVar(env: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  return pattern.test(env) ? env.replace(pattern, line) : `${env.trimEnd()}\n${line}\n`;
}

function main(): void {
  let env = loadEnvFile();
  if (/^OBOL_WALLET_PRIVATE_KEY=.+$/m.test(env)) {
    console.error(
      "A wallet already exists in .env. Delete OBOL_WALLET_PRIVATE_KEY first to replace it.",
    );
    process.exit(1);
  }

  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  env = upsertVar(env, "OBOL_WALLET_ADDRESS", account.address);
  env = upsertVar(env, "OBOL_WALLET_PRIVATE_KEY", privateKey);
  writeFileSync(ENV_PATH, env, { mode: 0o600 });

  console.log("Obol wallet created.");
  console.log(`  Address:  ${account.address}`);
  console.log("  Key:      written to .env (git-ignored) — keep it private.");
  console.log("");
  console.log("Next: fund this address with testnet USDC at https://faucet.circle.com");
  console.log("Then verify on https://testnet.arcscan.app");
}

main();
