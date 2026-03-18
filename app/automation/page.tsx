export const dynamic = "force-dynamic";

import { getServerSession }       from "next-auth";
import { authOptions }            from "../../lib/auth";
import { prisma }                 from "../../lib/db";
import {
  loadDetectionInput,
  evaluateAutomationRules,
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

  // Run rule evaluation server-side on every page load.
  // Results are persisted so the Operations page can show top proposed
  // actions without re-running evaluation.
  const input   = await loadDetectionInput(workspaceId);
  const drafts  = evaluateAutomationRules(input);
  await upsertProposedActions(drafts);

  // Load persisted actions + summary + client list for filter dropdown.
  const clientWhere = workspaceId ? { workspaceId } : {};
  const [actions, summary, clients] = await Promise.all([
    loadProposedActions(workspaceId),
    buildAutomationSummary(workspaceId),
    prisma.clientAccount.findMany({
      where:  clientWhere,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <AutomationView
      actions={actions}
      summary={summary}
      clients={clients}
    />
  );
}
