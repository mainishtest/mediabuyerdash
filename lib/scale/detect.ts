// ─── Scale Workflow — Detection & Recommendation ─────────────────────────────
//
// Pure functions. No DB calls.
// Evaluates whether a campaign is eligible for scaling based on 3-day
// performance and guardrail validation.

import {
  SCALE_GUARDRAILS,
  type ScaleRecommendation,
  type ScaleGuardrail,
  type ScaleReadinessState,
  type ScaleConfidence,
  type ScaleStrategy,
  type GuardrailStatus,
} from "../../types/scale";

// ── Input shape ─────────────────────────────────────────────────────────────

export type ScaleDetectionInput = {
  // 3-day performance averages (CRM source of truth)
  avgRoas3d:       number;
  avgCpa3d:        number | null;
  avgSpend3d:      number;
  totalOrders3d:   number;
  currentDailySpend: number;

  // Goals
  roasGoal:        number | null;
  cpaGoal:         number | null;

  // Governance flags
  hasEmergencyStop: boolean;
  isRestricted:     boolean;
};

// ── Main recommendation builder ─────────────────────────────────────────────

/**
 * Evaluates whether a campaign should be scaled and builds a recommendation.
 * Returns a ScaleRecommendation with guardrails, confidence, and reasoning.
 */
export function buildScaleRecommendation(input: ScaleDetectionInput): ScaleRecommendation {
  const G = SCALE_GUARDRAILS;
  const guardrails = evaluateGuardrails(input);
  const blockers: string[] = [];
  const warnings: string[] = [];

  // ── Governance blocks ─────────────────────────────────────────────────

  if (input.hasEmergencyStop) {
    blockers.push("Emergency stop is active — scaling is blocked.");
  }
  if (input.isRestricted) {
    blockers.push("Account is in restricted automation mode.");
  }

  if (blockers.length > 0) {
    return buildResult({
      input,
      strategy: "increase_budget",
      increasePct: 0,
      confidence: "low",
      readiness: "blocked",
      reasoning: blockers[0],
      guardrails,
      blockers,
      warnings,
    });
  }

  // ── Data sufficiency ──────────────────────────────────────────────────

  const failedGuardrails = guardrails.filter((g) => g.status === "fail");
  const warnGuardrails = guardrails.filter((g) => g.status === "warn");

  if (input.avgSpend3d < G.MIN_SPEND_3D || input.totalOrders3d < G.MIN_CONVERSIONS_3D) {
    return buildResult({
      input,
      strategy: "increase_budget",
      increasePct: 0,
      confidence: "low",
      readiness: "insufficient_data",
      reasoning: "Not enough spend or conversions over the last 3 days to confidently recommend scaling.",
      guardrails,
      blockers,
      warnings: [...warnings, ...warnGuardrails.map((g) => `${g.name}: ${g.actual} (threshold: ${g.threshold})`)],
    });
  }

  // ── ROAS floor check ──────────────────────────────────────────────────

  if (input.avgRoas3d < G.MIN_ROAS_3D) {
    return buildResult({
      input,
      strategy: "increase_budget",
      increasePct: 0,
      confidence: "low",
      readiness: "not_ready",
      reasoning: `3-day average ROAS (${fmtRoas(input.avgRoas3d)}) is below the ${fmtRoas(G.MIN_ROAS_3D)} minimum floor for scaling.`,
      guardrails,
      blockers,
      warnings,
    });
  }

  // ── CPA ceiling check ────────────────────────────────────────────────

  if (input.cpaGoal !== null && input.avgCpa3d !== null && input.avgCpa3d > input.cpaGoal * G.MAX_CPA_RATIO) {
    warnings.push(`CPA ($${input.avgCpa3d.toFixed(2)}) exceeds ${Math.round(G.MAX_CPA_RATIO * 100)}% of goal ($${input.cpaGoal.toFixed(2)}).`);
  }

  // ── Goal-relative ROAS check ──────────────────────────────────────────

  if (input.roasGoal !== null && input.roasGoal > 0) {
    const roasRatio = input.avgRoas3d / input.roasGoal;
    if (roasRatio < G.ROAS_GOAL_FLOOR_RATIO) {
      return buildResult({
        input,
        strategy: "increase_budget",
        increasePct: 0,
        confidence: "low",
        readiness: "needs_review",
        reasoning: `ROAS (${fmtRoas(input.avgRoas3d)}) is only ${Math.round(roasRatio * 100)}% of goal (${fmtRoas(input.roasGoal)}). Recommend stabilizing before scaling.`,
        guardrails,
        blockers,
        warnings,
      });
    }
  }

  // ── Confidence scoring ────────────────────────────────────────────────

  const confidence = computeConfidence(input, failedGuardrails.length, warnGuardrails.length);
  const strategy: ScaleStrategy = "increase_budget";

  // ── Suggested increase ────────────────────────────────────────────────

  const increasePct =
    confidence === "high" ? G.DEFAULT_INCREASE_HIGH : G.DEFAULT_INCREASE_MEDIUM;

  // ── Readiness ─────────────────────────────────────────────────────────

  let readiness: ScaleReadinessState;
  if (failedGuardrails.length > 0) {
    readiness = "not_ready";
  } else if (warnGuardrails.length > 0 || warnings.length > 0) {
    readiness = "needs_review";
  } else {
    readiness = "ready";
  }

  // ── Reasoning ─────────────────────────────────────────────────────────

  const parts: string[] = [];
  parts.push(`3-day average ROAS is ${fmtRoas(input.avgRoas3d)}`);
  if (input.roasGoal) parts.push(`(${Math.round((input.avgRoas3d / input.roasGoal) * 100)}% of ${fmtRoas(input.roasGoal)} goal)`);
  if (input.avgCpa3d !== null) parts.push(`with CPA at $${input.avgCpa3d.toFixed(2)}`);
  parts.push(`on $${fmtNum(input.avgSpend3d)}/day average spend.`);
  if (confidence === "high") {
    parts.push(`Strong performance across all metrics — ${increasePct}% increase recommended.`);
  } else {
    parts.push(`Performance is positive but some metrics warrant attention — ${increasePct}% increase suggested with monitoring.`);
  }

  return buildResult({
    input,
    strategy,
    increasePct,
    confidence,
    readiness,
    reasoning: parts.join(" "),
    guardrails,
    blockers,
    warnings,
  });
}

