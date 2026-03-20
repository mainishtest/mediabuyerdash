// app/api/governance/stops/[stopId]/route.ts
// DELETE — clear an active emergency stop by ID.

import { NextResponse }     from "next/server";
import { getServerSession } from "next-auth";
import { authOptions }      from "../../../../../lib/auth";
import { clearEmergencyStop } from "../../../../../lib/governance";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: { stopId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await clearEmergencyStop(params.stopId, session.user.id);
  if (!result) {
    return NextResponse.json({ error: "Stop not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, stop: result });
}
