// app/api/clients/[clientId]/reconciliation/run/route.ts
// Runs the full reconciliation pipeline for a client over a date range.
// Persists both the row-level match data AND the per-campaign rollup, then
// returns the match rows, summary, and campaign performance rows.
//
// POST /api/clients/[clientId]/reconciliation/run
//   Body (optional): { dateFrom?: string, dateTo?: string }
//   → { matchRows, summary, campaignPerformance }
//
// If no date range is provided, defaults to the last 30 days.

import { NextRequest, NextResponse }         from "next/server";
import { prisma }                             from "../../../../../../lib/db";
import {
  buildMetaUTMRowsForClient,
  buildCRMOrderRowsForClient,
}                                             from "../../../../../../lib/reconciliation/realDataService";
import { reconcileMetaRowsWithShopifyOrders } from "../../../../../../lib/reconciliation/matchEngine";
import { summarizeReconciliationResults }     from "../../../../../../lib/reconciliation/summarize";
import {
  persistReconciliationMatches,
  persistReconciliationSummary,
  persistCampaignPerformance,
}                                             from "../../../../../../lib/reconciliation/persist";
import {
  attributeOrdersToCampaigns,
  aggregateCampaignRevenue,
  calculateCampaignPerformance,
}                                             from "../../../../../../lib/reconciliation/campaignPerformance";
import type { MetaCampaignSpend, OrderRecord } from "../../../../../../lib/reconciliation/campaignPerformance";
import { normalizeUtmValue }                  from "../../../../../../lib/reconciliation/utils";

type RouteParams = { params: { clientId: string } };

function defaultDateRange(): { dateFrom: string; dateTo: string } {
  const now  = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 30);
  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo:   now.toISOString().slice(0, 10),
  };
}

const ATTRIBUTION_WINDOW_DAYS = 7;

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { clientId } = params;

  // Verify the client exists.
  const client = await prisma.clientAccount.findUnique({
    where:  { id: clientId },
    select: { id: true },
  });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Parse optional date range from body.
  let dateFrom: string;
  let dateTo:   string;

  try {
    const body = await req.json().catch(() => ({}));
    const defaults = defaultDateRange();
    dateFrom = typeof body?.dateFrom === "string" ? body.dateFrom : defaults.dateFrom;
    dateTo   = typeof body?.dateTo   === "string" ? body.dateTo   : defaults.dateTo;
  } catch {
    const defaults = defaultDateRange();
    dateFrom = defaults.dateFrom;
    dateTo   = defaults.dateTo;
  }

  try {
    // ── 1. Load raw source data in parallel ──────────────────────────────────
    const [metaRows, crmOrders] = await Promise.all([
      buildMetaUTMRowsForClient(clientId, dateFrom, dateTo),
      buildCRMOrderRowsForClient(clientId, dateFrom, dateTo),
    ]);

    // ── 2. Row-level reconciliation (existing engine) ─────────────────────────
    const matchRows = reconcileMetaRowsWithShopifyOrders(metaRows, crmOrders, clientId);
    const summary   = summarizeReconciliationResults(matchRows, clientId);

    // ── 3. Per-campaign attribution pipeline ─────────────────────────────────
    //
    // Build MetaCampaignSpend[] from the UTM rows.
    // Each UTM row is one (campaign, date) record — aggregate per campaign.
    const campaignSpendMap = new Map<string, MetaCampaignSpend>();

    for (const row of metaRows) {
      if (!row.campaignId) continue;
      if (!campaignSpendMap.has(row.campaignId)) {
        campaignSpendMap.set(row.campaignId, {
          externalCampaignId: row.campaignId,
          campaignName:       row.campaignName,
          dailySpend:         [],
          totalSpend:         0,
        });
      }
      const c = campaignSpendMap.get(row.campaignId)!;
      c.dailySpend.push({ date: row.date, spend: row.spend });
      c.totalSpend += row.spend;
    }

    const campaigns = Array.from(campaignSpendMap.values());

    // Build OrderRecord[] from the CRM order data.
    const orders: OrderRecord[] = crmOrders.map((o) => ({
      id:           o.id,
      date:         o.date,
      revenue:      o.revenue,
      utmCampaign:  o.utm_campaign,
      utmContent:   o.utm_content,
      utmTerm:      o.utm_term,
    }));

    // Run the 4 named functions.
    const attributedOrders  = attributeOrdersToCampaigns(orders, campaigns, ATTRIBUTION_WINDOW_DAYS);
    const revenueAggregates = aggregateCampaignRevenue(attributedOrders, campaigns);
    const campaignPerf      = calculateCampaignPerformance(revenueAggregates, campaigns, ATTRIBUTION_WINDOW_DAYS);

    // ── 4. Persist all results (upserts — safe to re-run) ────────────────────
    await Promise.all([
      persistReconciliationMatches(matchRows),
      persistReconciliationSummary(summary),
      persistCampaignPerformance(clientId, dateFrom, dateTo, campaignPerf),
    ]);

    return NextResponse.json({ matchRows, summary, campaignPerformance: campaignPerf }, { status: 200 });
  } catch (err) {
    console.error("[reconciliation/run POST]", err);
    return NextResponse.json({ error: "Reconciliation run failed" }, { status: 500 });
  }
}
