// app/api/automation/[actionId]/defer/route.ts
// POST — defer a proposed action. Sets status="deferred" and creates an override record.

import { NextResponse }     from "next/server";
import { getServerSession } from "next-auth";
import { authOptions }      from "../../../../../lib/auth";
import { deferAction }      from "../../../../../lib/governance";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { actionId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = session.user.workspaceId ?? null;
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace found" }, { status: 400 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch { /* empty body is ok */ }

  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason) {
    return NextResponse.json({ error: "reason is required" }, { status: 400 });
  }

  const deferUntil =
    typeof body.deferUntil === "string" ? new Date(body.deferUntil) : undefined;

  const result = await deferAction({
    actionId:    params.actionId,
    workspaceId,
    reason,
    appliedBy:   session.user.id,
    deferUntil,
  });

  return NextResponse.json({ ok: true, ...result });
}
