// types/reconciliation.ts
// Types for the Meta ↔ Shopify reconciliation engine (v1).
//
// Separate from types/crm.ts (which contains the legacy reconciliation types
// that the old page still uses) so both layers can evolve independently.
//
// Naming convention:
//   ReconciliationMatchRow      — in-memory result of matching one Meta row to CRM data
//   ReconciliationComputedSummary — in-memory aggregate across a set of match rows
//
// These in-memory types mirror the Prisma models ReconciliationMatch and
// ReconciliationSummary but are kept separate so the page layer never has a
// hard dependency on Prisma types.

// ---------------------------------------------------------------------------
// Match status
// ---------------------------------------------------------------------------

/**
 * Describes how confidently a Meta row was linked to CRM data.
 *
 *  matched       — exact UTM key match (clientId + date + campaign + content + term)
 *  partial       — fallback match (date + campaign only; content/term missing from one side)
 *  unmatched_meta — Meta row found; no corresponding CRM group
 *  unmatched_crm  — CRM orders found; no corresponding Meta row
 *  ambiguous      — Multiple Meta rows mapped to the same CRM aggregation group
 */
export type ReconciliationMatchStatus =
  | "matched"
  | "partial"
  | "unmatched_meta"
  | "unmatched_crm"
  | "ambiguous";

// ---------------------------------------------------------------------------
// Match row (in-memory)
// ---------------------------------------------------------------------------

/**
 * Result of matching one Meta UTM performance row to CRM order data.
 * One row is produced per Meta row, plus one per unmatched CRM group.
 *
 * Key product rule (carried into every row):
 *   evaluatedCpa  = metaSpend / crmOrders   (CRM orders = source of truth)
 *   evaluatedRoas = crmRevenue / metaSpend   (CRM revenue = source of truth)
 *
 * Meta spend/clicks/impressions are preserved for delivery diagnostics.
 */
export interface ReconciliationMatchRow {
  id: string;
  clientAccountId: string;
  date: string;               // ISO date (YYYY-MM-DD)
  attributionWindowDays: number;
  matchKey: string;           // composite: clientId|date|utmCampaign|utmContent|utmTerm

  // --- Meta entity refs (absent for unmatched_crm rows) ---
  metaCampaignId?:   string;
  metaAdSetId?:      string;
  metaAdId?:         string;
  // Display names (in-memory only — not persisted to ReconciliationMatch)
  metaCampaignName?: string;
  metaAdSetName?:    string;
  metaAdName?:       string;

  // --- UTM dimensions ---
  utmCampaign?: string;
  utmContent?:  string;
  utmTerm?:     string;

  // --- Meta delivery metrics (source: Meta) ---
  metaSpend:        number;
  metaClicks?:      number;
  metaImpressions?: number;

  // --- CRM source-of-truth metrics (source: Shopify/CRM) ---
  crmOrders:  number;
  crmRevenue: number;

  // --- Evaluated performance — CRM is the source of truth ---
  evaluatedCpa:  number | null;  // metaSpend / crmOrders  (null if crmOrders = 0)
  evaluatedRoas: number | null;  // crmRevenue / metaSpend (null if metaSpend = 0)

  // --- Match quality ---
  matchStatus: ReconciliationMatchStatus;
}

// ---------------------------------------------------------------------------
// Computed summary (in-memory)
// ---------------------------------------------------------------------------

/**
 * Rolled-up totals and counts across a set of ReconciliationMatchRows.
 * Produced by summarizeReconciliationResults().
 *
 * evaluatedCpa / evaluatedRoas are computed from aggregate CRM totals:
 *   evaluatedCpa  = totalMetaSpend / totalCrmOrders
 *   evaluatedRoas = totalCrmRevenue / totalMetaSpend
 */
export interface ReconciliationComputedSummary {
  clientAccountId: string;
  dateFrom:        string;
  dateTo:          string;

  // Aggregate spend + CRM outcomes
  totalMetaSpend:  number;
  totalCrmRevenue: number;
  totalCrmOrders:  number;

  // Aggregate evaluated metrics (CRM source of truth)
  evaluatedCpa:  number | null;
  evaluatedRoas: number | null;

  // Row counts
  total:         number;
  matchedRows:   number;
  partialRows:   number;
  unmatchedRows: number;   // unmatched_meta + unmatched_crm combined
  ambiguousRows: number;
}
