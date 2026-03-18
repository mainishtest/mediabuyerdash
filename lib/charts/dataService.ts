// lib/charts/dataService.ts
// Server-side queries that produce time-series data for charts.
//
// All monetary values are in the client's native currency (USD by default).
// Dates are ISO strings (YYYY-MM-DD) in the ad account's timezone — same
// convention used by MetaSyncedInsight.dateStart.
//
// CRM source-of-truth rule is maintained:
//   revenue always comes from ShopifyOrder.totalPrice (never Meta revenue)
//   ROAS = crmRevenue / metaSpend (computed per-day, null when spend = 0)

import { prisma } from "../db";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface DailyPoint {
  date:     string;   // YYYY-MM-DD
  spend:    number;
  revenue:  number;
  orders:   number;
  roas:     number | null;  // revenue / spend, null when spend = 0
}

export interface SparkPoint {
  date:  string;
  spend: number;
}

// ---------------------------------------------------------------------------
// Client-level daily metrics (for the campaigns-page overview chart)
// ---------------------------------------------------------------------------

/**
 * Returns daily spend (from MetaSyncedInsight) and CRM revenue (from ShopifyOrder)
 * for a client over the past `days` days.
 *
 * Both series are aligned to the same date range; days with no data have value 0.
 */
export async function getClientDailyMetrics(
  clientAccountId: string,
  days = 30
): Promise<DailyPoint[]> {
  const since = daysAgo(days);

  // Resolve ad account IDs for this client.
  const selectedAccounts = await prisma.metaSelectedAdAccount.findMany({
    where:   { clientAccountId },
    include: { accessibleAdAccount: { select: { externalAdAccountId: true } } },
  });

  if (selectedAccounts.length === 0) return fillZeroDays(since, days);

  const adAccountIds = selectedAccounts.map(
    (sa) => sa.accessibleAdAccount.externalAdAccountId
  );

  // Daily spend from campaign-level insights.
  const insightRows = await prisma.metaSyncedInsight.groupBy({
    by:    ["dateStart"],
    where: {
      externalAdAccountId: { in: adAccountIds },
      level:               "campaign",
      dateStart:           { gte: since },
    },
    _sum: { spend: true },
    orderBy: { dateStart: "asc" },
  });

  // Daily CRM revenue from Shopify.
  const orderRows = await prisma.shopifyOrder.findMany({
    where: {
      clientAccountId,
      orderCreatedAt: { gte: new Date(since + "T00:00:00.000Z") },
    },
    select: { orderCreatedAt: true, totalPrice: true },
  });

  return mergeIntoDailyPoints(insightRows, orderRows, since, days);
}

// ---------------------------------------------------------------------------
// Per-campaign daily metrics (for the campaign drill-down chart)
// ---------------------------------------------------------------------------

/**
 * Returns daily spend + CRM revenue for a single campaign.
 *
 * Revenue is attributed to the campaign by matching ShopifyOrder.utmCampaign
 * (normalized) against the campaign name — same logic as the aggregator.
 */
export async function getCampaignDailyMetrics(
  externalCampaignId: string,
  clientAccountId:    string,
  days = 30
): Promise<DailyPoint[]> {
  const since = daysAgo(days);

  // Look up campaign name for UTM matching.
  const campaign = await prisma.metaSyncedCampaign.findUnique({
    where:  { externalCampaignId },
    select: { name: true },
  });

  // Daily spend for this campaign.
  const insightRows = await prisma.metaSyncedInsight.groupBy({
    by:    ["dateStart"],
    where: {
      externalCampaignId,
      level:     "campaign",
      dateStart: { gte: since },
    },
    _sum: { spend: true },
    orderBy: { dateStart: "asc" },
  });

  // CRM orders attributed to this campaign by normalized utm_campaign name.
  const normalizedName = (campaign?.name ?? "").toLowerCase().trim();
  const orderRows = await prisma.shopifyOrder.findMany({
    where: {
      clientAccountId,
      orderCreatedAt: { gte: new Date(since + "T00:00:00.000Z") },
      ...(normalizedName
        ? { utmCampaign: { equals: normalizedName, mode: "insensitive" } }
        : {}),
    },
    select: { orderCreatedAt: true, totalPrice: true },
  });

  return mergeIntoDailyPoints(insightRows, orderRows, since, days);
}

