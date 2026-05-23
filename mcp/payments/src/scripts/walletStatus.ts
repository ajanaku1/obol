/**
 * Reports Obol's wallet balance on Arc testnet.
 *
 *   npm run wallet:status
 */
import { formatUnits } from "viem";
import { erc20Abi } from "viem";
import { publicClient, obolAccount, usdcAddress } from "../arc.js";

async function main(): Promise<void> {
  const account = obolAccount();
  console.log(`Obol wallet: ${account.address}`);

  const nativeBalance = await publicClient.getBalance({ address: account.address });
  console.log(`  Native (gas): ${formatUnits(nativeBalance, 18)} USDC`);

  try {
    const tokenBalance = await publicClient.readContract({
      address: usdcAddress(),
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account.address],
    });
    console.log(`  USDC (ERC-20): ${formatUnits(tokenBalance, 6)} USDC`);
  } catch {
    console.log("  USDC (ERC-20): unavailable — set ARC_USDC_ADDRESS in .env");
  }

  console.log(`  Explorer: https://testnet.arcscan.app/address/${account.address}`);
}

main().catch((err) => {
  console.error("Failed to read wallet status:", err instanceof Error ? err.message : err);
  process.exit(1);
});
