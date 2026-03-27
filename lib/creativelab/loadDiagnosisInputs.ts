// lib/creativelab/loadDiagnosisInputs.ts
//
// Loads real ad data from the database to build CreativeDiagnosisInput entries
// for the Creative Lab generate page. Replaces mock data.
//
// Data chain:
//   ClientAccount → MetaSelectedAdAccount → MetaAccessibleAdAccount (externalAdAccountId)
//     → MetaSyncedAd + MetaSyncedCreative (creative content)
//     → MetaSyncedInsight (spend, clicks, impressions over 14-day window)
//     → MetaSyncedCampaign + MetaCampaignGoal / ClientGoalDefaults (goals)

import { prisma } from "../db";
import type { CreativeDiagnosisInput } from "../../types/creativeDiagnosis";

const WINDOW_DAYS = 14;

/**
 * Load real ad entries for a given client, ready for diagnosis.
 * Returns [] if no data is available (graceful fallback).
 */
export async function loadDiagnosisInputs(
  clientAccountId: string,
): Promise<CreativeDiagnosisInput[]> {
  // 1. Resolve the client's Meta ad account IDs
  const selectedAccounts = await prisma.metaSelectedAdAccount.findMany({
    where: { clientAccountId },
    include: { accessibleAdAccount: true },
  });

  const adAccountIds = selectedAccounts
    .map((s) => s.accessibleAdAccount.externalAdAccountId)
    .filter(Boolean);

  if (adAccountIds.length === 0) return [];

  // 2. Load client-level goal defaults as fallback
  const goalDefaults = await prisma.clientGoalDefaults.findUnique({
    where: { clientAccountId },
  });

  // 3. Date window for performance aggregation
  const since = new Date();
  since.setDate(since.getDate() - WINDOW_DAYS);
  const sinceStr = since.toISOString().slice(0, 10);

  // 4. Load ads, creatives, insights, campaigns, and campaign goals in parallel
  const [ads, insights, campaigns] = await Promise.all([
    prisma.metaSyncedAd.findMany({
      where: { externalAdAccountId: { in: adAccountIds }, status: "ACTIVE" },
    }),
    prisma.metaSyncedInsight.findMany({
      where: {
        externalAdAccountId: { in: adAccountIds },
        level: "ad",
        dateStart: { gte: sinceStr },
      },
    }),
    prisma.metaSyncedCampaign.findMany({
      where: { externalAdAccountId: { in: adAccountIds } },
      include: { goal: true },
    }),
  ]);

  if (ads.length === 0) return [];

  // 5. Load creatives for the ads that have a creative ID
  const creativeIds = ads
    .map((a) => a.externalCreativeId)
    .filter((id): id is string => !!id);

  const creatives = creativeIds.length > 0
    ? await prisma.metaSyncedCreative.findMany({
        where: { externalCreativeId: { in: creativeIds } },
      })
    : [];

  // 6. Load reconciled campaign performance for CRM-verified ROAS/CPA
  const campaignIds = [...new Set(ads.map((a) => a.externalCampaignId))];
  const reconciledPerf = await prisma.reconciledCampaignPerformance.findMany({
    where: { clientAccountId, externalCampaignId: { in: campaignIds } },
    orderBy: { dateFrom: "desc" },
  });

  // Build lookup maps
  const creativeMap = new Map(creatives.map((c) => [c.externalCreativeId, c]));
  const campaignMap = new Map(campaigns.map((c) => [c.externalCampaignId, c]));

  // Aggregate insights per ad
  const insightsByAd = new Map<string, { spend: number; clicks: number; impressions: number }>();
  for (const i of insights) {
    const key = i.externalAdId;
    const cur = insightsByAd.get(key) ?? { spend: 0, clicks: 0, impressions: 0 };
    cur.spend += i.spend;
    cur.clicks += i.clicks;
    cur.impressions += i.impressions;
    insightsByAd.set(key, cur);
  }

  // Latest reconciled ROAS/CPA per campaign
  const reconciledByCampaign = new Map<string, { roas: number; cpa: number }>();
  for (const r of reconciledPerf) {
    if (!reconciledByCampaign.has(r.externalCampaignId)) {
      reconciledByCampaign.set(r.externalCampaignId, {
        roas: r.calculatedRoas ?? 0,
        cpa: r.calculatedCpa ?? 0,
      });
    }
  }

  // 7. Assemble CreativeDiagnosisInput entries
  const entries: CreativeDiagnosisInput[] = [];

  for (const ad of ads) {
    const perf = insightsByAd.get(ad.externalAdId);
    if (!perf || perf.spend < 10) continue; // Skip ads with negligible spend

    const campaign = campaignMap.get(ad.externalCampaignId);
    const creative = ad.externalCreativeId
      ? creativeMap.get(ad.externalCreativeId)
      : undefined;
    const reconciled = reconciledByCampaign.get(ad.externalCampaignId);
    const campaignGoal = campaign?.goal;

    // Resolve goals: campaign-specific → client defaults → sensible fallback
    const roasGoalValue = campaignGoal?.roasGoalValue
      ?? goalDefaults?.defaultRoasGoalValue ?? 2.0;
    const roasGoalType = (campaignGoal?.roasGoalType
      ?? goalDefaults?.defaultRoasGoalType ?? "high") as "high" | "low";
    const cpaGoalValue = campaignGoal?.cpaGoalValue
      ?? goalDefaults?.defaultCpaGoalValue ?? 30.0;
    const cpaGoalType = (campaignGoal?.cpaGoalType
      ?? goalDefaults?.defaultCpaGoalType ?? "low") as "high" | "low";

    const actualRoas = reconciled?.roas ?? 0;
    const actualCpa = reconciled?.cpa ?? 0;
    const conversions = actualCpa > 0 ? Math.round(perf.spend / actualCpa) : 0;

    // Parse copy fields from creative — split body into hook + body if possible
    const rawBody = creative?.body ?? "";
    const bodyLines = rawBody.split("\n").filter((l) => l.trim());
    const hook = bodyLines[0] ?? "";
    const body = bodyLines.slice(1).join(" ").trim() || hook;

    entries.push({
      adId: ad.externalAdId,
      adName: ad.name,
      campaignId: ad.externalCampaignId,
      campaignName: campaign?.name ?? "Unknown Campaign",
      actualCpa,
      actualRoas,
      spend: perf.spend,
      conversions,
      cpaGoalValue,
      cpaGoalType,
      roasGoalValue,
      roasGoalType,
      copy: {
        hook,
        body,
        callToAction: creative?.callToAction ?? "Shop Now",
      },
      image: {
        imageHeadline: creative?.title ?? creative?.name ?? ad.name ?? "",
        imageStyle: creative?.imageUrl ? "static_image" : creative?.thumbnailUrl ? "has_thumbnail" : "unknown",
        dominantMessage: hook || creative?.name || "",
        visualTheme: "unknown",
      },
    });
  }

  return entries;
}
