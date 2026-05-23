/**
 * Ledger MCP server.
 *
 * Obol calls these tools to record its work: it opens a run, logs every
 * decision and discovery, records each settled micropayment, and closes the
 * run with an answer. The receipt is assembled from these records.
 */
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { repoRoot } from "./repoRoot.js";
import {
  createRun,
  finishRun,
  recordEvent,
  recordPayment,
  type EventKind,
} from "./db.js";
import { buildReceipt, buildWorkView } from "./receipt.js";

loadEnv({ path: resolve(repoRoot(), ".env") });

const server = new McpServer({ name: "obol-ledger", version: "0.1.0" });

const ok = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});
const fail = (err: unknown) => ({
  content: [{ type: "text" as const, text: err instanceof Error ? err.message : String(err) }],
  isError: true,
});

server.tool(
  "start_run",
  "Open a new run for a question and budget. Returns the run id.",
  {
    question: z.string().min(1),
    budgetBaseUnits: z.number().int().positive().describe("Budget in USDC base units (6 decimals)."),
    runId: z.string().optional().describe("Optional caller-supplied id."),
  },
  async ({ question, budgetBaseUnits, runId }) => {
    try {
      const id = runId ?? randomUUID();
      createRun(id, question, budgetBaseUnits);
      return ok({ runId: id });
    } catch (err) {
      return fail(err);
    }
  },
);

server.tool(
  "log_event",
  "Record a reasoning step: a discovery, a decision, a note, or an error.",
  {
    runId: z.string(),
    kind: z.enum(["discovery", "decision", "note", "error"]),
    text: z.string().min(1),
  },
  async ({ runId, kind, text }) => {
    try {
      recordEvent(runId, kind as EventKind, text);
      return ok({ logged: true });
    } catch (err) {
      return fail(err);
    }
  },
);

server.tool(
  "record_payment",
  "Record a settled USDC micropayment to a vendor, with its Circle Gateway settlement reference.",
  {
    runId: z.string(),
    vendorId: z.string(),
    vendorName: z.string(),
    endpoint: z.string(),
    amountBaseUnits: z.number().int().positive(),
    txHash: z.string(),
    payTo: z.string(),
    resultSummary: z.string().optional(),
  },
  async (args) => {
    try {
      recordPayment(args);
      return ok({ recorded: true });
    } catch (err) {
      return fail(err);
    }
  },
);

server.tool(
  "finish_run",
  "Close a run with a final status and answer.",
  {
    runId: z.string(),
    status: z.enum(["answered", "budget_exhausted", "failed"]),
    answer: z.string().nullable(),
  },
  async ({ runId, status, answer }) => {
    try {
      finishRun(runId, status, answer);
      return ok({ closed: true });
    } catch (err) {
      return fail(err);
    }
  },
);

server.tool(
  "get_receipt",
  "Get the itemized on-chain spend receipt for a run.",
  { runId: z.string() },
  async ({ runId }) => {
    try {
      const receipt = buildReceipt(runId);
      return receipt ? ok(receipt) : fail(new Error(`Unknown run: ${runId}`));
    } catch (err) {
      return fail(err);
    }
  },
);

server.tool(
  "get_work_view",
  "Get the live work view for a run: receipt so far plus the reasoning log.",
  { runId: z.string() },
  async ({ runId }) => {
    try {
      const view = buildWorkView(runId);
      return view ? ok(view) : fail(new Error(`Unknown run: ${runId}`));
    } catch (err) {
      return fail(err);
    }
  },
);

await server.connect(new StdioServerTransport());
console.error("obol-ledger MCP server ready on stdio");
