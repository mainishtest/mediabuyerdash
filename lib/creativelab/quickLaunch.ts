// lib/creativelab/quickLaunch.ts
// Prefills a QuickLaunchDraft from a selected creative and variant.
// Pure function — no DB or API calls.

import type { QuickLaunchDraft } from "../../types/creativeWorkflow";
import type { CreativeOverviewItem } from "../../types/creativeWorkflow";

export function buildQuickLaunchDraft(opts: {
  item: CreativeOverviewItem;
  challengerVariantId: string;
  challengerTitle: string;
  challengerType: "copy" | "image_brief" | "combined";
}): QuickLaunchDraft {
  const { item, challengerVariantId, challengerTitle, challengerType } = opts;

  return {
    overviewItemId:      item.id,
    controlCreativeId:   item.externalCreativeId,
    challengerVariantId,
    challengerTitle,
    challengerType,
    clientAccountId:     item.clientAccountId,
    campaignId:          item.externalCampaignId,
    suggestedName:       `Test: ${challengerTitle} vs ${item.creativeName ?? "Control"}`,
    primaryMetric:       item.roas != null ? "roas" : "cpa",
    evaluationWindowDays: 7,
  };
}
