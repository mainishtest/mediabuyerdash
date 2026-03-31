// lib/stats/statsService.ts
// Server-side query logic for the Stats hierarchical view.
//
// Three entry points:
//   getCampaignStats()  — top-level campaign rows
//   getAdSetStats()     — ad sets within a campaign
//   getAdStats()        — ads within an ad set
//   searchAllLevels()   — deep search across all hierarchy levels
//
// Each returns StatsRow[] with metrics, revenue attribution, and child counts.
// Revenue source of truth: CRM (Shopify). 7-day attribution window.

import { prisma } from "../db";
import { computeCreativeMetrics } from "../creativePerformance/metrics";
import {
  attributeOrdersToCampaigns,
  attributeOrdersToAdsForStats,
  rollUpAdRevenueToAdSets,
  toTimezoneDate,
  dateRangeToUtc,
  type OrderForAttribution,
  type AdForAttribution,
} from "./revenueAttribution";
import type { StatsRow, StatsTotals, StatsApiResponse, StatsSearchResult } from "./statsTypes";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function resolveAdAccountIds(
  selectedAccounts: Array<{ accessibleAdAccount: { externalAdAccountId: string } }>
): string[] {
  return selectedAccounts.map(a => a.accessibleAdAccount.externalAdAccountId);
}

function buildStatsRow(params: {
  id: string;
  externalId: string;
  parentExternalId: string;
  name: string;
  status: string;
  level: "campaign" | "adset" | "ad";
  spend: number;
  impressions: number;
  clicks: number;
  revenue: number;
  orders: number;
  revenueSource: "crm" | "utmContent" | "spendShare" | "none";
  childCount: number;
}): StatsRow {
  const { spend, impressions, clicks, revenue, orders } = params;
  const metrics = computeCreativeMetrics({ spend, impressions, clicks, conversions: orders, revenue });

  return {
    id: params.id,
    externalId: params.externalId,
    parentExternalId: params.parentExternalId,
    name: params.name,
    status: params.status,
    level: params.level,
    spend: metrics.spend,
    impressions: metrics.impressions,
    clicks: metrics.clicks,
    ctr: metrics.ctr,
    cpm: metrics.cpm,
    cpc: metrics.cpc,
    revenue: metrics.revenue,
    orders: metrics.conversions,
    roas: metrics.roas,
    cpa: metrics.cpa,
    revenueSource: params.revenueSource,
    childCount: params.childCount,
  };
}

function computeTotals(rows: StatsRow[]): StatsTotals {
  return rows.reduce(
    (t, r) => ({
      spend: t.spend + r.spend,
      impressions: t.impressions + r.impressions,
      clicks: t.clicks + r.clicks,
      revenue: t.revenue + r.revenue,
      orders: t.orders + r.orders,
    }),
    { spend: 0, impressions: 0, clicks: 0, revenue: 0, orders: 0 },
  );
}

// ---------------------------------------------------------------------------
// Campaign-level stats
// ---------------------------------------------------------------------------