// ── Guardrail evaluation ────────────────────────────────────────────────────

function evaluateGuardrails(input: ScaleDetectionInput): ScaleGuardrail[] {
  const G = SCALE_GUARDRAILS;
  const guardrails: ScaleGuardrail[] = [];

  // 1. 3-day ROAS floor
  guardrails.push({
    name: "ROAS floor",
    description: `3-day avg ROAS must be ≥ ${fmtRoas(G.MIN_ROAS_3D)}`,
    status: input.avgRoas3d >= G.MIN_ROAS_3D ? "pass" : "fail",
    actual: fmtRoas(input.avgRoas3d),
    threshold: `≥ ${fmtRoas(G.MIN_ROAS_3D)}`,
    metric: "roas",
  });

  // 2. ROAS above goal
  if (input.roasGoal !== null && input.roasGoal > 0) {
    const roasRatio = input.avgRoas3d / input.roasGoal;
    guardrails.push({
      name: "ROAS vs goal",
      description: `ROAS must be ≥ ${Math.round(G.ROAS_GOAL_FLOOR_RATIO * 100)}% of goal`,
      status: roasRatio >= G.ROAS_GOAL_FLOOR_RATIO ? "pass" : (roasRatio >= 1.0 ? "warn" : "fail"),
      actual: `${Math.round(roasRatio * 100)}% of goal`,
      threshold: `≥ ${Math.round(G.ROAS_GOAL_FLOOR_RATIO * 100)}%`,
      metric: "roas",
    });
  }

  // 3. CPA within threshold
  if (input.cpaGoal !== null && input.cpaGoal > 0 && input.avgCpa3d !== null) {
    const cpaRatio = input.avgCpa3d / input.cpaGoal;
    guardrails.push({
      name: "CPA ceiling",
      description: `CPA must be ≤ ${Math.round(G.MAX_CPA_RATIO * 100)}% of goal`,
      status: cpaRatio <= G.MAX_CPA_RATIO ? "pass" : (cpaRatio <= 1.3 ? "warn" : "fail"),
      actual: `$${input.avgCpa3d.toFixed(2)} (${Math.round(cpaRatio * 100)}% of goal)`,
      threshold: `≤ ${Math.round(G.MAX_CPA_RATIO * 100)}% ($${(input.cpaGoal * G.MAX_CPA_RATIO).toFixed(2)})`,
      metric: "cpa",
    });
  }

  // 4. Minimum spend
  guardrails.push({
    name: "Minimum spend",
    description: `3-day total spend must be ≥ $${G.MIN_SPEND_3D}`,
    status: input.avgSpend3d * 3 >= G.MIN_SPEND_3D ? "pass" : "fail",
    actual: `$${fmtNum(input.avgSpend3d * 3)}`,
    threshold: `≥ $${G.MIN_SPEND_3D}`,
    metric: "spend",
  });

  // 5. Minimum conversions
  guardrails.push({
    name: "Minimum conversions",
    description: `3-day total orders must be ≥ ${G.MIN_CONVERSIONS_3D}`,
    status: input.totalOrders3d >= G.MIN_CONVERSIONS_3D ? "pass" : "fail",
    actual: `${input.totalOrders3d} orders`,
    threshold: `≥ ${G.MIN_CONVERSIONS_3D}`,
    metric: "orders",
  });

  return guardrails;
}