// ---------------------------------------------------------------------------
// Per-campaign sparkline data (batch — for the campaign list page)
// ---------------------------------------------------------------------------

/**
 * Returns spend-only sparkline series for every campaign in a client account.
 * Returns a map keyed by externalCampaignId.
 *
 * Batches a single insight query across all campaigns for efficiency.
 */
export async function getCampaignSparklines(
  clientAccountId: string,
  days = 30
): Promise<Record<string, SparkPoint[]>> {
  const since = daysAgo(days);

  const selectedAccounts = await prisma.metaSelectedAdAccount.findMany({
    where:   { clientAccountId },
    include: { accessibleAdAccount: { select: { externalAdAccountId: true } } },
  });

  if (selectedAccounts.length === 0) return {};

  const adAccountIds = selectedAccounts.map(
    (sa) => sa.accessibleAdAccount.externalAdAccountId
  );

  // Fetch campaign-level daily spend across all campaigns.
  const rows = await prisma.metaSyncedInsight.groupBy({
    by:    ["externalCampaignId", "dateStart"],
    where: {
      externalAdAccountId: { in: adAccountIds },
      level:               "campaign",
      dateStart:           { gte: since },
      externalCampaignId:  { not: "" },
    },
    _sum: { spend: true },
    orderBy: { dateStart: "asc" },
  });

  // Group into per-campaign series.
  const result: Record<string, SparkPoint[]> = {};
  for (const row of rows) {
    const id = row.externalCampaignId;
    result[id] ??= [];
    result[id].push({ date: row.dateStart, spend: row._sum.spend ?? 0 });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Fill a date range with zero-value DailyPoints. */
function fillZeroDays(since: string, days: number): DailyPoint[] {
  const result: DailyPoint[] = [];
  for (let i = days; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    result.push({
      date:    d.toISOString().slice(0, 10),
      spend:   0,
      revenue: 0,
      orders:  0,
      roas:    null,
    });
  }
  return result;
}

type InsightGroup = { dateStart: string; _sum: { spend: number | null } };
type OrderRow     = { orderCreatedAt: Date; totalPrice: number };

function mergeIntoDailyPoints(
  insightGroups: InsightGroup[],
  orderRows:     OrderRow[],
  since:         string,
  days:          number
): DailyPoint[] {
  // Build lookup maps.
  const spendByDate:   Record<string, number> = {};
  const revenueByDate: Record<string, number> = {};
  const ordersByDate:  Record<string, number> = {};

  for (const r of insightGroups) {
    spendByDate[r.dateStart] = (spendByDate[r.dateStart] ?? 0) + (r._sum.spend ?? 0);
  }
  for (const o of orderRows) {
    const d = o.orderCreatedAt.toISOString().slice(0, 10);
    revenueByDate[d] = (revenueByDate[d] ?? 0) + (o.totalPrice ?? 0);
    ordersByDate[d]  = (ordersByDate[d]  ?? 0) + 1;
  }

  // Build contiguous date series from since → today.
  const result: DailyPoint[] = [];
  for (let i = days; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date    = d.toISOString().slice(0, 10);
    if (date < since) continue;
    const spend   = spendByDate[date]   ?? 0;
    const revenue = revenueByDate[date] ?? 0;
    const orders  = ordersByDate[date]  ?? 0;
    result.push({
      date,
      spend:   Math.round(spend   * 100) / 100,
      revenue: Math.round(revenue * 100) / 100,
      orders,
      roas:    spend > 0 ? Math.round((revenue / spend) * 100) / 100 : null,
    });
  }
  return result;
}
