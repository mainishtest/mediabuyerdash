// app/creative-lab/creative-engine/page.tsx
// Performance-Driven AI Creative Engine page.
//
// Data flow:
//   1. Load session and clients.
//   2. Load creative performance snapshots from the evaluation pipeline.
//   3. Pass snapshots to CreativeEngineView (client-side generation UI).
//
// The engine generates creative concepts via POST /api/creative-lab/creative-engine,
// which builds enriched context from performance signals and learning memory
// before invoking the Anthropic generation engine (or structured mock).

export const dynamic = "force-dynamic";

import { getServerSession }                           from "next-auth";
import { authOptions }                                from "../../../lib/auth";
import { prisma }                                     from "../../../lib/db";
import {
  loadCreativePerformanceData,
  buildCreativePerformanceSnapshots,
}                                                     from "../../../lib/creativelab/performance";
import { CreativeEngineView }                         from "./CreativeEngineView";

export const metadata = {
  title: "Creative Engine — Media Buying Dashboard",
};

type PageProps = {
  searchParams: { clientId?: string; creativeId?: string; campaignId?: string };
};

export default async function CreativeEnginePage({ searchParams }: PageProps) {
  const session      = await getServerSession(authOptions);
  const workspaceId  = session?.user?.workspaceId ?? null;
  const selectedClientId  = searchParams?.clientId  ?? null;
  const initialCreativeId = searchParams?.creativeId ?? null;
  const initialCampaignId = searchParams?.campaignId ?? null;

  // Load clients for selector
  const clients = await prisma.clientAccount
    .findMany({
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
      where:   workspaceId ? { workspaceId } : {},
    })
    .catch(() => []);

  // Load performance snapshots — same pipeline as Creative Lab workflow
  const perfData  = await loadCreativePerformanceData(workspaceId).catch(() => null);
  const snapshots = perfData
    ? buildCreativePerformanceSnapshots(perfData).filter(
        (s) => s.evaluationStatus !== "insufficient_data",
      )
    : [];

  return (
    <CreativeEngineView
      clients={clients}
      snapshots={snapshots}
      selectedClientId={selectedClientId}
      initialCreativeId={initialCreativeId}
      initialCampaignId={initialCampaignId}
    />
  );
}
