// lib/stats/statsService.ts
// ─────────────────────────────────────────────────────────────────────────────
// Server-side query logic for the Stats hierarchical view.
//
// ARCHITECTURE
// ────────────
// Four public entry points, each returning a uniform StatsRow[] shape:
//
//   getCampaignStats()   — Top-level campaign rows for a client
//   getAdSetStats()      — Ad sets within a single campaign
//   getAdStats()         — Ads within a single ad set
//   searchAllLevels()    — Deep search across all hierarchy levels
//
// QUERY STRATEGY
// ──────────────
// Each function uses Promise.all to run independent DB queries in parallel,
// then joins the results in application code. This avoids N+1 patterns:
//
//   Campaign level:  4 parallel queries (campaigns, insights groupBy, CRM orders, child counts)
//   Ad set level:    7 parallel queries (ad sets, insight aggs, child counts, ads, ad insights, CRM orders, campaign name)
//   Ad level:        6 parallel queries (ads, insight aggs, all campaign ads, ad insights, CRM orders, campaign name)
//   Deep search:     3 parallel searches + 2 ancestor fetches + 6 parallel insight/count queries
//
// REVENUE ATTRIBUTION
// ───────────────────
// Revenue source of truth: CRM (Shopify). Meta revenue fields are NEVER used.
//
//   Campaign level:  Direct CRM match — utmCampaign ↔ normalized campaign name
//   Ad set level:    Derived — attribute orders to ads, then roll up to ad sets
//   Ad level:        UTM content matching — utmContent ↔ ad ID or ad name,
//                    with 7-day spend-share fallback for unmatched orders
//
// TIMEZONE HANDLING
// ─────────────────
// MetaSyncedInsight.dateStart is stored in the ad account's timezone as YYYY-MM-DD.
// ShopifyOrder.orderCreatedAt is a UTC timestamp.
// Date range queries use timezone-aware boundaries (startOfDayInTz/endOfDayInTz)
// to ensure "today" and "yesterday" align with the user's local calendar.
//
// INSIGHT LEVEL
// ──────────────
// Meta sync only stores ad-level insight rows (level: "ad"). Campaign-level
// and adset-level rows do NOT exist. All queries aggregate from ad-level
// rows using groupBy on externalCampaignId or externalAdSetId.
//
// INDEX SUPPORT
// ─────────────
// The following Prisma indexes support the groupBy queries:
//   @@index([externalAdAccountId, level, dateStart])   — campaign-level rollup
//   @@index([externalCampaignId, level, dateStart])    — ad set & ad insights by campaign
//   @@index([externalAdSetId, level, dateStart])       — ad insights by ad set
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "../db";
import { computeCreativeMetrics } from "../creativePerformance/metrics";
import { round2 } from "../creativePerformance/metrics";
import {
  attributeOrdersToCampaigns,
  attributeOrdersToAdsForStats,
  rollUpAdRevenueToAdSets,
  toTimezoneDate,
  type OrderForAttribution,
  type AdForAttribution,
} from "./revenueAttribution";
import type {
  StatsRow,
  StatsTotals,
  StatsApiResponse,
  StatsSearchResult,
} from "./statsTypes";

// ─── Empty response constant ────────────────────────────────────────────────

const EMPTY_TOTALS: StatsTotals = { spend: 0, impressions: 0, clicks: 0, revenue: 0, orders: 0 };
const EMPTY_RESPONSE: StatsApiResponse = { rows: [], totals: EMPTY_TOTALS };

// ─── Shared helpers ─────────────────────────────────────────────────────────

/**
 * Resolve the external Meta ad account IDs linked to a client.
 * This is the entry point for every stats query — a client can have
 * multiple Meta ad accounts via MetaSelectedAdAccount.
 *
 * Returns [] if the client has no linked ad accounts.
 */
async function resolveClientAdAccountIds(clientId: string): Promise<string[]> {
  const selectedAccounts = await prisma.metaSelectedAdAccount.findMany({
    where: { clientAccountId: clientId },
    include: { accessibleAdAccount: { select: { externalAdAccountId: true } } },
  });
  return selectedAccounts.map(a => a.accessibleAdAccount.externalAdAccountId);
}

