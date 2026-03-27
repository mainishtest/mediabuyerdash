// Pure utility functions for CRM ↔ Meta reconciliation.
// No UI logic, no side effects — safe for server components, tests, and
// future background sync jobs.

import type { UTMPerformanceRow } from "../types/reporting";
import type {
  CRMOrderRecord,
  CRMPerformanceRow,
  ReconciliationMatchKey,
  ReconciliationResult,
  ReconciliationStatus,
  ReconciliationSummary
} from "../types/crm";

// --- Match key helpers -------------------------------------------------------

// Produces a stable composite string key for a given set of match fields.
// Empty string is used for missing UTM values so the key is always well-formed.
export function normalizeMatchKey(fields: ReconciliationMatchKey): string {
  return [
    fields.date,
    fields.clientAccountId,
    fields.utm_campaign,
    fields.utm_content,
    fields.utm_term
  ].join("|");
}

function keyFromUTMRow(row: UTMPerformanceRow): string {
  return normalizeMatchKey({
    date:            row.date,
    clientAccountId: row.clientAccountId,
    utm_campaign:    row.utm_campaign  ?? "",
    utm_content:     row.utm_content   ?? "",
    utm_term:        row.utm_term      ?? ""
  });
}

function keyFromCRMRow(row: CRMPerformanceRow): string {
  return normalizeMatchKey({
    date:            row.date,
    clientAccountId: row.clientAccountId,
    utm_campaign:    row.utm_campaign  ?? "",
    utm_content:     row.utm_content   ?? "",
    utm_term:        row.utm_term      ?? ""
  });
}

// --- Aggregation helpers -----------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Groups individual CRM order records into per-match-key performance rows.
// Equivalent to a GROUP BY on (date, clientAccountId, UTM fields, platform).
export function groupCRMOrdersToRows(orders: CRMOrderRecord[]): CRMPerformanceRow[] {
  const map = new Map<string, CRMPerformanceRow>();

  for (const order of orders) {
    const key = normalizeMatchKey({
      date:            order.date,
      clientAccountId: order.clientAccountId,
      utm_campaign:    order.utm_campaign ?? "",
      utm_content:     order.utm_content  ?? "",
      utm_term:        order.utm_term     ?? ""
    });

    if (!map.has(key)) {
      map.set(key, {
        id:               `crm_row_${map.size + 1}`,
        date:             order.date,
        clientAccountId:  order.clientAccountId,
        sourcePlatform:   order.sourcePlatform,
        utm_campaign:     order.utm_campaign,
        utm_content:      order.utm_content,
        utm_term:         order.utm_term,
        utm_source:       order.utm_source,
        utm_medium:       order.utm_medium,
        orders:           0,
        revenue:          0,
        averageOrderValue: 0
      });
    }

    const row = map.get(key)!;
    row.orders  += 1;
    row.revenue  = round2(row.revenue + order.revenue);
  }

  // Derive average order value after all orders are accumulated.
  for (const row of map.values()) {
    row.averageOrderValue = row.orders > 0 ? round2(row.revenue / row.orders) : 0;
  }

  return Array.from(map.values());
}

// --- Reconciliation ----------------------------------------------------------

// Status thresholds (delta expressed as % of Meta revenue).
const MATCHED_THRESHOLD  = 10;   // |deltaPct| < 10 %  → matched
const PARTIAL_THRESHOLD  = 30;   // |deltaPct| < 30 %  → partial
                                  // |deltaPct| ≥ 30 %  → mismatch

function deriveStatus(
  hasUTM: boolean,
  hasCRM: boolean,
  deltaPct: number
): ReconciliationStatus {
  if (!hasUTM) return "missing_meta";
  if (!hasCRM) return "missing_crm";
  const abs = Math.abs(deltaPct);
  if (abs < MATCHED_THRESHOLD)  return "matched";
  if (abs < PARTIAL_THRESHOLD)  return "partial";
  return "mismatch";
}

