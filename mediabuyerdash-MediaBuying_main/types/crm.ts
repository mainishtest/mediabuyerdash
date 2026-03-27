// CRM / source-of-truth reporting and reconciliation types.
// Kept separate from types/reporting.ts (Meta-side UTM performance rows) and
// types/integrations.ts (generic connection models) so each layer can evolve
// at its own pace when real Shopify/Konnective ingestion is added.

// --- CRM source data ---------------------------------------------------------

export type CRMSourcePlatform = "shopify" | "konnective" | "other";

// A single order/event row from a CRM system — the atomic source-of-truth unit.
// In production these would be ingested from Shopify webhooks or a Konnective API pull.
export interface CRMOrderRecord {
  id:              string;
  orderId:         string;
  sourcePlatform:  CRMSourcePlatform;
  clientAccountId: string;
  date:            string;          // ISO date of order
  // UTM fields from the order's referring URL (snake_case to match UTMPerformanceRow)
  utm_campaign?:   string;
  utm_content?:    string;
  utm_term?:       string;
  utm_source?:     string;
  utm_medium?:     string;
  revenue:         number;          // order value
  productName?:    string;          // optional — useful for product-level drill-downs
  funnelName?:     string;          // optional — Konnective-specific funnel context
}

// CRM orders aggregated to the match-key level for comparison with Meta rows.
// Produced by groupCRMOrdersToRows() in reconciliationUtils.
export interface CRMPerformanceRow {
  id:               string;
  date:             string;
  clientAccountId:  string;
  sourcePlatform:   CRMSourcePlatform;
  utm_campaign?:    string;
  utm_content?:     string;
  utm_term?:        string;
  utm_source?:      string;
  utm_medium?:      string;
  orders:           number;
  revenue:          number;
  averageOrderValue: number;
}

// --- Reconciliation ----------------------------------------------------------

// Normalized composite key used to match Meta UTM rows to CRM rows.
// All fields are required strings so the key is stable (empty string = missing).
export interface ReconciliationMatchKey {
  date:            string;
  clientAccountId: string;
  utm_campaign:    string;
  utm_content:     string;
  utm_term:        string;
}

// The label describing how well a matched pair agrees.
export type ReconciliationStatus =
  | "matched"       // both present, revenue within 10 %
  | "partial"       // both present, 10–30 % revenue gap
  | "mismatch"      // both present, > 30 % revenue gap
  | "missing_crm"   // Meta data exists, no matching CRM row
  | "missing_meta"; // CRM data exists, no matching Meta row

// Side-by-side comparison result for a single match-key.
export interface ReconciliationResult {
  id:              string;
  date:            string;
  clientAccountId: string;
  utm_campaign?:   string;
  utm_content?:    string;
  utm_term?:       string;
  // Meta side (absent when status = missing_meta)
  metaSpend?:       number;
  metaConversions?: number;
  metaRevenue?:     number;
  metaRoas?:        number;
  // CRM side (absent when status = missing_crm)
  crmOrders?:      number;
  crmRevenue?:     number;
  crmSource?:      CRMSourcePlatform;
  // Derived
  revenueDelta?:    number;   // crmRevenue − metaRevenue
  revenueDeltaPct?: number;   // delta as % of metaRevenue (negative = CRM lower)
  status:           ReconciliationStatus;
  statusReason:     string;
}

// Rolled-up counts and totals across all reconciliation results.
export interface ReconciliationSummary {
  total:            number;
  matched:          number;
  partial:          number;
  mismatch:         number;
  missing_crm:      number;
  missing_meta:     number;
  totalMetaRevenue: number;
  totalCrmRevenue:  number;
  totalMetaSpend:   number;
  revenueDelta:     number;
}
