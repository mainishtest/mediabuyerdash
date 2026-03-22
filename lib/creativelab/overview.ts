// lib/creativelab/overview.ts
// Builds CreativeOverviewItem[] from real synced Meta data.
//
// Reuses the existing performance snapshot pipeline and adds
// the fields the simplified Creative page needs.

import {
  loadCreativePerformanceData,
  buildCreativePerformanceSnapshots,
} from "./performance";
import type { CreativePerformanceSnapshot } from "./types";
import type {
  CreativeOverviewItem,
  CreativeHealthStatus,
} from "../../types/creativeWorkflow";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function buildCreativeOverviewItems(
  workspaceId: string | null
): Promise<CreativeOverviewItem[]> {
  const perfData = await loadCreativePerformanceData(workspaceId);
  const snapshots = buildCreativePerformanceSnapshots(perfData);

  return snapshots.map(snapshotToOverviewItem);
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

function snapshotToOverviewItem(s: CreativePerformanceSnapshot): CreativeOverviewItem {
  const status = s.evaluationStatus as CreativeHealthStatus;

  return {
    id: `co_${s.clientAccountId}_${s.externalCreativeId}_${s.externalCampaignId}`,

    externalCreativeId: s.externalCreativeId,
    externalCampaignId: s.externalCampaignId,
    clientAccountId:    s.clientAccountId,
    clientName:         s.clientName,
    creativeName:       s.creativeName,
    campaignName:       s.campaignName,

    thumbnailUrl: s.thumbnailUrl,
    imageUrl:     s.imageUrl,

    adCopy:       s.adCopy,
    callToAction: s.callToAction,

    spend:       s.spend,
    impressions: s.impressions,
    clicks:      s.clicks,
    ctr:         s.avgCtr,
    frequency:   s.avgFrequency,
    roas:        s.campaignRoas,
    cpa:         s.campaignCpa,

    status,
    statusLabel: STATUS_LABELS[status],

    canGenerateCopy:  s.adCopy != null && s.adCopy.length > 0,
    canGenerateImage: s.imageUrl != null || s.thumbnailUrl != null,
    canLaunchTest:    s.spend >= 50, // need baseline performance to test against
  };
}

const STATUS_LABELS: Record<CreativeHealthStatus, string> = {
  strong:            "Strong — Scale",
  average:           "Average — Monitor",
  weak:              "Weak — Iterate",
  fatigued:          "Fatigued — Replace",
  insufficient_data: "Low Data",
};