/**
 * Build a uniform StatsRow from raw metric inputs.
 * Delegates derived metric computation (CTR, CPC, CPM, ROAS, CPA) to
 * computeCreativeMetrics() which guarantees no NaN/Infinity values.
 */
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

  // computeCreativeMetrics handles all derived metric calculations
  // and guards against division by zero, NaN, and Infinity.
  const metrics = computeCreativeMetrics({
    spend,
    impressions,
    clicks,
    conversions: orders,
    revenue,
  });

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

/** Sum totals across rows (rounded to avoid floating-point noise). */
function computeTotals(rows: StatsRow[]): StatsTotals {
  const raw = rows.reduce(
    (t, r) => ({
      spend: t.spend + r.spend,
      impressions: t.impressions + r.impressions,
      clicks: t.clicks + r.clicks,
      revenue: t.revenue + r.revenue,
      orders: t.orders + r.orders,
    }),
    { spend: 0, impressions: 0, clicks: 0, revenue: 0, orders: 0 },
  );

  return {
    spend: round2(raw.spend),
    impressions: raw.impressions,
    clicks: raw.clicks,
    revenue: round2(raw.revenue),
    orders: round2(raw.orders),
  };
}

/**
 * Build daily spend index maps from ad-level insight rows.
 * These are needed by the attribution engine for spend-share distribution.
 *
 * Returns two maps:
 *   adDailySpend       — adId → date → spend
 *   campaignDailySpend — campaignId → date → spend (aggregated from ad-level)
 */
function buildDailySpendIndexes(
  adInsightRows: Array<{ externalAdId: string; externalCampaignId: string; dateStart: string; spend: number }>,
): {
  adDailySpend: Map<string, Map<string, number>>;
  campaignDailySpend: Map<string, Map<string, number>>;
} {
  const adDailySpend = new Map<string, Map<string, number>>();
  const campaignDailySpend = new Map<string, Map<string, number>>();

  for (const row of adInsightRows) {
    const spend = row.spend ?? 0;
    if (spend <= 0) continue;

    // Index by ad
    if (!adDailySpend.has(row.externalAdId)) {
      adDailySpend.set(row.externalAdId, new Map());
    }
    const adDay = adDailySpend.get(row.externalAdId)!;
    adDay.set(row.dateStart, (adDay.get(row.dateStart) ?? 0) + spend);

    // Index by campaign (aggregated from ad-level rows)
    if (!campaignDailySpend.has(row.externalCampaignId)) {
      campaignDailySpend.set(row.externalCampaignId, new Map());
    }
    const camDay = campaignDailySpend.get(row.externalCampaignId)!;
    camDay.set(row.dateStart, (camDay.get(row.dateStart) ?? 0) + spend);
  }

  return { adDailySpend, campaignDailySpend };
}

/**
 * Convert Shopify order rows into the OrderForAttribution shape
 * expected by the attribution engine, bucketing by local date.
 */
function mapOrdersForAttribution(
  shopifyOrders: Array<{
    id: string;
    orderCreatedAt: Date;
    totalPrice: number;
    utmCampaign: string | null;
    utmContent: string | null;
    clientAccountId: string | null;
  }>,
  tz: string,
): OrderForAttribution[] {
  return shopifyOrders.map(o => ({
    id: o.id,
    clientAccountId: o.clientAccountId!,
    date: toTimezoneDate(o.orderCreatedAt, tz),
    revenue: o.totalPrice ?? 0,
    utmCampaign: o.utmCampaign ?? undefined,
    utmContent: o.utmContent ?? undefined,
  }));
}

// ─── Shared Shopify order select shape ──────────────────────────────────────
// Used by ad set and ad level queries that need full order data for attribution.

const SHOPIFY_ORDER_SELECT_FOR_ATTRIBUTION = {
  id: true,
  orderCreatedAt: true,
  totalPrice: true,
  utmCampaign: true,
  utmContent: true,
  clientAccountId: true,
} as const;

// ─── Timezone helpers ───────────────────────────────────────────────────────
// Duplicated from lib/charts/dataService.ts to avoid circular imports.
// These convert YYYY-MM-DD date strings (in account timezone) to UTC Date
// objects for Prisma's gte/lte filters on DateTime fields.

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

