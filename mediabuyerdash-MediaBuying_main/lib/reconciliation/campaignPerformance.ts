// lib/reconciliation/campaignPerformance.ts
// Four named functions that implement per-campaign attribution and roll-up.
//
// Attribution strategy:
//   1. Primary — UTM match: Shopify order.utmCampaign (normalized) must equal
//      the normalized Meta campaign name. Covers orders where UTM params were
//      set at checkout via a Meta ad click.
//   2. Fallback — 7-day window: Orders with no utmCampaign (or a UTM that
//      doesn't match any Meta campaign) are attributed to the Meta campaign
//      that had the highest spend in the 7 days before the order date. This is
//      a last-touch approximation and is labeled "window" so it can be audited.
//
// Limitations (document at the call site):
//   - UTM loss on iOS/Meta traffic can be 40-60% post-ATT; fallback fills most
//     of that gap but introduces noise in multi-campaign accounts.
//   - 7-day fallback assumes one dominant campaign per client; if multiple
//     campaigns run simultaneously the "highest spend" heuristic is imprecise.
//   - No view-through or multi-touch; this is last-touch / last-click only.
//   - Campaign name matching breaks if the campaign is renamed mid-period.

import { normalizeUtmValue, calculateEvaluatedRoas, calculateEvaluatedCpa } from "./utils";

// ---------------------------------------------------------------------------
// Input/output types
// ---------------------------------------------------------------------------

/** A single Shopify order with UTM context. */
export type OrderRecord = {
  id:             string;
  date:           string;   // YYYY-MM-DD (UTC)
  revenue:        number;
  utmCampaign?:   string;
  utmContent?:    string;
  utmTerm?:       string;
};

/** A Meta campaign with its total spend over the reconciliation period. */
export type MetaCampaignSpend = {
  externalCampaignId: string;
  campaignName:       string;
  /** Daily spend records used for the 7-day lookback window. */
  dailySpend:         { date: string; spend: number }[];
  /** Total spend over the full period (sum of dailySpend). */
  totalSpend:         number;
};

/** An order after attribution — knows which campaign it belongs to. */
export type AttributedOrder = OrderRecord & {
  externalCampaignId:   string;
  attributionMethod:    "utm" | "window" | "unattributed";
};

/** Per-campaign revenue aggregation. */
export type CampaignRevenueAggregate = {
  externalCampaignId: string;
  campaignName:       string;
  revenue:            number;
  orders:             number;
  utmMatchedOrders:   number;
  windowMatchedOrders: number;
};

/** Final per-campaign performance record ready for persistence. */
export type CampaignPerformanceRow = {
  externalCampaignId:   string;
  campaignName:         string;
  metaSpend:            number;
  attributedRevenue:    number;
  attributedOrders:     number;
  calculatedRoas:       number | null;
  calculatedCpa:        number | null;
  utmMatchedOrders:     number;
  windowMatchedOrders:  number;
  attributionWindowDays: number;
};

// ---------------------------------------------------------------------------
// Step 1 — matchOrdersToCampaigns
// ---------------------------------------------------------------------------

/**
 * Build a lookup map from normalized utm_campaign → externalCampaignId.
 *
 * Exported so callers can inspect the mapping, but the primary entry point
 * is `attributeOrdersToCampaigns` which calls this internally.
 */
export function matchOrdersToCampaigns(
  campaigns: MetaCampaignSpend[]
): Map<string, string> {
  const utmToCampaignId = new Map<string, string>();
  for (const c of campaigns) {
    const key = normalizeUtmValue(c.campaignName);
    if (key) utmToCampaignId.set(key, c.externalCampaignId);
  }
  return utmToCampaignId;
}

// ---------------------------------------------------------------------------
// Step 2 — attributeOrdersToCampaigns
// ---------------------------------------------------------------------------

/**
 * Assign each Shopify order to a Meta campaign.
 *
 * Primary path: normalize order.utmCampaign → look up in the UTM→campaign map.
 * Fallback path: for orders without a matching UTM, find the campaign with the
 *   highest total spend in the `attributionWindowDays` days before the order.
 *
 * Orders that can't be attributed via either path are returned with
 * attributionMethod = "unattributed".
 */
