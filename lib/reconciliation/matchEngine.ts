// lib/reconciliation/matchEngine.ts
// First-pass reconciliation strategy: match Meta UTM performance rows to
// Shopify/CRM order groups using UTM dimensions as the join key.
//
// ── Matching strategy (v1 — explicit, minimal) ──────────────────────────────
//
//   1. EXACT match:    clientAccountId + date + utmCampaign + utmContent + utmTerm
//                      → status: "matched"
//
//   2. FALLBACK match: clientAccountId + date + utmCampaign only
//                      (used when utmContent or utmTerm is absent from one side)
//                      → status: "partial"
//
//   3. NO CRM match:   Meta row with no corresponding CRM group
//                      → status: "unmatched_meta"
//
//   4. CRM leftover:   CRM aggregation group with no Meta row
//                      → status: "unmatched_crm"
//
//   5. AMBIGUOUS:      Multiple Meta rows claimed the same CRM group
//                      (second claimer is marked ambiguous)
//                      → status: "ambiguous"
//
// ── Attribution window (v1 pragmatic implementation) ────────────────────────
//
//   Product rule: attribution window is 7 days. Full multi-day window
//   attribution (matching CRM orders from T to T+7 against a Meta row on
//   date T) is a planned v2 enhancement. In v1 we match on exact date —
//   the most common case for same-day click-to-purchase attribution.
//   The attributionWindowDays value is stored on each match row so that v2
//   can change matching behavior without a schema migration.
//
// ── CRM as source of truth ───────────────────────────────────────────────────
//
//   evaluatedCpa  = metaSpend / crmOrders   (CRM orders = source of truth)
//   evaluatedRoas = crmRevenue / metaSpend  (CRM revenue = source of truth)
//   Meta conversions / Meta revenue are NOT used for evaluated metrics.

import type { UTMPerformanceRow } from "../../types/reporting";
import type { CRMOrderRecord }    from "../../types/crm";
import type {
  ReconciliationMatchRow,
  ReconciliationMatchStatus,
} from "../../types/reconciliation";
import {
  buildReconciliationMatchKey,
  buildPartialMatchKey,
  calculateEvaluatedCpa,
  calculateEvaluatedRoas,
  round2,
  DEFAULT_ATTRIBUTION_WINDOW_DAYS,
} from "./utils";

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface CRMGroup {
  crmOrders:    number;
  crmRevenue:   number;
  date:         string;
  utmCampaign?: string;
  utmContent?:  string;
  utmTerm?:     string;
}

// ---------------------------------------------------------------------------
// CRM grouping helpers
// ---------------------------------------------------------------------------

/** Group CRM orders into buckets by the FULL match key (all 3 UTM dims). */
function buildCrmFullKeyMap(
  orders:          CRMOrderRecord[],
  clientAccountId: string
): Map<string, CRMGroup> {
  const map = new Map<string, CRMGroup>();

  for (const order of orders) {
    if (order.clientAccountId !== clientAccountId) continue;

    const key = buildReconciliationMatchKey({
      clientAccountId,
      date:        order.date,
      utmCampaign: order.utm_campaign,
      utmContent:  order.utm_content,
      utmTerm:     order.utm_term,
    });

    if (!map.has(key)) {
      map.set(key, {
        crmOrders:   0,
        crmRevenue:  0,
        date:        order.date,
        utmCampaign: order.utm_campaign  ?? undefined,
        utmContent:  order.utm_content   ?? undefined,
        utmTerm:     order.utm_term      ?? undefined,
      });
    }

    const g = map.get(key)!;
    g.crmOrders  += 1;
    g.crmRevenue  = round2(g.crmRevenue + order.revenue);
  }

  return map;
}

/** Group CRM orders into buckets by the PARTIAL match key (date + campaign). */
function buildCrmPartialKeyMap(
  orders:          CRMOrderRecord[],
  clientAccountId: string
): Map<string, CRMGroup> {
  const map = new Map<string, CRMGroup>();

  for (const order of orders) {
    if (order.clientAccountId !== clientAccountId) continue;

    const key = buildPartialMatchKey({
      clientAccountId,
      date:        order.date,
      utmCampaign: order.utm_campaign,
    });

    if (!map.has(key)) {
      map.set(key, {
        crmOrders:   0,
        crmRevenue:  0,
        date:        order.date,
        utmCampaign: order.utm_campaign ?? undefined,
      });
    }

    const g = map.get(key)!;
    g.crmOrders  += 1;
    g.crmRevenue  = round2(g.crmRevenue + order.revenue);
  }

  return map;
}

// ---------------------------------------------------------------------------
// Row builder helper
// ---------------------------------------------------------------------------

function buildMatchRow(
  seq:                  number,
  clientAccountId:      string,
  attributionWindowDays: number,
  matchKey:             string,
  meta:                 UTMPerformanceRow,
  crm:                  CRMGroup,
  status:               ReconciliationMatchStatus
): ReconciliationMatchRow {
  return {
    id:                   `match_${seq}`,
    clientAccountId,
    date:                 meta.date,
    attributionWindowDays,
    matchKey,
    metaCampaignId:       meta.campaignId   ?? undefined,
    metaAdSetId:          meta.adSetId      ?? undefined,
    metaAdId:             meta.adId         ?? undefined,
    metaCampaignName:     meta.campaignName ?? undefined,
    metaAdSetName:        meta.adSetName    ?? undefined,
    metaAdName:           meta.adName       ?? undefined,
    utmCampaign:          meta.utm_campaign ?? undefined,
    utmContent:           meta.utm_content  ?? undefined,
    utmTerm:              meta.utm_term     ?? undefined,
    metaSpend:            meta.spend,
    metaClicks:           meta.clicks,
    metaImpressions:      meta.impressions,
    crmOrders:            crm.crmOrders,
    crmRevenue:           crm.crmRevenue,
    evaluatedCpa:         calculateEvaluatedCpa(meta.spend, crm.crmOrders),
    evaluatedRoas:        calculateEvaluatedRoas(crm.crmRevenue, meta.spend),
    matchStatus:          status,
  };
}

