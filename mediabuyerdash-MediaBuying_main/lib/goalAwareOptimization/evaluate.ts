// lib/goalAwareOptimization/evaluate.ts
// evaluateEntityAgainstGoals() — deterministic goal-aware evaluation.
//
// All ROAS and CPA comparisons use reconciled CRM-backed metrics only.
// Meta-reported revenue is never used for optimization decisions.
//
// Threshold model (v1):
//   ROAS strong   ≥ goal × 1.10   (10% above goal)
//   ROAS near     ≥ goal × 0.90   (within 10% below goal)
//   ROAS weak     <  goal × 0.80   (below 80% of goal)
//
//   CPA strong    ≤ goal × 0.90   (10% below goal — lower is better)
//   CPA near      ≤ goal × 1.10   (within 10% above goal)
//   CPA weak      >  goal × 1.30   (above 130% of goal)

import type {
  ReconciledPerformanceSnapshot,
  GoalAwareEvaluationResult,
  GoalAwareEntityStatus,
  OptimizationPriority,
  OptimizationReasonCode,
} from "../../types/goalAwareOptimization";

// Tolerance constants — adjust here when refining thresholds.
const ROAS_STRONG_FACTOR = 1.10;
const ROAS_NEAR_FACTOR   = 0.90;
const ROAS_WEAK_FACTOR   = 0.80;

const CPA_STRONG_FACTOR  = 0.90;
const CPA_NEAR_FACTOR    = 1.10;
const CPA_WEAK_FACTOR    = 1.30;

// ---------------------------------------------------------------------------
// Main evaluator
// ---------------------------------------------------------------------------

/**
 * Evaluates a reconciled snapshot against ROAS and CPA goals.
 * Returns a typed result with status, priority, reason, and reason code.
 *
 * Goals are always sourced from the parent campaign, even for ad sets and ads.
 */
