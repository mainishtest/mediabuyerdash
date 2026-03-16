// lib/goalAwareOptimization/recommend.ts
// buildGoalAwareRecommendation() — maps evaluation results to actionable
// recommendations. Logic is deterministic and based on entity status.
//
// v1 recommendation rules:
//   strong        → scale
//   on_track      → maintain
//   underperforming (ROAS below goal, some CRM orders) → reduce_spend
//   underperforming (ROAS below goal, no CRM orders)   → review_creative
//   critical      → pause (or review_creative when orders are very low)
//   watch/no_data → watch

import type {
  GoalAwareEvaluationResult,
  GoalAwareRecommendation,
  GoalAwareActionType,
  ReconciledPerformanceSnapshot,
} from "../../types/goalAwareOptimization";

// Threshold below which critical entities get review_creative instead of pause.
// When very few CRM orders exist, the creative angle may be the root cause.
const CRITICAL_LOW_ORDER_THRESHOLD = 3;

/**
 * Builds a GoalAwareRecommendation from an evaluation result and its snapshot.
 *
 * All recommendation logic is deterministic — no ML or probabilistic scoring.
 * Input metrics used in supportingMetrics are CRM-backed (never Meta-reported).
 */
export function buildGoalAwareRecommendation(
  evaluation: GoalAwareEvaluationResult,
  snapshot:   ReconciledPerformanceSnapshot
): GoalAwareRecommendation {
  const actionType = resolveAction(evaluation, snapshot);

  return {
    entityType:  evaluation.entityType,
    entityId:    evaluation.entityId,
    entityName:  evaluation.entityName,
    actionType,
    priority:    evaluation.priority,
    reason:      evaluation.reason,
    reasonCode:  evaluation.reasonCode,
    supportingMetrics: {
      actualRoas:  evaluation.actualRoas,
      actualCpa:   evaluation.actualCpa,
      roasGoal:    evaluation.roasGoalValue,
      cpaGoal:     evaluation.cpaGoalValue,
      metaSpend:   snapshot.metaSpend,
      crmOrders:   snapshot.crmOrders,
      ctr:         snapshot.ctr,
      frequency:   snapshot.frequency,
    },
  };
}

// ---------------------------------------------------------------------------
// Action resolution
// ---------------------------------------------------------------------------

function resolveAction(
  evaluation: GoalAwareEvaluationResult,
  snapshot:   ReconciledPerformanceSnapshot
): GoalAwareActionType {
  switch (evaluation.status) {
    case "strong":
      return "scale";

    case "on_track":
      return "maintain";

    case "critical":
      // Very few CRM orders suggest a creative problem, not just a budget problem.
      return snapshot.crmOrders < CRITICAL_LOW_ORDER_THRESHOLD
        ? "review_creative"
        : "pause";

    case "underperforming":
      if (evaluation.reasonCode === "below_roas_goal") {
        // No CRM outcomes at all → likely a creative resonance problem.
        return snapshot.crmOrders === 0 ? "review_creative" : "reduce_spend";
      }
      // CPA above goal → reduce spend to lower acquisition cost.
      return "reduce_spend";

    case "watch":
    case "no_data":
    default:
      return "watch";
  }
}
