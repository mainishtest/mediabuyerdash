// lib/reconciliation/summarize.ts
// Rolls up a set of ReconciliationMatchRows into a ReconciliationComputedSummary.
// Pure function — no DB access, no UI logic.

import type {
  ReconciliationMatchRow,
  ReconciliationComputedSummary,
} from "../../types/reconciliation";
import { calculateEvaluatedCpa, calculateEvaluatedRoas, round2 } from "./utils";

/**
 * Summarize a set of reconciliation match rows into aggregate totals.
 *
 * Row counting:
 *   matchedRows   — status === "matched"
 *   partialRows   — status === "partial"
 *   unmatchedRows — status === "unmatched_meta" OR "unmatched_crm"
 *   ambiguousRows — status === "ambiguous"
 *
 * Metric sourcing:
 *   totalMetaSpend  — sum of metaSpend across ALL rows
 *   totalCrmRevenue — sum of crmRevenue across ALL rows
 *   totalCrmOrders  — sum of crmOrders across ALL rows
 *   evaluatedCpa    — totalMetaSpend / totalCrmOrders  (CRM = source of truth)
 *   evaluatedRoas   — totalCrmRevenue / totalMetaSpend (CRM = source of truth)
 *
 * dateFrom / dateTo are derived from the earliest and latest dates in the rows.
 * If no rows are provided, dateFrom/dateTo are empty strings.
 */
export function summarizeReconciliationResults(
  rows:            ReconciliationMatchRow[],
  clientAccountId: string
): ReconciliationComputedSummary {
  let totalMetaSpend  = 0;
  let totalCrmRevenue = 0;
  let totalCrmOrders  = 0;
  let matchedRows     = 0;
  let partialRows     = 0;
  let unmatchedRows   = 0;
  let ambiguousRows   = 0;
  let dateFrom        = "";
  let dateTo          = "";

  for (const row of rows) {
    totalMetaSpend  = round2(totalMetaSpend  + row.metaSpend);
    totalCrmRevenue = round2(totalCrmRevenue + row.crmRevenue);
    totalCrmOrders  += row.crmOrders;

    switch (row.matchStatus) {
      case "matched":        matchedRows++;   break;
      case "partial":        partialRows++;   break;
      case "unmatched_meta":
      case "unmatched_crm":  unmatchedRows++; break;
      case "ambiguous":      ambiguousRows++; break;
    }

    // Derive date range from row dates (rows are sorted chronologically).
    if (!dateFrom || row.date < dateFrom) dateFrom = row.date;
    if (!dateTo   || row.date > dateTo)   dateTo   = row.date;
  }

  return {
    clientAccountId,
    dateFrom,
    dateTo,
    totalMetaSpend,
    totalCrmRevenue,
    totalCrmOrders,
    evaluatedCpa:  calculateEvaluatedCpa(totalMetaSpend, totalCrmOrders),
    evaluatedRoas: calculateEvaluatedRoas(totalCrmRevenue, totalMetaSpend),
    total:         rows.length,
    matchedRows,
    partialRows,
    unmatchedRows,
    ambiguousRows,
  };
}