export function evaluateEntityAgainstGoals(
  snapshot:   ReconciledPerformanceSnapshot,
  entityType: "campaign" | "adset" | "ad",
  entityId:   string,
  entityName: string,
  roasGoal:   number,
  cpaGoal:    number
): GoalAwareEvaluationResult {
  const { evaluatedRoas, evaluatedCpa, crmOrders, metaSpend, ctr } = snapshot;

  // No spend or CRM outcomes — nothing to evaluate.
  if (metaSpend === 0 || (crmOrders === 0 && evaluatedRoas === null)) {
    return build(entityType, entityId, entityName, roasGoal, cpaGoal, {
      actualRoas:    evaluatedRoas,
      actualCpa:     evaluatedCpa,
      meetsRoasGoal: null,
      meetsCpaGoal:  null,
      status:        "no_data",
      reason:        "No spend or CRM conversions recorded in the selected period.",
      priority:      "low",
      reasonCode:    "watchlist",
    });
  }

  // Spend exists but no CRM conversions — check delivery quality.
  if (crmOrders === 0) {
    const hasWeakDelivery = (ctr ?? 0) < 0.005;
    return build(entityType, entityId, entityName, roasGoal, cpaGoal, {
      actualRoas:    null,
      actualCpa:     null,
      meetsRoasGoal: null,
      meetsCpaGoal:  null,
      status:        hasWeakDelivery ? "watch" : "watch",
      reason:        hasWeakDelivery
        ? "Weak delivery metrics. No CRM outcomes recorded — consider reviewing creative."
        : "No CRM conversions yet. Monitor delivery before drawing conclusions.",
      priority:      "low",
      reasonCode:    hasWeakDelivery ? "weak_delivery" : "watchlist",
    });
  }

  // Both ROAS and CPA should be non-null at this point (crmOrders > 0, metaSpend > 0).
  const roasAboveGoal = evaluatedRoas !== null && evaluatedRoas >= roasGoal * ROAS_STRONG_FACTOR;
  const roasNearGoal  = evaluatedRoas !== null && evaluatedRoas >= roasGoal * ROAS_NEAR_FACTOR;
  const roasWeak      = evaluatedRoas !== null && evaluatedRoas <  roasGoal * ROAS_WEAK_FACTOR;

  const cpaBelowGoal  = evaluatedCpa  !== null && evaluatedCpa  <= cpaGoal  * CPA_STRONG_FACTOR;
  const cpaNearGoal   = evaluatedCpa  !== null && evaluatedCpa  <= cpaGoal  * CPA_NEAR_FACTOR;
  const cpaWeak       = evaluatedCpa  !== null && evaluatedCpa  >  cpaGoal  * CPA_WEAK_FACTOR;

  const meetsRoasGoal = roasNearGoal  || roasAboveGoal;
  const meetsCpaGoal  = cpaNearGoal   || cpaBelowGoal;

  // ── Determine status ────────────────────────────────────────────────────

  let status:     GoalAwareEntityStatus;
  let priority:   OptimizationPriority;
  let reason:     string;
  let reasonCode: OptimizationReasonCode;

  if (roasAboveGoal && cpaBelowGoal) {
    // Both metrics clearly beating goals.
    status     = "strong";
    priority   = "low";
    reason     = `ROAS ${fmt(evaluatedRoas)}x exceeds the ${roasGoal}x goal and CPA ${fmtCpa(evaluatedCpa)} is below the $${cpaGoal} goal.`;
    reasonCode = "strong_performer";

  } else if (meetsRoasGoal && meetsCpaGoal) {
    // Both metrics within tolerance.
    status     = "on_track";
    priority   = "low";
    reason     = `Performance is on track. ROAS ${fmt(evaluatedRoas)}x (goal ${roasGoal}x), CPA ${fmtCpa(evaluatedCpa)} (goal $${cpaGoal}).`;
    reasonCode = evaluatedRoas! >= roasGoal ? "strong_performer" : "watchlist";

  } else if (roasWeak && cpaWeak) {
    // Both metrics significantly off-goal.
    status     = "critical";
    priority   = "high";
    reason     = `Both ROAS and CPA are significantly off-goal. ROAS ${fmt(evaluatedRoas)}x (goal ${roasGoal}x), CPA ${fmtCpa(evaluatedCpa)} (goal $${cpaGoal}).`;
    reasonCode = "weak_conversion_outcome";

  } else if (roasWeak || cpaWeak) {
    // One metric is clearly off-goal.
    status   = "underperforming";
    priority = "medium";

    if (roasWeak && !cpaWeak) {
      reason     = `ROAS ${fmt(evaluatedRoas)}x is below the ${roasGoal}x goal.`;
      reasonCode = "below_roas_goal";
    } else if (cpaWeak && !roasWeak) {
      reason     = `CPA ${fmtCpa(evaluatedCpa)} exceeds the $${cpaGoal} goal.`;
      reasonCode = "above_cpa_goal";
    } else {
      reason     = `Both ROAS and CPA are off-goal. ROAS ${fmt(evaluatedRoas)}x (goal ${roasGoal}x), CPA ${fmtCpa(evaluatedCpa)} (goal $${cpaGoal}).`;
      reasonCode = "weak_conversion_outcome";
    }

  } else {
    // Partially meets goals — mixed signals.
    status     = "watch";
    priority   = "low";
    reason     = `Mixed performance signals. ROAS ${fmt(evaluatedRoas)}x (goal ${roasGoal}x), CPA ${fmtCpa(evaluatedCpa)} (goal $${cpaGoal}).`;
    reasonCode = "watchlist";
  }

  return build(entityType, entityId, entityName, roasGoal, cpaGoal, {
    actualRoas: evaluatedRoas,
    actualCpa:  evaluatedCpa,
    meetsRoasGoal,
    meetsCpaGoal,
    status,
    reason,
    priority,
    reasonCode,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function build(
  entityType: "campaign" | "adset" | "ad",
  entityId:   string,
  entityName: string,
  roasGoal:   number,
  cpaGoal:    number,
  fields: {
    actualRoas:    number | null;
    actualCpa:     number | null;
    meetsRoasGoal: boolean | null;
    meetsCpaGoal:  boolean | null;
    status:        GoalAwareEntityStatus;
    reason:        string;
    priority:      OptimizationPriority;
    reasonCode:    OptimizationReasonCode;
  }
): GoalAwareEvaluationResult {
  return {
    entityType,
    entityId,
    entityName,
    roasGoalValue: roasGoal,
    cpaGoalValue:  cpaGoal,
    ...fields,
  };
}

function fmt(v: number | null): string {
  return v != null ? v.toFixed(2) : "—";
}

function fmtCpa(v: number | null): string {
  return v != null ? `$${v.toFixed(2)}` : "—";
}
