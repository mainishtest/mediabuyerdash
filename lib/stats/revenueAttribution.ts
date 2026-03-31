// lib/stats/revenueAttribution.ts
// ─────────────────────────────────────────────────────────────────────────────
// Revenue attribution for the Stats hierarchical view.
//
// This module wraps the existing attribution engine from
// lib/creativePerformance/attribution.ts for the Stats use case.
//
// Attribution strategy per level:
//   Campaign → Direct CRM matching by normalized utmCampaign ↔ campaign name
//   Ad Set   → Attribute orders to ads first, then roll up sums to parent ad sets
//   Ad       → UTM content matching (ad ID → ad name → spend-share fallback)
//
// Revenue source of truth: CRM (Shopify). Meta revenue fields are NEVER used.
// Attribution window: 7 days (configurable).
// ─────────────────────────────────────────────────────────────────────────────

import {
  attributeOrdersToAds,
  toTimezoneDate,
  dateRangeToUtc,
  type OrderForAttribution,
  type AdForAttribution,
} from "../creativePerformance/attribution";
import { normalizeUtmValue } from "../reconciliation/utils";
import type { RevenueSource } from "./statsTypes";

// ─── Campaign-level attribution ─────────────────────────────────────────────
// Matches Shopify orders to campaigns by normalizing utmCampaign ↔ campaign name.
// Same logic as lib/campaignPerformance/aggregator.ts lines 131-138.
// ─────────────────────────────────────────────────────────────────────────────

export interface CampaignRevenue {
  revenue: number;
  orders: number;
  revenueSource: RevenueSource;
}

/**
 * Match Shopify orders to campaigns by normalized UTM campaign name.
 *
 * @param shopifyOrders - Orders with utmCampaign and totalPrice
 * @param campaignNames - Map of externalCampaignId → campaign name
 * @returns Map of externalCampaignId → { revenue, orders, revenueSource: "crm" }
 */
export function attributeOrdersToCampaigns(
  shopifyOrders: Array<{ utmCampaign: string | null; totalPrice: number }>,
  campaignNames: Map<string, string>,
): Map<string, CampaignRevenue> {
  // Reverse map: normalized campaign name → externalCampaignId
  // Used for O(1) lookup when matching Shopify UTM values to campaigns.
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

    const existing = result.get(campaignId) ?? {
      revenue: 0,
      orders: 0,
      revenueSource: "crm" as RevenueSource,
    };
    existing.revenue += order.totalPrice;
    existing.orders += 1;
    result.set(campaignId, existing);
  }

  return result;
}

// ─── Ad-level attribution ───────────────────────────────────────────────────
// Uses the full attribution engine with UTM content matching.
//
// Priority order (from lib/creativePerformance/attribution.ts):
//   1a. utmContent === externalAdId (exact ID match)
//   1b. normalize(utmContent) === normalize(adName) (name match)
//   2.  utm_campaign match + 7-day spend-share distribution
//   3.  Unattributed (no match found)
// ─────────────────────────────────────────────────────────────────────────────

export interface AdRevenue {
  revenue: number;
  orders: number;
  revenueSource: RevenueSource;
}

/**
 * Attribute CRM orders to individual ads using UTM content matching.
 *
 * @param params.orders        - CRM orders with utmCampaign, utmContent, date, revenue
 * @param params.ads           - All ads in scope (used for name/ID matching)
 * @param params.adDailySpend  - adId → date → spend (for spend-share fallback)
 * @param params.campaignDailySpend - campaignId → date → spend (for campaign-level fallback)
 * @param params.campaignNameById   - campaignId → name (for UTM campaign matching)
 * @param params.windowDays    - Attribution window in days (default: 7)
 * @returns Map of externalAdId → { revenue, orders, revenueSource }
 */
export function attributeOrdersToAdsForStats(params: {
  orders: OrderForAttribution[];
  ads: AdForAttribution[];
  adDailySpend: Map<string, Map<string, number>>;
  campaignDailySpend: Map<string, Map<string, number>>;
  campaignNameById: Map<string, string>;
  windowDays?: number;
}): Map<string, AdRevenue> {
  const {
    orders, ads, adDailySpend, campaignDailySpend, campaignNameById,
    windowDays = 7,
  } = params;

  // Delegate to the existing attribution engine — it handles all the
  // matching priority logic and spend-share distribution.
  const results = attributeOrdersToAds(
    orders, ads, adDailySpend, campaignDailySpend, campaignNameById, windowDays,
  );

  // Aggregate results per ad, tracking the best attribution source.
  const adRevenueMap = new Map<string, AdRevenue>();

  for (const r of results) {
    if (!r.adId) continue; // Unattributed — not counted against any ad

    const existing = adRevenueMap.get(r.adId) ?? {
      revenue: 0,
      orders: 0,
      revenueSource: "none" as RevenueSource,
    };
    existing.revenue += r.revenue;
    existing.orders += r.conversions;

    // Track the highest-fidelity attribution source seen for this ad.
    // utmContent > spendShare > none
    if (r.attributionMethod === "utm_content_id" || r.attributionMethod === "utm_content_name") {
      existing.revenueSource = "utmContent";
    } else if (r.attributionMethod === "utm_campaign_window" && existing.revenueSource !== "utmContent") {
      existing.revenueSource = "spendShare";
    }

    adRevenueMap.set(r.adId, existing);
  }

  return adRevenueMap;
}

// ─── Ad set-level attribution ───────────────────────────────────────────────
// Ad sets don't have their own CRM attribution. Revenue is derived by
// summing the ad-level attributions of their child ads.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Roll up ad-level revenue to ad sets by summing child ads.
 *
 * @param adRevenueMap - Map of externalAdId → { revenue, orders, revenueSource }
 * @param adToAdSetMap - Map of externalAdId → externalAdSetId
 * @returns Map of externalAdSetId → { revenue, orders, revenueSource }
 */
export function rollUpAdRevenueToAdSets(
  adRevenueMap: Map<string, AdRevenue>,
  adToAdSetMap: Map<string, string>,
): Map<string, AdRevenue> {
  const adSetRevenueMap = new Map<string, AdRevenue>();

  for (const [adId, rev] of adRevenueMap) {
    const adSetId = adToAdSetMap.get(adId);
    if (!adSetId) continue;

    const existing = adSetRevenueMap.get(adSetId) ?? {
      revenue: 0,
      orders: 0,
      revenueSource: "none" as RevenueSource,
    };
    existing.revenue += rev.revenue;
    existing.orders += rev.orders;

    // Promote the best source seen across child ads
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
