// Agent Framework — Data Access Layer
//
// Centralized query functions for all agents. Reuses existing measurement
// policy and evaluation utilities. All reads, no writes.

import { prisma } from "../db";
import { buildEvaluationMetricSet } from "../measurementPolicy";
import type {
  AccountPerformanceSnapshot,
  BudgetPacingResult,
  CampaignMetricsSummary,
  FatigueSignal,
} from "./types";
import { FATIGUE_THRESHOLDS, SPEND_THRESHOLDS } from "./constants";

// ── Account performance snapshot ────────────────────────────────────────────

export async function getAccountPerformanceSnapshot(
  adAccountId: string,
  lookbackDays: number
): Promise<AccountPerformanceSnapshot> {
  const since = daysAgo(lookbackDays);

  // Aggregate Meta spend
  const spendAgg = await prisma.metaSyncedInsight.aggregate({
    where: {
      externalAdAccountId: adAccountId,
      level: "campaign",
      dateStart: { gte: since },
    },
    _sum: { spend: true, impressions: true, clicks: true },
    _count: true,
  });

  const totalSpend = spendAgg._sum.spend ?? 0;
  const dataPoints = spendAgg._count;

  // CRM reconciliation data for the same window
  const reconRows = await prisma.reconciliationResult.findMany({
    where: {
      date: { gte: since },
      status: { in: ["matched", "partial"] },
    },
    select: { crmRevenue: true, crmOrders: true },
  });

  const crmRevenue = reconRows.reduce((s, r) => s + (r.crmRevenue ?? 0), 0);
  const crmConversions = reconRows.reduce((s, r) => s + (r.crmOrders ?? 0), 0);

  const metrics = buildEvaluationMetricSet({
    spend: totalSpend,
    impressions: spendAgg._sum.impressions ?? 0,
    clicks: spendAgg._sum.clicks ?? 0,
    frequency: 0,
    crmRevenue,
    crmConversions,
  });

  // Active campaign count
  const activeCampaigns = await prisma.metaSyncedCampaign.count({
    where: {
      externalAdAccountId: adAccountId,
      status: "ACTIVE",
    },
  });

  return {
    adAccountId,
    lookbackDays,
    totalSpend,
    avgDailySpend: lookbackDays > 0 ? totalSpend / lookbackDays : 0,
    crmRoas: metrics.roas,
    crmCpa: metrics.cpa,
    crmRevenue,
    crmConversions,
    activeCampaignCount: activeCampaigns,
    dataPoints,
  };
}

// ── Active campaign metrics ─────────────────────────────────────────────────

export async function getActiveCampaignMetrics(
  adAccountId: string,
  lookbackDays = 7
): Promise<CampaignMetricsSummary[]> {
  const since = daysAgo(lookbackDays);

  // Get active campaigns
  const campaigns = await prisma.metaSyncedCampaign.findMany({
    where: {
      externalAdAccountId: adAccountId,
      status: "ACTIVE",
    },
  });

  if (campaigns.length === 0) return [];

  const campaignIds = campaigns.map((c) => c.externalCampaignId);

  // Aggregate insights per campaign
  const insightGroups = await prisma.metaSyncedInsight.groupBy({
    by: ["externalCampaignId"],
    where: {
      externalAdAccountId: adAccountId,
      level: "campaign",
      dateStart: { gte: since },
      externalCampaignId: { in: campaignIds },
    },
    _sum: { spend: true, impressions: true, clicks: true },
    _avg: { frequency: true },
  });

  const insightMap = new Map(insightGroups.map((g) => [g.externalCampaignId, g]));

  // Get CRM reconciliation per campaign (via utmCampaign matching campaign name)
  const campaignNameMap = new Map(campaigns.map((c) => [c.name, c.externalCampaignId]));
  const reconRows = await prisma.reconciliationResult.findMany({
    where: {
      date: { gte: since },
      status: { in: ["matched", "partial"] },
    },
    select: { utmCampaign: true, crmRevenue: true, crmOrders: true },
  });

  // Aggregate CRM data by campaign name → externalCampaignId
  const crmByCampaign = new Map<string, { revenue: number; conversions: number }>();
  for (const row of reconRows) {
    if (!row.utmCampaign) continue;
    // Try exact match on campaign name
    const extId = campaignNameMap.get(row.utmCampaign);
    if (!extId) continue;
    const existing = crmByCampaign.get(extId) ?? { revenue: 0, conversions: 0 };
    existing.revenue += row.crmRevenue ?? 0;
    existing.conversions += row.crmOrders ?? 0;
    crmByCampaign.set(extId, existing);
  }

  return campaigns.map((c) => {
    const insight = insightMap.get(c.externalCampaignId);
    const spend = insight?._sum.spend ?? 0;
    const impressions = insight?._sum.impressions ?? 0;
    const clicks = insight?._sum.clicks ?? 0;
    const frequency = insight?._avg.frequency ?? 0;
    const crm = crmByCampaign.get(c.externalCampaignId) ?? { revenue: 0, conversions: 0 };

    const metrics = buildEvaluationMetricSet({
      spend,
      impressions,
      clicks,
      frequency,
      crmRevenue: crm.revenue,
      crmConversions: crm.conversions,
    });

    return {
      campaignId: c.id,
      externalCampaignId: c.externalCampaignId,
      campaignName: c.name,
      status: c.status,
      spend,
      impressions,
      clicks,
      ctr: metrics.ctr,
      cpm: metrics.cpm,
      frequency,
      crmRoas: metrics.roas,
      crmCpa: metrics.cpa,
      dailyBudget: null, // Meta doesn't expose this in our synced data
    };
  });
}

