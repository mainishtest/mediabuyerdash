// lib/creativePerformance/metrics.ts
// Pure metric computation for the creative performance layer.
// No DB access, no side effects.
//
// Contract: none of these functions ever return NaN or Infinity.

import type { CreativePerformanceMetrics } from "./types";

// ---------------------------------------------------------------------------
// safeDivide
// The single place where all division happens for derived metrics.
// ---------------------------------------------------------------------------

/**
 * Divide numerator by denominator.
 * Returns fallback (default null) when:
 *   - denominator is 0
 *   - either argument is non-finite (NaN, ±Infinity)
 *   - the result would be non-finite
 */
export function safeDivide(
  numerator:   number,
  denominator: number,
  fallback:    number | null = null
): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return fallback;
  if (denominator === 0) return fallback;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : fallback;
}

// ---------------------------------------------------------------------------
// Rounding helpers
// ---------------------------------------------------------------------------

export function round2(n: number): number {
  const r = Math.round(n * 100) / 100;
  return Number.isFinite(r) ? r : 0;
}

export function round4(n: number): number {
  const r = Math.round(n * 10000) / 10000;
  return Number.isFinite(r) ? r : 0;
}

// ---------------------------------------------------------------------------
// computeCreativeMetrics
// Derives all display metrics from raw platform + CRM counts.
//
// Rules (per product spec):
//   CTR  = clicks / impressions * 100  → 0 when impressions = 0 (not null)
//   CPC  = spend / clicks              → null when clicks = 0
//   CPM  = spend / impressions * 1000  → null when impressions = 0
//   CPA  = spend / conversions         → null when conversions = 0
//   ROAS = revenue / spend             → 0 when spend = 0 (not null)
//   CVR  = conversions / clicks * 100  → null when clicks = 0
// ---------------------------------------------------------------------------

export function computeCreativeMetrics(raw: {
  spend:       number;
  impressions: number;
  clicks:      number;
  conversions: number;
  revenue:     number;
}): CreativePerformanceMetrics {
  const { spend, impressions, clicks, conversions, revenue } = raw;

  // CTR: 0 is meaningful (no clicks but had impressions).
  const ctr = impressions > 0
    ? round4((clicks / impressions) * 100)
    : 0;

  // CPC: undefined (null) when no clicks to average over.
  const rawCpc = safeDivide(spend, clicks);
  const cpc    = rawCpc !== null ? round2(rawCpc) : null;

  // CPM: undefined (null) when no impressions.
  const rawCpm = safeDivide(spend * 1000, impressions);
  const cpm    = rawCpm !== null ? round2(rawCpm) : null;

  // CPA: undefined (null) when zero conversions (not divide by zero).
  const rawCpa = conversions > 0 ? safeDivide(spend, conversions) : null;
  const cpa    = rawCpa !== null ? round2(rawCpa) : null;

  // ROAS: 0 when spend = 0 or revenue = 0 — both are valid "earned nothing" states.
  const rawRoas = spend > 0 ? safeDivide(revenue, spend) : null;
  const roas    = rawRoas !== null ? round2(rawRoas) : 0;

  // CVR: undefined (null) when no clicks.
  const rawCvr = clicks > 0 ? safeDivide(conversions * 100, clicks) : null;
  const cvr    = rawCvr !== null ? round4(rawCvr) : null;

  return { spend, impressions, clicks, conversions, revenue, ctr, cpc, cpm, cpa, roas, cvr };
}
