// lib/experimentLaunch/mapping.ts
// Builds CreativeExperimentMapping from campaign/ad set inputs.
// All functions are pure — no DB access.

import type { CreativeExperimentMapping } from "../../types/experimentLaunch";

// ---------------------------------------------------------------------------
// Build the campaign and ad set mapping for the experiment
// ---------------------------------------------------------------------------

export function buildCreativeExperimentMapping(opts: {
  clientAccountId:          string;
  externalAdAccountId?:     string | null;
  targetCampaignId?:        string | null;
  targetCampaignName?:      string | null;
  targetCampaignExternalId?: string | null;
  targetAdSetId?:           string | null;
  targetAdSetName?:         string | null;
  targetAdSetExternalId?:   string | null;
  comparisonMode?:          "simultaneous" | "sequential";
}): CreativeExperimentMapping {
  return {
    clientAccountId:     opts.clientAccountId,
    externalAdAccountId: opts.externalAdAccountId ?? null,
    campaignId:          opts.targetCampaignId    ?? null,
    campaignName:        opts.targetCampaignName  ?? null,
    campaignExternalId:  opts.targetCampaignExternalId ?? null,
    adSetId:             opts.targetAdSetId    ?? null,
    adSetName:           opts.targetAdSetName  ?? null,
    adSetExternalId:     opts.targetAdSetExternalId ?? null,
    comparisonMode:      opts.comparisonMode ?? "simultaneous",
  };
}

// ---------------------------------------------------------------------------
// Check if a mapping has the minimum fields to support launch
// ---------------------------------------------------------------------------

export function isMappingComplete(mapping: CreativeExperimentMapping): boolean {
  const hasCampaign = !!(mapping.campaignId || mapping.campaignExternalId);
  const hasAdSet    = !!(mapping.adSetId    || mapping.adSetExternalId);
  return hasCampaign && hasAdSet;
}

// ---------------------------------------------------------------------------
// Summarise which mapping fields are missing
// ---------------------------------------------------------------------------

export function getMappingBlockers(mapping: CreativeExperimentMapping): string[] {
  const blockers: string[] = [];
  if (!mapping.campaignId && !mapping.campaignExternalId) {
    blockers.push("Target campaign not mapped");
  }
  if (!mapping.adSetId && !mapping.adSetExternalId) {
    blockers.push("Target ad set not mapped");
  }
  return blockers;
}
