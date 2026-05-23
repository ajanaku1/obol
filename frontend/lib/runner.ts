/**
 * Launches an Obol run as a detached process.
 *
 * The agent writes its progress to the shared ledger as it works; the browser
 * follows along by polling the work view. Keeping the run out-of-process means
 * a slow query never holds an HTTP request open.
 */
import "server-only";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

function repoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, ".env.example"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

/** Starts a run for a question and budget; returns the new run id. */
export function startRun(question: string, budgetUsdc: number): string {
  const runId = randomUUID();
  const root = repoRoot();

  const child = spawn(
    "npx",
    [
      "tsx",
      resolve(root, "agent", "src", "cli.ts"),
      "--run-id", runId,
      "--question", question,
      "--budget", String(budgetUsdc),
    ],
    { cwd: root, detached: true, stdio: "ignore", env: process.env },
  );
  child.unref();

  return runId;
}
