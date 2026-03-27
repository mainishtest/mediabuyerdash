// app/api/automation/[actionId]/reject/route.ts
// POST — reject a proposed automation action and write a native audit entry.

import { NextRequest, NextResponse }   from "next/server";
import { getServerSession }            from "next-auth";
import { authOptions }                 from "../../../../../lib/auth";
import { prisma }                      from "../../../../../lib/db";
import { rejectAutomationAction }      from "../../../../../lib/automation/persist";
import { recordAutomationApproval }    from "../../../../../lib/auditLog";

type Params = { params: { actionId: string } };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);

  try {
    let reason: string | undefined;
    try {
      const body = await req.json();
      reason = typeof body?.reason === "string" ? body.reason : undefined;
    } catch { /* body is optional */ }

    // Load action for audit scope
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

    await rejectAutomationAction(params.actionId, reason);

    if (action) {
      recordAutomationApproval({
        workspaceId:     action.workspaceId ?? null,
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
        decision:   "rejected",
        decidedBy:  session?.user?.id ?? null,
        reason:     reason ?? null,
        routeType:  "standard_review",
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[automation/reject]", err);
    return NextResponse.json(
      { error: "Failed to reject action" },
      { status: 500 }
    );
  }
}
