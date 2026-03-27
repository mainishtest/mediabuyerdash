// app/api/governance/overrides/[overrideId]/route.ts
// DELETE — clear an active override by ID.

import { NextResponse }     from "next/server";
import { getServerSession } from "next-auth";
import { authOptions }      from "../../../../../lib/auth";
import { clearOverride }    from "../../../../../lib/governance";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: { overrideId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await clearOverride(params.overrideId, session.user.id);
  if (!result) {
    return NextResponse.json({ error: "Override not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, override: result });
}
