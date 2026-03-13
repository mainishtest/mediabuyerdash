// Measurement Policy
//
// Single source of truth for how performance is measured across the system.
// All evaluation, recommendation, dayparting, and reporting logic should
// resolve metric definitions through this module — never from scattered
// assumptions in individual files.
//
// Per-client overrides: pass clientAccountId to any function.
// Currently all clients use the global policy. A database lookup can be
// added to getMeasurementPolicy() transparently without changing any caller.

import type {
  MeasurementPolicy,
  PerformanceMetricSource,
  EvaluationMetricSet,
  MetricOwnershipMap,
} from "../types/measurementPolicy";

// ── Global policy constant ────────────────────────────────────────────────────

const GLOBAL_POLICY: MeasurementPolicy = {
  version: "1.0",

  attribution: {
    attributionWindowDays: 7,
    attributionModel:      "7-day click",
  },

  sourceOfTruth: {
    revenue:     "crm",
    cpa:         "crm",
    roas:        "crm",
    conversions: "crm",
  },

  timezone: {
    daypartingTimezoneSource: "ad_account",
    reportingTimezoneSource:  "ad_account",
  },

  notes: [
    "CRM is the source of truth for all business performance metrics (revenue, CPA, ROAS, conversions).",
    "Meta data is used only for delivery analysis: spend, impressions, clicks, frequency, CPM.",
    "Attribution window is 7 days (7-day click).",
    "Dayparting and hourly analysis always use the ad account's timezone.",
    "Meta-reported revenue and conversion figures may be used for comparison but must not drive optimization decisions.",
  ],
};

// ── Policy resolution ─────────────────────────────────────────────────────────

/**
 * Returns the active measurement policy.
 * Pass clientAccountId when per-client overrides are supported.
 */
export function getMeasurementPolicy(
  _clientAccountId?: string
): MeasurementPolicy {
  return GLOBAL_POLICY;
}

export function getAttributionWindowDays(clientAccountId?: string): number {
  return getMeasurementPolicy(clientAccountId).attribution.attributionWindowDays;
}

export function getAttributionModel(clientAccountId?: string): string {
  return getMeasurementPolicy(clientAccountId).attribution.attributionModel;
}

export function resolveRevenueSource(
  clientAccountId?: string
): PerformanceMetricSource {
  return getMeasurementPolicy(clientAccountId).sourceOfTruth.revenue;
}

export function resolveCpaSource(
  clientAccountId?: string
): PerformanceMetricSource {
  return getMeasurementPolicy(clientAccountId).sourceOfTruth.cpa;
}

export function resolveRoasSource(
  clientAccountId?: string
): PerformanceMetricSource {
  return getMeasurementPolicy(clientAccountId).sourceOfTruth.roas;
}

export function resolveConversionsSource(
  clientAccountId?: string
): PerformanceMetricSource {
  return getMeasurementPolicy(clientAccountId).sourceOfTruth.conversions;
}

export function getDaypartingTimezoneSource(
  clientAccountId?: string
): string {
  return getMeasurementPolicy(clientAccountId).timezone.daypartingTimezoneSource;
}

export function getReportingTimezoneSource(
  clientAccountId?: string
): string {
  return getMeasurementPolicy(clientAccountId).timezone.reportingTimezoneSource;
}

// ── Metric ownership map ──────────────────────────────────────────────────────

export function getMetricOwnershipMap(): MetricOwnershipMap {
  return {
    delivery: ["spend", "impressions", "clicks", "frequency", "ctr", "cpm"],
    outcomes: ["crmRevenue", "crmConversions"],
    computed: ["cpa", "roas"],
  };
}

// ── Evaluation metric set builder ─────────────────────────────────────────────

// Constructs a policy-compliant EvaluationMetricSet.
// CPA and ROAS are always derived from CRM figures.
// Meta-reported equivalents are stored separately for comparison only.
export function buildEvaluationMetricSet(params: {
  spend:            number;
  impressions:      number;
  clicks:           number;
  frequency:        number;
  crmRevenue:       number;
  crmConversions:   number;
  metaRevenue?:     number;
  metaConversions?: number;
  clientAccountId?: string;
}): EvaluationMetricSet {
  const {
    spend, impressions, clicks, frequency,
    crmRevenue, crmConversions, metaRevenue, metaConversions,
  } = params;

  const ctr  = impressions > 0 ? parseFloat(((clicks / impressions) * 100).toFixed(2)) : 0;
  const cpm  = impressions > 0 ? parseFloat(((spend / impressions) * 1000).toFixed(2)) : 0;

  // Source of truth: CRM
  const cpa  = crmConversions > 0 ? parseFloat((spend / crmConversions).toFixed(2))  : 0;
  const roas = spend > 0          ? parseFloat((crmRevenue / spend).toFixed(2))       : 0;

  const metaCpa  = metaConversions && metaConversions > 0
    ? parseFloat((spend / metaConversions).toFixed(2))
    : undefined;
  const metaRoas = metaRevenue !== undefined && spend > 0
    ? parseFloat((metaRevenue / spend).toFixed(2))
    : undefined;

  return {
    spend, impressions, clicks, frequency,
    ctr, cpm,
    crmRevenue, crmConversions,
    cpa, roas,
    metaRevenue, metaConversions,
    metaCpa, metaRoas,
  };
}
