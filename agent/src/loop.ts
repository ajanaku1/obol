/**
 * Obol's autonomous loop.
 *
 * The loop hands the model the question, the budget, and the payment tools,
 * then lets it run: discover the market, choose vendors, pay on Arc, read
 * results, and decide when the answer is good enough. The loop's own job is
 * narrow but firm — enforce the budget, record every payment, and guarantee
 * the run terminates.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
import { BudgetTracker, toUsdc, usdcToBaseUnits } from "./budget.js";
import { budgetBriefing, mustFinalize, type RunState } from "./decide.js";
import { McpHub } from "./mcpClient.js";
import { repoRoot } from "./repoRoot.js";

loadEnv({ path: resolve(repoRoot(), ".env") });

/** The agent package directory — found by walking up to the `.mcp.json` file. */
function findAgentDir(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    if (existsSync(resolve(dir, ".mcp.json"))) return dir;
    dir = dirname(dir);
  }
  throw new Error("Could not locate agent/.mcp.json");
}

const AGENT_DIR = findAgentDir();
const MODEL = process.env.OBOL_MODEL ?? "claude-sonnet-4-6";

/** A single observable step in a run, streamed to the caller as it happens. */
export interface AgentEvent {
  kind: "status" | "discovery" | "decision" | "payment" | "error" | "answer";
  text: string;
  at: number;
}

export interface RunOptions {
  question: string;
  budgetUsdc: number;
  runId?: string;
  onEvent?: (event: AgentEvent) => void;
}

export interface RunResult {
  runId: string;
  answer: string;
  status: "answered" | "budget_exhausted" | "failed";
  spentUsdc: string;
  paymentCount: number;
}

interface VendorInfo {
  id: string;
  name: string;
  priceBaseUnits: number;
}

const personaPath = resolve(AGENT_DIR, "CLAUDE.md");

/** Runs Obol end to end for one question and budget. */
export async function runAgent(options: RunOptions): Promise<RunResult> {
  const { question } = options;
  const budgetBaseUnits = usdcToBaseUnits(options.budgetUsdc);
  const budget = new BudgetTracker(budgetBaseUnits);
  const state: RunState = { budget, paidCalls: 0, iterations: 0 };

  const anthropic = new Anthropic();
  const hub = new McpHub();
  const emit = makeEmitter(options.onEvent);

  await hub.connect(resolve(AGENT_DIR, ".mcp.json"));

  const runId = await startRun(hub, question, budgetBaseUnits, options.runId);
  emit("status", `Run ${runId} opened with a ${toUsdc(budgetBaseUnits)} budget.`);

  // Spend guard: Obol fronts every run from one shared Gateway balance. If that
  // balance can't cover even the cheapest vendor, fail fast with a clear
  // message instead of letting every purchase fail and look like an outage.
  // The check is best-effort — a flaky balance read must not block a run.
  const broke = await purseTooLow(hub);
  if (broke) {
    emit("error", broke);
    await logEvent(hub, runId, "error", broke);
    await finishRun(hub, runId, "failed", broke);
    await hub.close();
    return {
      runId, answer: broke, status: "failed",
      spentUsdc: toUsdc(0), paymentCount: 0,
    };
  }

  // Vendors are kept here so the budget can be checked before any purchase.
  const vendorsByEndpoint = new Map<string, VendorInfo>();
  let result: RunResult;

  try {
    result = await reason({
      anthropic, hub, state, runId, question, vendorsByEndpoint, emit,
    });
  } catch (err) {
    const text = err instanceof Error ? err.message : String(err);
    emit("error", text);
    await logEvent(hub, runId, "error", text);
    await finishRun(hub, runId, "failed", null);
    result = {
      runId, answer: `Run failed: ${text}`, status: "failed",
      spentUsdc: toUsdc(budget.spent), paymentCount: state.paidCalls,
    };
  } finally {
    await hub.close();
  }
  return result;
}

interface ReasonContext {
  anthropic: Anthropic;
  hub: McpHub;
  state: RunState;
  runId: string;
  question: string;
  vendorsByEndpoint: Map<string, VendorInfo>;
  emit: (kind: AgentEvent["kind"], text: string) => void;
}

