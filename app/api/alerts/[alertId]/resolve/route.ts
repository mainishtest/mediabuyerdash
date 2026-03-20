import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "../../../../../lib/auth";
import { resolveAlert }              from "../../../../../lib/alerts/persist";

type Params = { params: { alertId: string } };

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await resolveAlert(params.alertId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[alerts/resolve]", err);
    return NextResponse.json({ error: "Failed to resolve alert" }, { status: 500 });
  }
}