// ── Campaign daily trends ───────────────────────────────────────────────────

export async function getCampaignDailyTrends(
  externalCampaignId: string,
  days: number
): Promise<Array<{ date: string; spend: number; impressions: number; clicks: number; ctr: number; frequency: number }>> {
  const since = daysAgo(days);

  const rows = await prisma.metaSyncedInsight.findMany({
    where: {
      externalCampaignId,
      level: "campaign",
      dateStart: { gte: since },
    },
    orderBy: { dateStart: "desc" },
    select: { dateStart: true, spend: true, impressions: true, clicks: true, ctr: true, frequency: true },
  });

  return rows.map((r) => ({
    date: r.dateStart,
    spend: r.spend,
    impressions: r.impressions,
    clicks: r.clicks,
    ctr: r.ctr ?? 0,
    frequency: r.frequency ?? 0,
  }));
}

// ── Budget pacing ───────────────────────────────────────────────────────────

export async function getBudgetPacing(
  adAccountId: string,
  lookbackDays = 7
): Promise<BudgetPacingResult[]> {
  const campaigns = await getActiveCampaignMetrics(adAccountId, lookbackDays);

  // We don't have dailyBudget from Meta sync, so we estimate from average spend
  // In a production system, this would come from the Meta API daily_budget field
  return campaigns
    .filter((c) => c.spend > 0)
    .map((c) => {
      const avgDaily = c.spend / lookbackDays;
      // Use estimated budget as the average daily spend (best we have without Meta budget data)
      const estimatedBudget = avgDaily; // placeholder
      const pacingRatio = estimatedBudget > 0 ? avgDaily / estimatedBudget : 1;

      return {
        campaignId: c.externalCampaignId,
        campaignName: c.campaignName,
        dailyBudget: estimatedBudget,
        actualDailySpend: avgDaily,
        pacingRatio,
        status: pacingRatio < SPEND_THRESHOLDS.underpacingRatio
          ? "underpacing" as const
          : pacingRatio > SPEND_THRESHOLDS.overpacingRatio
            ? "overpacing" as const
            : "on_track" as const,
      };
    });
}

// ── Frequency / fatigue data ────────────────────────────────────────────────

