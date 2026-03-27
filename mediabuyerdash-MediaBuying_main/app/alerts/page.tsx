export const dynamic = "force-dynamic";
// app/alerts/page.tsx
// Runs anomaly detection on load, upserts results, then renders the alerts view.

import { getServerSession }      from "next-auth";
import { authOptions }           from "../../lib/auth";
import { loadDetectionInput, runAllDetectors } from "../../lib/alerts/detectors";
import { upsertAlerts, loadAlerts }            from "../../lib/alerts/persist";
import { buildAlertSummary }                   from "../../lib/alerts/summary";
import { prisma }                              from "../../lib/db";
import { AlertsView }                          from "./AlertsView";

export async function generateMetadata() {
  return { title: "Alerts — Media Buying Dashboard" };
}

export default async function AlertsPage() {
  const session     = await getServerSession(authOptions);
  const workspaceId = session?.user?.workspaceId ?? null;

  // Run detection and upsert (server-side, every page load)
  try {
    const input  = await loadDetectionInput(workspaceId);
    const drafts = runAllDetectors(input);
    await upsertAlerts(drafts);
  } catch (err) {
    console.error("[alerts/page] detection error:", err);
    // Continue to show existing persisted alerts even if detection fails
  }

  // Load all alerts for display
  const alerts  = await loadAlerts(workspaceId);
  const summary = buildAlertSummary(alerts);

  // Load client list for the filter dropdown
  const clientWhere = workspaceId ? { workspaceId } : {};
  const clients = await prisma.clientAccount.findMany({
    where:   clientWhere,
    select:  { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <AlertsView
      alerts={alerts}
      summary={summary}
      clients={clients}
    />
  );
}
