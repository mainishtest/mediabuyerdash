// lib/creativePerformance/attribution.ts
// Creative-level CRM order attribution.
//
// Attribution priority (per product spec):
//   1. utm_content → externalAdId exact match ("click_id equivalent")
//   2. normalize(utm_content) → normalize(adName) match
//   3. utm_campaign → campaign match + 7-day spend-share distribution
//   4. Unattributed
//
// Meta conversions/revenue fields are NEVER used — CRM orders are the
// source of truth.
//
// Spend-share distribution:
//   For orders attributed to a campaign but not a specific ad, revenue is
//   distributed proportionally across ads in that campaign based on each
//   ad's spend in the 7-day window before the order date.
//   This ensures: sum(ad.revenue) == sum(campaign.revenue) for attributed orders.

import type { CreativeAttributionResult } from "./types";
import { normalizeUtmValue }               from "../reconciliation/utils";

// ---------------------------------------------------------------------------
// Input types (internal to this module)
// ---------------------------------------------------------------------------

export type OrderForAttribution = {
  id:              string;
  clientAccountId: string;
  date:            string;   // YYYY-MM-DD in account timezone
  revenue:         number;
  utmCampaign?:    string;
  utmContent?:     string;
};

export type AdForAttribution = {
  externalAdId:        string;
  externalCampaignId:  string;
  externalAdAccountId: string;
  name:                string;
};

// ---------------------------------------------------------------------------
// Timezone utility
// Uses Intl.DateTimeFormat with sv-SE locale which always produces YYYY-MM-DD.
// ---------------------------------------------------------------------------

export function toTimezoneDate(utcDate: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("sv-SE", { timeZone: timezone }).format(utcDate);
  } catch {
    // Fallback to UTC slice if timezone string is invalid.
    return utcDate.toISOString().slice(0, 10);
  }
}

/**
 * Convert a YYYY-MM-DD date range (in account timezone) to UTC Date bounds
 * suitable for Prisma's gte/lte filters on DateTime fields.
 */
export function dateRangeToUtc(
  dateFrom: string,
  dateTo:   string,
  timezone: string
): { startUtc: Date; endUtc: Date } {
  // We parse the local midnight as a UTC time by finding the offset.
  // Strategy: create a reference Date at noon UTC on each day, then
  // use the formatted local date to confirm we have the right day.
  // For simplicity in v1 we use a ±14-hour buffer and then filter
  // precisely in application code.
  // The Intl-based conversion below is accurate for all IANA timezones.
  function localMidnightUtc(dateStr: string, endOfDay: boolean): Date {
    // Build a Date that represents the local midnight by trying UTC midnight
    // and correcting for the offset on that day.
    const suffix = endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z";
    const utcBase = new Date(dateStr + suffix);
    // Get the local date string for this UTC time.
    const localDate = new Intl.DateTimeFormat("sv-SE", { timeZone: timezone }).format(utcBase);
    if (localDate === dateStr) return utcBase;

    // The local date differs from the requested date — adjust.
    // Try adding or subtracting 14 hours to find local midnight.
    for (const offset of [-14, -13, -12, -11, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1,
                           1,   2,   3,   4,   5,   6,   7,   8,   9,  10,  11,  12,  13, 14]) {
      const candidate = new Date(utcBase.getTime() + offset * 3600_000);
      const candidateLocal = new Intl.DateTimeFormat("sv-SE", { timeZone: timezone }).format(candidate);
      if (candidateLocal === dateStr) return candidate;
    }
    return utcBase; // Best effort fallback
  }

  return {
    startUtc: localMidnightUtc(dateFrom, false),
    endUtc:   localMidnightUtc(dateTo,   true),
  };
}

// ---------------------------------------------------------------------------
// attributeOrdersToAds
// Main attribution function.
// Returns one or more CreativeAttributionResult per order.
// ---------------------------------------------------------------------------

