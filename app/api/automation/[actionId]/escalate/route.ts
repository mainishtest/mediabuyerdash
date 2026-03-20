// app/api/automation/[actionId]/escalate/route.ts
// POST — escalate a proposed action to elevated review and write a native audit entry.

import { NextResponse }              from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "../../../../../lib/auth";
import { prisma }                    from "../../../../../lib/db";
import { escalateAction }            from "../../../../../lib/governance";
import { recordAutomationApproval }  from "../../../../../lib/auditLog";

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

  // Load action before escalating so we can build the audit scope
  const action = await prisma.proposedAutomationAction.findUnique({
    where:  { id: params.actionId },
    select: {
      workspaceId:     true,
      clientAccountId: true,
      clientName:      true,
      actionType:      true,
      entityType:      true,
      entityId:        true,
      entityName:      true,
    },
  });

  const result = await escalateAction({
    actionId:       params.actionId,
    workspaceId,
    escalationNote,
    appliedBy:      session.user.id,
  });

  if (action) {
    recordAutomationApproval({
      workspaceId:     workspaceId,
      clientAccountId: action.clientAccountId,
      clientName:      action.clientName,
      actionId:        params.actionId,
      actionType:      action.actionType,
      scope: {
        entityType: action.entityType as "campaign" | "client" | "ad_account" | "integration" | "workspace" | "action_type",
        entityId:   action.entityId,
        entityName: action.entityName,
        clientId:   action.clientAccountId,
        clientName: action.clientName ?? undefined,
      },
      decision:   "escalated",
      decidedBy:  session.user.id,
      reason:     escalationNote,
      routeType:  "elevated_review",
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, ...result });
}
