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

// Meta DPA ads use template variables like {{product.name}} in names/copy.
// These aren't real copy — resolve them to a readable fallback.
function isTemplateVar(str: string | null | undefined): boolean {
  return str != null && str.includes("{{");
}

function cleanDpaName(name: string, creativeId: string): string {
  if (!isTemplateVar(name)) return name;
  // Strip template vars, keep any surrounding text
  const cleaned = name.replace(/\{\{[^}]+\}\}/g, "").trim();
  if (cleaned.length > 5) return cleaned;
  // Fallback: use last 8 chars of creative ID
  return `Creative ${creativeId.slice(-8)}`;
}

function snapshotToOverviewItem(s: CreativePerformanceSnapshot): CreativeOverviewItem {
  const status = s.evaluationStatus as CreativeHealthStatus;
  const isDpa  = isTemplateVar(s.creativeName) || isTemplateVar(s.adCopy);

  // Clean up DPA template variables in display name
  const creativeName = s.creativeName ? cleanDpaName(s.creativeName, s.externalCreativeId) : `Creative ${s.externalCreativeId.slice(-8)}`;
  // Use real copy for generation; skip template vars
  const adCopy = isDpa && isTemplateVar(s.adCopy) ? null : s.adCopy;

  return {
    id: `co_${s.clientAccountId}_${s.externalCreativeId}_${s.externalCampaignId}`,

    externalCreativeId: s.externalCreativeId,
    externalCampaignId: s.externalCampaignId,
    clientAccountId:    s.clientAccountId,
    clientName:         s.clientName,
    creativeName,
    campaignName:       s.campaignName,

    thumbnailUrl: s.thumbnailUrl,
    imageUrl:     s.imageUrl,

    adCopy,
    callToAction: s.callToAction,

    spend:       s.spend,
    impressions: s.impressions,
    clicks:      s.clicks,
    ctr:         s.avgCtr,
    frequency:   s.avgFrequency,
    roas:        s.campaignRoas,
    cpa:         s.campaignCpa,

    status,
    statusLabel: isDpa ? `${STATUS_LABELS[status]} (DPA)` : STATUS_LABELS[status],

    canGenerateCopy:  adCopy != null && adCopy.length > 0,
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
