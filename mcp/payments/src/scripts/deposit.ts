/**
 * Deposit USDC from Obol's wallet into its Circle Gateway balance.
 *
 *   npm run gateway:deposit -- 2.00
 *
 * Gateway holds the deposited USDC and draws from it for each nanopayment, so
 * Obol must have a Gateway balance before it can pay any vendor.
 */
import { depositToGateway, gatewayBalances } from "../gateway.js";

const amount = process.argv[2] ?? "1.00";

async function main(): Promise<void> {
  console.log(`Depositing ${amount} USDC into Circle Gateway...`);
  const result = await depositToGateway(amount);
  console.log(`Deposit submitted: ${result.depositTxHash}`);

  const balances = await gatewayBalances();
  console.log(`Gateway available: ${balances.gatewayAvailableUsdc} USDC`);
  console.log(`Wallet balance:    ${balances.walletUsdc} USDC`);
}

main().catch((err) => {
  console.error("Deposit failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
