// lib/evaluation/evaluate.ts
// Core pure evaluation functions for the Phase 3 recommendation engine.
//
// All functions are DB-free, side-effect-free, and deterministic.
// They can be called from aggregators, API routes, alerts, or automation rules.
//
// Entry point: evaluatePerformance(input) → PerformanceEvaluation

import type {
  EvaluationInput,
  PerformanceEvaluation,
  PerformanceStatus,
  PerformanceDelta,
  ConfidenceLevel,
  Recommendation,
  RecommendationType,
  EvaluationReason,
} from "./types";
import { EVAL_THRESHOLDS as T } from "./thresholds";

// ---------------------------------------------------------------------------
// computePerformanceDeltas
// Returns percentage deviation from each goal.
// Positive = actual is ABOVE the goal value.
//   For ROAS: positive is good. For CPA: positive is bad.
// ---------------------------------------------------------------------------

export function computePerformanceDeltas(input: EvaluationInput): PerformanceDelta {
  const { roas, cpa, ctr, cvr, resolvedGoal } = input;

  const roasDelta = resolvedGoal.targetRoas != null && resolvedGoal.targetRoas > 0
    ? ((roas - resolvedGoal.targetRoas) / resolvedGoal.targetRoas) * 100
    : null;

  const cpaDelta = resolvedGoal.targetCpa != null && resolvedGoal.targetCpa > 0 && cpa != null
    ? ((cpa - resolvedGoal.targetCpa) / resolvedGoal.targetCpa) * 100
    : null;

  const ctrDelta = resolvedGoal.targetCtr != null && resolvedGoal.targetCtr > 0
    ? ((ctr - resolvedGoal.targetCtr) / resolvedGoal.targetCtr) * 100
    : null;

  const cvrDelta = resolvedGoal.targetCvr != null && resolvedGoal.targetCvr > 0 && cvr != null
    ? ((cvr - resolvedGoal.targetCvr) / resolvedGoal.targetCvr) * 100
    : null;

  return { roasDelta, cpaDelta, ctrDelta, cvrDelta };
}

// ---------------------------------------------------------------------------
// computeConfidence
// Based on spend and conversion volume — not on goal attainment.
// ---------------------------------------------------------------------------

export function computeConfidence(input: EvaluationInput): ConfidenceLevel {
  const { spend, conversions } = input;

  if (spend >= T.HIGH_SPEND && conversions >= T.HIGH_CONVS) return "high";
  if (spend >= T.MED_SPEND  && conversions >= T.MED_CONVS)  return "medium";
  return "low";
}

// ---------------------------------------------------------------------------
// classifyPerformanceStatus
// Determines the primary status and contributing reasons.
// Uses ROAS as primary signal; CPA as confirmation / divergence signal.
// Fatigue check runs after the primary classification when targets exist.
// ---------------------------------------------------------------------------

