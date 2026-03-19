import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";

type RouteContext = { params: { token: string } };

/**
 * GET /api/portal/[token]?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Public (no auth) — returns aggregated stats for the client linked to the token.
 * Response shape:
 * {
 *   client: { name, brandName, currency },
 *   summary: { totalSpend, totalRevenue, totalOrders, totalImpressions, totalClicks, overallRoas, overallCpa },
 *   dailyRows: [{ date, spend, revenue, orders, impressions, clicks, roas, cpa }],
 *   campaignRows: [{ campaignId, campaignName, spend, revenue, orders, roas, cpa, impressions, clicks }],
 *   adRows: [{ adId, adName, campaignName, spend, revenue, orders, roas, cpa, impressions, clicks }],
 * }
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  const { token } = params;

  const account = await prisma.clientAccount.findUnique({
    where: { clientPortalToken: token },
    select: { id: true, name: true, brandName: true, currency: true },
  });

  if (!account) {
    return NextResponse.json({ error: "Invalid or expired portal link" }, { status: 404 });
  }

  const url = new URL(req.url);
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const from = url.searchParams.get("from") ?? thirtyDaysAgo;
  const to   = url.searchParams.get("to")   ?? today;

  const clientId = account.id;

  // Fetch UTM performance rows for date range (contains daily spend + reconciled revenue)
  const utmRows = await prisma.uTMPerformanceRow.findMany({
    where: {
      clientAccountId: clientId,
      date: { gte: from, lte: to },
    },
    select: {
      date: true,
      campaignId: true,
      campaignName: true,
      adId: true,
      adName: true,
      spend: true,
      impressions: true,
      clicks: true,
      conversions: true,
      revenue: true,
    },
    orderBy: { date: "asc" },
  });

  // ── Daily totals ─────────────────────────────────────────────────────────────
  const dailyMap = new Map<string, {
    date: string; spend: number; revenue: number; orders: number;
    impressions: number; clicks: number;
  }>();

  for (const row of utmRows) {
    const existing = dailyMap.get(row.date) ?? {
      date: row.date, spend: 0, revenue: 0, orders: 0, impressions: 0, clicks: 0,
    };
    existing.spend       += row.spend;
    existing.revenue     += row.revenue;
    existing.orders      += row.conversions;
    existing.impressions += row.impressions;
    existing.clicks      += row.clicks;
    dailyMap.set(row.date, existing);
  }

  const dailyRows = Array.from(dailyMap.values()).map((d) => ({
    ...d,
    roas: d.spend > 0 ? d.revenue / d.spend : null,
    cpa:  d.orders > 0 ? d.spend / d.orders : null,
  }));

  // ── Campaign totals ──────────────────────────────────────────────────────────
  const campaignMap = new Map<string, {
    campaignId: string; campaignName: string;
    spend: number; revenue: number; orders: number; impressions: number; clicks: number;
  }>();

  for (const row of utmRows) {
    const key = row.campaignId ?? row.campaignName ?? "unknown";
    const existing = campaignMap.get(key) ?? {
      campaignId:   row.campaignId   ?? "",
      campaignName: row.campaignName ?? "Unknown Campaign",
      spend: 0, revenue: 0, orders: 0, impressions: 0, clicks: 0,
    };
    existing.spend       += row.spend;
    existing.revenue     += row.revenue;
    existing.orders      += row.conversions;
    existing.impressions += row.impressions;
    existing.clicks      += row.clicks;
    campaignMap.set(key, existing);
  }

  const campaignRows = Array.from(campaignMap.values())
    .map((c) => ({
      ...c,
      roas: c.spend > 0 ? c.revenue / c.spend : null,
      cpa:  c.orders > 0 ? c.spend / c.orders : null,
    }))
    .sort((a, b) => b.spend - a.spend);

  // ── Ad-level totals ──────────────────────────────────────────────────────────
  const adMap = new Map<string, {
    adId: string; adName: string; campaignName: string;
    spend: number; revenue: number; orders: number; impressions: number; clicks: number;
  }>();

  for (const row of utmRows) {
    const key = row.adId ?? row.adName ?? "unknown";
    const existing = adMap.get(key) ?? {
      adId:         row.adId      ?? "",
      adName:       row.adName    ?? "Unknown Ad",
      campaignName: row.campaignName ?? "",
      spend: 0, revenue: 0, orders: 0, impressions: 0, clicks: 0,
    };
    existing.spend       += row.spend;
    existing.revenue     += row.revenue;
    existing.orders      += row.conversions;
    existing.impressions += row.impressions;
    existing.clicks      += row.clicks;
    adMap.set(key, existing);
  }

  const adRows = Array.from(adMap.values())
    .map((a) => ({
      ...a,
      roas: a.spend > 0 ? a.revenue / a.spend : null,
      cpa:  a.orders > 0 ? a.spend / a.orders : null,
    }))
    .sort((a, b) => b.spend - a.spend);

  // ── Summary ──────────────────────────────────────────────────────────────────
  const totalSpend       = dailyRows.reduce((s, d) => s + d.spend, 0);
  const totalRevenue     = dailyRows.reduce((s, d) => s + d.revenue, 0);
  const totalOrders      = dailyRows.reduce((s, d) => s + d.orders, 0);
  const totalImpressions = dailyRows.reduce((s, d) => s + d.impressions, 0);
  const totalClicks      = dailyRows.reduce((s, d) => s + d.clicks, 0);

  const summary = {
    totalSpend,
    totalRevenue,
    totalOrders,
    totalImpressions,
    totalClicks,
    overallRoas: totalSpend > 0 ? totalRevenue / totalSpend : null,
    overallCpa:  totalOrders > 0 ? totalSpend / totalOrders : null,
  };

  return NextResponse.json({
    client: {
      name:      account.name,
      brandName: account.brandName ?? account.name,
      currency:  account.currency,
    },
    dateRange: { from, to },
    summary,
    dailyRows,
    campaignRows,
    adRows,
  });
}
