export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions }      from "../../../lib/auth";
import { ImageVariationView } from "./ImageVariationView";
import {
  loadCreativePerformanceData,
  buildCreativePerformanceSnapshots,
} from "../../../lib/creativelab/performance";
import { getImageVariationHistory } from "../../../lib/imageVariation";

export const metadata: Metadata = {
  title: "Image Variations — Creative Lab",
};

export default async function ImageVariationsPage() {
  const session     = await getServerSession(authOptions);
  const workspaceId = session?.user?.workspaceId ?? null;

  // Load creative snapshots for the selector
  const perfData = await loadCreativePerformanceData(workspaceId).catch(() => null);
  const snapshots = perfData ? buildCreativePerformanceSnapshots(perfData) : [];

  const creatives = snapshots.map((s) => ({
    externalCreativeId: s.externalCreativeId,
    creativeName:       s.creativeName,
    thumbnailUrl:       s.thumbnailUrl,
    campaignName:       s.campaignName,
    clientAccountId:    s.clientAccountId,
    clientName:         s.clientName,
    avgCtr:             s.avgCtr,
    avgFrequency:       s.avgFrequency,
    campaignRoas:       s.campaignRoas,
    evaluationStatus:   s.evaluationStatus,
    spend:              s.spend,
  }));

  // Load recent history
  const history = await getImageVariationHistory({ limit: 5 }).catch(() => []);

  return (
    <ImageVariationView
      creatives={creatives}
      recentHistory={history.map((h) => ({
        ...h,
        createdAt: h.createdAt.toISOString(),
      }))}
    />
  );
}
