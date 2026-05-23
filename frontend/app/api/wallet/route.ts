import { NextResponse } from "next/server";
import { getObolWallet } from "@/lib/wallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/wallet — Obol's own wallet address and live USDC balance on Arc. */
export async function GET(): Promise<NextResponse> {
  const wallet = await getObolWallet();
  if (!wallet) {
    return NextResponse.json({ error: "Obol has no wallet configured." }, { status: 503 });
  }
  return NextResponse.json(wallet);
}
