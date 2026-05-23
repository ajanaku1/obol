/**
 * Run Obol from the terminal.
 *
 *   npm run agent -- --question "What is Arc?" --budget 0.05
 */
import { runAgent } from "./loop.js";

interface Args {
  question: string;
  budget: number;
  runId?: string;
}

function parseArgs(argv: string[]): Args {
  let question = "";
  let budget = 0.05;
  let runId: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--question") question = argv[++i] ?? "";
    else if (argv[i] === "--budget") budget = Number(argv[++i]);
    else if (argv[i] === "--run-id") runId = argv[++i];
  }
  if (!question) {
    console.error('Usage: npm run agent -- --question "..." --budget 0.05');
    process.exit(1);
  }
  if (!Number.isFinite(budget) || budget <= 0) {
    console.error("Budget must be a positive number of USDC.");
    process.exit(1);
  }
  return { question, budget, runId };
}

const ICON: Record<string, string> = {
  status: "·", discovery: "◇", decision: "→", payment: "$", error: "!", answer: "✓",
};

async function main(): Promise<void> {
  const { question, budget, runId } = parseArgs(process.argv.slice(2));
  console.log(`\nObol — "${question}"  (budget $${budget.toFixed(4)})\n`);

  const result = await runAgent({
    question,
    budgetUsdc: budget,
    runId,
    onEvent: (e) => console.log(`  ${ICON[e.kind] ?? "·"} ${e.text}`),
  });

  console.log(`\n${"-".repeat(60)}`);
  console.log(`Status:   ${result.status}`);
  console.log(`Spent:    ${result.spentUsdc} across ${result.paymentCount} payment(s)`);
  console.log(`Run:      ${result.runId}\n`);
}

main().catch((err) => {
  console.error("Obol crashed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