export async function getCampaignStats(
  clientId: string,
  startDate: string,
  endDate: string,
  options: { activeOnly?: boolean; search?: string; timezone?: string } = {},
): Promise<StatsApiResponse> {
  const { activeOnly, search, timezone } = options;
  const tz = timezone || "America/New_York";

  // 1. Resolve ad account IDs
  const selectedAccounts = await prisma.metaSelectedAdAccount.findMany({
    where: { clientAccountId: clientId },
    include: { accessibleAdAccount: { select: { externalAdAccountId: true } } },
  });
  const adAccountIds = resolveAdAccountIds(selectedAccounts);
  if (adAccountIds.length === 0) return { rows: [], totals: { spend: 0, impressions: 0, clicks: 0, revenue: 0, orders: 0 } };

  // 2. Parallel queries
  const [campaigns, insightAggs, shopifyOrders, adSetCounts] = await Promise.all([
    // Campaign metadata
    prisma.metaSyncedCampaign.findMany({
      where: {
        externalAdAccountId: { in: adAccountIds },
        ...(activeOnly ? { status: "ACTIVE" } : {}),
        ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
      },
    }),

    // Campaign-level insight aggregation
    prisma.metaSyncedInsight.groupBy({
      by: ["externalCampaignId"],
      where: {
        externalAdAccountId: { in: adAccountIds },
        level: "campaign",
        dateStart: { gte: startDate, lte: endDate },
        externalCampaignId: { not: "" },
      },
      _sum: { spend: true, impressions: true, clicks: true },
    }),

    // CRM orders (timezone-aware)
    prisma.shopifyOrder.findMany({
      where: {
        clientAccountId: clientId,
        orderCreatedAt: {
          gte: startOfDayInTz(startDate, tz),
          lte: endOfDayInTz(endDate, tz),
        },
      },
      select: { utmCampaign: true, totalPrice: true },
    }),

    // Child ad set counts per campaign
    prisma.metaSyncedAdSet.groupBy({
      by: ["externalCampaignId"],
      where: { externalAdAccountId: { in: adAccountIds } },
      _count: true,
    }),
  ]);

  // 3. Build lookup maps
  const insightMap = new Map(
    insightAggs.map(r => [r.externalCampaignId, {
      spend: r._sum.spend ?? 0,
      impressions: r._sum.impressions ?? 0,
      clicks: r._sum.clicks ?? 0,
    }]),
  );

  const campaignNames = new Map(campaigns.map(c => [c.externalCampaignId, c.name]));
  const campaignRevenue = attributeOrdersToCampaigns(shopifyOrders, campaignNames);

  const adSetCountMap = new Map(adSetCounts.map(r => [r.externalCampaignId, r._count]));

  // 4. Build rows
  const rows: StatsRow[] = campaigns.map(c => {
    const insight = insightMap.get(c.externalCampaignId) ?? { spend: 0, impressions: 0, clicks: 0 };
    const rev = campaignRevenue.get(c.externalCampaignId);

    return buildStatsRow({
      id: c.id,
      externalId: c.externalCampaignId,
      parentExternalId: "",
      name: c.name,
      status: c.status,
      level: "campaign",
      spend: insight.spend,
      impressions: insight.impressions,
      clicks: insight.clicks,
      revenue: rev?.revenue ?? 0,
      orders: rev?.orders ?? 0,
      revenueSource: rev ? "crm" : "none",
      childCount: adSetCountMap.get(c.externalCampaignId) ?? 0,
    });
  });

  // Sort by spend descending by default
  rows.sort((a, b) => b.spend - a.spend);

  return { rows, totals: computeTotals(rows) };
}

// ---------------------------------------------------------------------------
// Ad set-level stats (within a campaign)
// ---------------------------------------------------------------------------

