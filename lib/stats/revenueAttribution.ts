// lib/stats/revenueAttribution.ts
// Revenue attribution for the Stats hierarchical view.
//
// Reuses the attribution engine from lib/creativePerformance/attribution.ts
// for UTM content matching, but wraps it for the Stats use case:
//   - Campaign level: direct CRM matching by utmCampaign (same as aggregator.ts)
//   - Ad set level: attribute to ads first, then roll up to ad sets
//   - Ad level: full UTM content matching with spend-share fallback
//
// Revenue source of truth: CRM (Shopify). Meta revenue is never used.

import {
  attributeOrdersToAds,
  toTimezoneDate,
  dateRangeToUtc,
  type OrderForAttribution,
  type AdForAttribution,
} from "../creativePerformance/attribution";
import { normalizeUtmValue } from "../reconciliation/utils";
import type { RevenueSource } from "./statsTypes";

// ---------------------------------------------------------------------------
// Campaign-level: match orders by utmCampaign → campaign name
// (Same logic as lib/campaignPerformance/aggregator.ts)
// ---------------------------------------------------------------------------

export interface CampaignRevenue {
  revenue: number;
  orders: number;
  revenueSource: RevenueSource;
}

export function attributeOrdersToCampaigns(
  shopifyOrders: Array<{ utmCampaign: string | null; totalPrice: number }>,
  campaignNames: Map<string, string>, // externalCampaignId → name
): Map<string, CampaignRevenue> {
  // Build reverse map: normalized name → externalCampaignId
  const normNameToId = new Map<string, string>();
  for (const [id, name] of campaignNames) {
    const norm = normalizeUtmValue(name);
    if (norm) normNameToId.set(norm, id);
  }

  const result = new Map<string, CampaignRevenue>();

  for (const order of shopifyOrders) {
    const normUtm = normalizeUtmValue(order.utmCampaign);
    if (!normUtm) continue;

    const campaignId = normNameToId.get(normUtm);
    if (!campaignId) continue;

    const existing = result.get(campaignId) ?? { revenue: 0, orders: 0, revenueSource: "crm" as RevenueSource };
    existing.revenue += order.totalPrice;
    existing.orders += 1;
    result.set(campaignId, existing);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Ad-level: UTM content matching with spend-share fallback
// Returns per-ad revenue with attribution source tracking
// ---------------------------------------------------------------------------

export interface AdRevenue {
  revenue: number;
  orders: number;
  revenueSource: RevenueSource;
}

export function attributeOrdersToAdsForStats(params: {
  orders: OrderForAttribution[];
  ads: AdForAttribution[];
  adDailySpend: Map<string, Map<string, number>>;
  campaignDailySpend: Map<string, Map<string, number>>;
  campaignNameById: Map<string, string>;
  windowDays?: number;
}): Map<string, AdRevenue> {
  const { orders, ads, adDailySpend, campaignDailySpend, campaignNameById, windowDays = 7 } = params;

  const results = attributeOrdersToAds(
    orders,
    ads,
    adDailySpend,
    campaignDailySpend,
    campaignNameById,
    windowDays,
  );

  const adRevenueMap = new Map<string, AdRevenue>();

  for (const r of results) {
    if (!r.adId) continue;

    const existing = adRevenueMap.get(r.adId) ?? { revenue: 0, orders: 0, revenueSource: "none" as RevenueSource };
    existing.revenue += r.revenue;
    existing.orders += r.conversions;

    // Track the "best" attribution source (utmContent > spendShare)
    if (r.attributionMethod === "utm_content_id" || r.attributionMethod === "utm_content_name") {
      existing.revenueSource = "utmContent";
    } else if (r.attributionMethod === "utm_campaign_window" && existing.revenueSource !== "utmContent") {
      existing.revenueSource = "spendShare";
    }

    adRevenueMap.set(r.adId, existing);
  }

  return adRevenueMap;
}

// ---------------------------------------------------------------------------
// Ad set-level: roll up ad-level attribution to ad sets
// ---------------------------------------------------------------------------

export function rollUpAdRevenueToAdSets(
  adRevenueMap: Map<string, AdRevenue>,
  adToAdSetMap: Map<string, string>, // externalAdId → externalAdSetId
): Map<string, AdRevenue> {
  const adSetRevenueMap = new Map<string, AdRevenue>();

  for (const [adId, rev] of adRevenueMap) {
    const adSetId = adToAdSetMap.get(adId);
    if (!adSetId) continue;

    const existing = adSetRevenueMap.get(adSetId) ?? { revenue: 0, orders: 0, revenueSource: "none" as RevenueSource };
    existing.revenue += rev.revenue;
    existing.orders += rev.orders;

    // Promote the best source
    if (rev.revenueSource === "utmContent") {
      existing.revenueSource = "utmContent";
    } else if (rev.revenueSource === "spendShare" && existing.revenueSource !== "utmContent") {
      existing.revenueSource = "spendShare";
    }

    adSetRevenueMap.set(adSetId, existing);
  }

  return adSetRevenueMap;
}

// Re-export utilities needed by statsService
export { toTimezoneDate, dateRangeToUtc, type OrderForAttribution, type AdForAttribution };
