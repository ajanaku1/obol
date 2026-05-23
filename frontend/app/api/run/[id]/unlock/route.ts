import { NextResponse } from "next/server";
import { createPublicClient, decodeEventLog, erc20Abi, getAddress, http } from "viem";
import { ARC } from "@/lib/arc";
import { getRunSettlement, markRunPaid } from "@/lib/ledger";
import { priceBaseUnits } from "@/lib/pricing";
// Importing wallet.ts loads the repo-root .env as a side-effect (Next only
// auto-loads frontend/.env), so ARC_RPC_URL / OBOL_WALLET_ADDRESS resolve here.
import { getObolWallet } from "@/lib/wallet";

export const runtime = "nodejs";

const client = createPublicClient({
  transport: http(process.env.ARC_RPC_URL ?? ARC.rpcUrl),
});

/**
 * Confirms a tx is a USDC transfer of at least `minBaseUnits` to Obol's wallet.
 * The user pays cost + markup to unlock the answer; we verify it on Arc before
 * revealing anything.
 */
async function confirmsPayment(
  txHash: `0x${string}`,
  minBaseUnits: bigint,
  recipient: `0x${string}`,
): Promise<boolean> {
  const receipt = await client.getTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") return false;

  for (const log of receipt.logs) {
    if (getAddress(log.address) !== getAddress(ARC.usdc)) continue;
    try {
      const decoded = decodeEventLog({ abi: erc20Abi, data: log.data, topics: log.topics });
      if (
        decoded.eventName === "Transfer" &&
        getAddress(decoded.args.to) === getAddress(recipient) &&
        decoded.args.value >= minBaseUnits
      ) {
        return true;
      }
    } catch {
      // Not an ERC-20 Transfer log — skip it.
    }
  }
  return false;
}

/** POST /api/run/:id/unlock — verify the user's payment, then reveal the answer. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const wallet = await getObolWallet();
  if (!wallet) {
    return NextResponse.json({ error: "Obol wallet address is not configured." }, { status: 500 });
  }

  let body: { txHash?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const txHash = typeof body.txHash === "string" ? body.txHash.trim() : "";
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return NextResponse.json({ error: "A valid payment tx hash is required." }, { status: 400 });
  }

  const run = getRunSettlement(id);
  if (!run) return NextResponse.json({ error: "Unknown run." }, { status: 404 });
  if (run.paid) return NextResponse.json({ paid: true });
  if (run.totalSpentBaseUnits <= 0) {
    return NextResponse.json({ error: "This run has nothing to unlock." }, { status: 400 });
  }

  const price = BigInt(priceBaseUnits(run.totalSpentBaseUnits));
  let ok = false;
  try {
    ok = await confirmsPayment(txHash as `0x${string}`, price, wallet.address as `0x${string}`);
  } catch (err) {
    return NextResponse.json(
      { error: `Could not verify payment: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    );
  }

  if (!ok) {
    return NextResponse.json(
      { error: "That transaction does not settle the unlock price to Obol." },
      { status: 402 },
    );
  }

  markRunPaid(id, txHash);
  return NextResponse.json({ paid: true });
}