// ── Confidence scoring ──────────────────────────────────────────────────────

function computeConfidence(
  input: ScaleDetectionInput,
  failCount: number,
  warnCount: number,
): ScaleConfidence {
  if (failCount > 0) return "low";

  // High: all guardrails pass, strong ROAS, decent volume
  const strongRoas = input.roasGoal
    ? input.avgRoas3d >= input.roasGoal * 1.2
    : input.avgRoas3d >= 2.0;
  const decentVolume = input.totalOrders3d >= 10 && input.avgSpend3d >= 100;
  const noCpaIssue = input.cpaGoal === null || input.avgCpa3d === null || input.avgCpa3d <= input.cpaGoal;

  if (warnCount === 0 && strongRoas && decentVolume && noCpaIssue) return "high";
  return "medium";
}

// ── Readiness validation ────────────────────────────────────────────────────

/**
 * Validates whether a user-configured scale plan passes all guardrails.
 * Called before submission to the approval queue.
 */
export function validateScaleReadiness(params: {
  increasePct:     number;
  recommendation:  ScaleRecommendation;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const { increasePct, recommendation } = params;

  if (recommendation.readiness === "blocked") {
    errors.push("Scaling is blocked by governance controls.");
  }
  if (recommendation.readiness === "insufficient_data") {
    errors.push("Not enough data to validate scaling.");
  }
  if (increasePct <= 0) {
    errors.push("Increase percentage must be greater than 0.");
  }
  if (increasePct > SCALE_GUARDRAILS.MAX_INCREASE_PCT) {
    errors.push(`Increase exceeds maximum of ${SCALE_GUARDRAILS.MAX_INCREASE_PCT}%.`);
  }
  const failedGuardrails = recommendation.guardrails.filter((g) => g.status === "fail");
  if (failedGuardrails.length > 0) {
    errors.push(`${failedGuardrails.length} guardrail(s) failing: ${failedGuardrails.map((g) => g.name).join(", ")}.`);
  }

  return { valid: errors.length === 0, errors };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildResult(params: {
  input: ScaleDetectionInput;
  strategy: ScaleStrategy;
  increasePct: number;
  confidence: ScaleConfidence;
  readiness: ScaleReadinessState;
  reasoning: string;
  guardrails: ScaleGuardrail[];
  blockers: string[];
  warnings: string[];
}): ScaleRecommendation {
  const projected = params.input.currentDailySpend * (1 + params.increasePct / 100);
  return {
    strategy:            params.strategy,
    suggestedIncreasePct: params.increasePct,
    currentDailySpend:   params.input.currentDailySpend,
    projectedDailySpend: projected,
    confidence:          params.confidence,
    reasoning:           params.reasoning,
    guardrails:          params.guardrails,
    readiness:           params.readiness,
    blockers:            params.blockers,
    warnings:            params.warnings,
  };
}

function fmtRoas(v: number): string {
  return `${v.toFixed(2)}x`;
}

function fmtNum(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(0);
}