export async function getFrequencyData(
  adAccountId: string,
  lookbackDays = 7
): Promise<FatigueSignal[]> {
  const since = daysAgo(lookbackDays);

  // Get ad-level insights with frequency
  const adInsights = await prisma.metaSyncedInsight.findMany({
    where: {
      externalAdAccountId: adAccountId,
      level: "ad",
      dateStart: { gte: since },
      externalAdId: { not: "" },
    },
    orderBy: { dateStart: "desc" },
    select: {
      externalAdId: true,
      externalCampaignId: true,
      dateStart: true,
      frequency: true,
      ctr: true,
      spend: true,
    },
  });

  // Group by ad
  const byAd = new Map<string, typeof adInsights>();
  for (const row of adInsights) {
    const existing = byAd.get(row.externalAdId) ?? [];
    existing.push(row);
    byAd.set(row.externalAdId, existing);
  }

  // Get ad names
  const adIds = [...byAd.keys()];
  const ads = await prisma.metaSyncedAd.findMany({
    where: { externalAdId: { in: adIds } },
    select: { externalAdId: true, name: true, externalCampaignId: true },
  });
  const adMap = new Map(ads.map((a) => [a.externalAdId, a]));

  // Get campaign names
  const campaignIds = [...new Set(ads.map((a) => a.externalCampaignId))];
  const campaigns = await prisma.metaSyncedCampaign.findMany({
    where: { externalCampaignId: { in: campaignIds } },
    select: { externalCampaignId: true, name: true },
  });
  const campaignMap = new Map(campaigns.map((c) => [c.externalCampaignId, c.name]));

  const signals: FatigueSignal[] = [];

  for (const [adId, rows] of byAd) {
    const totalSpend = rows.reduce((s, r) => s + r.spend, 0);
    if (totalSpend < FATIGUE_THRESHOLDS.minSpendForEval) continue;

    const avgFrequency = rows.reduce((s, r) => s + (r.frequency ?? 0), 0) / rows.length;
    const ctrTrend = rows.map((r) => r.ctr ?? 0);

    // Check CTR decline
    const recentCtr = ctrTrend.slice(0, 3);
    const olderCtr = ctrTrend.slice(3);
    const recentAvg = recentCtr.length > 0 ? recentCtr.reduce((s, v) => s + v, 0) / recentCtr.length : 0;
    const olderAvg = olderCtr.length > 0 ? olderCtr.reduce((s, v) => s + v, 0) / olderCtr.length : 0;
    const ctrDecline = olderAvg > 0 ? ((olderAvg - recentAvg) / olderAvg) * 100 : 0;

    const isFatigued =
      avgFrequency >= FATIGUE_THRESHOLDS.frequencyWarn ||
      ctrDecline >= FATIGUE_THRESHOLDS.ctrDeclinePercent;

    let reason = "";
    if (avgFrequency >= FATIGUE_THRESHOLDS.frequencyCritical) {
      reason = `Critical frequency: ${avgFrequency.toFixed(1)}x (threshold: ${FATIGUE_THRESHOLDS.frequencyCritical}x)`;
    } else if (avgFrequency >= FATIGUE_THRESHOLDS.frequencyWarn) {
      reason = `High frequency: ${avgFrequency.toFixed(1)}x (threshold: ${FATIGUE_THRESHOLDS.frequencyWarn}x)`;
    } else if (ctrDecline >= FATIGUE_THRESHOLDS.ctrDeclinePercent) {
      reason = `CTR declining: ${ctrDecline.toFixed(0)}% drop over ${lookbackDays} days`;
    }

    if (isFatigued) {
      const ad = adMap.get(adId);
      signals.push({
        adId,
        adName: ad?.name ?? `Ad ${adId}`,
        campaignName: campaignMap.get(ad?.externalCampaignId ?? "") ?? "Unknown",
        frequency: avgFrequency,
        ctrTrend,
        isFatigued: true,
        reason,
      });
    }
  }

  return signals;
}

// ── Full account structure ──────────────────────────────────────────────────

export async function getFullAccountStructure(adAccountId: string) {
  const [campaigns, adSets, ads] = await Promise.all([
    prisma.metaSyncedCampaign.findMany({
      where: { externalAdAccountId: adAccountId },
      orderBy: { name: "asc" },
    }),
    prisma.metaSyncedAdSet.findMany({
      where: { externalAdAccountId: adAccountId },
      orderBy: { name: "asc" },
    }),
    prisma.metaSyncedAd.findMany({
      where: { externalAdAccountId: adAccountId },
      orderBy: { name: "asc" },
    }),
  ]);

  return { campaigns, adSets, ads };
}

