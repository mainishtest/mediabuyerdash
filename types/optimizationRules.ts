// Optimization Rule Engine Types
//
// Models for rule definition, evaluation context, and recommendation output.
// Kept separate from execution logic so rules can later be persisted and
// executed automatically without changing the evaluation contract.

// ── Enumerations ─────────────────────────────────────────────────────────────

export type RuleMetric =
  | "cpa"
  | "roas"
  | "spend"
  | "frequency"
  | "ctr"
  | "conversions";

export type RuleOperator =
  | "greater_than"
  | "less_than"
  | "equal_to"
  | "increase_percent"   // reserved: value is N% above a baseline
  | "decrease_percent"   // reserved: value is N% below a baseline
  | "spike_percent";     // current value is N% above prior period average

export type RuleActionType =
  | "increase_budget"
  | "decrease_budget"
  | "pause_ad"
  | "mark_creative_fatigue"
  | "send_alert"
  | "recommend_creative_refresh";

export type EntityLevel = "campaign" | "adset" | "ad";

// ── Rule definition ───────────────────────────────────────────────────────────

export interface RuleCondition {
  metric:             RuleMetric;
  operator:           RuleOperator;
  // Use a number for a literal threshold, or "goal" to compare against the
  // entity's configured CPA / ROAS goal at evaluation time.
  thresholdValue:     number | "goal";
  // If set, the condition must hold for at least this many consecutive
  // recent days (most-recent-first in recentDailyMetrics).
  lookbackWindowDays?: number;
}

export interface OptimizationRule {
  id:           string;
  name:         string;
  description:  string;
  // "any" means the rule evaluates against all entity levels.
  entityLevel:  EntityLevel | "any";
  condition:    RuleCondition;
  actionType:   RuleActionType;
  // Percentage for budget increase / decrease actions (e.g. 20 = 20%).
  actionValue?: number;
  enabled:      boolean;
}

// ── Evaluation context ────────────────────────────────────────────────────────

// Numeric metrics indexed by RuleMetric — allows safe dynamic access in the
// engine without type casts.
export type RuleMetricSnapshot = Record<RuleMetric, number>;

// One completed calendar day of performance data.
// Defined as an intersection so day[metric] resolves to number.
export type RecentDayMetrics = { date: string } & RuleMetricSnapshot;

export interface RuleEvaluationContext {
  entityId:            string;
  entityName:          string;
  entityLevel:         EntityLevel;
  // Aggregated current-period metrics.
  metrics:             RuleMetricSnapshot;
  goals: {
    cpaGoalValue:  number;
    cpaGoalType:   "high" | "low";
    roasGoalValue: number;
    roasGoalType:  "high" | "low";
  };
  // Most-recent day first.  [0] = yesterday, [1] = 2 days ago, etc.
  recentDailyMetrics: RecentDayMetrics[];
}

// ── Evaluation results ────────────────────────────────────────────────────────

export interface RuleConditionResult {
  triggered:         boolean;
  actualValue:       number;
  // The absolute threshold value that was compared (goal resolved to number).
  resolvedThreshold: number;
  // How many lookback days satisfied the condition (0 when no lookback).
  daysTriggered:     number;
}

export interface RuleEvaluationResult {
  ruleId:          string;
  ruleName:        string;
  entityId:        string;
  entityName:      string;
  entityLevel:     EntityLevel;
  triggered:       boolean;
  conditionResult: RuleConditionResult;
}

// ── Recommendations ────────────────────────────────────────────────────────────

export interface RuleRecommendation {
  ruleId:              string;
  ruleName:            string;
  entityId:            string;
  entityName:          string;
  entityLevel:         EntityLevel;
  recommendationType:  RuleActionType;
  message:             string;
  suggestedAction:     string;
  confidence:          "low" | "medium" | "high";
  supportingMetrics:   Partial<RuleMetricSnapshot>;
}

// ── Engine output ─────────────────────────────────────────────────────────────

export interface RuleSetEvaluationOutput {
  results:         RuleEvaluationResult[];
  recommendations: RuleRecommendation[];
}
