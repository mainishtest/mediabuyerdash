// app/creative-lab/refresh-queue/page.tsx
// Creative Refresh Queue — server-side data loading.
//
// Data flow:
//   1. Load creative performance snapshots from Meta sync + CRM reconciliation.
//   2. Run buildCreativeRefreshQueue() → merges evaluation + fatigue detection.
//   3. Pass sorted, prioritised queue to RefreshQueueView.
//
// No generation or publishing happens here — this is a review and triage surface.

export const dynamic = "force-dynamic";

import { getServerSession }                  from "next-auth";
import { authOptions }                       from "../../../lib/auth";
import { prisma }                            from "../../../lib/db";
import {
  loadCreativePerformanceData,
  buildCreativePerformanceSnapshots,
}                                            from "../../../lib/creativelab/performance";
import { buildCreativeRefreshQueue }         from "../../../lib/creativeRefreshQueue/queue";
import { RefreshQueueView }                  from "./RefreshQueueView";

export const metadata = {
  title: "Creative Refresh Queue — Creative Lab",
};

type PageProps = {
  searchParams: { clientId?: string };
};

export default async function RefreshQueuePage({ searchParams }: PageProps) {
  const session     = await getServerSession(authOptions);
  const workspaceId = session?.user?.workspaceId ?? null;

  const selectedClientId = searchParams?.clientId ?? null;

  // Load clients for filter selector
  const clients = await prisma.clientAccount
    .findMany({
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
      where:   workspaceId ? { workspaceId } : {},
    })
    .catch(() => []);

  // Load performance snapshots — same pipeline as Creative Lab and Fatigue pages
  const perfData  = await loadCreativePerformanceData(workspaceId).catch(() => null);
  const snapshots = perfData ? buildCreativePerformanceSnapshots(perfData) : [];

  // Build the prioritised refresh queue
  // detectCreativeFatigue() is called internally per snapshot — no duplication
  const queueItems = buildCreativeRefreshQueue(snapshots, { includeMonitorOnly: true });

  return (
    <RefreshQueueView
      clients={clients}
      initialItems={queueItems}
      selectedClientId={selectedClientId}
    />
  );
}