export async function getAdSetStats(
  clientId: string,
  parentCampaignId: string,   // externalCampaignId
  startDate: string,
  endDate: string,
  options: { activeOnly?: boolean; search?: string; timezone?: string } = {},
): Promise<StatsApiResponse> {
  const { activeOnly, search, timezone } = options;
  const tz = timezone || "America/New_York";

  // 1. Resolve ad account IDs
  const selectedAccounts = await prisma.metaSelectedAdAccount.findMany({
    where: { clientAccountId: clientId },
    include: { accessibleAdAccount: { select: { externalAdAccountId: true } } },
  });
  const adAccountIds = resolveAdAccountIds(selectedAccounts);
  if (adAccountIds.length === 0) return { rows: [], totals: { spend: 0, impressions: 0, clicks: 0, revenue: 0, orders: 0 } };

  // 2. Parallel queries
  const [adSets, insightAggs, adCounts, ads, adInsightRows, shopifyOrders, campaign] = await Promise.all([
    // Ad set metadata
    prisma.metaSyncedAdSet.findMany({
      where: {
        externalCampaignId: parentCampaignId,
        externalAdAccountId: { in: adAccountIds },
        ...(activeOnly ? { status: "ACTIVE" } : {}),
        ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
      },
    }),

    // Ad set-level insight aggregation
    prisma.metaSyncedInsight.groupBy({
      by: ["externalAdSetId"],
      where: {
        externalCampaignId: parentCampaignId,
        level: "adset",
        dateStart: { gte: startDate, lte: endDate },
        externalAdSetId: { not: "" },
      },
      _sum: { spend: true, impressions: true, clicks: true },
    }),

    // Child ad counts per ad set
    prisma.metaSyncedAd.groupBy({
      by: ["externalAdSetId"],
      where: {
        externalCampaignId: parentCampaignId,
        externalAdAccountId: { in: adAccountIds },
      },
      _count: true,
    }),

    // All ads in this campaign (for attribution)
    prisma.metaSyncedAd.findMany({
      where: {
        externalCampaignId: parentCampaignId,
        externalAdAccountId: { in: adAccountIds },
      },
      select: {
        externalAdId: true,
        externalAdSetId: true,
        externalCampaignId: true,
        externalAdAccountId: true,
        name: true,
      },
    }),

    // Ad-level daily insight rows (for attribution spend indexes)
    prisma.metaSyncedInsight.findMany({
      where: {
        externalCampaignId: parentCampaignId,
        level: "ad",
        dateStart: { gte: startDate, lte: endDate },
        externalAdId: { not: "" },
      },
      select: {
        externalAdId: true,
        externalCampaignId: true,
        dateStart: true,
        spend: true,
      },
    }),

    // CRM orders (for attribution)
    prisma.shopifyOrder.findMany({
      where: {
        clientAccountId: clientId,
        orderCreatedAt: {
          gte: startOfDayInTz(startDate, tz),
          lte: endOfDayInTz(endDate, tz),
        },
      },
      select: {
        id: true,
        orderCreatedAt: true,
        totalPrice: true,
        utmCampaign: true,
        utmContent: true,
        clientAccountId: true,
      },
    }),

    // Campaign name for attribution matching
    prisma.metaSyncedCampaign.findUnique({
      where: { externalCampaignId: parentCampaignId },
      select: { name: true },
    }),
  ]);

  // 3. Build attribution indexes
  const adDailySpend = new Map<string, Map<string, number>>();
  const campaignDailySpend = new Map<string, Map<string, number>>();

  for (const row of adInsightRows) {
    const spend = row.spend ?? 0;
    if (spend <= 0) continue;

    if (!adDailySpend.has(row.externalAdId)) adDailySpend.set(row.externalAdId, new Map());
    const adDay = adDailySpend.get(row.externalAdId)!;
    adDay.set(row.dateStart, (adDay.get(row.dateStart) ?? 0) + spend);

    if (!campaignDailySpend.has(row.externalCampaignId)) campaignDailySpend.set(row.externalCampaignId, new Map());
    const camDay = campaignDailySpend.get(row.externalCampaignId)!;
    camDay.set(row.dateStart, (camDay.get(row.dateStart) ?? 0) + spend);
  }

  // 4. Attribute orders to ads, then roll up to ad sets
  const orders: OrderForAttribution[] = shopifyOrders.map(o => ({
    id: o.id,
    clientAccountId: o.clientAccountId!,
    date: toTimezoneDate(o.orderCreatedAt, tz),
    revenue: o.totalPrice ?? 0,
    utmCampaign: o.utmCampaign ?? undefined,
    utmContent: o.utmContent ?? undefined,
  }));

  const adsForAttribution: AdForAttribution[] = ads.map(a => ({
    externalAdId: a.externalAdId,
    externalCampaignId: a.externalCampaignId,
    externalAdAccountId: a.externalAdAccountId,
    name: a.name,
  }));

  const campaignNameById = new Map<string, string>();
  if (campaign?.name) campaignNameById.set(parentCampaignId, campaign.name);

  const adRevenueMap = attributeOrdersToAdsForStats({
    orders,
    ads: adsForAttribution,
    adDailySpend,
    campaignDailySpend,
    campaignNameById,
  });

  const adToAdSetMap = new Map(ads.map(a => [a.externalAdId, a.externalAdSetId]));
  const adSetRevenueMap = rollUpAdRevenueToAdSets(adRevenueMap, adToAdSetMap);

  // 5. Build lookup maps
  const insightMap = new Map(
    insightAggs.map(r => [r.externalAdSetId, {
      spend: r._sum.spend ?? 0,
      impressions: r._sum.impressions ?? 0,
      clicks: r._sum.clicks ?? 0,
    }]),
  );

  const adCountMap = new Map(adCounts.map(r => [r.externalAdSetId, r._count]));

  // 6. Build rows
  const rows: StatsRow[] = adSets.map(as => {
    const insight = insightMap.get(as.externalAdSetId) ?? { spend: 0, impressions: 0, clicks: 0 };
    const rev = adSetRevenueMap.get(as.externalAdSetId);

    return buildStatsRow({
      id: as.id,
      externalId: as.externalAdSetId,
      parentExternalId: parentCampaignId,
      name: as.name,
      status: as.status,
      level: "adset",
      spend: insight.spend,
      impressions: insight.impressions,
      clicks: insight.clicks,
      revenue: rev?.revenue ?? 0,
      orders: rev?.orders ?? 0,
      revenueSource: rev?.revenueSource ?? "none",
      childCount: adCountMap.get(as.externalAdSetId) ?? 0,
    });
  });

  rows.sort((a, b) => b.spend - a.spend);

  return { rows, totals: computeTotals(rows) };
}

