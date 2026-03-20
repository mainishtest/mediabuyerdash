// app/api/automation/[actionId]/approve/route.ts
// POST — approve a proposed automation action and write a native audit entry.

import { NextRequest, NextResponse }   from "next/server";
import { getServerSession }            from "next-auth";
import { authOptions }                 from "../../../../../lib/auth";
import { prisma }                      from "../../../../../lib/db";
import { approveAutomationAction }     from "../../../../../lib/automation/persist";
import { recordAutomationApproval }    from "../../../../../lib/auditLog";

type Params = { params: { actionId: string } };

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Load the action to get scope + client info for the audit entry
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

    await approveAutomationAction(params.actionId);

    // Write audit entry — fire-and-forget; approval must not be blocked by audit failure
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
        decision:   "approved",
        decidedBy:  session?.user?.id ?? null,
        reason:     null,
        routeType:  "standard_review",
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[automation/approve]", err);
    return NextResponse.json(
      { error: "Failed to approve action" },
      { status: 500 }
    );
  }
}