// ── Launch history ──────────────────────────────────────────────────────────

export async function getLaunchHistory(adAccountId: string, limit = 10) {
  return prisma.campaignLaunch.findMany({
    where: { externalAdAccountId: adAccountId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

// ── Naming patterns ─────────────────────────────────────────────────────────

export async function getNamingPatterns(adAccountId: string) {
  const [campaigns, adSets, ads] = await Promise.all([
    prisma.metaSyncedCampaign.findMany({
      where: { externalAdAccountId: adAccountId },
      select: { name: true },
    }),
    prisma.metaSyncedAdSet.findMany({
      where: { externalAdAccountId: adAccountId },
      select: { name: true },
    }),
    prisma.metaSyncedAd.findMany({
      where: { externalAdAccountId: adAccountId },
      select: { name: true },
    }),
  ]);

  return {
    campaignNames: campaigns.map((c) => c.name),
    adSetNames: adSets.map((a) => a.name),
    adNames: ads.map((a) => a.name),
  };
}

// ── Campaigns without goals ─────────────────────────────────────────────────

export async function getCampaignsWithoutGoals() {
  // Internal Campaign model has goals relation
  const campaigns = await prisma.campaign.findMany({
    where: { goals: null },
    select: { id: true, name: true },
  });
  return campaigns;
}

// ── Top creatives by CRM ROAS ───────────────────────────────────────────────

export async function getTopCreativesByCrmRoas(
  adAccountId: string,
  count: number,
  lookbackDays: number
) {
  const since = daysAgo(lookbackDays);

  // Get ad-level spend
  const adSpend = await prisma.metaSyncedInsight.groupBy({
    by: ["externalAdId"],
    where: {
      externalAdAccountId: adAccountId,
      level: "ad",
      dateStart: { gte: since },
      externalAdId: { not: "" },
    },
    _sum: { spend: true, impressions: true, clicks: true },
  });

  // Get CRM data per UTM content (maps to ad name)
  const reconRows = await prisma.reconciliationResult.findMany({
    where: {
      date: { gte: since },
      status: { in: ["matched", "partial"] },
      utmContent: { not: null },
    },
    select: { utmContent: true, crmRevenue: true, crmOrders: true },
  });

  // Aggregate CRM by utmContent
  const crmByContent = new Map<string, { revenue: number; conversions: number }>();
  for (const row of reconRows) {
    if (!row.utmContent) continue;
    const key = row.utmContent;
    const existing = crmByContent.get(key) ?? { revenue: 0, conversions: 0 };
    existing.revenue += row.crmRevenue ?? 0;
    existing.conversions += row.crmOrders ?? 0;
    crmByContent.set(key, existing);
  }

  // Get ad metadata
  const adIds = adSpend.map((a) => a.externalAdId);
  const ads = await prisma.metaSyncedAd.findMany({
    where: { externalAdId: { in: adIds } },
    select: { externalAdId: true, name: true, externalCreativeId: true, externalCampaignId: true },
  });
  const adMap = new Map(ads.map((a) => [a.externalAdId, a]));

  // Build ranked list with CRM ROAS
  const ranked = adSpend
    .map((a) => {
      const spend = a._sum.spend ?? 0;
      if (spend <= 0) return null;
      const ad = adMap.get(a.externalAdId);
      const adName = ad?.name ?? "";
      // Match CRM data by ad name (utmContent typically contains ad name)
      const crm = crmByContent.get(adName) ?? { revenue: 0, conversions: 0 };
      const crmRoas = spend > 0 ? crm.revenue / spend : 0;

      return {
        externalAdId: a.externalAdId,
        adName,
        externalCreativeId: ad?.externalCreativeId ?? null,
        externalCampaignId: ad?.externalCampaignId ?? null,
        spend,
        impressions: a._sum.impressions ?? 0,
        clicks: a._sum.clicks ?? 0,
        crmRevenue: crm.revenue,
        crmConversions: crm.conversions,
        crmRoas: Math.round(crmRoas * 100) / 100,
      };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null)
    .sort((a, b) => b.crmRoas - a.crmRoas)
    .slice(0, count);

  return ranked;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