// ---------------------------------------------------------------------------
// Ad-level stats (within an ad set)
// ---------------------------------------------------------------------------

export async function getAdStats(
  clientId: string,
  parentAdSetId: string,   // externalAdSetId
  startDate: string,
  endDate: string,
  options: { activeOnly?: boolean; search?: string; timezone?: string } = {},
): Promise<StatsApiResponse> {
  const { activeOnly, search, timezone } = options;
  const tz = timezone || "America/New_York";

  // 1. Resolve ad account IDs
  const selectedAccounts = await prisma.metaSelectedAdAccount.findMany({
    where: { clientAccountId: clientId },
    include: { accessibleAdAccount: { select: { externalAdAccountId: true } } },
  });
  const adAccountIds = resolveAdAccountIds(selectedAccounts);
  if (adAccountIds.length === 0) return { rows: [], totals: { spend: 0, impressions: 0, clicks: 0, revenue: 0, orders: 0 } };

  // Find the parent campaign for this ad set
  const parentAdSet = await prisma.metaSyncedAdSet.findUnique({
    where: { externalAdSetId: parentAdSetId },
    select: { externalCampaignId: true },
  });

  const parentCampaignId = parentAdSet?.externalCampaignId ?? "";

  // 2. Parallel queries
  const [adsInAdSet, insightAggs, allCampaignAds, adInsightRows, shopifyOrders, campaign] = await Promise.all([
    // Ads in this ad set
    prisma.metaSyncedAd.findMany({
      where: {
        externalAdSetId: parentAdSetId,
        externalAdAccountId: { in: adAccountIds },
        ...(activeOnly ? { status: "ACTIVE" } : {}),
        ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
      },
    }),

    // Ad-level insight aggregation for this ad set
    prisma.metaSyncedInsight.groupBy({
      by: ["externalAdId"],
      where: {
        externalAdSetId: parentAdSetId,
        level: "ad",
        dateStart: { gte: startDate, lte: endDate },
        externalAdId: { not: "" },
      },
      _sum: { spend: true, impressions: true, clicks: true },
    }),

    // All ads in parent campaign (for attribution — revenue is campaign-level)
    prisma.metaSyncedAd.findMany({
      where: {
        externalCampaignId: parentCampaignId,
        externalAdAccountId: { in: adAccountIds },
      },
      select: {
        externalAdId: true,
        externalAdSetId: true,
        externalCampaignId: true,
        externalAdAccountId: true,
        name: true,
      },
    }),

    // Ad-level daily insights for the entire parent campaign (attribution)
    prisma.metaSyncedInsight.findMany({
      where: {
        externalCampaignId: parentCampaignId,
        level: "ad",
        dateStart: { gte: startDate, lte: endDate },
        externalAdId: { not: "" },
      },
      select: {
        externalAdId: true,
        externalCampaignId: true,
        dateStart: true,
        spend: true,
      },
    }),

    // CRM orders
    prisma.shopifyOrder.findMany({
      where: {
        clientAccountId: clientId,
        orderCreatedAt: {
          gte: startOfDayInTz(startDate, tz),
          lte: endOfDayInTz(endDate, tz),
        },
      },
      select: {
        id: true,
        orderCreatedAt: true,
        totalPrice: true,
        utmCampaign: true,
        utmContent: true,
        clientAccountId: true,
      },
    }),

    // Campaign name for attribution
    prisma.metaSyncedCampaign.findUnique({
      where: { externalCampaignId: parentCampaignId },
      select: { name: true },
    }),
  ]);

  // 3. Build daily spend indexes
  const adDailySpend = new Map<string, Map<string, number>>();
  const campaignDailySpend = new Map<string, Map<string, number>>();

  for (const row of adInsightRows) {
    const spend = row.spend ?? 0;
    if (spend <= 0) continue;

    if (!adDailySpend.has(row.externalAdId)) adDailySpend.set(row.externalAdId, new Map());
    adDailySpend.get(row.externalAdId)!.set(row.dateStart, (adDailySpend.get(row.externalAdId)!.get(row.dateStart) ?? 0) + spend);

    if (!campaignDailySpend.has(row.externalCampaignId)) campaignDailySpend.set(row.externalCampaignId, new Map());
    campaignDailySpend.get(row.externalCampaignId)!.set(row.dateStart, (campaignDailySpend.get(row.externalCampaignId)!.get(row.dateStart) ?? 0) + spend);
  }

  // 4. Attribute orders to ads
  const orders: OrderForAttribution[] = shopifyOrders.map(o => ({
    id: o.id,
    clientAccountId: o.clientAccountId!,
    date: toTimezoneDate(o.orderCreatedAt, tz),
    revenue: o.totalPrice ?? 0,
    utmCampaign: o.utmCampaign ?? undefined,
    utmContent: o.utmContent ?? undefined,
  }));

  const adsForAttribution: AdForAttribution[] = allCampaignAds.map(a => ({
    externalAdId: a.externalAdId,
    externalCampaignId: a.externalCampaignId,
    externalAdAccountId: a.externalAdAccountId,
    name: a.name,
  }));

  const campaignNameById = new Map<string, string>();
  if (campaign?.name) campaignNameById.set(parentCampaignId, campaign.name);

  const adRevenueMap = attributeOrdersToAdsForStats({
    orders,
    ads: adsForAttribution,
    adDailySpend,
    campaignDailySpend,
    campaignNameById,
  });

  // 5. Build lookup maps
  const insightMap = new Map(
    insightAggs.map(r => [r.externalAdId, {
      spend: r._sum.spend ?? 0,
      impressions: r._sum.impressions ?? 0,
      clicks: r._sum.clicks ?? 0,
    }]),
  );

  // Filter to only ads in this ad set
  const adSetAdIds = new Set(adsInAdSet.map(a => a.externalAdId));

  // 6. Build rows
  const rows: StatsRow[] = adsInAdSet.map(ad => {
    const insight = insightMap.get(ad.externalAdId) ?? { spend: 0, impressions: 0, clicks: 0 };
    const rev = adRevenueMap.get(ad.externalAdId);

    return buildStatsRow({
      id: ad.id,
      externalId: ad.externalAdId,
      parentExternalId: parentAdSetId,
      name: ad.name,
      status: ad.status,
      level: "ad",
      spend: insight.spend,
      impressions: insight.impressions,
      clicks: insight.clicks,
      revenue: rev?.revenue ?? 0,
      orders: rev?.orders ?? 0,
      revenueSource: rev?.revenueSource ?? "none",
      childCount: 0, // Ads have no children
    });
  });

  rows.sort((a, b) => b.spend - a.spend);

  return { rows, totals: computeTotals(rows) };
}