export function attributeOrdersToCampaigns(
  orders:                OrderRecord[],
  campaigns:             MetaCampaignSpend[],
  attributionWindowDays: number = 7
): AttributedOrder[] {
  const utmMap = matchOrdersToCampaigns(campaigns);

  // Build a per-date spend index: date → campaignId → spend, for the window.
  // We pre-compute this once rather than re-scanning campaigns per order.
  const dailySpendByCampaign = new Map<string, Map<string, number>>();
  for (const c of campaigns) {
    for (const d of c.dailySpend) {
      if (!dailySpendByCampaign.has(d.date)) {
        dailySpendByCampaign.set(d.date, new Map());
      }
      const dayMap = dailySpendByCampaign.get(d.date)!;
      dayMap.set(c.externalCampaignId, (dayMap.get(c.externalCampaignId) ?? 0) + d.spend);
    }
  }

  return orders.map((order) => {
    // --- Primary: UTM match ---
    const normalizedUtm = normalizeUtmValue(order.utmCampaign ?? "");
    if (normalizedUtm && utmMap.has(normalizedUtm)) {
      return {
        ...order,
        externalCampaignId: utmMap.get(normalizedUtm)!,
        attributionMethod:  "utm" as const,
      };
    }

    // --- Fallback: 7-day window ---
    // Sum spend per campaign over the `attributionWindowDays` days before order.
    const orderDate  = new Date(order.date + "T12:00:00Z");
    const windowSpend = new Map<string, number>();

    for (let i = 1; i <= attributionWindowDays; i++) {
      const d = new Date(orderDate);
      d.setUTCDate(d.getUTCDate() - i);
      const dStr = d.toISOString().slice(0, 10);
      const dayMap = dailySpendByCampaign.get(dStr);
      if (dayMap) {
        for (const [campaignId, spend] of dayMap) {
          windowSpend.set(campaignId, (windowSpend.get(campaignId) ?? 0) + spend);
        }
      }
    }

    if (windowSpend.size > 0) {
      // Pick the campaign with the highest spend in the window.
      let bestId    = "";
      let bestSpend = -1;
      for (const [id, spend] of windowSpend) {
        if (spend > bestSpend) { bestSpend = spend; bestId = id; }
      }
      return {
        ...order,
        externalCampaignId: bestId,
        attributionMethod:  "window" as const,
      };
    }

    // --- Neither path matched ---
    return { ...order, externalCampaignId: "", attributionMethod: "unattributed" as const };
  });
}

// ---------------------------------------------------------------------------
// Step 3 — aggregateCampaignRevenue
// ---------------------------------------------------------------------------

/**
 * Group attributed orders by campaign and sum revenue + order counts.
 * Unattributed orders (externalCampaignId = "") are excluded.
 */
export function aggregateCampaignRevenue(
  attributedOrders: AttributedOrder[],
  campaigns:        MetaCampaignSpend[]
): Map<string, CampaignRevenueAggregate> {
  const nameById = new Map(campaigns.map((c) => [c.externalCampaignId, c.campaignName]));
  const result   = new Map<string, CampaignRevenueAggregate>();

  for (const order of attributedOrders) {
    if (!order.externalCampaignId) continue;

    if (!result.has(order.externalCampaignId)) {
      result.set(order.externalCampaignId, {
        externalCampaignId:  order.externalCampaignId,
        campaignName:        nameById.get(order.externalCampaignId) ?? order.externalCampaignId,
        revenue:             0,
        orders:              0,
        utmMatchedOrders:    0,
        windowMatchedOrders: 0,
      });
    }

    const agg = result.get(order.externalCampaignId)!;
    agg.revenue += order.revenue;
    agg.orders  += 1;
    if (order.attributionMethod === "utm")    agg.utmMatchedOrders    += 1;
    if (order.attributionMethod === "window") agg.windowMatchedOrders += 1;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Step 4 — calculateCampaignPerformance
// ---------------------------------------------------------------------------

/**
 * Combine per-campaign revenue aggregates with Meta spend to compute
 * CRM-verified ROAS and CPA.
 *
 * Returns one CampaignPerformanceRow per Meta campaign (even if no orders
 * were attributed to it — those will have attributedRevenue=0).
 */
export function calculateCampaignPerformance(
  revenueAggregates:     Map<string, CampaignRevenueAggregate>,
  campaigns:             MetaCampaignSpend[],
  attributionWindowDays: number = 7
): CampaignPerformanceRow[] {
  return campaigns.map((c) => {
    const agg          = revenueAggregates.get(c.externalCampaignId);
    const revenue      = agg?.revenue ?? 0;
    const orders       = agg?.orders  ?? 0;
    const metaSpend    = c.totalSpend;

    return {
      externalCampaignId:   c.externalCampaignId,
      campaignName:         c.campaignName,
      metaSpend,
      attributedRevenue:    revenue,
      attributedOrders:     orders,
      calculatedRoas:       calculateEvaluatedRoas(revenue, metaSpend),
      calculatedCpa:        calculateEvaluatedCpa(metaSpend, orders),
      utmMatchedOrders:     agg?.utmMatchedOrders    ?? 0,
      windowMatchedOrders:  agg?.windowMatchedOrders ?? 0,
      attributionWindowDays,
    };
  });
}
