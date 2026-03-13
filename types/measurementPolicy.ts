// Measurement Policy Types
//
// Defines the product-level rules for how performance is measured across the
// entire system. Every evaluation, recommendation, and reporting component
// should derive its metric definitions from these types.

// ── Enumerations ──────────────────────────────────────────────────────────────

// Where a given metric value originates.
export type PerformanceMetricSource = "meta" | "crm" | "blended";

// Where timezone context is pulled from.
export type TimezoneSource = "ad_account" | "utc" | "fixed";

// ── Policy components ─────────────────────────────────────────────────────────

export interface AttributionPolicy {
  // Number of days in the lookback window applied to conversion attribution.
  attributionWindowDays: number;
  // Human-readable descriptor for the attribution model.
  attributionModel:      string;
}

// Which platform is authoritative for each business outcome metric.
// CRM is the source of truth per product rules.
export interface SourceOfTruthPolicy {
  revenue:     PerformanceMetricSource;
  cpa:         PerformanceMetricSource;
  roas:        PerformanceMetricSource;
  conversions: PerformanceMetricSource;
}

// How timezone context is determined for different use-cases.
export interface TimezonePolicy {
  // Used when computing dayparting windows and hourly analysis.
  daypartingTimezoneSource: TimezoneSource;
  // Used for date-level reporting aggregation.
  reportingTimezoneSource:  TimezoneSource;
  // Optional fixed IANA timezone string (only used when source = "fixed").
  fixedTimezone?:            string;
}

// ── Top-level policy ──────────────────────────────────────────────────────────

// The full measurement policy for the system.
// Callers should always obtain this via getMeasurementPolicy() — never
// construct it directly — so per-client overrides can be added transparently.
export interface MeasurementPolicy {
  version:       string;
  attribution:   AttributionPolicy;
  sourceOfTruth: SourceOfTruthPolicy;
  timezone:      TimezonePolicy;
  // Human-readable notes explaining the policy intent.
  notes:         string[];
}

// ── Evaluation metric set ─────────────────────────────────────────────────────

// A structured set of metrics used for optimization decisions.
// Explicitly separates delivery metrics (Meta) from business outcome
// metrics (CRM). CPA and ROAS are always computed from CRM values.
export interface EvaluationMetricSet {
  // ── Meta delivery metrics ─────────────────────────────────────────────────
  spend:       number;
  impressions: number;
  clicks:      number;
  frequency:   number;
  ctr:         number;   // clicks / impressions × 100
  cpm:         number;   // spend / impressions × 1000

  // ── CRM business outcome metrics (source of truth) ───────────────────────
  crmRevenue:     number;
  crmConversions: number;

  // ── Evaluated metrics (computed from CRM source of truth) ────────────────
  cpa:  number;   // spend / crmConversions
  roas: number;   // crmRevenue / spend

  // ── Meta-reported versions (for comparison / diagnostic use only) ─────────
  metaRevenue?:     number;
  metaConversions?: number;
  metaCpa?:         number;
  metaRoas?:        number;
}

// ── Metric classification ─────────────────────────────────────────────────────

// Documents which platform owns each named metric.
export interface MetricOwnershipMap {
  delivery: string[];  // metric names owned by Meta
  outcomes: string[];  // metric names owned by CRM (source of truth)
  computed: string[];  // derived from CRM values
}
