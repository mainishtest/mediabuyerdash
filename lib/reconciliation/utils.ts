// lib/reconciliation/utils.ts
// Pure utility functions for the reconciliation engine.
// No side effects, no DB access, no UI logic.
// Safe for server components, API routes, background jobs, and tests.

// ---------------------------------------------------------------------------
// Attribution window
// ---------------------------------------------------------------------------

/**
 * Default attribution window in days.
 * Product rule: CRM orders are attributed within 7 days of the Meta click date.
 *
 * v1 implementation note:
 *   The full multi-day window attribution (matching CRM orders from T to T+7
 *   against a Meta row on date T) is a planned v2 enhancement. In v1 we match
 *   on the exact date only — the most common case for same-day attribution.
 *   The window value is stored on each ReconciliationMatch for use in v2.
 */
export const DEFAULT_ATTRIBUTION_WINDOW_DAYS = 7;

// ---------------------------------------------------------------------------
// UTM normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a UTM parameter value for consistent matching.
 *
 * Rules applied (in order):
 *   1. null / undefined / "" → returns ""
 *   2. Trim leading and trailing whitespace
 *   3. Lowercase
 *
 * This ensures "Prospecting-Q1", " prospecting-q1 ", and "prospecting-q1"
 * all produce the same normalized form and match each other.
 */
export function normalizeUtmValue(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Match key builders
// ---------------------------------------------------------------------------

/**
 * Build a stable, composite match key from all reconciliation dimensions.
 *
 * Format:  `{clientAccountId}|{date}|{utmCampaign}|{utmContent}|{utmTerm}`
 *
 * Missing UTM fields are represented as "" so the key is always well-formed
 * and can be safely stored, compared, and split.
 *
 * This is the PRIMARY match key used for exact-match reconciliation.
 */
export function buildReconciliationMatchKey(fields: {
  clientAccountId: string;
  date:            string;
  utmCampaign?:    string | null;
  utmContent?:     string | null;
  utmTerm?:        string | null;
}): string {
  return [
    fields.clientAccountId,
    fields.date,
    normalizeUtmValue(fields.utmCampaign),
    normalizeUtmValue(fields.utmContent),
    normalizeUtmValue(fields.utmTerm),
  ].join("|");
}

/**
 * Build a partial match key using only clientAccountId, date, and utmCampaign.
 *
 * Format:  `{clientAccountId}|{date}|{utmCampaign}`
 *
 * Used as a FALLBACK when utmContent or utmTerm are absent from one side.
 * A fallback match produces a "partial" ReconciliationMatchStatus.
 */
export function buildPartialMatchKey(fields: {
  clientAccountId: string;
  date:            string;
  utmCampaign?:    string | null;
}): string {
  return [
    fields.clientAccountId,
    fields.date,
    normalizeUtmValue(fields.utmCampaign),
  ].join("|");
}

// ---------------------------------------------------------------------------
// Evaluated metric calculators
// ---------------------------------------------------------------------------

/**
 * Calculate Evaluated CPA using Meta spend (delivery) and CRM orders (source of truth).
 *
 * Formula: metaSpend / crmOrders
 *
 * Returns null if crmOrders ≤ 0 (no orders to average) or metaSpend ≤ 0.
 *
 * Product rule: CRM/Shopify orders are the source of truth for CPA.
 * Meta's own conversion count is NOT used here.
 */
export function calculateEvaluatedCpa(
  metaSpend:  number,
  crmOrders:  number
): number | null {
  if (crmOrders <= 0 || metaSpend <= 0) return null;
  return Math.round((metaSpend / crmOrders) * 100) / 100;
}

/**
 * Calculate Evaluated ROAS using CRM revenue (source of truth) and Meta spend (delivery).
 *
 * Formula: crmRevenue / metaSpend
 *
 * Returns null if metaSpend ≤ 0 (division by zero).
 *
 * Product rule: CRM/Shopify revenue is the source of truth for ROAS.
 * Meta's own revenue field is NOT used here.
 */
export function calculateEvaluatedRoas(
  crmRevenue: number,
  metaSpend:  number
): number | null {
  if (metaSpend <= 0) return null;
  return Math.round((crmRevenue / metaSpend) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Rounding helper (shared across engine files)
// ---------------------------------------------------------------------------

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
