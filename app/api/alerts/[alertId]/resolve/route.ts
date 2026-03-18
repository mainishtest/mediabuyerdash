import { NextRequest, NextResponse } from "next/server";
import { resolveAlert }              from "../../../../../lib/alerts/persist";

type Params = { params: { alertId: string } };

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    await resolveAlert(params.alertId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[alerts/resolve]", err);
    return NextResponse.json({ error: "Failed to resolve alert" }, { status: 500 });
  }
}
