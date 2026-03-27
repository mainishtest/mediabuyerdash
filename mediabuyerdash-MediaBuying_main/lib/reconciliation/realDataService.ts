// lib/reconciliation/realDataService.ts
// Builds UTMPerformanceRow[] from MetaSyncedInsight and CRMOrderRecord[] from
// ShopifyOrder so the reconciliation engine can run on real data.
//
// Architecture:
//   MetaSyncedInsight (campaign level) → UTMPerformanceRow[]
//   ShopifyOrder                       → CRMOrderRecord[]
//
// UTM bridging:
//   Meta does not embed UTM params in insight rows. To link Meta spend to
//   Shopify orders, we use the campaign name (normalized) as utm_campaign.
//   Shopify orders must have utm_campaign set to the same normalized campaign
//   name at checkout for a match to succeed. This is v1 — a UTM template
//   mapping table will improve match rates in v2.
//
// CRM source-of-truth rule (carried from product spec):
//   ROAS = crmRevenue / metaSpend
//   CPA  = metaSpend / crmOrders
//   Meta conversions/revenue fields are NEVER used for evaluation.

import { prisma }            from "../db";
import type { UTMPerformanceRow } from "../../types/reporting";
import type { CRMOrderRecord }    from "../../types/crm";
import { normalizeUtmValue }      from "./utils";

// ---------------------------------------------------------------------------
// Meta → UTMPerformanceRow[]
// ---------------------------------------------------------------------------

/**
 * Build UTMPerformanceRow[] for a client from real MetaSyncedInsight data.
 *
 * Uses campaign-level insight rows so each (date, campaign) pair produces
 * exactly one UTMPerformanceRow. The normalized campaign name is used as
 * utm_campaign so the reconciliation engine can match against Shopify orders
 * that carry the same value in their utm_campaign field.
 *
 * Spend, impressions, clicks are taken directly from Meta.
 * Conversions and revenue are set to 0 — CRM is the source of truth.
 */
export async function buildMetaUTMRowsForClient(
  clientAccountId: string,
  dateFrom:         string,
  dateTo:           string
): Promise<UTMPerformanceRow[]> {
  // 1. Resolve the external ad account IDs linked to this client.
  const selectedAccounts = await prisma.metaSelectedAdAccount.findMany({
    where: { clientAccountId },
    include: { accessibleAdAccount: { select: { externalAdAccountId: true } } },
  });

  if (selectedAccounts.length === 0) return [];

  const externalAdAccountIds = selectedAccounts.map(
    (sa) => sa.accessibleAdAccount.externalAdAccountId
  );

  // 2. Aggregate spend/impressions/clicks by (campaignId, dateStart) across ALL
  //    insight levels (ad / adset / campaign). Insights may be stored at any level
  //    depending on the sync configuration; grouping without a level filter ensures
  //    we always capture spend regardless of which level was synced.
  const insightAggs = await prisma.metaSyncedInsight.groupBy({
    by:    ["externalCampaignId", "dateStart"],
    where: {
      externalAdAccountId: { in: externalAdAccountIds },
      dateStart:           { gte: dateFrom, lte: dateTo },
      externalCampaignId:  { not: "" },
    },
    _sum: { spend: true, impressions: true, clicks: true },
  });

  if (insightAggs.length === 0) return [];

  // 3. Batch-look up campaign names.
  const campaignIds = [...new Set(insightAggs.map((r) => r.externalCampaignId))];
  const campaigns   = await prisma.metaSyncedCampaign.findMany({
    where:  { externalCampaignId: { in: campaignIds } },
    select: { externalCampaignId: true, name: true },
  });
  const campaignNameById = new Map(campaigns.map((c) => [c.externalCampaignId, c.name]));

  // 4. Map to UTMPerformanceRow — one row per (date, campaign).
  return insightAggs.map((row, idx) => {
    const campaignName = campaignNameById.get(row.externalCampaignId) ?? row.externalCampaignId;
    const spend        = row._sum.spend       ?? 0;
    const impressions  = row._sum.impressions ?? 0;
    const clicks       = row._sum.clicks      ?? 0;

    return {
      id:              `${row.externalCampaignId}_${row.dateStart}_${idx}`,
      date:            row.dateStart,
      clientAccountId,
      campaignId:      row.externalCampaignId,
      campaignName,
      adSetId:         "",
      adSetName:       "",
      adId:            "",
      adName:          "",
      // Use normalized campaign name as utm_campaign for CRM matching.
      utm_campaign:    normalizeUtmValue(campaignName) || undefined,
      utm_content:     undefined,
      utm_term:        undefined,
      utm_source:      undefined,
      utm_medium:      undefined,
      spend,
      impressions,
      clicks,
      conversions:     0,   // CRM is source of truth — not used for evaluation
      revenue:         0,   // CRM is source of truth — not used for evaluation
      cpa:             0,
      roas:            0,
    };
  });
}

