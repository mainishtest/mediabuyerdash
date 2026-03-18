import { NextRequest, NextResponse } from "next/server";
import { acknowledgeAlert }          from "../../../../../lib/alerts/persist";

type Params = { params: { alertId: string } };

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    await acknowledgeAlert(params.alertId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[alerts/acknowledge]", err);
    return NextResponse.json({ error: "Failed to acknowledge alert" }, { status: 500 });
  }
}
