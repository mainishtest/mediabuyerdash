// app/api/automation/[actionId]/escalate/route.ts
// POST — escalate a proposed action to elevated review.

import { NextResponse }     from "next/server";
import { getServerSession } from "next-auth";
import { authOptions }      from "../../../../../lib/auth";
import { escalateAction }   from "../../../../../lib/governance";

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

  const escalationNote = typeof body.escalationNote === "string"
    ? body.escalationNote.trim()
    : "";
  if (!escalationNote) {
    return NextResponse.json({ error: "escalationNote is required" }, { status: 400 });
  }

  const result = await escalateAction({
    actionId:       params.actionId,
    workspaceId,
    escalationNote,
    appliedBy:      session.user.id,
  });

  return NextResponse.json({ ok: true, ...result });
}