/** The tool-use loop: think, act, observe, until the answer is ready. */
async function reason(ctx: ReasonContext): Promise<RunResult> {
  const { anthropic, hub, state, runId, emit } = ctx;
  const persona = readFileSync(personaPath, "utf8");
  // Obol reasons with the payment tools only; the ledger is the loop's job.
  const AGENT_TOOLS = new Set([
    "discover_vendors",
    "get_quote",
    "pay_and_fetch",
    "wallet_balance",
  ]);
  const tools = hub.anthropicTools().filter((t) => AGENT_TOOLS.has(t.name));

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: openingPrompt(ctx.question, state) },
  ];

  for (;;) {
    state.iterations += 1;
    const forced = mustFinalize(state, cheapestPrice(ctx.vendorsByEndpoint));

    // The persona is stable across turns — cache it to cut repeated input cost.
    const personaBlock = {
      type: "text",
      text: persona,
      cache_control: { type: "ephemeral" },
    } as unknown as Anthropic.TextBlockParam;
    const system: Anthropic.TextBlockParam[] = [
      personaBlock,
      { type: "text", text: budgetBriefing(state) },
    ];
    if (forced) {
      system.push({
        type: "text",
        text:
          `You must stop spending now — ${forced.reason}. Do not request any ` +
          `more data. Give your final answer using what you have already learned.`,
      });
    }

    // On the finalize turn we omit `tools` entirely — the Anthropic API
    // rejects an empty array, and with no tools the model can only produce
    // its closing answer in text.
    const request: Anthropic.MessageCreateParamsNonStreaming = {
      model: MODEL,
      max_tokens: 2048,
      system,
      messages,
      ...(forced ? {} : { tools }),
    };
    const response = await anthropic.messages.create(request);
    messages.push({ role: "assistant", content: response.content });

    for (const block of response.content) {
      if (block.type === "text" && block.text.trim()) {
        await logEvent(hub, runId, "decision", block.text);
        emit("decision", block.text);
      }
    }

    if (response.stop_reason !== "tool_use" || forced) {
      const answer = finalText(response.content);
      const status = forced?.reason.includes("budget") ? "budget_exhausted" : "answered";
      await finishRun(hub, runId, status, answer);
      emit("answer", answer);
      return {
        runId, answer, status,
        spentUsdc: toUsdc(state.budget.spent), paymentCount: state.paidCalls,
      };
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      toolResults.push(await handleToolCall(ctx, block));
    }
    messages.push({ role: "user", content: toolResults });
  }
}

/** Dispatches one tool call, enforcing the budget on every purchase. */
async function handleToolCall(
  ctx: ReasonContext,
  block: Anthropic.ToolUseBlock,
): Promise<Anthropic.ToolResultBlockParam> {
  const { hub, state, runId, vendorsByEndpoint, emit } = ctx;
  const args = (block.input ?? {}) as Record<string, unknown>;

  try {
    if (block.name === "pay_and_fetch") {
      return await handlePayment(ctx, block, args);
    }

    const output = await hub.call(block.name, args);
    if (block.name === "discover_vendors") {
      indexVendors(output, vendorsByEndpoint);
      await logEvent(hub, runId, "discovery", `Surveyed ${vendorsByEndpoint.size} vendors.`);
      emit("discovery", `Surveyed ${vendorsByEndpoint.size} vendors in the market.`);
    }
    return { type: "tool_result", tool_use_id: block.id, content: output };
  } catch (err) {
    const text = err instanceof Error ? err.message : String(err);
    emit("error", `${block.name} failed: ${text}`);
    return { type: "tool_result", tool_use_id: block.id, content: text, is_error: true };
  }
}

