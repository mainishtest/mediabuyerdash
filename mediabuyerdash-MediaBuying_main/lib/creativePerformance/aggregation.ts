// lib/creativePerformance/aggregation.ts
// Post-query aggregation utilities.
// No DB access — operates purely on in-memory CreativePerformanceRow[].

import type { CreativePerformanceRow, CreativePerformanceSummary } from "./types";
import { computeCreativeMetrics, safeDivide, round2, round4 }       from "./metrics";

// ---------------------------------------------------------------------------
// aggregateCreativePerformance
// Re-aggregate rows — e.g. collapse multiple adSets to campaign level.
// Currently a pass-through (rows are already at ad level); kept for the
// evaluation layer to compose on top of.
// ---------------------------------------------------------------------------

export function aggregateCreativePerformance(
  rows: CreativePerformanceRow[]
): CreativePerformanceRow[] {
  return rows;
}

// ---------------------------------------------------------------------------
// buildCreativePerformanceSummary
// Compute workspace-level totals from a set of rows.
// Aggregate metrics are computed from totals (not averages of row metrics)
// to ensure they reconcile with source-of-truth campaign totals.
// ---------------------------------------------------------------------------

export function buildCreativePerformanceSummary(
  rows: CreativePerformanceRow[]
): CreativePerformanceSummary {
  let totalSpend       = 0;
  let totalImpressions = 0;
  let totalClicks      = 0;
  let totalConversions = 0;
  let totalRevenue     = 0;
  let totalUtmMatch    = 0;
  let totalWindowMatch = 0;
  let totalUnattrib    = 0;

  for (const row of rows) {
    totalSpend       += row.spend;
    totalImpressions += row.impressions;
    totalClicks      += row.clicks;
    totalConversions += row.conversions;
    totalRevenue     += row.revenue;
    totalUtmMatch    += row.utmMatchedConversions;
    totalWindowMatch += row.windowMatchedConversions;
    totalUnattrib    += row.unattributedConversions;
  }

  // Derive aggregate metrics from totals — not from averaging row metrics.
  const aggMetrics = computeCreativeMetrics({
    spend:       totalSpend,
    impressions: totalImpressions,
    clicks:      totalClicks,
    conversions: totalConversions,
    revenue:     totalRevenue,
  });

  // Attribution rates (fraction of total attributed conversions)
  const totalAttributed = totalUtmMatch + totalWindowMatch;
  const grandTotal      = totalAttributed + totalUnattrib;

  const utmMatchRate    = grandTotal > 0 ? round4(totalUtmMatch    / grandTotal) : 0;
  const windowMatchRate = grandTotal > 0 ? round4(totalWindowMatch / grandTotal) : 0;
  const unattribRate    = grandTotal > 0 ? round4(totalUnattrib    / grandTotal) : 0;

  return {
    totalCreatives:   rows.length,
    totalSpend:       round2(totalSpend),
    totalImpressions: Math.round(totalImpressions),
    totalClicks:      Math.round(totalClicks),
    totalConversions: round2(totalConversions),
    totalRevenue:     round2(totalRevenue),

    aggregateCtr:  aggMetrics.ctr,
    aggregateCpc:  aggMetrics.cpc,
    aggregateCpm:  aggMetrics.cpm,
    aggregateCpa:  aggMetrics.cpa,
    aggregateRoas: aggMetrics.roas,
    aggregateCvr:  aggMetrics.cvr,

    utmMatchRate,
    windowMatchRate,
    unattributedRate: unattribRate,
  };
}