// ---------------------------------------------------------------------------
// ShopifyOrder → CRMOrderRecord[]
// ---------------------------------------------------------------------------

/**
 * Build CRMOrderRecord[] for a client from real ShopifyOrder data.
 *
 * Filters to orders where clientAccountId matches.
 * Revenue = order.totalPrice (full order value).
 * Date is derived from orderCreatedAt (UTC, ISO date portion).
 */
export async function buildCRMOrderRowsForClient(
  clientAccountId: string,
  dateFrom:         string,
  dateTo:           string
): Promise<CRMOrderRecord[]> {
  const dateFromDt = new Date(dateFrom + "T00:00:00.000Z");
  const dateToDt   = new Date(dateTo   + "T23:59:59.999Z");

  const orders = await prisma.shopifyOrder.findMany({
    where: {
      clientAccountId,
      orderCreatedAt: { gte: dateFromDt, lte: dateToDt },
    },
    select: {
      id:             true,
      externalOrderId: true,
      orderCreatedAt: true,
      totalPrice:     true,
      utmCampaign:    true,
      utmContent:     true,
      utmTerm:        true,
      utmSource:      true,
      utmMedium:      true,
    },
  });

  return orders.map((o) => ({
    id:              o.id,
    orderId:         o.externalOrderId,
    sourcePlatform:  "shopify" as const,
    clientAccountId,
    date:            o.orderCreatedAt.toISOString().slice(0, 10),
    utm_campaign:    o.utmCampaign  ?? undefined,
    utm_content:     o.utmContent   ?? undefined,
    utm_term:        o.utmTerm      ?? undefined,
    utm_source:      o.utmSource    ?? undefined,
    utm_medium:      o.utmMedium    ?? undefined,
    revenue:         o.totalPrice   ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Persisted reconciliation reader
// ---------------------------------------------------------------------------

/**
 * Load the most recent ReconciliationMatch rows for a client from the DB.
 * Used by the Reconciliation page on initial load to show the last run's results.
 * Returns [] if no rows exist yet.
 *
 * Optional dateFrom/dateTo filter the DB query so the page can be scoped to
 * a specific period. When omitted, returns the 500 most recent rows.
 */
export async function loadLatestReconciliationMatches(
  clientAccountId: string,
  dateFrom?: string,
  dateTo?:   string,
  limit = 500
) {
  return prisma.reconciliationMatch.findMany({
    where: {
      clientAccountId,
      ...(dateFrom ? { date: { gte: dateFrom } } : {}),
      ...(dateTo   ? { date: { lte: dateTo   } } : {}),
    },
    orderBy: { date: "desc" },
    take:    limit,
  });
}

/**
 * Load the most recent ReconciliationSummary for a client.
 * Returns null if none exists.
 */
export async function loadLatestReconciliationSummary(
  clientAccountId: string
) {
  return prisma.reconciliationSummary.findFirst({
    where:   { clientAccountId },
    orderBy: { createdAt: "desc" },
  });
}
