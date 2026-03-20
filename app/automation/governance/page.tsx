// app/automation/governance/page.tsx
// Server component — loads governance state and pending actions, renders GovernanceView.

import { redirect }          from "next/navigation";
import { getServerSession }  from "next-auth";
import { authOptions }       from "../../../lib/auth";
import { prisma }            from "../../../lib/db";
import {
  summarizeGovernanceControls,
} from "../../../lib/governance";
import { GovernanceView }    from "./GovernanceView";

export const dynamic = "force-dynamic";

export default async function GovernancePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const workspaceId = session.user.workspaceId ?? null;
  if (!workspaceId) redirect("/dashboard");

  // Load governance summary (stops + overrides + counts)
  const [governanceSummary, pendingActions, clients] = await Promise.all([
    summarizeGovernanceControls(workspaceId).catch(() => null),
    prisma.proposedAutomationAction.findMany({
      where: {
        workspaceId,
        status: { in: ["proposed", "deferred", "escalated"] },
      },
      orderBy: [
        // Escalated first, then deferred, then proposed; within each group by priority desc
        { status:    "asc" },
        { priority:  "desc" },
        { proposedAt: "asc" },
      ],
      take: 100,
      select: {
        id:              true,
        clientAccountId: true,
        clientName:      true,
        actionType:      true,
        status:          true,
        priority:        true,
        entityType:      true,
        entityId:        true,
        entityName:      true,
        rationale:       true,
        proposedAt:      true,
        expiresAt:       true,
        deferredUntil:   true,
        escalatedAt:     true,
        escalationNote:  true,
      },
    }).catch(() => []),
    // Load clients for scope labels in stop/override creation
    prisma.clientAccount.findMany({
      where:   { workspaceId },
      orderBy: { name: "asc" },
      select:  { id: true, name: true },
    }).catch(() => []),
  ]);

  if (!governanceSummary) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-500 text-sm">
        Governance data could not be loaded. Please try refreshing.
      </div>
    );
  }

  return (
    <GovernanceView
      workspaceId={workspaceId}
      summary={governanceSummary}
      pendingActions={pendingActions.map((a) => ({
        ...a,
        proposedAt:    a.proposedAt.toISOString(),
        expiresAt:     a.expiresAt?.toISOString()    ?? null,
        deferredUntil: a.deferredUntil?.toISOString() ?? null,
        escalatedAt:   a.escalatedAt?.toISOString()   ?? null,
        escalationNote: a.escalationNote              ?? null,
      }))}
      clients={clients}
    />
  );
}
