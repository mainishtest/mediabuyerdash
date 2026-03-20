"use server";

// app/reconciliation/actions.ts
// Server actions for the Reconciliation page.

import { prisma }            from "../../lib/db";
import { normalizeUtmValue } from "../../lib/reconciliation/utils";

// ---------------------------------------------------------------------------
// Ad-level insight row — Meta delivery metrics only.
// CRM revenue cannot be attributed to individual ads without ad-level UTMs,
// which Meta does not expose in the standard Insights API.
// ---------------------------------------------------------------------------

export type AdInsightRow = {
  externalAdId: string;
  adName:        string | null;
  spend:         number;
  impressions:   number;
  clicks:        number;
  ctr:           number;        // (clicks / impressions) × 100, as %
  avgFrequency:  number | null; // null when no frequency data was synced
};

// ---------------------------------------------------------------------------
// fetchAdLevelInsightsAction
//
// Returns ad-level MetaSyncedInsight rows for a specific (campaign, date) pair.
// Called from the expandable row in ReconciliationTable when the buyer clicks
// the drill-down toggle on a reconciliation match row.
//
// Uses the match row's date so the breakdown is scoped to exactly the same day
// as the parent campaign row being expanded.
// ---------------------------------------------------------------------------

export async function fetchAdLevelInsightsAction(
  clientId:    string,
  utmCampaign: string,   // normalized campaign name from the reconciliation row
  date:        string,   // YYYY-MM-DD — the date of the parent row
): Promise<{ rows: AdInsightRow[]; error?: string }> {
  try {
    // 1. Resolve ad account IDs linked to this client.
    const selectedAccounts = await prisma.metaSelectedAdAccount.findMany({
      where:  { clientAccountId: clientId },
      select: { accessibleAdAccount: { select: { externalAdAccountId: true } } },
    });

    const adAccountIds = selectedAccounts
      .map((s) => s.accessibleAdAccount?.externalAdAccountId)
      .filter((id): id is string => !!id);

    if (adAccountIds.length === 0) {
      return { rows: [], error: "No Meta ad accounts found for this client." };
    }

    // 2. Discover which campaign IDs had activity on this date for this client.
    //    Using distinct on externalCampaignId is cheaper than groupBy when we
    //    only need the IDs, not aggregations.
    const campaignRows = await prisma.metaSyncedInsight.findMany({
      where: {
        externalAdAccountId: { in: adAccountIds },
        externalCampaignId:  { not: "" },
        dateStart:           date,
      },
      distinct: ["externalCampaignId"],
      select:   { externalCampaignId: true },
    });

    if (campaignRows.length === 0) {
      return { rows: [], error: "No insight data found for this date." };
    }

    // 3. Look up campaign names and filter to those matching this utm_campaign.
    const allCampaignIds = campaignRows.map((r) => r.externalCampaignId);
    const campaigns = await prisma.metaSyncedCampaign.findMany({
      where:  { externalCampaignId: { in: allCampaignIds } },
      select: { externalCampaignId: true, name: true },
    });

    const matchingCampaignIds = campaigns
      .filter((c) => normalizeUtmValue(c.name) === utmCampaign)
      .map((c) => c.externalCampaignId);

    if (matchingCampaignIds.length === 0) {
      return {
        rows:  [],
        error: "No Meta campaign found matching this campaign name. The campaign may have been renamed since the last sync.",
      };
    }

    // 4. Load ad-level insights for those campaigns on this date.
    const insights = await prisma.metaSyncedInsight.findMany({
      where: {
        externalAdAccountId: { in: adAccountIds },
        externalCampaignId:  { in: matchingCampaignIds },
        level:               "ad",
        dateStart:           date,
        externalAdId:        { not: "" },
      },
      select: {
        externalAdId: true,
        spend:        true,
        impressions:  true,
        clicks:       true,
        frequency:    true,
      },
    });

    if (insights.length === 0) {
      return {
        rows:  [],
        error: "No ad-level insights found. The Meta sync may have been run at campaign or ad set level only — re-sync with ad-level insight collection enabled.",
      };
    }

    // 5. Fetch ad names.
    const adIds = [...new Set(insights.map((i) => i.externalAdId))];
    const ads   = await prisma.metaSyncedAd.findMany({
      where:  { externalAdId: { in: adIds } },
      select: { externalAdId: true, name: true },
    });
    const adNameMap = new Map(ads.map((a) => [a.externalAdId, a.name]));

    // 6. Build result rows — one per ad, sorted by spend desc.
    const rows: AdInsightRow[] = insights
      .map((ins) => ({
        externalAdId: ins.externalAdId,
        adName:       adNameMap.get(ins.externalAdId) ?? null,
        spend:        ins.spend,
        impressions:  ins.impressions,
        clicks:       ins.clicks,
        ctr:          ins.impressions > 0 ? (ins.clicks / ins.impressions) * 100 : 0,
        avgFrequency: ins.frequency,
      }))
      .sort((a, b) => b.spend - a.spend);

    return { rows };
  } catch (err) {
    console.error("[fetchAdLevelInsightsAction]", err);
    return { rows: [], error: "Failed to load ad-level data. Check server logs for details." };
  }
}
