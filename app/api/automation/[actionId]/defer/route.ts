// app/api/automation/[actionId]/defer/route.ts
// POST — defer a proposed action and write a native audit entry.

import { NextResponse }              from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "../../../../../lib/auth";
import { prisma }                    from "../../../../../lib/db";
import { deferAction }               from "../../../../../lib/governance";
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

  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason) {
    return NextResponse.json({ error: "reason is required" }, { status: 400 });
  }

  const deferUntil =
    typeof body.deferUntil === "string" ? new Date(body.deferUntil) : undefined;

  // Load action before deferring so we can build the audit scope
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

  const result = await deferAction({
    actionId:    params.actionId,
    workspaceId,
    reason,
    appliedBy:   session.user.id,
    deferUntil,
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
      decision:   "deferred",
      decidedBy:  session.user.id,
      reason,
      routeType:  "standard_review",
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, ...result });
}
