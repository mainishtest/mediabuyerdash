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
//
// TIMEZONE HANDLING:
//   Meta insight dateStart is stored in the ad account's timezone.
//   Shopify orderCreatedAt is a UTC timestamp.
//   All date range calculations and order-date bucketing use the client's
//   timezone (from ClientAccount.timezone) so "today" and "yesterday" align
//   with the user's local calendar.

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
  days             = 30,
  startDate?:      string,   // YYYY-MM-DD; overrides days when provided
  endDate?:        string,   // YYYY-MM-DD; defaults to today when startDate set
  timezone?:       string,   // IANA timezone (e.g. "America/New_York"); defaults to UTC
): Promise<DailyPoint[]> {
  const tz    = timezone ?? "UTC";
  const since = startDate ?? daysAgo(days, tz);
  const until = endDate   ?? today(tz);

  // Resolve ad account IDs for this client.
  const selectedAccounts = await prisma.metaSelectedAdAccount.findMany({
    where:   { clientAccountId },
    include: { accessibleAdAccount: { select: { externalAdAccountId: true } } },
  });

  if (selectedAccounts.length === 0) return fillDateRange(since, until);

  const adAccountIds = selectedAccounts.map(
    (sa) => sa.accessibleAdAccount.externalAdAccountId
  );

  // Daily spend from campaign-level insights.
  const insightRows = await prisma.metaSyncedInsight.groupBy({
    by:    ["dateStart"],
    where: {
      externalAdAccountId: { in: adAccountIds },
      level:               "campaign",
      dateStart:           { gte: since, lte: until },
    },
    _sum: { spend: true },
    orderBy: { dateStart: "asc" },
  });

  // Daily CRM revenue from Shopify.
  // Use timezone-aware boundaries so the query window matches the local calendar.
  const orderRows = await prisma.shopifyOrder.findMany({
    where: {
      clientAccountId,
      orderCreatedAt: {
        gte: startOfDayInTz(since, tz),
        lte: endOfDayInTz(until, tz),
      },
    },
    select: { orderCreatedAt: true, totalPrice: true },
  });

  return mergeIntoDailyPoints(insightRows, orderRows, since, until, tz);
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
  days               = 30,
  startDate?:        string,   // YYYY-MM-DD; overrides days when provided
  endDate?:          string,   // YYYY-MM-DD; defaults to today when startDate set
  timezone?:         string,   // IANA timezone; defaults to UTC
): Promise<DailyPoint[]> {
  const tz    = timezone ?? "UTC";
  const since = startDate ?? daysAgo(days, tz);
  const until = endDate   ?? today(tz);

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
      dateStart: { gte: since, lte: until },
    },
    _sum: { spend: true },
    orderBy: { dateStart: "asc" },
  });

  // CRM orders attributed to this campaign by normalized utm_campaign name.
  const normalizedName = (campaign?.name ?? "").toLowerCase().trim();
  const orderRows = await prisma.shopifyOrder.findMany({
    where: {
      clientAccountId,
      orderCreatedAt: {
        gte: startOfDayInTz(since, tz),
        lte: endOfDayInTz(until, tz),
      },
      ...(normalizedName
        ? { utmCampaign: { equals: normalizedName, mode: "insensitive" } }
        : {}),
    },
    select: { orderCreatedAt: true, totalPrice: true },
  });

  return mergeIntoDailyPoints(insightRows, orderRows, since, until, tz);
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
  days             = 30,
  startDate?:      string,   // YYYY-MM-DD; overrides days when provided
  endDate?:        string,   // YYYY-MM-DD; defaults to today when startDate set
  timezone?:       string,   // IANA timezone; defaults to UTC
): Promise<Record<string, SparkPoint[]>> {
  const tz    = timezone ?? "UTC";
  const since = startDate ?? daysAgo(days, tz);
  const until = endDate   ?? today(tz);

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
      dateStart:           { gte: since, lte: until },
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
// Timezone-aware date helpers
// ---------------------------------------------------------------------------

/**
 * Return "today" as YYYY-MM-DD in the given IANA timezone.
 * Meta stores insight dateStart in the ad account's timezone, so this
 * must match the user's local calendar.
 */
function today(tz: string): string {
  return dateInTz(new Date(), tz);
}

/**
 * Return the date N days ago as YYYY-MM-DD in the given IANA timezone.
 */
function daysAgo(n: number, tz: string): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dateInTz(d, tz);
}

