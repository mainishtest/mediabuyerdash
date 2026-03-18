// lib/optimization/realDataService.ts
// Loads real data from the DB for the goal-aware optimization layer.
//
// Data sources:
//   ReconciliationMatch  → RawPerformanceInput[] (spend + CRM outcomes)
//   MetaSyncedCampaign   → Campaign[]            (entity hierarchy)
//   MetaSyncedAdSet      → AdSet[]
//   MetaSyncedAd         → Ad[]
//   MetaCampaignGoal     → goal values injected into Campaign[]
//
// Architecture note:
//   The optimization evaluators (evaluateCampaignsFromReconciledMetrics etc.)
//   consume the Campaign/AdSet/Ad types from types/media.ts. For real data we
//   build those shapes from Meta sync tables, injecting MetaCampaignGoal values
//   so the evaluation engine requires no changes.
//
//   Ad sets and ads inherit goals from their parent campaign (as designed in the
//   evaluation layer). No ad-set or ad-level goals exist in v1.
//
//   Campaigns without a MetaCampaignGoal are excluded from evaluations — they
//   have no target to evaluate against (the evaluator skips non-matching IDs).

import { prisma }            from "../db";
import type { Campaign, AdSet, Ad } from "../../types/media";
import type { RawPerformanceInput } from "../goalAwareOptimization/snapshot";

// ---------------------------------------------------------------------------
// Default goal values for campaigns without a MetaCampaignGoal.
// These are passed to Campaign objects only; the evaluator will produce
// "no_data" or "watch" for campaigns that never ran ads.
// ---------------------------------------------------------------------------
const DEFAULT_ROAS_GOAL_TYPE  = "high" as const;
const DEFAULT_ROAS_GOAL_VALUE = 1;
const DEFAULT_CPA_GOAL_TYPE   = "low"  as const;
const DEFAULT_CPA_GOAL_VALUE  = 999999; // effectively no CPA ceiling

// ---------------------------------------------------------------------------
// Campaign[] builder
// ---------------------------------------------------------------------------

/**
 * Load MetaSyncedCampaigns for a client (via MetaSelectedAdAccount) and build
 * Campaign[] objects with goal values injected from MetaCampaignGoal.
 *
 * Only campaigns that have a MetaCampaignGoal are returned, so the evaluator
 * only runs against campaigns with configured targets.
 */
export async function loadCampaignsWithGoals(
  clientAccountId: string
): Promise<Campaign[]> {
  // Find the ad account IDs linked to this client.
  const selectedAccounts = await prisma.metaSelectedAdAccount.findMany({
    where:   { clientAccountId },
    include: { accessibleAdAccount: { select: { externalAdAccountId: true } } },
  });

  if (selectedAccounts.length === 0) return [];

  const externalAdAccountIds = selectedAccounts.map(
    (sa) => sa.accessibleAdAccount.externalAdAccountId
  );

  // Load all campaigns for these ad accounts.
  const campaigns = await prisma.metaSyncedCampaign.findMany({
    where: { externalAdAccountId: { in: externalAdAccountIds } },
    select: {
      externalCampaignId: true,
      name:               true,
      status:             true,
      createdAt:          true,
    },
  });

  if (campaigns.length === 0) return [];

  const campaignIds = campaigns.map((c) => c.externalCampaignId);
  const goals = await prisma.metaCampaignGoal.findMany({
    where:  { externalCampaignId: { in: campaignIds } },
    select: {
      externalCampaignId: true,
      roasGoalType:       true,
      roasGoalValue:      true,
      cpaGoalType:        true,
      cpaGoalValue:       true,
    },
  });

  const goalById = new Map(goals.map((g) => [g.externalCampaignId, g]));

  // Only return campaigns that have a goal configured.
  return campaigns
    .filter((c) => goalById.has(c.externalCampaignId))
    .map((c) => {
      const goal = goalById.get(c.externalCampaignId)!;
      return {
        id:            c.externalCampaignId,
        accountId:     clientAccountId,
        name:          c.name,
        objective:     "conversions" as const,
        status:        (c.status?.toLowerCase() as "active" | "paused" | "archived") ?? "active",
        dailyBudget:   0,
        createdAt:     c.createdAt.toISOString().slice(0, 10),
        roasGoalType:  (goal.roasGoalType  as "high" | "low") ?? DEFAULT_ROAS_GOAL_TYPE,
        roasGoalValue: goal.roasGoalValue  ?? DEFAULT_ROAS_GOAL_VALUE,
        cpaGoalType:   (goal.cpaGoalType   as "high" | "low") ?? DEFAULT_CPA_GOAL_TYPE,
        cpaGoalValue:  goal.cpaGoalValue   ?? DEFAULT_CPA_GOAL_VALUE,
      };
    });
}

// ---------------------------------------------------------------------------
// AdSet[] builder
// ---------------------------------------------------------------------------

/**
 * Load MetaSyncedAdSets for the campaigns passed in and build AdSet[] objects.
 * campaignId on each AdSet is set to externalCampaignId so it matches Campaign.id.
 */
export async function loadAdSetsForCampaigns(
  campaignIds: string[]
): Promise<AdSet[]> {
  if (campaignIds.length === 0) return [];

  const adSets = await prisma.metaSyncedAdSet.findMany({
    where: { externalCampaignId: { in: campaignIds } },
    select: {
      externalAdSetId:    true,
      externalCampaignId: true,
      name:               true,
      status:             true,
      updatedAt:          true,
    },
  });

  return adSets.map((as) => ({
    id:          as.externalAdSetId,
    campaignId:  as.externalCampaignId,
    name:        as.name,
    targeting:   "",
    dailyBudget: 0,
    status:      (as.status?.toLowerCase() as "active" | "paused" | "archived") ?? "active",
    startDate:   as.updatedAt.toISOString().slice(0, 10),
  }));
}

