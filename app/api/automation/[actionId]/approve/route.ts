import { NextRequest, NextResponse }   from "next/server";
import { approveAutomationAction }     from "../../../../../lib/automation/persist";

type Params = { params: { actionId: string } };

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    await approveAutomationAction(params.actionId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[automation/approve]", err);
    return NextResponse.json(
      { error: "Failed to approve action" },
      { status: 500 }
    );
  }
}