// ---------------------------------------------------------------------------
// Main reconciliation function
// ---------------------------------------------------------------------------

/**
 * Match Meta UTM performance rows to Shopify/CRM order records.
 *
 * Returns one ReconciliationMatchRow per Meta row plus one per unmatched
 * CRM aggregation group. Results are sorted chronologically by date.
 *
 * @param metaRows            UTM-enriched Meta performance rows (from Meta sync)
 * @param shopifyOrders       Raw Shopify/CRM order records (from Shopify sync)
 * @param clientAccountId     Account scope — only rows for this account are processed
 * @param attributionWindowDays  Days to consider for attribution (default 7, stored on each row)
 */
export function reconcileMetaRowsWithShopifyOrders(
  metaRows:              UTMPerformanceRow[],
  shopifyOrders:         CRMOrderRecord[],
  clientAccountId:       string,
  attributionWindowDays: number = DEFAULT_ATTRIBUTION_WINDOW_DAYS
): ReconciliationMatchRow[] {
  const crmFullMap    = buildCrmFullKeyMap(shopifyOrders, clientAccountId);
  const crmPartialMap = buildCrmPartialKeyMap(shopifyOrders, clientAccountId);

  const results:       ReconciliationMatchRow[] = [];
  const claimedKeys    = new Set<string>();  // full keys that have been matched
  const claimCounts    = new Map<string, number>(); // tracks how many Meta rows hit same key
  let   seq            = 1;

  for (const meta of metaRows) {
    if (meta.clientAccountId !== clientAccountId) continue;

    const fullKey = buildReconciliationMatchKey({
      clientAccountId,
      date:        meta.date,
      utmCampaign: meta.utm_campaign,
      utmContent:  meta.utm_content,
      utmTerm:     meta.utm_term,
    });

    const exactCrm = crmFullMap.get(fullKey);

    if (exactCrm) {
      // Track how many Meta rows have hit this CRM group.
      const count = (claimCounts.get(fullKey) ?? 0) + 1;
      claimCounts.set(fullKey, count);
      claimedKeys.add(fullKey);

      // Second (or later) claimant on the same CRM group → ambiguous.
      const status: ReconciliationMatchStatus = count > 1 ? "ambiguous" : "matched";

      results.push(buildMatchRow(seq++, clientAccountId, attributionWindowDays, fullKey, meta, exactCrm, status));
    } else {
      // Fallback: try date + utmCampaign only.
      const partialKey = buildPartialMatchKey({
        clientAccountId,
        date:        meta.date,
        utmCampaign: meta.utm_campaign,
      });

      const partialCrm = crmPartialMap.get(partialKey);

      if (partialCrm) {
        results.push(buildMatchRow(seq++, clientAccountId, attributionWindowDays, fullKey, meta, partialCrm, "partial"));
      } else {
        // No CRM match — Meta row only.
        results.push({
          id:                   `match_${seq++}`,
          clientAccountId,
          date:                 meta.date,
          attributionWindowDays,
          matchKey:             fullKey,
          metaCampaignId:       meta.campaignId   ?? undefined,
          metaAdSetId:          meta.adSetId      ?? undefined,
          metaAdId:             meta.adId         ?? undefined,
          metaCampaignName:     meta.campaignName ?? undefined,
          metaAdSetName:        meta.adSetName    ?? undefined,
          metaAdName:           meta.adName       ?? undefined,
          utmCampaign:          meta.utm_campaign ?? undefined,
          utmContent:           meta.utm_content  ?? undefined,
          utmTerm:              meta.utm_term     ?? undefined,
          metaSpend:            meta.spend,
          metaClicks:           meta.clicks,
          metaImpressions:      meta.impressions,
          crmOrders:            0,
          crmRevenue:           0,
          evaluatedCpa:         null,
          evaluatedRoas:        null,
          matchStatus:          "unmatched_meta",
        });
      }
    }
  }

  // Add CRM-only rows (unmatched_crm) for every CRM group not yet claimed.
  for (const [fullKey, crmGroup] of crmFullMap.entries()) {
    if (claimedKeys.has(fullKey)) continue;

    results.push({
      id:                   `match_${seq++}`,
      clientAccountId,
      date:                 crmGroup.date,
      attributionWindowDays,
      matchKey:             fullKey,
      utmCampaign:          crmGroup.utmCampaign,
      utmContent:           crmGroup.utmContent,
      utmTerm:              crmGroup.utmTerm,
      metaSpend:            0,
      metaClicks:           undefined,
      metaImpressions:      undefined,
      crmOrders:            crmGroup.crmOrders,
      crmRevenue:           crmGroup.crmRevenue,
      evaluatedCpa:         null,
      evaluatedRoas:        null,
      matchStatus:          "unmatched_crm",
    });
  }

  return results.sort((a, b) => a.date.localeCompare(b.date));
}
