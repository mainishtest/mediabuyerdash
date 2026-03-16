// types/goalAwareOptimization.ts
// Goal-aware optimization layer types.
//
// These types are separate from:
//   types/reconciliation.ts  — reconciliation match/summary models
//   types/optimizationRules.ts — rule-engine models
//
// Naming convention:
//   ReconciledPerformanceSnapshot   — entity-level aggregation of CRM-backed metrics
//   GoalAwareEvaluationResult       — evaluation of a snapshot against campaign goals
//   GoalAwareRecommendation         — actionable recommendation from an evaluation

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

/**
 * Priority of an evaluation or recommendation.
 *   high   — needs immediate attention
 *   medium — should be reviewed soon
 *   low    — informational or no action required
 */
export type OptimizationPriority = "low" | "medium" | "high";

/**
 * Semantic code describing why an entity received its evaluation status.
 * Used to drive recommendation logic and display labels.
 */
export type OptimizationReasonCode =
  | "below_roas_goal"         // evaluated ROAS below the campaign target
  | "above_cpa_goal"          // evaluated CPA above the campaign target
  | "weak_delivery"           // low CTR / no CRM outcomes from Meta delivery
  | "weak_conversion_outcome" // both ROAS and CPA are significantly off-goal
  | "strong_performer"        // both ROAS and CPA beat their goals
  | "watchlist";              // insufficient data or inconclusive metrics

/**
 * Recommended action type for a goal-aware recommendation.
 * v1 actions are read-only suggestions — no Meta write actions are performed.
 */
export type GoalAwareActionType =
  | "scale"            // increase investment — entity is outperforming
  | "maintain"         // keep current budget and approach
  | "reduce_spend"     // reduce budget allocation — underperforming
  | "pause"            // pause entity — critically underperforming
  | "review_creative"  // creative angle may be the root cause
  | "watch";           // monitor — insufficient data or mixed signals

/**
 * Overall health status of an evaluated entity.
 *   strong        — beats both ROAS and CPA goals
 *   on_track      — within tolerance of both goals
 *   underperforming — one metric is clearly off-goal
 *   critical      — both metrics are clearly off-goal
 *   watch         — mixed signals or partially meets goals
 *   no_data       — no spend or CRM conversions in the period
 */
export type GoalAwareEntityStatus =
  | "strong"
  | "on_track"
  | "underperforming"
  | "critical"
  | "watch"
  | "no_data";

// ---------------------------------------------------------------------------
// ReconciledPerformanceSnapshot
// ---------------------------------------------------------------------------

/**
 * Entity-level aggregation of reconciled performance metrics.
 *
 * Product rules (preserved in every snapshot):
 *   evaluatedCpa  = metaSpend / crmOrders   (CRM orders = source of truth)
 *   evaluatedRoas = crmRevenue / metaSpend   (CRM revenue = source of truth)
 *
 * Meta spend / clicks / impressions are retained for delivery diagnostics only.
 * Meta-reported conversions and revenue are NOT stored here.
 */
export interface ReconciledPerformanceSnapshot {
  clientAccountId: string;
  campaignId?:     string;
  adSetId?:        string;
  adId?:           string;
  dateRange:       { from: string; to: string };

  // --- Meta delivery metrics (source: Meta Ads) ---
  metaSpend:       number;
  metaClicks:      number;
  metaImpressions: number;

  // --- CRM source-of-truth metrics (source: Shopify / CRM) ---
  crmOrders:       number;
  crmRevenue:      number;

  // --- Evaluated performance — CRM is the source of truth ---
  evaluatedCpa:    number | null;  // metaSpend / crmOrders  (null if crmOrders = 0)
  evaluatedRoas:   number | null;  // crmRevenue / metaSpend (null if metaSpend = 0)

  // --- Optional delivery diagnostics ---
  frequency?:      number;         // impressions / unique reach (when available)
  ctr?:            number;         // metaClicks / metaImpressions
  cpm?:            number;         // (metaSpend / metaImpressions) * 1000
}

// ---------------------------------------------------------------------------
// GoalAwareEvaluationResult
// ---------------------------------------------------------------------------

/**
 * Result of evaluating a ReconciledPerformanceSnapshot against campaign goals.
 * Goals always come from the parent campaign (ad sets and ads inherit them).
 *
 * Important: actualRoas and actualCpa are CRM-backed evaluated metrics,
 * not Meta-reported values.
 */
export interface GoalAwareEvaluationResult {
  entityType:    "campaign" | "adset" | "ad";
  entityId:      string;
  entityName:    string;

  // Goals applied during evaluation
  roasGoalValue: number;
  cpaGoalValue:  number;

  // Actual CRM-backed metrics at evaluation time
  actualRoas:    number | null;
  actualCpa:     number | null;

  // Whether the entity meets each goal (null = insufficient data)
  meetsRoasGoal: boolean | null;
  meetsCpaGoal:  boolean | null;

  // Evaluation output
  status:     GoalAwareEntityStatus;
  reason:     string;
  priority:   OptimizationPriority;
  reasonCode: OptimizationReasonCode;
}

// ---------------------------------------------------------------------------
// GoalAwareRecommendation
// ---------------------------------------------------------------------------

/**
 * Actionable recommendation derived from a GoalAwareEvaluationResult.
 *
 * v1 recommendations are read-only suggestions.
 * No Meta write actions (budget changes, pauses) are executed automatically.
 */
export interface GoalAwareRecommendation {
  entityType: "campaign" | "adset" | "ad";
  entityId:   string;
  entityName: string;

  actionType: GoalAwareActionType;
  priority:   OptimizationPriority;
  reason:     string;
  reasonCode: OptimizationReasonCode;

  // Metrics shown alongside the recommendation for context
  supportingMetrics: {
    actualRoas?:  number | null;
    actualCpa?:   number | null;
    roasGoal?:    number;
    cpaGoal?:     number;
    metaSpend?:   number;
    crmOrders?:   number;
    ctr?:         number;
    frequency?:   number;
  };
}
