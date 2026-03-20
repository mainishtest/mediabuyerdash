export const dynamic = "force-dynamic";

import { getServerSession }        from "next-auth";
import { authOptions }             from "../../lib/auth";
import { buildOperationsSnapshot } from "../../lib/operations/aggregator";
import { loadTopOpenAlerts }       from "../../lib/alerts/persist";
import { loadTopProposedActions }  from "../../lib/automation/persist";
import { loadTopPacingRisks }      from "../../lib/budgetPacing/service";
import { OperationsView }          from "./OperationsView";

export async function generateMetadata() {
  return { title: "Operations — Media Buying Dashboard" };
}

export default async function OperationsPage() {
  const session     = await getServerSession(authOptions);
  const workspaceId = session?.user?.workspaceId ?? null;

  const [snapshot, topAlerts, topProposedActions, topPacingRisks] = await Promise.all([
    buildOperationsSnapshot(workspaceId).catch(() => null),
    loadTopOpenAlerts(workspaceId, 5).catch(() => []),
    loadTopProposedActions(workspaceId, 5).catch(() => []),
    loadTopPacingRisks(workspaceId, 5).catch(() => []),
  ]);

  if (!snapshot) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-500 text-sm">
        Operations data could not be loaded. Please try refreshing.
      </div>
    );
  }

  return (
    <OperationsView
      snapshot={snapshot}
      topAlerts={topAlerts}
      topProposedActions={topProposedActions}
      topPacingRisks={topPacingRisks}
    />
  );
}