/** Handles `pay_and_fetch`: budget gate, then settle, then record. */
async function handlePayment(
  ctx: ReasonContext,
  block: Anthropic.ToolUseBlock,
  args: Record<string, unknown>,
): Promise<Anthropic.ToolResultBlockParam> {
  const { hub, state, runId, vendorsByEndpoint, emit } = ctx;
  const endpoint = String(args.endpoint ?? "");
  const vendor = vendorsByEndpoint.get(endpoint);
  const price = vendor?.priceBaseUnits ?? (await quotePrice(hub, endpoint));

  if (!state.budget.canAfford(price)) {
    const refusal =
      `Payment refused. ${vendor?.name ?? endpoint} costs ${toUsdc(price)}, ` +
      `but only ${toUsdc(state.budget.remaining)} of the budget remains. ` +
      `Do not retry this purchase — answer with what you already know.`;
    emit("decision", refusal);
    return { type: "tool_result", tool_use_id: block.id, content: refusal, is_error: true };
  }

  const output = await hub.call("pay_and_fetch", args);
  const parsed = JSON.parse(output) as {
    amountBaseUnits: string;
    paidTo: string;
    settlement: { transaction: string };
  };
  const amount = Number(parsed.amountBaseUnits);
  state.budget.commit(amount);
  state.paidCalls += 1;

  await recordPayment(hub, {
    runId,
    vendorId: vendor?.id ?? "unknown",
    vendorName: vendor?.name ?? endpoint,
    endpoint,
    amountBaseUnits: amount,
    txHash: parsed.settlement.transaction,
    payTo: parsed.paidTo,
  });
  emit(
    "payment",
    `Paid ${vendor?.name ?? endpoint} ${toUsdc(amount)} — settled via Circle ` +
      `Gateway (ref ${parsed.settlement.transaction}).`,
  );
  return { type: "tool_result", tool_use_id: block.id, content: output };
}

/* --- helpers -------------------------------------------------------------- */

function openingPrompt(question: string, state: RunState): string {
  return [
    `Question: ${question}`,
    ``,
    `You have a budget of ${toUsdc(state.budget.total)} in USDC on Arc.`,
    `Survey the market with discover_vendors before buying anything, then buy`,
    `only what the question needs. Stop as soon as the answer is good enough.`,
  ].join("\n");
}

function indexVendors(output: string, into: Map<string, VendorInfo>): void {
  const parsed = JSON.parse(output) as {
    vendors?: { id: string; name: string; endpoint: string; priceBaseUnits: string }[];
  };
  for (const v of parsed.vendors ?? []) {
    into.set(v.endpoint, {
      id: v.id,
      name: v.name,
      priceBaseUnits: Number(v.priceBaseUnits),
    });
  }
}

const cheapestPrice = (vendors: Map<string, VendorInfo>): number | undefined => {
  const prices = [...vendors.values()].map((v) => v.priceBaseUnits);
  return prices.length ? Math.min(...prices) : undefined;
};

async function quotePrice(hub: McpHub, endpoint: string): Promise<number> {
  const output = await hub.call("get_quote", { endpoint });
  return Number((JSON.parse(output) as { priceBaseUnits: string }).priceBaseUnits);
}

const finalText = (content: Anthropic.ContentBlock[]): string =>
  content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim() || "Obol finished without a written answer.";

function makeEmitter(
  onEvent?: (event: AgentEvent) => void,
): (kind: AgentEvent["kind"], text: string) => void {
  return (kind, text) => onEvent?.({ kind, text, at: Date.now() });
}

/* --- ledger calls (orchestration, not exposed to the model) --------------- */

async function startRun(
  hub: McpHub,
  question: string,
  budgetBaseUnits: number,
  runId?: string,
): Promise<string> {
  const output = await hub.call("start_run", { question, budgetBaseUnits, runId });
  return (JSON.parse(output) as { runId: string }).runId;
}

const logEvent = (hub: McpHub, runId: string, kind: string, text: string): Promise<string> =>
  hub.call("log_event", { runId, kind, text });

/** The cheapest vendor costs $0.001; below this Obol can't buy anything. */
const PURSE_FLOOR_BASE_UNITS = 1000;

/**
 * Returns a message if Obol's Gateway balance is too low to fund any purchase,
 * or null when it's fine. Best-effort: a failed balance read returns null so a
 * transient RPC blip never blocks an otherwise-fundable run.
 */
async function purseTooLow(hub: McpHub): Promise<string | null> {
  try {
    const raw = await hub.call("wallet_balance", {});
    const available = Number(
      (JSON.parse(raw) as { gatewayAvailableBaseUnits?: string }).gatewayAvailableBaseUnits ?? "0",
    );
    if (Number.isFinite(available) && available < PURSE_FLOOR_BASE_UNITS) {
      return (
        "Obol's purse is empty — its Circle Gateway balance can't fund this run " +
        "right now. Please try again shortly."
      );
    }
    return null;
  } catch {
    return null;
  }
}

const recordPayment = (
  hub: McpHub,
  payment: Record<string, unknown>,
): Promise<string> => hub.call("record_payment", payment);

const finishRun = (
  hub: McpHub,
  runId: string,
  status: string,
  answer: string | null,
): Promise<string> => hub.call("finish_run", { runId, status, answer });
