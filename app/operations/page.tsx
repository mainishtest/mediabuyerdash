export const dynamic = "force-dynamic";

import { getServerSession }        from "next-auth";
import { authOptions }             from "../../lib/auth";
import { buildOperationsSnapshot } from "../../lib/operations/aggregator";
import { loadTopOpenAlerts }       from "../../lib/alerts/persist";
import { loadTopProposedActions }  from "../../lib/automation/persist";
import { OperationsView }          from "./OperationsView";

export async function generateMetadata() {
  return { title: "Operations — Media Buying Dashboard" };
}

export default async function OperationsPage() {
  const session     = await getServerSession(authOptions);
  const workspaceId = session?.user?.workspaceId ?? null;

  const [snapshot, topAlerts, topProposedActions] = await Promise.all([
    buildOperationsSnapshot(workspaceId),
    loadTopOpenAlerts(workspaceId, 5),
    loadTopProposedActions(workspaceId, 5),
  ]);

  return (
    <OperationsView
      snapshot={snapshot}
      topAlerts={topAlerts}
      topProposedActions={topProposedActions}
    />
  );
}
