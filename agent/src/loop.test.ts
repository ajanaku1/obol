/**
 * End-to-end integration test for the agent loop.
 *
 * Drives runAgent() through a scripted Anthropic message sequence and a fake
 * McpHub. Asserts the loop respects the contract:
 *   - discovery happens before any purchase
 *   - the budget gate refuses over-budget pay_and_fetch calls
 *   - every successful payment is recorded via record_payment
 *   - the run terminates with answered status, the right tx count, and the
 *     final assistant text as the answer
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ScriptedTurn =
  | { kind: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { kind: "text"; text: string };

const messagesCreate = vi.fn();
const hubCall = vi.fn();
const hubConnect = vi.fn();
const hubClose = vi.fn();
const hubAnthropicTools = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  class Anthropic {
    messages = { create: messagesCreate };
  }
  return { default: Anthropic };
});

vi.mock("./mcpClient.js", () => {
  class McpHub {
    connect = hubConnect;
    call = hubCall;
    close = hubClose;
    anthropicTools = hubAnthropicTools;
  }
  return { McpHub };
});

const tool = (id: string, name: string, input: Record<string, unknown>) => ({
  type: "tool_use" as const,
  id,
  name,
  input,
});
const text = (s: string) => ({ type: "text" as const, text: s });

function scriptResponse(turn: ScriptedTurn[]): {
  content: unknown[];
  stop_reason: "tool_use" | "end_turn";
} {
  const content = turn.map((t) =>
    t.kind === "tool_use" ? tool(t.id, t.name, t.input) : text(t.text),
  );
  const stop_reason = turn.some((t) => t.kind === "tool_use") ? "tool_use" : "end_turn";
  return { content, stop_reason };
}

describe("runAgent end-to-end", () => {
  beforeEach(() => {
    messagesCreate.mockReset();
    hubCall.mockReset();
    hubConnect.mockReset();
    hubClose.mockReset();
    hubAnthropicTools.mockReset();

    hubConnect.mockResolvedValue(undefined);
    hubClose.mockResolvedValue(undefined);
    hubAnthropicTools.mockReturnValue([
      { name: "discover_vendors", description: "", input_schema: { type: "object" } },
      { name: "pay_and_fetch", description: "", input_schema: { type: "object" } },
      { name: "get_quote", description: "", input_schema: { type: "object" } },
      { name: "wallet_balance", description: "", input_schema: { type: "object" } },
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("discovers, pays within budget, records, and returns answered", async () => {
    // Hub responses are dispatched by tool name with light scripting on top.
    const recordPaymentCalls: unknown[] = [];
    const finishRunCalls: unknown[] = [];
    hubCall.mockImplementation(async (name: string, args: Record<string, unknown>) => {
      if (name === "start_run") return JSON.stringify({ runId: "run-1" });
      if (name === "log_event") return "{}";
      if (name === "discover_vendors") {
        return JSON.stringify({
          vendors: [
            {
              id: "filings-desk",
              name: "Filings Desk",
              endpoint: "http://localhost:4020/vendor/filings-desk",
              priceBaseUnits: "8000",
            },
          ],
        });
      }
      if (name === "pay_and_fetch") {
        return JSON.stringify({
          amountBaseUnits: "8000",
          paidTo: "0xVendor",
          settlement: { transaction: "0xTX1" },
          data: { ok: true },
        });
      }
      if (name === "record_payment") {
        recordPaymentCalls.push(args);
        return "{}";
      }
      if (name === "finish_run") {
        finishRunCalls.push(args);
        return "{}";
      }
      throw new Error(`Unexpected tool: ${name}`);
    });

    messagesCreate
      .mockResolvedValueOnce(
        scriptResponse([{ kind: "tool_use", id: "t1", name: "discover_vendors", input: {} }]),
      )
      .mockResolvedValueOnce(
        scriptResponse([
          {
            kind: "tool_use",
            id: "t2",
            name: "pay_and_fetch",
            input: { endpoint: "http://localhost:4020/vendor/filings-desk" },
          },
        ]),
      )
      .mockResolvedValueOnce(
        scriptResponse([{ kind: "text", text: "Filings show X." }]),
      );

    const { runAgent } = await import("./loop.js");
    const result = await runAgent({ question: "What did Circle file?", budgetUsdc: 0.02 });

    expect(result.status).toBe("answered");
    expect(result.answer).toBe("Filings show X.");
    expect(result.paymentCount).toBe(1);
    expect(result.spentUsdc).toBe("$0.008000");
    expect(recordPaymentCalls).toHaveLength(1);
    expect((recordPaymentCalls[0] as { txHash: string }).txHash).toBe("0xTX1");

    // Discovery before any payment.
    const callOrder = hubCall.mock.calls.map((c) => c[0]);
    const discoverAt = callOrder.indexOf("discover_vendors");
    const payAt = callOrder.indexOf("pay_and_fetch");
    expect(discoverAt).toBeGreaterThanOrEqual(0);
    expect(payAt).toBeGreaterThan(discoverAt);

    // Final finalize was called with answered status.
    expect((finishRunCalls[0] as { status: string }).status).toBe("answered");
  });

  it("refuses an over-budget pay_and_fetch via the budget gate", async () => {
    hubCall.mockImplementation(async (name: string) => {
      if (name === "start_run") return JSON.stringify({ runId: "run-2" });
      if (name === "log_event") return "{}";
      if (name === "finish_run") return "{}";
      if (name === "discover_vendors") {
        return JSON.stringify({
          vendors: [
            {
              id: "filings-desk",
              name: "Filings Desk",
              endpoint: "http://localhost:4020/vendor/filings-desk",
              priceBaseUnits: "8000",
            },
          ],
        });
      }
      // pay_and_fetch should never be reached — the gate refuses first.
      if (name === "pay_and_fetch") throw new Error("payment must not be settled");
      return "{}";
    });

    messagesCreate
      .mockResolvedValueOnce(
        scriptResponse([{ kind: "tool_use", id: "t1", name: "discover_vendors", input: {} }]),
      )
      .mockResolvedValueOnce(
        scriptResponse([
          {
            kind: "tool_use",
            id: "t2",
            name: "pay_and_fetch",
            input: { endpoint: "http://localhost:4020/vendor/filings-desk" },
          },
        ]),
      )
      .mockResolvedValueOnce(scriptResponse([{ kind: "text", text: "Could not afford." }]));

    const { runAgent } = await import("./loop.js");
    // $0.005 budget < $0.008 vendor price.
    const result = await runAgent({ question: "anything", budgetUsdc: 0.005 });

    expect(result.paymentCount).toBe(0);
    expect(result.spentUsdc).toBe("$0.000000");
    // pay_and_fetch was never actually dispatched to the hub.
    expect(hubCall.mock.calls.map((c) => c[0])).not.toContain("pay_and_fetch");
  });
});