// ---------------------------------------------------------------------------
// Ad[] builder
// ---------------------------------------------------------------------------

/**
 * Load MetaSyncedAds for the ad sets passed in and build Ad[] objects.
 */
export async function loadAdsForAdSets(
  adSetIds: string[]
): Promise<Ad[]> {
  if (adSetIds.length === 0) return [];

  const ads = await prisma.metaSyncedAd.findMany({
    where: { externalAdSetId: { in: adSetIds } },
    select: {
      externalAdId:    true,
      externalAdSetId: true,
      name:            true,
      status:          true,
      createdAt:       true,
    },
  });

  return ads.map((ad) => ({
    id:         ad.externalAdId,
    adSetId:    ad.externalAdSetId,
    creativeId: "",
    name:       ad.name,
    status:     (ad.status?.toLowerCase() as "active" | "paused" | "archived") ?? "active",
    createdAt:  ad.createdAt.toISOString().slice(0, 10),
  }));
}

// ---------------------------------------------------------------------------
// Ad creative context — creative image + copy loaded from MetaSyncedCreative
// via the externalCreativeId on MetaSyncedAd.
// ---------------------------------------------------------------------------

export type AdCreativeData = {
  imageUrl:     string | null;
  thumbnailUrl: string | null;
  body:         string | null;
  callToAction: string | null;
  creativeName: string | null;
};

/**
 * Load creative data (image, copy, CTA) for a set of ad IDs.
 * Joins MetaSyncedAd → MetaSyncedCreative via externalCreativeId.
 * Returns a map keyed by externalAdId — ads without a synced creative get
 * a record with all-null fields so the panel can show an empty state.
 */
export async function loadAdCreatives(
  adIds: string[]
): Promise<Record<string, AdCreativeData>> {
  if (adIds.length === 0) return {};

  const ads = await prisma.metaSyncedAd.findMany({
    where:  { externalAdId: { in: adIds } },
    select: { externalAdId: true, externalCreativeId: true },
  });

  const creativeIds = [
    ...new Set(
      ads.map((a) => a.externalCreativeId).filter((id): id is string => !!id)
    ),
  ];

  const creatives =
    creativeIds.length > 0
      ? await prisma.metaSyncedCreative.findMany({
          where:  { externalCreativeId: { in: creativeIds } },
          select: {
            externalCreativeId: true,
            name:               true,
            imageUrl:           true,
            thumbnailUrl:       true,
            body:               true,
            callToAction:       true,
          },
        })
      : [];

  const creativeById = new Map(creatives.map((c) => [c.externalCreativeId, c]));

  const result: Record<string, AdCreativeData> = {};
  for (const ad of ads) {
    const creative = ad.externalCreativeId
      ? creativeById.get(ad.externalCreativeId)
      : undefined;
    result[ad.externalAdId] = {
      imageUrl:     creative?.imageUrl     ?? null,
      thumbnailUrl: creative?.thumbnailUrl ?? null,
      body:         creative?.body         ?? null,
      callToAction: creative?.callToAction ?? null,
      creativeName: creative?.name         ?? null,
    };
  }
  return result;
}

// ---------------------------------------------------------------------------
// RawPerformanceInput[] builder from ReconciliationMatch
// ---------------------------------------------------------------------------

/**
 * Load ReconciliationMatch rows for a client in a date range and map them to
 * RawPerformanceInput[] for the optimization evaluators.
 *
 * Only rows with metaCampaignId set are useful for campaign-level evaluation.
 * The match rows already carry CRM-backed crmOrders and crmRevenue — no
 * additional data joining is needed here.
 */
export async function loadRawPerformanceInputs(
  clientAccountId: string,
  dateFrom:         string,
  dateTo:           string
): Promise<RawPerformanceInput[]> {
  const rows = await prisma.reconciliationMatch.findMany({
    where: {
      clientAccountId,
      date:           { gte: dateFrom, lte: dateTo },
      metaCampaignId: { not: null },
    },
    select: {
      id:              true,
      date:            true,
      metaCampaignId:  true,
      metaAdSetId:     true,
      metaAdId:        true,
      metaSpend:       true,
      metaClicks:      true,
      metaImpressions: true,
      crmOrders:       true,
      crmRevenue:      true,
    },
  });

  // Look up campaign names in one batch query.
  const campaignIds = [...new Set(rows.map((r) => r.metaCampaignId!))];
  const campaigns   = await prisma.metaSyncedCampaign.findMany({
    where:  { externalCampaignId: { in: campaignIds } },
    select: { externalCampaignId: true, name: true },
  });
  const campaignNameById = new Map(campaigns.map((c) => [c.externalCampaignId, c.name]));

  return rows.map((r) => ({
    clientAccountId,
    campaignId:      r.metaCampaignId ?? undefined,
    campaignName:    r.metaCampaignId ? (campaignNameById.get(r.metaCampaignId) ?? r.metaCampaignId) : undefined,
    adSetId:         r.metaAdSetId    ?? undefined,
    adId:            r.metaAdId       ?? undefined,
    date:            r.date,
    metaSpend:       r.metaSpend       ?? 0,
    metaClicks:      r.metaClicks      ?? 0,
    metaImpressions: r.metaImpressions ?? 0,
    crmOrders:       r.crmOrders       ?? 0,
    crmRevenue:      r.crmRevenue      ?? 0,
  }));
}
