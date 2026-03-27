// Pure utility functions for UTM reporting.
// Separated from UI so the same logic can be reused in future server-side
// queries, exports, or CRM reconciliation flows.

import type {
  UTMPerformanceRow,
  ReportingFilterState,
  FilterOption,
  ReportingSummary
} from "../types/reporting";

// --- Filter helpers ----------------------------------------------------------

// Returns sorted, deduplicated options for any string field on UTMPerformanceRow.
// Only non-empty string values are included.
export function extractFilterOptions(
  rows: UTMPerformanceRow[],
  field: keyof ReportingFilterState
): FilterOption[] {
  const seen = new Set<string>();
  for (const row of rows) {
    const val = row[field as keyof UTMPerformanceRow];
    if (typeof val === "string" && val.length > 0) seen.add(val);
  }
  return Array.from(seen)
    .sort()
    .map((v) => ({ label: v, value: v }));
}

// Returns rows that pass every active filter.
// A null filter value means "no constraint" (pass-through).
export function applyFilters(
  rows: UTMPerformanceRow[],
  filters: ReportingFilterState
): UTMPerformanceRow[] {
  return rows.filter((row) => {
    if (filters.campaignName && row.campaignName !== filters.campaignName) return false;
    if (filters.adSetName    && row.adSetName    !== filters.adSetName)    return false;
    if (filters.adName       && row.adName       !== filters.adName)       return false;
    if (filters.utm_campaign && row.utm_campaign !== filters.utm_campaign) return false;
    if (filters.utm_content  && row.utm_content  !== filters.utm_content)  return false;
    if (filters.utm_term     && row.utm_term     !== filters.utm_term)     return false;
    return true;
  });
}

// Returns true if at least one filter dimension has an active value.
export function hasActiveFilters(filters: ReportingFilterState): boolean {
  return Object.values(filters).some((v) => v !== null);
}

// --- Aggregation helpers -----------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Computes a summary from whatever set of rows is currently visible.
export function summarizeRows(rows: UTMPerformanceRow[]): ReportingSummary {
  const totalSpend       = rows.reduce((s, r) => s + r.spend,       0);
  const totalConversions = rows.reduce((s, r) => s + r.conversions, 0);
  const totalRevenue     = rows.reduce((s, r) => s + r.revenue,     0);

  return {
    rowCount:         rows.length,
    totalSpend:       round2(totalSpend),
    totalConversions,
    totalRevenue:     round2(totalRevenue),
    avgCpa:           totalConversions > 0 ? round2(totalSpend   / totalConversions) : 0,
    avgRoas:          totalSpend > 0       ? round2(totalRevenue / totalSpend)        : 0
  };
}
