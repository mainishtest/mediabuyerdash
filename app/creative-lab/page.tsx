// app/creative-lab/page.tsx
// Creative Lab — unified workflow page.
//
// Single page that shows:
//   1. All existing ads/creatives with performance data
//   2. Quick generate panel (copy tests, image variations, full refresh)
//   3. Review + launch flow
//
// Data flow:
//   1. Load performance snapshots from Meta sync + CRM reconciliation.
//   2. Convert to CreativeOverviewItem[] (simplified for the UI).
//   3. Pass to CreativeWorkflow client component.
//
// The old workflow queue view is preserved at /creative-lab/queue.
// The AI generator page is preserved at /creative-lab/generate.

export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions }      from "../../lib/auth";
import { prisma }           from "../../lib/db";
import { buildCreativeOverviewItems } from "../../lib/creativelab/overview";
import { loadSourceAssets }           from "../../lib/creativelab/sourceAsset";
import { CreativeWorkflow }           from "./CreativeWorkflow";

export const metadata = {
  title: "Creative Lab — Media Buying Dashboard",
};

type PageProps = {
  searchParams: { clientId?: string };
};

export default async function CreativeLabPage({ searchParams }: PageProps) {
  const session     = await getServerSession(authOptions);
  const workspaceId = session?.user?.workspaceId ?? null;

  const selectedClientId = searchParams?.clientId ?? null;

  const [clients, items, sourceAssets] = await Promise.all([
    prisma.clientAccount
      .findMany({
        select:  { id: true, name: true },
        orderBy: { name: "asc" },
        where:   workspaceId ? { workspaceId } : {},
      })
      .catch(() => []),
    buildCreativeOverviewItems(workspaceId).catch(() => []),
    loadSourceAssets(workspaceId).catch(() => []),
  ]);

  return (
    <CreativeWorkflow
      items={items}
      clients={clients}
      selectedClientId={selectedClientId}
      sourceAssets={sourceAssets}
    />
  );
}