// ═══════════════════════════════════════════════════════════════════════════════
// getCampaignStats — Top-level campaign rows for a client
// ═══════════════════════════════════════════════════════════════════════════════
//
// Query plan (4 parallel queries via Promise.all):
//   1. MetaSyncedCampaign     — campaign metadata (name, status)
//   2. MetaSyncedInsight      — groupBy externalCampaignId (spend, impressions, clicks)
//   3. ShopifyOrder           — CRM orders for revenue attribution
//   4. MetaSyncedAdSet        — groupBy externalCampaignId for child counts
//
// Revenue: Direct CRM match — utmCampaign ↔ normalized campaign name.
// ═══════════════════════════════════════════════════════════════════════════════

export async function getCampaignStats(
  clientId: string,
  startDate: string,
  endDate: string,
  options: { activeOnly?: boolean; search?: string; timezone?: string } = {},
): Promise<StatsApiResponse> {
  const { activeOnly, search, timezone } = options;
  const tz = timezone || "America/New_York";

  const adAccountIds = await resolveClientAdAccountIds(clientId);
  if (adAccountIds.length === 0) return EMPTY_RESPONSE;

  // ── Parallel fetch: campaigns, insights, CRM orders, child counts ────────
  const [campaigns, insightAggs, shopifyOrders, adSetCounts] = await Promise.all([
    // Campaign metadata — filtered by active status and name search
    prisma.metaSyncedCampaign.findMany({
      where: {
        externalAdAccountId: { in: adAccountIds },
        ...(activeOnly ? { status: "ACTIVE" } : {}),
        ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
      },
    }),

    // Spend/impressions/clicks aggregated by campaign.
    // IMPORTANT: Meta sync only stores ad-level insight rows (level: "ad").
    // Campaign-level rows do NOT exist in the DB. We aggregate ad-level
    // rows grouped by externalCampaignId to derive campaign totals.
    // Uses index: (externalCampaignId, level, dateStart)
    prisma.metaSyncedInsight.groupBy({
      by: ["externalCampaignId"],
      where: {
        externalAdAccountId: { in: adAccountIds },
        level: "ad",
        dateStart: { gte: startDate, lte: endDate },
        externalCampaignId: { not: "" },
      },
      _sum: { spend: true, impressions: true, clicks: true },
    }),

    // CRM orders for this client in the date range.
    // Timezone-aware: converts YYYY-MM-DD boundaries to UTC using account tz.
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

    // Count of ad sets per campaign (for the expand chevron indicator).
    // Respects activeOnly so the count matches what expanding will show.
    prisma.metaSyncedAdSet.groupBy({
      by: ["externalCampaignId"],
      where: {
        externalAdAccountId: { in: adAccountIds },
        ...(activeOnly ? { status: "ACTIVE" } : {}),
      },
      _count: true,
    }),
  ]);

  // ── Build lookup maps ────────────────────────────────────────────────────
  const insightMap = new Map(
    insightAggs.map(r => [r.externalCampaignId, {
      spend: r._sum.spend ?? 0,
      impressions: r._sum.impressions ?? 0,
      clicks: r._sum.clicks ?? 0,
    }]),
  );

  // Revenue attribution: match CRM orders to campaigns by normalized UTM campaign name
  const campaignNames = new Map(campaigns.map(c => [c.externalCampaignId, c.name]));
  const campaignRevenue = attributeOrdersToCampaigns(shopifyOrders, campaignNames);

  const adSetCountMap = new Map(adSetCounts.map(r => [r.externalCampaignId, r._count]));

  // ── Build rows ───────────────────────────────────────────────────────────
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

  rows.sort((a, b) => b.spend - a.spend);
  return { rows, totals: computeTotals(rows) };
}

