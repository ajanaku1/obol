import { NextResponse } from "next/server";
import { getWorkView } from "@/lib/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/run/:id — the live work view for a run. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const view = getWorkView(id);

  if (!view) {
    // The run was accepted but the agent has not written its first record yet.
    return NextResponse.json({ status: "starting" }, { status: 202 });
  }
  return NextResponse.json(view);
}
