import { NextRequest, NextResponse }  from "next/server";
import { rejectAutomationAction }     from "../../../../../lib/automation/persist";

type Params = { params: { actionId: string } };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    let reason: string | undefined;
    try {
      const body = await req.json();
      reason = typeof body?.reason === "string" ? body.reason : undefined;
    } catch { /* body is optional */ }

    await rejectAutomationAction(params.actionId, reason);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[automation/reject]", err);
    return NextResponse.json(
      { error: "Failed to reject action" },
      { status: 500 }
    );
  }
}