// ---------------------------------------------------------------------------
// Deep search across all levels
// ---------------------------------------------------------------------------

export async function searchAllLevels(
  clientId: string,
  search: string,
  startDate: string,
  endDate: string,
  options: { activeOnly?: boolean; timezone?: string } = {},
): Promise<StatsSearchResult> {
  const { activeOnly, timezone } = options;
  const tz = timezone || "America/New_York";

  // Resolve ad account IDs
  const selectedAccounts = await prisma.metaSelectedAdAccount.findMany({
    where: { clientAccountId: clientId },
    include: { accessibleAdAccount: { select: { externalAdAccountId: true } } },
  });
  const adAccountIds = resolveAdAccountIds(selectedAccounts);
  if (adAccountIds.length === 0) {
    return { campaigns: [], adSets: [], ads: [], ancestorMap: {} };
  }

  // Search all 3 levels in parallel
  const [matchedCampaigns, matchedAdSets, matchedAds] = await Promise.all([
    prisma.metaSyncedCampaign.findMany({
      where: {
        externalAdAccountId: { in: adAccountIds },
        name: { contains: search, mode: "insensitive" },
        ...(activeOnly ? { status: "ACTIVE" } : {}),
      },
    }),
    prisma.metaSyncedAdSet.findMany({
      where: {
        externalAdAccountId: { in: adAccountIds },
        name: { contains: search, mode: "insensitive" },
        ...(activeOnly ? { status: "ACTIVE" } : {}),
      },
    }),
    prisma.metaSyncedAd.findMany({
      where: {
        externalAdAccountId: { in: adAccountIds },
        name: { contains: search, mode: "insensitive" },
        ...(activeOnly ? { status: "ACTIVE" } : {}),
      },
    }),
  ]);

  // Collect all unique campaign IDs and ad set IDs needed for context
  const campaignIdsNeeded = new Set<string>();
  const adSetIdsNeeded = new Set<string>();

  for (const c of matchedCampaigns) campaignIdsNeeded.add(c.externalCampaignId);
  for (const as of matchedAdSets) {
    campaignIdsNeeded.add(as.externalCampaignId);
    adSetIdsNeeded.add(as.externalAdSetId);
  }
  for (const ad of matchedAds) {
    campaignIdsNeeded.add(ad.externalCampaignId);
    adSetIdsNeeded.add(ad.externalAdSetId);
  }

  // Fetch ancestor entities we don't already have
  const existingCampaignIds = new Set(matchedCampaigns.map(c => c.externalCampaignId));
  const existingAdSetIds = new Set(matchedAdSets.map(as => as.externalAdSetId));

  const missingCampaignIds = [...campaignIdsNeeded].filter(id => !existingCampaignIds.has(id));
  const missingAdSetIds = [...adSetIdsNeeded].filter(id => !existingAdSetIds.has(id));

  const [ancestorCampaigns, ancestorAdSets] = await Promise.all([
    missingCampaignIds.length > 0
      ? prisma.metaSyncedCampaign.findMany({
          where: { externalCampaignId: { in: missingCampaignIds } },
        })
      : [],
    missingAdSetIds.length > 0
      ? prisma.metaSyncedAdSet.findMany({
          where: { externalAdSetId: { in: missingAdSetIds } },
        })
      : [],
  ]);

  const allCampaigns = [...matchedCampaigns, ...ancestorCampaigns];
  const allAdSets = [...matchedAdSets, ...ancestorAdSets];

  // Now fetch insights for everything
  const allCampaignIds = [...new Set(allCampaigns.map(c => c.externalCampaignId))];
  const allAdSetIdsList = [...new Set(allAdSets.map(as => as.externalAdSetId))];
  const allAdIds = matchedAds.map(a => a.externalAdId);

  const [campaignInsights, adSetInsights, adInsights, shopifyOrders, adSetCounts, adCounts] = await Promise.all([
    prisma.metaSyncedInsight.groupBy({
      by: ["externalCampaignId"],
      where: {
        externalCampaignId: { in: allCampaignIds },
        level: "campaign",
        dateStart: { gte: startDate, lte: endDate },
      },
      _sum: { spend: true, impressions: true, clicks: true },
    }),
    allAdSetIdsList.length > 0
      ? prisma.metaSyncedInsight.groupBy({
          by: ["externalAdSetId"],
          where: {
            externalAdSetId: { in: allAdSetIdsList },
            level: "adset",
            dateStart: { gte: startDate, lte: endDate },
          },
          _sum: { spend: true, impressions: true, clicks: true },
        })
      : [],
    allAdIds.length > 0
      ? prisma.metaSyncedInsight.groupBy({
          by: ["externalAdId"],
          where: {
            externalAdId: { in: allAdIds },
            level: "ad",
            dateStart: { gte: startDate, lte: endDate },
          },
          _sum: { spend: true, impressions: true, clicks: true },
        })
      : [],
    prisma.shopifyOrder.findMany({
      where: {
        clientAccountId: clientId,
        orderCreatedAt: {
          gte: startOfDayInTz(startDate, tz),
          lte: endOfDayInTz(endDate, tz),
        },
      },
      select: { utmCampaign: true, totalPrice: true },
    }),
    prisma.metaSyncedAdSet.groupBy({
      by: ["externalCampaignId"],
      where: { externalAdAccountId: { in: adAccountIds } },
      _count: true,
    }),
    prisma.metaSyncedAd.groupBy({
      by: ["externalAdSetId"],
      where: { externalAdAccountId: { in: adAccountIds } },
      _count: true,
    }),
  ]);

  // Campaign revenue attribution
  const campaignNames = new Map(allCampaigns.map(c => [c.externalCampaignId, c.name]));
  const campaignRevenue = attributeOrdersToCampaigns(shopifyOrders, campaignNames);

  const campaignInsightMap = new Map(campaignInsights.map(r => [r.externalCampaignId, { spend: r._sum.spend ?? 0, impressions: r._sum.impressions ?? 0, clicks: r._sum.clicks ?? 0 }]));
  const adSetInsightMap = new Map(adSetInsights.map(r => [r.externalAdSetId, { spend: r._sum.spend ?? 0, impressions: r._sum.impressions ?? 0, clicks: r._sum.clicks ?? 0 }]));
  const adInsightMap = new Map(adInsights.map(r => [r.externalAdId, { spend: r._sum.spend ?? 0, impressions: r._sum.impressions ?? 0, clicks: r._sum.clicks ?? 0 }]));
  const adSetCountMap = new Map(adSetCounts.map(r => [r.externalCampaignId, r._count]));
  const adCountMap = new Map(adCounts.map(r => [r.externalAdSetId, r._count]));

  // Build rows for all levels
  const campaignRows: StatsRow[] = allCampaigns.map(c => {
    const insight = campaignInsightMap.get(c.externalCampaignId) ?? { spend: 0, impressions: 0, clicks: 0 };
    const rev = campaignRevenue.get(c.externalCampaignId);
    return buildStatsRow({
      id: c.id, externalId: c.externalCampaignId, parentExternalId: "", name: c.name, status: c.status, level: "campaign",
      spend: insight.spend, impressions: insight.impressions, clicks: insight.clicks,
      revenue: rev?.revenue ?? 0, orders: rev?.orders ?? 0, revenueSource: rev ? "crm" : "none",
      childCount: adSetCountMap.get(c.externalCampaignId) ?? 0,
    });
  });

  const adSetRows: StatsRow[] = allAdSets.map(as => {
    const insight = adSetInsightMap.get(as.externalAdSetId) ?? { spend: 0, impressions: 0, clicks: 0 };
    // Simplified: no ad-level attribution for search results (performance trade-off)
    return buildStatsRow({
      id: as.id, externalId: as.externalAdSetId, parentExternalId: as.externalCampaignId, name: as.name, status: as.status, level: "adset",
      spend: insight.spend, impressions: insight.impressions, clicks: insight.clicks,
      revenue: 0, orders: 0, revenueSource: "none",
      childCount: adCountMap.get(as.externalAdSetId) ?? 0,
    });
  });

  const adRows: StatsRow[] = matchedAds.map(ad => {
    const insight = adInsightMap.get(ad.externalAdId) ?? { spend: 0, impressions: 0, clicks: 0 };
    return buildStatsRow({
      id: ad.id, externalId: ad.externalAdId, parentExternalId: ad.externalAdSetId, name: ad.name, status: ad.status, level: "ad",
      spend: insight.spend, impressions: insight.impressions, clicks: insight.clicks,
      revenue: 0, orders: 0, revenueSource: "none",
      childCount: 0,
    });
  });

  // Build ancestor map: childExternalId → [ancestorIds from campaign down]
  const ancestorMap: Record<string, string[]> = {};
  for (const as of allAdSets) {
    if (!ancestorMap[as.externalAdSetId]) {
      ancestorMap[as.externalAdSetId] = [as.externalCampaignId];
    }
  }
  for (const ad of matchedAds) {
    ancestorMap[ad.externalAdId] = [ad.externalCampaignId, ad.externalAdSetId];
  }

  return {
    campaigns: campaignRows,
    adSets: adSetRows,
    ads: adRows,
    ancestorMap,
  };
}

// ---------------------------------------------------------------------------
// Timezone helpers (duplicated from dataService.ts to avoid circular imports)
// ---------------------------------------------------------------------------

function startOfDayInTz(dateStr: string, tz: string): Date {
  const noon = new Date(dateStr + "T12:00:00.000Z");
  const localStr = noon.toLocaleString("en-US", { timeZone: tz });
  const localDate = new Date(localStr);
  const offsetMs = noon.getTime() - localDate.getTime();
  const midnight = new Date(dateStr + "T00:00:00.000Z");
  return new Date(midnight.getTime() + offsetMs);
}

function endOfDayInTz(dateStr: string, tz: string): Date {
  const start = startOfDayInTz(dateStr, tz);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}
