export const dynamic = "force-dynamic";

import { getServerSession }       from "next-auth";
import { authOptions }            from "../../lib/auth";
import { prisma }                 from "../../lib/db";
import {
  buildProposedAutomationActions,
  upsertProposedActions,
  loadProposedActions,
  buildAutomationSummary,
} from "../../lib/automation";
import { AutomationView }         from "./AutomationView";

export async function generateMetadata() {
  return { title: "Automation — Media Buying Dashboard" };
}

export default async function AutomationPage() {
  const session     = await getServerSession(authOptions);
  const workspaceId = session?.user?.workspaceId ?? null;

  // Run all rule evaluation (including pacing rules) server-side on every
  // page load. Results are persisted so Operations can show top proposed
  // actions without re-running evaluation.
  try {
    const drafts = await buildProposedAutomationActions(workspaceId);
    await upsertProposedActions(drafts);
  } catch (err) {
    console.error("[automation/page] rule evaluation error:", err);
    // Continue — show existing persisted actions even if evaluation fails
  }

  // Load persisted actions + summary + client list for filter dropdown.
  const clientWhere = workspaceId ? { workspaceId } : {};
  const [actions, summary, clients] = await Promise.all([
    loadProposedActions(workspaceId).catch(() => []),
    buildAutomationSummary(workspaceId).catch(() => ({ proposedCount: 0, highPriorityCount: 0, approvedCount: 0, rejectedCount: 0, totalCount: 0 })),
    prisma.clientAccount.findMany({
      where:  clientWhere,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }).catch(() => []),
  ]);

  return (
    <AutomationView
      actions={actions}
      summary={summary}
      clients={clients}
    />
  );
}
