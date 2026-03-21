// ─── Client Decision View — Typed Models ─────────────────────────────────────
//
// Decision-first client drill-down types.
// Answers: what changed, why, and what to do.
// CRM is the source of truth for ROAS/CPA. Attribution window: 7 days.

// ── Change signal (what changed) ────────────────────────────────────────────

export type ChangeMetric = "roas" | "cpa" | "spend" | "revenue" | "ctr" | "orders";

export type ChangeDirection = "improved" | "declined" | "flat";

export type ChangeSeverity = "major" | "moderate" | "minor";

export type ClientChangeSignal = {
  metric:      ChangeMetric;
  label:       string;           // e.g. "ROAS"
  direction:   ChangeDirection;
  severity:    ChangeSeverity;
  yesterday:   number;
  priorDay:    number;
  deltaPct:    number;           // signed percentage change
  displayValue: string;          // e.g. "2.4x → 1.8x"
};

// ── Performance driver (why it changed) ─────────────────────────────────────

export type DriverType =
  | "creative_fatigue"
  | "frequency_high"
  | "ctr_drop"
  | "spend_change"
  | "cpa_spike"
  | "roas_drop"
  | "conversion_drop"
  | "new_campaign"
  | "experiment_result"
  | "goal_miss";

export type ClientPerformanceDriver = {
  type:        DriverType;
  title:       string;           // e.g. "Creative fatigue detected"
  description: string;           // 1–2 sentence explanation
  severity:    "high" | "medium" | "low";
  relatedEntity?: string;        // campaign name, ad name, etc.
};

// ── Issue (active problem) ──────────────────────────────────────────────────

export type ClientIssue = {
  id:          string;
  title:       string;
  description: string;
  severity:    "critical" | "high" | "medium" | "low";
  source:      string;           // "alert" | "evaluation" | "fatigue"
  href?:       string;
};

// ── Opportunity ─────────────────────────────────────────────────────────────

export type ClientOpportunity = {
  id:          string;
  title:       string;
  description: string;
  priority:    "high" | "medium" | "low";
  href?:       string;
};

// ── Recommended action ──────────────────────────────────────────────────────

export type ActionType =
  | "create_test"
  | "refresh_creatives"
  | "pause_losers"
  | "scale_winners"
  | "investigate"
  | "review_goals"
  | "monitor";

export type ClientRecommendedAction = {
  action:      ActionType;
  label:       string;
  description: string;
  href:        string;
  variant:     "primary" | "secondary" | "ghost" | "danger";
  priority:    "high" | "medium" | "low";
};

// ── Day snapshot (for comparison) ───────────────────────────────────────────

export type DaySnapshot = {
  date:     string;
  spend:    number;
  revenue:  number;
  orders:   number;
  roas:     number | null;
  cpa:      number | null;
};

// ── Full decision summary ───────────────────────────────────────────────────

export type ClientDecisionSummary = {
  clientId:     string;
  clientName:   string;
  currency:     string;
  generatedAt:  string;

  // Yesterday vs prior day snapshots
  yesterday:    DaySnapshot;
  priorDay:     DaySnapshot;

  // Goals
  roasGoal:     number | null;
  cpaGoal:      number | null;

  // Section 1: What changed
  changes:      ClientChangeSignal[];

  // Section 2: Why it changed
  drivers:      ClientPerformanceDriver[];

  // Section 3: What to do
  actions:       ClientRecommendedAction[];

  // Supporting data
  issues:        ClientIssue[];
  opportunities: ClientOpportunity[];

  // Edge cases
  noData:        boolean;
  hasPartialData: boolean;
  hasMissingGoals: boolean;
};
