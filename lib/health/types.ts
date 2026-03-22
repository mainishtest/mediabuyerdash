// lib/health/types.ts
// Typed models for first-sync data validation and account health check.
// Client-safe — no server imports.

// ── Trust states ──────────────────────────────────────────────────────────────

export type DataTrustState =
  | "unverified"
  | "healthy"
  | "warning"
  | "suspect"
  | "blocked";

// ── Health categories ─────────────────────────────────────────────────────────

export type HealthCategory =
  | "meta_spend_coverage"
  | "shopify_revenue_coverage"
  | "timezone_alignment"
  | "attribution_sanity"
  | "sync_freshness"
  | "account_mapping"
  | "date_gap_detection";

export const HEALTH_CATEGORIES: Array<{
  id: HealthCategory;
  label: string;
  required: boolean;
}> = [
  { id: "meta_spend_coverage",      label: "Meta Spend Coverage",     required: true },
  { id: "shopify_revenue_coverage", label: "Revenue Coverage",        required: true },
  { id: "sync_freshness",           label: "Sync Freshness",          required: true },
  { id: "timezone_alignment",       label: "Timezone Alignment",      required: true },
  { id: "attribution_sanity",       label: "Attribution Sanity",      required: false },
  { id: "account_mapping",          label: "Account Mapping",         required: true },
  { id: "date_gap_detection",       label: "Date Gap Detection",      required: false },
];

// ── AccountHealthCheck ────────────────────────────────────────────────────────

export type AccountHealthCheck = {
  id: string;
  category: HealthCategory;
  label: string;
  description: string;
  status: "pass" | "fail" | "warning" | "skipped";
  required: boolean;
  detail?: string;
  actionLabel?: string;
  actionHref?: string;
};

// ── AccountHealthIssue ────────────────────────────────────────────────────────

export type AccountHealthIssue = {
  id: string;
  category: HealthCategory;
  message: string;
  severity: "critical" | "warning";
  actionLabel: string;
  actionHref: string;
};

// ── SyncCoverageSummary ───────────────────────────────────────────────────────

export type SyncCoverageSummary = {
  source: "meta" | "shopify";
  daysWithData: number;
  daysExpected: number;
  gapDates: string[];
  oldestDate: string | null;
  newestDate: string | null;
  totalValue: number;
};

// ── SpendValidationSummary ────────────────────────────────────────────────────

export type SpendValidationSummary = {
  hasSpend: boolean;
  totalSpend: number;
  daysCovered: number;
  oldestDate: string | null;
  newestDate: string | null;
  avgDailySpend: number;
  gapDates: string[];
};

// ── RevenueValidationSummary ──────────────────────────────────────────────────

export type RevenueValidationSummary = {
  hasRevenue: boolean;
  totalRevenue: number;
  orderCount: number;
  daysCovered: number;
  oldestDate: string | null;
  newestDate: string | null;
  fbAttributedRevenue: number;
  hasFbAttribution: boolean;
  gapDates: string[];
};

// ── AccountHealthSummary ──────────────────────────────────────────────────────

export type AccountHealthSummary = {
  trustState: DataTrustState;
  trustMessage: string;
  checks: AccountHealthCheck[];
  issues: AccountHealthIssue[];
  recommendations: HealthRecommendation[];
  spendSummary: SpendValidationSummary;
  revenueSummary: RevenueValidationSummary;
  syncFreshnessHours: { meta: number | null; shopify: number | null };
};

// ── HealthRecommendation ──────────────────────────────────────────────────────

export type HealthRecommendation = {
  priority: "required" | "recommended" | "optional";
  label: string;
  description: string;
  actionLabel: string;
  actionHref: string;
};