function buildStatusReason(
  status: ReconciliationStatus,
  deltaPct?: number
): string {
  switch (status) {
    case "matched":
      return `Revenue within ${MATCHED_THRESHOLD}% (${deltaPct?.toFixed(1) ?? "0"}%)`;
    case "partial":
      return `CRM revenue ${Math.abs(deltaPct ?? 0).toFixed(1)}% below Meta-reported`;
    case "mismatch":
      return `Revenue gap exceeds ${PARTIAL_THRESHOLD}% (${deltaPct?.toFixed(1) ?? "0"}%)`;
    case "missing_crm":
      return "Meta data found — no matching CRM orders";
    case "missing_meta":
      return "CRM orders found — no matching Meta UTM row";
  }
}

// Matches UTM performance rows against CRM performance rows and produces
// a ReconciliationResult for every unique match key across both sets.
export function buildReconciliationResults(
  utmRows:  UTMPerformanceRow[],
  crmRows:  CRMPerformanceRow[]
): ReconciliationResult[] {
  const utmMap = new Map<string, UTMPerformanceRow>(
    utmRows.map((r) => [keyFromUTMRow(r), r])
  );
  const crmMap = new Map<string, CRMPerformanceRow>(
    crmRows.map((r) => [keyFromCRMRow(r), r])
  );

  const results: ReconciliationResult[] = [];
  let seq = 1;

  // Process all UTM rows first.
  for (const [key, utmRow] of utmMap.entries()) {
    const crmRow = crmMap.get(key);

    const metaRevenue = utmRow.revenue;
    const crmRevenue  = crmRow?.revenue;

    const delta       = crmRevenue != null ? round2(crmRevenue - metaRevenue) : undefined;
    const deltaPct    = (delta != null && metaRevenue > 0)
                          ? round2((delta / metaRevenue) * 100)
                          : undefined;

    const status = deriveStatus(true, crmRow != null, deltaPct ?? 0);

    results.push({
      id:              `rec_${seq++}`,
      date:             utmRow.date,
      clientAccountId:  utmRow.clientAccountId,
      utm_campaign:     utmRow.utm_campaign,
      utm_content:      utmRow.utm_content,
      utm_term:         utmRow.utm_term,
      metaSpend:        utmRow.spend,
      metaConversions:  utmRow.conversions,
      metaRevenue,
      metaRoas:         utmRow.roas,
      crmOrders:        crmRow?.orders,
      crmRevenue,
      crmSource:        crmRow?.sourcePlatform,
      revenueDelta:     delta,
      revenueDeltaPct:  deltaPct,
      status,
      statusReason:     buildStatusReason(status, deltaPct)
    });
  }

  // Add CRM-only rows (missing_meta).
  for (const [key, crmRow] of crmMap.entries()) {
    if (utmMap.has(key)) continue; // already handled above

    results.push({
      id:              `rec_${seq++}`,
      date:             crmRow.date,
      clientAccountId:  crmRow.clientAccountId,
      utm_campaign:     crmRow.utm_campaign,
      utm_content:      crmRow.utm_content,
      utm_term:         crmRow.utm_term,
      crmOrders:        crmRow.orders,
      crmRevenue:       crmRow.revenue,
      crmSource:        crmRow.sourcePlatform,
      status:           "missing_meta",
      statusReason:     buildStatusReason("missing_meta")
    });
  }

  // Sort chronologically for consistent display.
  return results.sort((a, b) => a.date.localeCompare(b.date));
}

// --- Summary -----------------------------------------------------------------

export function summarizeReconciliation(
  results: ReconciliationResult[]
): ReconciliationSummary {
  const summary: ReconciliationSummary = {
    total: results.length,
    matched: 0, partial: 0, mismatch: 0,
    missing_crm: 0, missing_meta: 0,
    totalMetaRevenue: 0,
    totalCrmRevenue:  0,
    totalMetaSpend:   0,
    revenueDelta:     0
  };

  for (const r of results) {
    summary[r.status]        += 1;
    summary.totalMetaRevenue  = round2(summary.totalMetaRevenue + (r.metaRevenue  ?? 0));
    summary.totalCrmRevenue   = round2(summary.totalCrmRevenue  + (r.crmRevenue   ?? 0));
    summary.totalMetaSpend    = round2(summary.totalMetaSpend   + (r.metaSpend    ?? 0));
  }

  summary.revenueDelta = round2(summary.totalCrmRevenue - summary.totalMetaRevenue);
  return summary;
}
