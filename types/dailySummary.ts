// ─── Daily Executive Summary — Typed Models ─────────────────────────────────
//
// Decision-first dashboard types. Pure type definitions only.
// CRM is the source of truth for ROAS and CPA. Attribution window: 7 days.

// ── Status enums ────────────────────────────────────────────────────────────

export type ClientPerformanceStatus =
  | "scaling"
  | "stable"
  | "at_risk"
  | "critical"
  | "insufficient_data";

export type ClientTrendDirection = "up" | "flat" | "down";

export type ClientActionRecommendation =
  | "scale"
  | "investigate"
  | "create_test"
  | "fix_now"
  | "monitor";

export type ClientRiskLevel = "none" | "low" | "medium" | "high" | "critical";

export type ClientScaleReadiness = "ready" | "possible" | "not_ready";

// ── Daily action item ───────────────────────────────────────────────────────

export type DailyActionItem = {
  action:      ClientActionRecommendation;
  label:       string;
  href:        string;
  variant:     "primary" | "secondary" | "ghost" | "danger";
};

// ── Client daily summary (one card per client) ─────────────────────────────

export type ClientDailySummary = {
  clientId:      string;
  clientName:    string;
  currency:      string;
  // Yesterday's metrics (CRM source of truth)
  spend:         number;
  revenue:       number;
  roas:          number | null;
  cpa:           number | null;
  orders:        number;
  // Goals
  roasGoal:      number | null;
  cpaGoal:       number | null;
  // CPA vs goal (negative = under goal = good, positive = over goal = bad)
  cpaVsGoalPct:  number | null;
  roasVsGoalPct: number | null;
  // 3-day trend
  trend:         ClientTrendDirection;
  trendValues:   number[]; // last 3 days of ROAS [day-3, day-2, day-1]
  // Decision outputs
  status:        ClientPerformanceStatus;
  riskLevel:     ClientRiskLevel;
  scaleReadiness: ClientScaleReadiness;
  actions:       DailyActionItem[];
  // Signals
  alertCount:    number;
  hasStaleSync:  boolean;
  hasMissingGoals: boolean;
  hasPartialData:  boolean;
  // Navigation
  href:          string;
};

// ── Portfolio daily summary (top-level KPIs) ────────────────────────────────

export type PortfolioDailySummary = {
  generatedAt:       string;
  dateLabel:         string;       // e.g. "Yesterday — Mar 20, 2026"
  totalSpend:        number;
  totalRevenue:      number;
  blendedRoas:       number | null;
  blendedCpa:        number | null;
  cpaVsTarget:       number | null; // pct difference
  totalOrders:       number;
  totalClients:      number;
  scalingCount:      number;
  stableCount:       number;
  atRiskCount:       number;
  criticalCount:     number;
  insufficientDataCount: number;
};

// ── Filter state ────────────────────────────────────────────────────────────

export type DailySummaryFilterState = {
  clientId:    string;    // "" = all
  status:      ClientPerformanceStatus | "";
  riskLevel:   ClientRiskLevel | "";
  trend:       ClientTrendDirection | "";
};

// ── Full payload (server → client) ──────────────────────────────────────────

// ── Trust state (from health check) ──────────────────────────────────────────

export type DataTrustLevel = "unverified" | "healthy" | "warning" | "suspect" | "blocked";

// ── Full payload (server → client) ──────────────────────────────────────────

export type DailyExecutiveSummary = {
  portfolio:     PortfolioDailySummary;
  clients:       ClientDailySummary[];
  clientOptions: { id: string; name: string }[];
  // Edge case flags
  noDataYesterday: boolean;
  hasPartialCrm:   boolean;
  hasMissingGoals: boolean;
  hasStaleSync:    boolean;
  // Trust state integration
  trustState:      DataTrustLevel;
  trustMessage:    string;
};