// ═══════════════════════════════════════════════════════════════════════════════
// getAdSetStats — Ad sets within a campaign
// ═══════════════════════════════════════════════════════════════════════════════
//
// Query plan (7 parallel queries via Promise.all):
//   1. MetaSyncedAdSet        — ad set metadata
//   2. MetaSyncedInsight      — groupBy externalAdSetId at adset level
//   3. MetaSyncedAd           — groupBy externalAdSetId for child counts
//   4. MetaSyncedAd           — all ads in campaign (for revenue attribution)
//   5. MetaSyncedInsight      — ad-level daily rows (for spend-share indexes)
//   6. ShopifyOrder           — CRM orders with utmContent (for attribution)
//   7. MetaSyncedCampaign     — parent campaign name (for UTM matching)
//
// Revenue: Attribute orders to ads via UTM content matching, then roll up
//          ad revenue to their parent ad sets.
// ═══════════════════════════════════════════════════════════════════════════════

export async function getAdSetStats(
  clientId: string,
  parentCampaignId: string,
  startDate: string,
  endDate: string,
  options: { activeOnly?: boolean; search?: string; timezone?: string } = {},
): Promise<StatsApiResponse> {
  const { activeOnly, search, timezone } = options;
  const tz = timezone || "America/New_York";

  const adAccountIds = await resolveClientAdAccountIds(clientId);
  if (adAccountIds.length === 0) return EMPTY_RESPONSE;

  // ── Parallel fetch ───────────────────────────────────────────────────────
  const [adSets, insightAggs, adCounts, ads, adInsightRows, shopifyOrders, campaign] = await Promise.all([
    // Ad set metadata for this campaign
    prisma.metaSyncedAdSet.findMany({
      where: {
        externalCampaignId: parentCampaignId,
        externalAdAccountId: { in: adAccountIds },
        ...(activeOnly ? { status: "ACTIVE" } : {}),
        ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
      },
    }),

    // Ad set delivery metrics — aggregated from ad-level insight rows.
    // Meta sync only stores ad-level rows; adset-level rows don't exist.
    // Uses index: (externalCampaignId, level, dateStart)
    prisma.metaSyncedInsight.groupBy({
      by: ["externalAdSetId"],
      where: {
        externalCampaignId: parentCampaignId,
        level: "ad",
        dateStart: { gte: startDate, lte: endDate },
        externalAdSetId: { not: "" },
      },
      _sum: { spend: true, impressions: true, clicks: true },
    }),

    // Count of ads per ad set (for expand chevron).
    // Respects activeOnly so the count matches what expanding will show.
    prisma.metaSyncedAd.groupBy({
      by: ["externalAdSetId"],
      where: {
        externalCampaignId: parentCampaignId,
        externalAdAccountId: { in: adAccountIds },
        ...(activeOnly ? { status: "ACTIVE" } : {}),
      },
      _count: true,
    }),

    // ALL ads in the parent campaign — needed for revenue attribution.
    // Attribution is campaign-scoped: spend-share distributes across all
    // ads in the campaign, not just those in one ad set.
    // Only fetch the 3 fields the attribution engine needs.
    prisma.metaSyncedAd.findMany({
      where: {
        externalCampaignId: parentCampaignId,
        externalAdAccountId: { in: adAccountIds },
      },
      select: {
        externalAdId: true,
        externalAdSetId: true,
        name: true,
      },
    }),

    // Ad-level daily insight rows for the campaign — builds the
    // daily spend indexes needed by the attribution engine.
    // Only fetch rows with actual spend to reduce attribution input.
    // Uses index: (externalCampaignId, level, dateStart)
    prisma.metaSyncedInsight.findMany({
      where: {
        externalCampaignId: parentCampaignId,
        level: "ad",
        dateStart: { gte: startDate, lte: endDate },
        externalAdId: { not: "" },
        spend: { gt: 0 },
      },
      select: {
        externalAdId: true,
        externalCampaignId: true,
        dateStart: true,
        spend: true,
      },
    }),

    // CRM orders for attribution (includes utmContent for ad matching)
    prisma.shopifyOrder.findMany({
      where: {
        clientAccountId: clientId,
        orderCreatedAt: {
          gte: startOfDayInTz(startDate, tz),
          lte: endOfDayInTz(endDate, tz),
        },
      },
      select: SHOPIFY_ORDER_SELECT_FOR_ATTRIBUTION,
    }),

    // Parent campaign name — needed to match utmCampaign in orders
    prisma.metaSyncedCampaign.findUnique({
      where: { externalCampaignId: parentCampaignId },
      select: { name: true },
    }),
  ]);

  // ── Revenue attribution: orders → ads → ad sets ──────────────────────────
  const { adDailySpend, campaignDailySpend } = buildDailySpendIndexes(adInsightRows);

  const orders = mapOrdersForAttribution(shopifyOrders, tz);

  // Campaign/account IDs are known in scope — no need to fetch them per-ad.
  const adsForAttribution: AdForAttribution[] = ads.map(a => ({
    externalAdId: a.externalAdId,
    externalCampaignId: parentCampaignId,
    externalAdAccountId: adAccountIds[0],
    name: a.name,
  }));

  const campaignNameById = new Map<string, string>();
  if (campaign?.name) campaignNameById.set(parentCampaignId, campaign.name);

  // Step 1: Attribute orders to ads
  const adRevenueMap = attributeOrdersToAdsForStats({
    orders,
    ads: adsForAttribution,
    adDailySpend,
    campaignDailySpend,
    campaignNameById,
  });

  // Step 2: Roll up ad revenue to their parent ad sets
  const adToAdSetMap = new Map(ads.map(a => [a.externalAdId, a.externalAdSetId]));
  const adSetRevenueMap = rollUpAdRevenueToAdSets(adRevenueMap, adToAdSetMap);

  // ── Build lookup maps ────────────────────────────────────────────────────
  const insightMap = new Map(
    insightAggs.map(r => [r.externalAdSetId, {
      spend: r._sum.spend ?? 0,
      impressions: r._sum.impressions ?? 0,
      clicks: r._sum.clicks ?? 0,
    }]),
  );

  const adCountMap = new Map(adCounts.map(r => [r.externalAdSetId, r._count]));

  // ── Build rows ───────────────────────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════════════════════
// getAdStats — Ads within an ad set
// ═══════════════════════════════════════════════════════════════════════════════
//
// Query plan (6 parallel queries after resolving parent campaign):
//   1. MetaSyncedAd           — ads in this ad set
//   2. MetaSyncedInsight      — groupBy externalAdId at ad level
//   3. MetaSyncedAd           — all ads in parent campaign (for attribution)
//   4. MetaSyncedInsight      — ad-level daily rows (for spend-share indexes)
//   5. ShopifyOrder           — CRM orders (for attribution)
//   6. MetaSyncedCampaign     — parent campaign name
//
// NOTE: Attribution is campaign-scoped, not ad-set-scoped. When distributing
// unmatched orders by spend-share, the denominator includes ALL ads in the
// campaign — not just ads in this ad set. This ensures sum(ad revenue) across
// all ad sets equals the campaign's total CRM revenue.
// ═══════════════════════════════════════════════════════════════════════════════

export async function getAdStats(
  clientId: string,
  parentAdSetId: string,
  startDate: string,
  endDate: string,
  options: { activeOnly?: boolean; search?: string; timezone?: string } = {},
): Promise<StatsApiResponse> {
  const { activeOnly, search, timezone } = options;
  const tz = timezone || "America/New_York";

  const adAccountIds = await resolveClientAdAccountIds(clientId);
  if (adAccountIds.length === 0) return EMPTY_RESPONSE;

  // Resolve the parent campaign ID — needed because revenue attribution
  // is campaign-scoped, not ad-set-scoped.
  const parentAdSet = await prisma.metaSyncedAdSet.findUnique({
    where: { externalAdSetId: parentAdSetId },
    select: { externalCampaignId: true },
  });

  // If the ad set doesn't exist, return empty — don't silently query with ""
  if (!parentAdSet) return EMPTY_RESPONSE;
  const parentCampaignId = parentAdSet.externalCampaignId;

  // ── Parallel fetch ───────────────────────────────────────────────────────
  const [adsInAdSet, insightAggs, allCampaignAds, adInsightRows, shopifyOrders, campaign] = await Promise.all([
    // Ads in this specific ad set (filtered by status/search).
    // Select externalCreativeId so we can join to MetaSyncedCreative.
    prisma.metaSyncedAd.findMany({
      where: {
        externalAdSetId: parentAdSetId,
        externalAdAccountId: { in: adAccountIds },
        ...(activeOnly ? { status: "ACTIVE" } : {}),
        ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
      },
    }),

    // Ad-level insight aggregation for this ad set.
    // Uses index: (externalAdSetId, level, dateStart)
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

    // ALL ads in the parent campaign — for campaign-scoped attribution.
    // Only fetch the 3 fields the attribution engine needs.
    prisma.metaSyncedAd.findMany({
      where: {
        externalCampaignId: parentCampaignId,
        externalAdAccountId: { in: adAccountIds },
      },
      select: {
        externalAdId: true,
        externalAdSetId: true,
        name: true,
      },
    }),

    // Ad-level daily insights for the entire parent campaign.
    // Only rows with spend > 0 — reduces attribution input set.
    // Uses index: (externalCampaignId, level, dateStart)
    prisma.metaSyncedInsight.findMany({
      where: {
        externalCampaignId: parentCampaignId,
        level: "ad",
        dateStart: { gte: startDate, lte: endDate },
        externalAdId: { not: "" },
        spend: { gt: 0 },
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
      select: SHOPIFY_ORDER_SELECT_FOR_ATTRIBUTION,
    }),

    // Campaign name for UTM matching
    prisma.metaSyncedCampaign.findUnique({
      where: { externalCampaignId: parentCampaignId },
      select: { name: true },
    }),
  ]);

  // ── Fetch creative metadata for ad preview (after we have adsInAdSet) ────
  const creativeIds = adsInAdSet
    .map(a => a.externalCreativeId)
    .filter((id): id is string => !!id);

  const creatives = creativeIds.length > 0
    ? await prisma.metaSyncedCreative.findMany({
        where: { externalCreativeId: { in: creativeIds } },
        select: {
          externalCreativeId: true,
          name: true,
          title: true,
          body: true,
          callToAction: true,
          imageUrl: true,
          thumbnailUrl: true,
        },
      })
    : [];

  const creativeMap = new Map(creatives.map(c => [c.externalCreativeId, c]));

  // ── Revenue attribution: orders → ads ────────────────────────────────────
  const { adDailySpend, campaignDailySpend } = buildDailySpendIndexes(adInsightRows);

  const orders = mapOrdersForAttribution(shopifyOrders, tz);

  const adsForAttribution: AdForAttribution[] = allCampaignAds.map(a => ({
    externalAdId: a.externalAdId,
    externalCampaignId: parentCampaignId,
    externalAdAccountId: adAccountIds[0],
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

  // ── Build lookup maps ────────────────────────────────────────────────────
  const insightMap = new Map(
    insightAggs.map(r => [r.externalAdId, {
      spend: r._sum.spend ?? 0,
      impressions: r._sum.impressions ?? 0,
      clicks: r._sum.clicks ?? 0,
    }]),
  );

  // ── Build rows (only ads belonging to this ad set) ───────────────────────
  const rows: StatsRow[] = adsInAdSet.map(ad => {
    const insight = insightMap.get(ad.externalAdId) ?? { spend: 0, impressions: 0, clicks: 0 };
    const rev = adRevenueMap.get(ad.externalAdId);

    // Join creative metadata for ad preview drawer
    const cr = ad.externalCreativeId ? creativeMap.get(ad.externalCreativeId) : undefined;

    const row = buildStatsRow({
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
      childCount: 0,
    });

    if (cr) {
      row.creative = {
        imageUrl: cr.imageUrl,
        thumbnailUrl: cr.thumbnailUrl,
        body: cr.body,
        title: cr.title,
        callToAction: cr.callToAction,
        creativeName: cr.name,
      };
    }

    return row;
  });

  rows.sort((a, b) => b.spend - a.spend);
  return { rows, totals: computeTotals(rows) };
}

// ═══════════════════════════════════════════════════════════════════════════════
// searchAllLevels — Deep search across all hierarchy levels
// ═══════════════════════════════════════════════════════════════════════════════
//
// Query plan:
//   Phase 1: 3 parallel searches (campaigns, ad sets, ads by name)
//   Phase 2: 2 parallel ancestor fetches (campaigns, ad sets not in search results)
//   Phase 3: 6 parallel queries (insights for each level, orders, child counts)
//
// Returns all matched rows plus their ancestor chain so the frontend can
// auto-expand the hierarchy to show search matches in context.
//
// Revenue: Campaign-level only for search results. Ad set/ad revenue requires
// the full attribution engine per campaign — too expensive for cross-account search.
// When the user expands a specific campaign, the lazy-load fetch runs full attribution.
// ═══════════════════════════════════════════════════════════════════════════════

export async function searchAllLevels(
  clientId: string,
  search: string,
  startDate: string,
  endDate: string,
  options: { activeOnly?: boolean; timezone?: string } = {},
): Promise<StatsSearchResult> {
  const { activeOnly, timezone } = options;
  const tz = timezone || "America/New_York";

  const adAccountIds = await resolveClientAdAccountIds(clientId);
  if (adAccountIds.length === 0) {
    return { campaigns: [], adSets: [], ads: [], ancestorMap: {} };
  }

  // ── Phase 1: Search all 3 levels in parallel ─────────────────────────────
  const statusFilter = activeOnly ? { status: "ACTIVE" } : {};
  const nameFilter = { name: { contains: search, mode: "insensitive" as const } };
  const accountFilter = { externalAdAccountId: { in: adAccountIds } };

  // Cap search results to avoid runaway queries on broad terms.
  // 200 per level is enough to show meaningful results.
  const SEARCH_LIMIT = 200;

  const [matchedCampaigns, matchedAdSets, matchedAds] = await Promise.all([
    prisma.metaSyncedCampaign.findMany({ where: { ...accountFilter, ...nameFilter, ...statusFilter }, take: SEARCH_LIMIT }),
    prisma.metaSyncedAdSet.findMany({ where: { ...accountFilter, ...nameFilter, ...statusFilter }, take: SEARCH_LIMIT }),
    prisma.metaSyncedAd.findMany({ where: { ...accountFilter, ...nameFilter, ...statusFilter }, take: SEARCH_LIMIT }),
  ]);

  // ── Collect ancestor IDs needed for hierarchy context ────────────────────
  // If an ad matches, we need its parent ad set and campaign.
  // If an ad set matches, we need its parent campaign.
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

  // ── Phase 2: Fetch ancestor entities not already in search results ───────
  const existingCampaignIds = new Set(matchedCampaigns.map(c => c.externalCampaignId));
  const existingAdSetIds = new Set(matchedAdSets.map(as => as.externalAdSetId));

  const missingCampaignIds = [...campaignIdsNeeded].filter(id => !existingCampaignIds.has(id));
  const missingAdSetIds = [...adSetIdsNeeded].filter(id => !existingAdSetIds.has(id));

  const [ancestorCampaigns, ancestorAdSets] = await Promise.all([
    missingCampaignIds.length > 0
      ? prisma.metaSyncedCampaign.findMany({ where: { externalCampaignId: { in: missingCampaignIds } } })
      : [],
    missingAdSetIds.length > 0
      ? prisma.metaSyncedAdSet.findMany({ where: { externalAdSetId: { in: missingAdSetIds } } })
      : [],
  ]);

  const allCampaigns = [...matchedCampaigns, ...ancestorCampaigns];
  const allAdSets = [...matchedAdSets, ...ancestorAdSets];

  // ── Phase 3: Fetch insights, orders, and child counts in parallel ────────
  const allCampaignIds = [...new Set(allCampaigns.map(c => c.externalCampaignId))];
  const allAdSetIdsList = [...new Set(allAdSets.map(as => as.externalAdSetId))];
  const allAdIds = matchedAds.map(a => a.externalAdId);

  const [campaignInsights, adSetInsights, adInsights, shopifyOrders, adSetCounts, adCounts] = await Promise.all([
    // All three insight queries use level: "ad" since Meta sync only stores ad-level rows.
    // Campaign and adset totals are derived by grouping ad-level rows.
    prisma.metaSyncedInsight.groupBy({
      by: ["externalCampaignId"],
      where: {
        externalCampaignId: { in: allCampaignIds },
        level: "ad",
        dateStart: { gte: startDate, lte: endDate },
      },
      _sum: { spend: true, impressions: true, clicks: true },
    }),

    allAdSetIdsList.length > 0
      ? prisma.metaSyncedInsight.groupBy({
          by: ["externalAdSetId"],
          where: {
            externalAdSetId: { in: allAdSetIdsList },
            level: "ad",
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

    // CRM orders — only utmCampaign + totalPrice needed for campaign-level attribution
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

    // Child counts for expand indicators
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

  // ── Build lookup maps ────────────────────────────────────────────────────
  const campaignNames = new Map(allCampaigns.map(c => [c.externalCampaignId, c.name]));
  const campaignRevenue = attributeOrdersToCampaigns(shopifyOrders, campaignNames);

  const campaignInsightMap = new Map(
    campaignInsights.map(r => [r.externalCampaignId, { spend: r._sum.spend ?? 0, impressions: r._sum.impressions ?? 0, clicks: r._sum.clicks ?? 0 }]),
  );
  const adSetInsightMap = new Map(
    adSetInsights.map(r => [r.externalAdSetId, { spend: r._sum.spend ?? 0, impressions: r._sum.impressions ?? 0, clicks: r._sum.clicks ?? 0 }]),
  );
  const adInsightMap = new Map(
    adInsights.map(r => [r.externalAdId, { spend: r._sum.spend ?? 0, impressions: r._sum.impressions ?? 0, clicks: r._sum.clicks ?? 0 }]),
  );
  const adSetCountMap = new Map(adSetCounts.map(r => [r.externalCampaignId, r._count]));
  const adCountMap = new Map(adCounts.map(r => [r.externalAdSetId, r._count]));

  // ── Build rows ───────────────────────────────────────────────────────────
  const campaignRows: StatsRow[] = allCampaigns.map(c => {
    const insight = campaignInsightMap.get(c.externalCampaignId) ?? { spend: 0, impressions: 0, clicks: 0 };
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

  // NOTE: Ad set and ad rows in search results show delivery metrics only.
  // Full revenue attribution (UTM content matching) runs when the user
  // expands a specific campaign/ad set via the lazy-load path (getAdSetStats/getAdStats).
  // This is a deliberate performance trade-off — deep search can span many campaigns,
  // and running the full attribution engine for each would be prohibitively expensive.
  const adSetRows: StatsRow[] = allAdSets.map(as => {
    const insight = adSetInsightMap.get(as.externalAdSetId) ?? { spend: 0, impressions: 0, clicks: 0 };
    return buildStatsRow({
      id: as.id,
      externalId: as.externalAdSetId,
      parentExternalId: as.externalCampaignId,
      name: as.name,
      status: as.status,
      level: "adset",
      spend: insight.spend,
      impressions: insight.impressions,
      clicks: insight.clicks,
      revenue: 0,
      orders: 0,
      revenueSource: "none",
      childCount: adCountMap.get(as.externalAdSetId) ?? 0,
    });
  });

  const adRows: StatsRow[] = matchedAds.map(ad => {
    const insight = adInsightMap.get(ad.externalAdId) ?? { spend: 0, impressions: 0, clicks: 0 };
    return buildStatsRow({
      id: ad.id,
      externalId: ad.externalAdId,
      parentExternalId: ad.externalAdSetId,
      name: ad.name,
      status: ad.status,
      level: "ad",
      spend: insight.spend,
      impressions: insight.impressions,
      clicks: insight.clicks,
      revenue: 0,
      orders: 0,
      revenueSource: "none",
      childCount: 0,
    });
  });

  // ── Build ancestor map for auto-expand ───────────────────────────────────
  // Maps child externalId → array of ancestor externalIds (campaign, then ad set).
  // The frontend uses this to auto-expand parent rows when a child matches.
  const ancestorMap: Record<string, string[]> = {};
  for (const as of allAdSets) {
    if (!ancestorMap[as.externalAdSetId]) {
      ancestorMap[as.externalAdSetId] = [as.externalCampaignId];
    }
  }
  for (const ad of matchedAds) {
    ancestorMap[ad.externalAdId] = [ad.externalCampaignId, ad.externalAdSetId];
  }

  return { campaigns: campaignRows, adSets: adSetRows, ads: adRows, ancestorMap };
}
