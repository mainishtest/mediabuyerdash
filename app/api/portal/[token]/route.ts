import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "../../../../lib/db";
import { isPortalAuthenticated }     from "../../../../lib/portalAuth";

type RouteContext = { params: { token: string } };

/**
 * GET /api/portal/[token]?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Public but password-gated when clientPortalPasswordHash is set.
 * Returns { requiresPassword: true } if the client has a password and the
 * request does not carry a valid auth cookie.
 *
 * Data sources (in priority order):
 *   1. ReconciliationMatch — Meta spend + Shopify revenue/orders (best)
 *   2. UTMPerformanceRow   — legacy reconciled rows
 *   3. MetaSyncedInsight   — raw Meta sync data (spend + impressions + clicks)
 *      Used as fallback when neither reconciled source has data.
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  const { token } = params;

  const account = await prisma.clientAccount.findUnique({
    where:  { clientPortalToken: token },
    select: {
      id:                      true,
      name:                    true,
      brandName:               true,
      currency:                true,
      timezone:                true,
      clientPortalPasswordHash: true,
    },
  });

  if (!account) {
    return NextResponse.json({ error: "Invalid or expired portal link" }, { status: 404 });
  }

  // ── Password gate ──────────────────────────────────────────────────────────
  if (account.clientPortalPasswordHash && !isPortalAuthenticated(req, token)) {
    return NextResponse.json({ requiresPassword: true }, { status: 401 });
  }

  const url = new URL(req.url);

  // Use the client's timezone so "today" matches the user's local calendar
  const tz = account.timezone || "America/New_York";
  const dateInTz = (d: Date) => new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
  const today         = dateInTz(new Date());
  const thirtyDaysAgo = dateInTz(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const from          = url.searchParams.get("from") ?? thirtyDaysAgo;
  const to            = url.searchParams.get("to")   ?? today;
  const clientId      = account.id;

  type NormRow = {
    date: string; campaignId: string; campaignName: string;
    adId: string; adName: string;
    spend: number; impressions: number; clicks: number;
    conversions: number; revenue: number;
  };

  let rows: NormRow[];
  let dataSource: "reconciled" | "utm_reconciled" | "meta_insights" = "meta_insights";

  // ── 1. Try ReconciliationMatch (Meta spend + Shopify revenue/orders) ────
  const reconMatches = await prisma.reconciliationMatch.findMany({
    where: {
      clientAccountId: clientId,
      date: { gte: from, lte: to },
    },
    select: {
      date: true,
      metaCampaignId: true, metaAdId: true,
      utmCampaign: true,
      metaSpend: true, metaClicks: true, metaImpressions: true,
      crmOrders: true, crmRevenue: true,
    },
    orderBy: { date: "asc" },
  });

  if (reconMatches.length > 0) {
    dataSource = "reconciled";

    // Resolve campaign and ad names for display
    const campaignIds = [...new Set(reconMatches.map((m) => m.metaCampaignId).filter(Boolean))] as string[];
    const adIds       = [...new Set(reconMatches.map((m) => m.metaAdId).filter(Boolean))] as string[];

    const [campaigns, ads] = await Promise.all([
      campaignIds.length > 0
        ? prisma.metaSyncedCampaign.findMany({
            where:  { externalCampaignId: { in: campaignIds } },
            select: { externalCampaignId: true, name: true },
          })
        : [],
      adIds.length > 0
        ? prisma.metaSyncedAd.findMany({
            where:  { externalAdId: { in: adIds } },
            select: { externalAdId: true, name: true },
          })
        : [],
    ]);

    const campaignNameMap = new Map(campaigns.map((c) => [c.externalCampaignId, c.name]));
    const adNameMap       = new Map(ads.map((a) => [a.externalAdId, a.name]));

    // Only take delivery metrics from recon; revenue/orders come from
    // direct Shopify query below to avoid double-counting when recon
    // has both matched and unmatched_crm rows for the same orders.
    rows = reconMatches
      .filter((m) => m.metaCampaignId)          // skip unmatched_crm rows (no Meta side)
      .map((m) => ({
        date:         m.date,
        campaignId:   m.metaCampaignId ?? "",
        campaignName: campaignNameMap.get(m.metaCampaignId ?? "") ?? m.utmCampaign ?? "",
        adId:         m.metaAdId ?? "",
        adName:       adNameMap.get(m.metaAdId ?? "") ?? m.metaAdId ?? "",
        spend:        m.metaSpend,
        impressions:  m.metaImpressions ?? 0,
        clicks:       m.metaClicks ?? 0,
        conversions:  0,
        revenue:      0,
      }));
  } else {
    // ── 2. Try UTM performance rows ─────────────────────────────────────────
    const utmRows = await prisma.uTMPerformanceRow.findMany({
      where: {
        clientAccountId: clientId,
        date: { gte: from, lte: to },
      },
      select: {
        date: true, campaignId: true, campaignName: true,
        adId: true, adName: true,
        spend: true, impressions: true, clicks: true, conversions: true, revenue: true,
      },
      orderBy: { date: "asc" },
    });

    if (utmRows.length > 0) {
      dataSource = "utm_reconciled";
      rows = utmRows.map((r) => ({
        date:         r.date,
        campaignId:   r.campaignId   ?? "",
        campaignName: r.campaignName ?? "",
        adId:         r.adId         ?? "",
        adName:       r.adName       ?? "",
        spend:        r.spend,
        impressions:  r.impressions,
        clicks:       r.clicks,
        conversions:  0,   // revenue/orders come from direct Shopify query below
        revenue:      0,
      }));
    } else {
      // ── 3. Fallback: MetaSyncedInsight (raw Meta data) ──────────────────
      const selectedAccounts = await prisma.metaSelectedAdAccount.findMany({
        where:  { clientAccountId: clientId },
        select: { accessibleAdAccount: { select: { externalAdAccountId: true } } },
      });

      const adAccountIds = selectedAccounts
        .map((s) => s.accessibleAdAccount.externalAdAccountId)
        .filter(Boolean);

      if (adAccountIds.length > 0) {
        const insights = await prisma.metaSyncedInsight.findMany({
          where: {
            externalAdAccountId: { in: adAccountIds },
            dateStart: { gte: from, lte: to },
            level: "ad",
          },
          select: {
            dateStart: true,
            externalCampaignId: true,
            externalAdId: true,
            spend: true, impressions: true, clicks: true,
          },
          orderBy: { dateStart: "asc" },
        });

        const campaignIds = [...new Set(insights.map((i) => i.externalCampaignId).filter(Boolean))];
        const adIds       = [...new Set(insights.map((i) => i.externalAdId).filter(Boolean))];

        const [campaigns, ads] = await Promise.all([
          campaignIds.length > 0
            ? prisma.metaSyncedCampaign.findMany({
                where:  { externalCampaignId: { in: campaignIds } },
                select: { externalCampaignId: true, name: true },
              })
            : [],
          adIds.length > 0
            ? prisma.metaSyncedAd.findMany({
                where:  { externalAdId: { in: adIds } },
                select: { externalAdId: true, name: true },
              })
            : [],
        ]);

        const campaignNameMap = new Map(campaigns.map((c) => [c.externalCampaignId, c.name]));
        const adNameMap       = new Map(ads.map((a) => [a.externalAdId, a.name]));

        rows = insights.map((i) => ({
          date:         i.dateStart,
          campaignId:   i.externalCampaignId,
          campaignName: campaignNameMap.get(i.externalCampaignId) ?? i.externalCampaignId,
          adId:         i.externalAdId,
          adName:       adNameMap.get(i.externalAdId) ?? i.externalAdId,
          spend:        i.spend,
          impressions:  i.impressions,
          clicks:       i.clicks,
          conversions:  0,
          revenue:      0,
        }));
      } else {
        rows = [];
      }
    }
  }

  // ── Shopify orders (direct) ───────────────────────────────────────────────
  // Always query Shopify orders so revenue/orders appear even when
  // reconciliation hasn't run yet (e.g. today / yesterday).
  function startOfDayInTz(dateStr: string, tzId: string): Date {
    const noon = new Date(dateStr + "T12:00:00.000Z");
    const localStr = noon.toLocaleString("en-US", { timeZone: tzId });
    const localDate = new Date(localStr);
    const offsetMs = noon.getTime() - localDate.getTime();
    const midnight = new Date(dateStr + "T00:00:00.000Z");
    return new Date(midnight.getTime() + offsetMs);
  }
  function endOfDayInTz(dateStr: string, tzId: string): Date {
    return new Date(startOfDayInTz(dateStr, tzId).getTime() + 24 * 60 * 60 * 1000 - 1);
  }

  const shopifyOrders = await prisma.shopifyOrder.findMany({
    where: {
      clientAccountId: clientId,
      orderCreatedAt: {
        gte: startOfDayInTz(from, tz),
        lte: endOfDayInTz(to, tz),
      },
    },
    select: { orderCreatedAt: true, totalPrice: true, utmCampaign: true },
  });

  // Bucket Shopify orders by date in the client's timezone
  const shopifyByDate = new Map<string, { revenue: number; orders: number }>();
  for (const o of shopifyOrders) {
    const d = dateInTz(o.orderCreatedAt);
    const entry = shopifyByDate.get(d) ?? { revenue: 0, orders: 0 };
    entry.revenue += o.totalPrice;
    entry.orders  += 1;
    shopifyByDate.set(d, entry);
  }

  // ── Daily totals ──────────────────────────────────────────────────────────
  const dailyMap = new Map<string, {
    date: string; spend: number; revenue: number; orders: number;
    impressions: number; clicks: number;
  }>();

  for (const row of rows) {
    const d = dailyMap.get(row.date) ?? {
      date: row.date, spend: 0, revenue: 0, orders: 0, impressions: 0, clicks: 0,
    };
    d.spend       += row.spend;
    d.revenue     += row.revenue;
    d.orders      += row.conversions;
    d.impressions += row.impressions;
    d.clicks      += row.clicks;
    dailyMap.set(row.date, d);
  }

  // Shopify is the single source of truth for revenue/orders
  for (const [date, shopify] of shopifyByDate) {
    const existing = dailyMap.get(date);
    if (existing) {
      existing.revenue = shopify.revenue;
      existing.orders  = shopify.orders;
    } else {
      dailyMap.set(date, {
        date, spend: 0, revenue: shopify.revenue, orders: shopify.orders,
        impressions: 0, clicks: 0,
      });
    }
  }

  const dailyRows = Array.from(dailyMap.values()).map((d) => ({
    ...d,
    roas: d.spend > 0 ? d.revenue / d.spend : null,
    cpa:  d.orders > 0 ? d.spend / d.orders : null,
  }));

  // ── Campaign totals ───────────────────────────────────────────────────────
  const campaignMap = new Map<string, {
    campaignId: string; campaignName: string;
    spend: number; revenue: number; orders: number; impressions: number; clicks: number;
  }>();

  for (const row of rows) {
    const key      = row.campaignId || row.campaignName || "unknown";
    const existing = campaignMap.get(key) ?? {
      campaignId:   row.campaignId,
      campaignName: row.campaignName || "Unknown Campaign",
      spend: 0, revenue: 0, orders: 0, impressions: 0, clicks: 0,
    };
    existing.spend       += row.spend;
    existing.revenue     += row.revenue;
    existing.orders      += row.conversions;
    existing.impressions += row.impressions;
    existing.clicks      += row.clicks;
    campaignMap.set(key, existing);
  }

  // Merge Shopify CRM revenue into campaigns by matching utmCampaign → campaign name
  {
    const shopifyCrmByCampaign = new Map<string, { revenue: number; orders: number }>();
    for (const o of shopifyOrders) {
      const key = (o.utmCampaign ?? "").toLowerCase().trim();
      if (!key) continue;
      const entry = shopifyCrmByCampaign.get(key) ?? { revenue: 0, orders: 0 };
      entry.revenue += o.totalPrice;
      entry.orders  += 1;
      shopifyCrmByCampaign.set(key, entry);
    }
    for (const [, campaign] of campaignMap) {
      const crm = shopifyCrmByCampaign.get(campaign.campaignName.toLowerCase().trim());
      if (crm) {
        campaign.revenue = crm.revenue;
        campaign.orders  = crm.orders;
      }
    }
  }

  const campaignRows = Array.from(campaignMap.values())
    .map((c) => ({
      ...c,
      roas: c.spend > 0 ? c.revenue / c.spend : null,
      cpa:  c.orders > 0 ? c.spend / c.orders : null,
    }))
    .sort((a, b) => b.spend - a.spend);

  // ── Ad-level totals ───────────────────────────────────────────────────────
  const adMap = new Map<string, {
    adId: string; adName: string; campaignName: string;
    spend: number; revenue: number; orders: number; impressions: number; clicks: number;
  }>();

  for (const row of rows) {
    if (!row.adId && !row.adName) continue; // skip rows without ad-level data
    const key      = row.adId || row.adName || "unknown";
    const existing = adMap.get(key) ?? {
      adId:         row.adId,
      adName:       row.adName || "Unknown Ad",
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

  // ── Summary ───────────────────────────────────────────────────────────────
  const totalSpend       = dailyRows.reduce((s, d) => s + d.spend, 0);
  const totalRevenue     = dailyRows.reduce((s, d) => s + d.revenue, 0);
  const totalOrders      = dailyRows.reduce((s, d) => s + d.orders, 0);
  const totalImpressions = dailyRows.reduce((s, d) => s + d.impressions, 0);
  const totalClicks      = dailyRows.reduce((s, d) => s + d.clicks, 0);

  return NextResponse.json({
    client: {
      name:      account.name,
      brandName: account.brandName ?? account.name,
      currency:  account.currency,
    },
    dateRange:    { from, to },
    dataSource,
    summary: {
      totalSpend,
      totalRevenue,
      totalOrders,
      totalImpressions,
      totalClicks,
      overallRoas: totalSpend > 0 ? totalRevenue / totalSpend : null,
      overallCpa:  totalOrders > 0 ? totalSpend / totalOrders : null,
    },
    dailyRows,
    campaignRows,
    adRows,
  });
}