export function classifyPerformanceStatus(
  input:      EvaluationInput,
  confidence: ConfidenceLevel,
  deltas:     PerformanceDelta
): { status: PerformanceStatus; reasons: EvaluationReason[] } {
  const { spend, conversions, roas, cpa, ctr, cvr, resolvedGoal } = input;
  const reasons: EvaluationReason[] = [];

  // Insufficient data: not enough spend or conversions to judge.
  if (spend < T.MED_SPEND || (conversions === 0 && roas === 0)) {
    reasons.push("Insufficient spend or conversion data for reliable evaluation.");
    return { status: "insufficient_data", reasons };
  }

  // Fatigue check: CTR or CVR severely below target (requires spend floor).
  if (spend >= T.FATIGUE_MIN_SPEND) {
    const ctrFatigue = resolvedGoal.targetCtr != null
      && resolvedGoal.targetCtr > 0
      && ctr < resolvedGoal.targetCtr * T.CTR_FATIGUE;

    const cvrFatigue = resolvedGoal.targetCvr != null
      && resolvedGoal.targetCvr > 0
      && cvr != null
      && cvr < resolvedGoal.targetCvr * T.CVR_FATIGUE;

    if (ctrFatigue || cvrFatigue) {
      if (ctrFatigue) reasons.push(`CTR ${fmtPct(ctr)}% is below 70% of the ${resolvedGoal.targetCtr}% target.`);
      if (cvrFatigue) reasons.push(`CVR ${fmtPct(cvr!)}% is below 70% of the ${resolvedGoal.targetCvr}% target.`);
      return { status: "fatigued", reasons };
    }
  }

  // No ROAS goal — cannot classify primary signal beyond data check.
  if (resolvedGoal.targetRoas == null || resolvedGoal.targetRoas === 0) {
    reasons.push("No ROAS goal set. Using spend + conversion volume as proxy.");
    // With no ROAS goal, fall back to volume signal.
    if (conversions >= T.HIGH_CONVS && spend >= T.HIGH_SPEND) {
      reasons.push(`${conversions} conversions on $${spend.toFixed(0)} spend.`);
      return { status: "stable", reasons };
    }
    return { status: "watching", reasons };
  }

  const goal = resolvedGoal.targetRoas;

  // Classify by ROAS band.
  if (roas >= goal * T.ROAS_SCALING) {
    reasons.push(`ROAS ${fmt(roas)}x exceeds the ${fmt(goal)}x goal (+${fmtDelta(deltas.roasDelta)}).`);
    if (deltas.cpaDelta != null && deltas.cpaDelta <= 0) {
      reasons.push(`CPA also on track (${fmtDelta(deltas.cpaDelta)} vs goal).`);
    }
    return { status: "scaling", reasons };
  }

  if (roas >= goal * T.ROAS_STABLE) {
    reasons.push(`ROAS ${fmt(roas)}x is within target range (goal ${fmt(goal)}x, ${fmtDelta(deltas.roasDelta)}).`);
    return { status: "stable", reasons };
  }

  if (roas >= goal * T.ROAS_WATCHING) {
    reasons.push(`ROAS ${fmt(roas)}x is ${fmtDelta(deltas.roasDelta)} below the ${fmt(goal)}x goal.`);
    return { status: "watching", reasons };
  }

  // Below ROAS_WATCHING — losing territory.
  reasons.push(`ROAS ${fmt(roas)}x is ${fmtDelta(deltas.roasDelta)} below the ${fmt(goal)}x goal.`);
  if (deltas.cpaDelta != null && deltas.cpaDelta > T.LP_CPA_BAD_DELTA) {
    reasons.push(`CPA ${fmtDelta(deltas.cpaDelta)} over goal adds to poor return.`);
  }
  return { status: "losing", reasons };
}

// ---------------------------------------------------------------------------
// buildRecommendation
// Maps status + confidence + deltas → a concrete Recommendation.
// ---------------------------------------------------------------------------