/**
 * Format a Date as YYYY-MM-DD in the given IANA timezone.
 */
function dateInTz(d: Date, tz: string): string {
  // Intl.DateTimeFormat with timeZone gives us the local date parts.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year:  "numeric",
    month: "2-digit",
    day:   "2-digit",
  }).format(d);
  // en-CA locale formats as YYYY-MM-DD
  return parts;
}

/**
 * Return a UTC Date representing the start of `dateStr` (YYYY-MM-DD) in `tz`.
 * E.g. startOfDayInTz("2026-03-24", "America/New_York") → 2026-03-24T04:00:00.000Z
 * (since EST is UTC-5, midnight ET = 5 AM UTC; EDT UTC-4 → 4 AM UTC)
 */
function startOfDayInTz(dateStr: string, tz: string): Date {
  // Create a date at noon UTC to avoid DST edge cases during parsing
  const noon = new Date(dateStr + "T12:00:00.000Z");
  // Get the UTC offset for this timezone on this date
  const localStr = noon.toLocaleString("en-US", { timeZone: tz });
  const localDate = new Date(localStr);
  const offsetMs = noon.getTime() - localDate.getTime();
  // Midnight local = midnight + offset to get UTC
  const midnight = new Date(dateStr + "T00:00:00.000Z");
  return new Date(midnight.getTime() + offsetMs);
}

/**
 * Return a UTC Date representing the end of `dateStr` (YYYY-MM-DD) in `tz`.
 * E.g. endOfDayInTz("2026-03-24", "America/New_York") → 2026-03-25T03:59:59.999Z
 */
function endOfDayInTz(dateStr: string, tz: string): Date {
  const start = startOfDayInTz(dateStr, tz);
  // End of day = start of day + 24h - 1ms
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

/** Fill a date range [startDate, endDate] with zero-value DailyPoints. */
function fillDateRange(startDate: string, endDate: string): DailyPoint[] {
  const result: DailyPoint[] = [];
  const cur = new Date(startDate + "T00:00:00.000Z");
  const end = new Date(endDate   + "T00:00:00.000Z");
  while (cur <= end) {
    result.push({
      date:    cur.toISOString().slice(0, 10),
      spend:   0,
      revenue: 0,
      orders:  0,
      roas:    null,
    });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return result;
}

type InsightGroup = { dateStart: string; _sum: { spend: number | null } };
type OrderRow     = { orderCreatedAt: Date; totalPrice: number };

function mergeIntoDailyPoints(
  insightGroups: InsightGroup[],
  orderRows:     OrderRow[],
  startDate:     string,
  endDate:       string,
  tz:            string = "UTC",
): DailyPoint[] {
  // Build lookup maps.
  const spendByDate:   Record<string, number> = {};
  const revenueByDate: Record<string, number> = {};
  const ordersByDate:  Record<string, number> = {};

  for (const r of insightGroups) {
    spendByDate[r.dateStart] = (spendByDate[r.dateStart] ?? 0) + (r._sum.spend ?? 0);
  }
  for (const o of orderRows) {
    // Bucket Shopify orders by the client's local date, not UTC.
    const d = dateInTz(o.orderCreatedAt, tz);
    revenueByDate[d] = (revenueByDate[d] ?? 0) + (o.totalPrice ?? 0);
    ordersByDate[d]  = (ordersByDate[d]  ?? 0) + 1;
  }

  // Build contiguous date series from startDate → endDate.
  const result: DailyPoint[] = [];
  const cur = new Date(startDate + "T00:00:00.000Z");
  const end = new Date(endDate   + "T00:00:00.000Z");
  while (cur <= end) {
    const date    = cur.toISOString().slice(0, 10);
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
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return result;
}