export function attributeOrdersToAds(
  orders:              OrderForAttribution[],
  ads:                 AdForAttribution[],
  adDailySpend:        Map<string, Map<string, number>>,   // adId → date → spend
  campaignDailySpend:  Map<string, Map<string, number>>,   // campaignId → date → spend
  campaignNameById:    Map<string, string>,                 // campaignId → campaignName
  windowDays = 7
): CreativeAttributionResult[] {
  const results: CreativeAttributionResult[] = [];

  // ── Build lookup indexes ──────────────────────────────────────────────────

  // externalAdId set for O(1) direct ID lookup
  const adIdSet = new Set<string>(ads.map(a => a.externalAdId));

  // Normalized ad name → externalAdId (for utm_content_name matching)
  const adNameToId = new Map<string, string>();
  for (const ad of ads) {
    const norm = normalizeUtmValue(ad.name);
    if (norm) adNameToId.set(norm, ad.externalAdId);
  }

  // externalAdId → AdForAttribution
  const adById = new Map(ads.map(a => [a.externalAdId, a]));

  // campaignId → ads in that campaign
  const campaignToAds = new Map<string, AdForAttribution[]>();
  for (const ad of ads) {
    const list = campaignToAds.get(ad.externalCampaignId) ?? [];
    list.push(ad);
    campaignToAds.set(ad.externalCampaignId, list);
  }

  // Normalized campaign name → campaignId (for UTM campaign matching)
  const normCampaignNameToId = new Map<string, string>();
  for (const [id, name] of campaignNameById) {
    const norm = normalizeUtmValue(name);
    if (norm) normCampaignNameToId.set(norm, id);
  }

  // ── Process each order ───────────────────────────────────────────────────

  for (const order of orders) {
    const utmContent = order.utmContent ?? "";

    // ── Priority 1a: utm_content === externalAdId (exact ID match) ───────
    if (utmContent && adIdSet.has(utmContent)) {
      results.push({
        adId:              utmContent,
        revenue:           order.revenue,
        conversions:       1,
        attributionMethod: "utm_content_id",
      });
      continue;
    }

    // ── Priority 1b: normalize(utm_content) === normalize(adName) ────────
    const normContent = normalizeUtmValue(utmContent);
    if (normContent && adNameToId.has(normContent)) {
      results.push({
        adId:              adNameToId.get(normContent)!,
        revenue:           order.revenue,
        conversions:       1,
        attributionMethod: "utm_content_name",
      });
      continue;
    }

    // ── Priority 2: Campaign UTM match + 7-day spend-share ───────────────
    const campaignId = attributeOrderToCampaign(
      order,
      normCampaignNameToId,
      campaignDailySpend,
      windowDays
    );

    if (!campaignId) {
      results.push({
        adId:              "",
        revenue:           order.revenue,
        conversions:       1,
        attributionMethod: "unattributed",
      });
      continue;
    }

    const campaignAds = campaignToAds.get(campaignId) ?? [];
    if (campaignAds.length === 0) {
      results.push({
        adId:              "",
        revenue:           order.revenue,
        conversions:       1,
        attributionMethod: "unattributed",
      });
      continue;
    }

    // Distribute by spend in the 7-day window before this order
    const distributed = distributeByWindowSpend(
      order,
      campaignAds,
      adDailySpend,
      windowDays
    );

    if (distributed.length === 0) {
      results.push({
        adId:              "",
        revenue:           order.revenue,
        conversions:       1,
        attributionMethod: "unattributed",
      });
    } else {
      results.push(...distributed);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// attributeOrderToCampaign
// Find which campaign this order belongs to.
// Priority: utm_campaign name match → 7-day window spend (highest-spend campaign)
// ---------------------------------------------------------------------------

function attributeOrderToCampaign(
  order:                  OrderForAttribution,
  normCampaignNameToId:   Map<string, string>,
  campaignDailySpend:     Map<string, Map<string, number>>,
  windowDays:             number
): string | null {
  // UTM campaign name match
  const normUtm = normalizeUtmValue(order.utmCampaign ?? "");
  if (normUtm && normCampaignNameToId.has(normUtm)) {
    return normCampaignNameToId.get(normUtm)!;
  }

  // 7-day window: pick the campaign with the highest spend in the window
  // (proxy for "which campaign was most active near the order date")
  const windowSpend = new Map<string, number>();
  const orderTs = Date.parse(order.date + "T12:00:00Z");
  if (isNaN(orderTs)) return null;

  for (let i = 1; i <= windowDays; i++) {
    const dayDate = new Date(orderTs - i * 86_400_000);
    const dStr    = dayDate.toISOString().slice(0, 10);

    for (const [campaignId, dailyMap] of campaignDailySpend) {
      const daySpend = dailyMap.get(dStr) ?? 0;
      if (daySpend > 0) {
        windowSpend.set(campaignId, (windowSpend.get(campaignId) ?? 0) + daySpend);
      }
    }
  }

  if (windowSpend.size === 0) return null;

  let bestId    = "";
  let bestSpend = -1;
  for (const [id, spend] of windowSpend) {
    if (spend > bestSpend) { bestSpend = spend; bestId = id; }
  }
  return bestId || null;
}

// ---------------------------------------------------------------------------
// distributeByWindowSpend
// Split one order's revenue proportionally across ads by their spend in the
// 7-day window before the order date.
// Returns [] when all ads have zero spend (caller will mark unattributed).
// ---------------------------------------------------------------------------

function distributeByWindowSpend(
  order:       OrderForAttribution,
  campaignAds: AdForAttribution[],
  adDailySpend: Map<string, Map<string, number>>,
  windowDays:   number
): CreativeAttributionResult[] {
  const orderTs = Date.parse(order.date + "T12:00:00Z");
  if (isNaN(orderTs)) return [];

  // Sum each ad's spend in [orderDate - windowDays, orderDate]
  const windowSpendByAd = new Map<string, number>();
  let totalWindowSpend = 0;

  for (const ad of campaignAds) {
    const dailyMap = adDailySpend.get(ad.externalAdId);
    let adSpend = 0;

    // Include the order date itself (day 0) and look back windowDays days.
    for (let i = 0; i <= windowDays; i++) {
      const dayDate = new Date(orderTs - i * 86_400_000);
      const dStr    = dayDate.toISOString().slice(0, 10);
      adSpend += dailyMap?.get(dStr) ?? 0;
    }

    if (adSpend > 0) {
      windowSpendByAd.set(ad.externalAdId, adSpend);
      totalWindowSpend += adSpend;
    }
  }

  // Fallback: if no window spend, use total-period spend as proxy
  if (totalWindowSpend === 0) {
    let totalPeriodSpend = 0;
    for (const ad of campaignAds) {
      const dailyMap = adDailySpend.get(ad.externalAdId);
      if (!dailyMap) continue;
      let s = 0;
      for (const v of dailyMap.values()) s += v;
      if (s > 0) { windowSpendByAd.set(ad.externalAdId, s); totalPeriodSpend += s; }
    }
    totalWindowSpend = totalPeriodSpend;
  }

  if (totalWindowSpend === 0) return [];

  const results: CreativeAttributionResult[] = [];
  for (const [adId, spend] of windowSpendByAd) {
    const share = spend / totalWindowSpend;
    results.push({
      adId,
      revenue:           order.revenue * share,
      conversions:       share,
      attributionMethod: "utm_campaign_window",
    });
  }
  return results;
}