export function buildRecommendation(
  status:     PerformanceStatus,
  confidence: ConfidenceLevel,
  input:      EvaluationInput,
  deltas:     PerformanceDelta
): Recommendation {
  const { spend, roas, cpa, resolvedGoal } = input;
  const goal = resolvedGoal.targetRoas;
  const cpaGoal = resolvedGoal.targetCpa;

  // Supporting data string for display.
  const supportingData = buildSupportingData(roas, cpa, goal, cpaGoal, deltas);

  // LP investigation signal: ROAS is near goal but CPA is 30%+ over.
  if (
    status !== "insufficient_data" &&
    status !== "fatigued" &&
    goal != null && goal > 0 &&
    roas >= goal * T.LP_ROAS_OK_FACTOR &&
    deltas.cpaDelta != null && deltas.cpaDelta > T.LP_CPA_BAD_DELTA
  ) {
    return {
      type:           "investigate_lp",
      priority:       "medium",
      confidence,
      reason:         `ROAS is near goal but CPA is ${fmtDelta(deltas.cpaDelta)} over target. Traffic quality looks OK — review landing page or checkout funnel.`,
      supportingData,
    };
  }

  switch (status) {
    case "scaling":
      return {
        type:           "scale_budget_10_20",
        priority:       confidence === "high" ? "high" : "medium",
        confidence,
        reason:         `Performance is exceeding goal. Increase budget 10–20% to capture more efficient return.`,
        supportingData,
      };

    case "stable":
      return {
        type:           "hold",
        priority:       "low",
        confidence,
        reason:         `Performance is meeting goals. Maintain current budget and monitor for trend changes.`,
        supportingData,
      };

    case "watching":
      return {
        type:           "hold",
        priority:       confidence === "high" ? "medium" : "low",
        confidence,
        reason:         `Performance is below goal but within recovery range. Monitor for 3–5 more days before adjusting budget.`,
        supportingData,
      };

    case "fatigued":
      return {
        type:           "rotate_creative",
        priority:       confidence === "low" ? "low" : "medium",
        confidence,
        reason:         `Delivery metrics (CTR/CVR) signal creative fatigue. Rotate in fresh creative to restore engagement.`,
        supportingData,
      };

    case "losing":
      if (confidence === "high" && spend >= T.PAUSE_MIN_SPEND) {
        return {
          type:           "pause_entity",
          priority:       "high",
          confidence,
          reason:         `ROAS is significantly below goal with high data confidence. Pause and review before resuming.`,
          supportingData,
        };
      }
      return {
        type:           "reduce_budget",
        priority:       confidence === "medium" ? "high" : "medium",
        confidence,
        reason:         `ROAS is below the losing threshold. Reduce budget to limit exposure while investigating root cause.`,
        supportingData,
      };

    case "insufficient_data":
    default:
      return {
        type:           "hold",
        priority:       "low",
        confidence:     "low",
        reason:         `Not enough data to make a reliable recommendation. Continue running and revisit after more spend accrues.`,
        supportingData: null,
      };
  }
}

// ---------------------------------------------------------------------------
// buildEvaluationReasonSummary
// One-line summary string for compact display (table cells, tooltips).
// ---------------------------------------------------------------------------

export function buildEvaluationReasonSummary(
  status:     PerformanceStatus,
  confidence: ConfidenceLevel,
  deltas:     PerformanceDelta
): string {
  const conf = confidence === "high" ? "" : ` (${confidence} confidence)`;
  switch (status) {
    case "scaling":        return `Scaling — beating goal${conf}`;
    case "stable":         return `Stable — at goal${conf}`;
    case "watching":       return `Watching — ${fmtDelta(deltas.roasDelta)} below ROAS goal${conf}`;
    case "fatigued":       return `Fatigued — rotate creative${conf}`;
    case "losing":         return `Losing — ${fmtDelta(deltas.roasDelta)} below ROAS goal${conf}`;
    case "insufficient_data": return "Not enough data";
    default:               return status;
  }
}

// ---------------------------------------------------------------------------
// evaluatePerformance  ← main entry point
// ---------------------------------------------------------------------------

export function evaluatePerformance(input: EvaluationInput): PerformanceEvaluation {
  const deltas     = computePerformanceDeltas(input);
  const confidence = computeConfidence(input);
  const { status, reasons } = classifyPerformanceStatus(input, confidence, deltas);
  const recommendation = buildRecommendation(status, confidence, input, deltas);

  return { status, deltas, recommendation, confidence, reasons };
}

// ---------------------------------------------------------------------------
// Internal format helpers
// ---------------------------------------------------------------------------

function fmt(v: number | null): string {
  return v != null ? v.toFixed(2) : "—";
}

function fmtPct(v: number): string {
  return v.toFixed(2);
}

function fmtDelta(v: number | null | undefined): string {
  if (v == null) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

function buildSupportingData(
  roas:    number,
  cpa:     number | null,
  goal:    number | null | undefined,
  cpaGoal: number | null | undefined,
  deltas:  PerformanceDelta
): string | null {
  const parts: string[] = [];
  if (goal != null) parts.push(`ROAS ${roas.toFixed(2)}x vs ${goal.toFixed(2)}x goal (${fmtDelta(deltas.roasDelta)})`);
  if (cpa != null && cpaGoal != null) parts.push(`CPA $${cpa.toFixed(2)} vs $${cpaGoal.toFixed(2)} goal (${fmtDelta(deltas.cpaDelta)})`);
  return parts.length > 0 ? parts.join(" · ") : null;
}
