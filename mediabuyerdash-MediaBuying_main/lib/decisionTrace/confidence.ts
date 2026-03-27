// ─── Decision Trace — Confidence Builder ─────────────────────────────────────
//
// Deterministic point-scored confidence for each output type.
// No ML or probabilistic models — all signals are based on data quality.
//
// Scale:
//   high   ≥ 70 points
//   medium ≥ 40 points
//   low    < 40 points

import type { DecisionConfidence, DecisionConfidenceLevel } from "./types";

// ── Score → level ─────────────────────────────────────────────────────────────

function scoreToLevel(score: number): DecisionConfidenceLevel {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

// ── Campaign / goal-aware recommendation ─────────────────────────────────────

interface CampaignConfidenceInput {
  hasGoal:          boolean;
  goalSource:       string;    // "explicit" | "client_default" | "none"
  dataWindowDays:   number;
  evaluatedRoas:    number;
  evaluatedCpa:     number;
  roasGoalValue:    number | null;
  cpaGoalValue:     number | null;
  healthStatus:     string;
  dataWarnings?:    string[];
}

export function buildCampaignConfidence(input: CampaignConfidenceInput): DecisionConfidence {
  let score = 0;
  const reasons: string[] = [];
  const limitations: string[] = [];

  // CRM data present
  if (input.evaluatedRoas > 0 || input.evaluatedCpa > 0) {
    score += 30;
    reasons.push("CRM-backed ROAS and CPA metrics available");
  } else {
    score -= 20;
    limitations.push("No CRM revenue data — ROAS and CPA could not be evaluated");
  }

  // Goal configured
  if (input.hasGoal && input.goalSource !== "none") {
    score += 20;
    reasons.push(
      input.goalSource === "explicit"
        ? "Explicit campaign goal configured"
        : "Client-default goal used as fallback"
    );
  } else {
    score -= 30;
    limitations.push("No ROAS or CPA goal configured — recommendation based on spend threshold only");
  }

  // Both goals present
  if (input.roasGoalValue !== null && input.cpaGoalValue !== null) {
    score += 10;
    reasons.push("Both ROAS and CPA goals configured");
  } else if (input.roasGoalValue !== null || input.cpaGoalValue !== null) {
    limitations.push("Only one goal metric configured — evaluation is partial");
  }

  // Data window
  if (input.dataWindowDays >= 7) {
    score += 20;
    reasons.push("Full 7-day attribution window covered");
  } else if (input.dataWindowDays >= 3) {
    score += 8;
    limitations.push(`Only ${input.dataWindowDays} days of data — full 7-day window preferred`);
  } else {
    limitations.push(`Very short data window (${input.dataWindowDays} days) — results are preliminary`);
  }

  // Consistent status signal
  if (["strong", "on_target", "below_goal"].includes(input.healthStatus)) {
    score += 15;
    reasons.push("Clear and consistent performance signal");
  } else if (input.healthStatus === "watch") {
    score += 5;
    limitations.push("Mixed performance signals — recommendation is directional");
  }

  // Data warnings
  (input.dataWarnings ?? []).forEach((w) => {
    score -= 20;
    limitations.push(w);
  });

  const finalScore = Math.max(0, Math.min(100, score));
  return { level: scoreToLevel(finalScore), score: finalScore, reasons, limitations };
}

// ── Experiment outcome ────────────────────────────────────────────────────────

interface ExperimentConfidenceInput {
  detectionConfidence: number;   // 0–1 from WinnerDetectionResult
  outcome:             string;
  controlSpend:        number;
  challengerSpend:     number;
  controlOrders:       number;
  challengerOrders:    number;
  daysRunning:         number;
}

export function buildExperimentConfidence(input: ExperimentConfidenceInput): DecisionConfidence {
  let score = 0;
  const reasons: string[] = [];
  const limitations: string[] = [];

  // Detection confidence
  score += Math.round(input.detectionConfidence * 50);
  if (input.detectionConfidence >= 0.75) {
    reasons.push(`High statistical confidence: ${(input.detectionConfidence * 100).toFixed(0)}%`);
  } else if (input.detectionConfidence >= 0.5) {
    limitations.push(`Moderate statistical confidence: ${(input.detectionConfidence * 100).toFixed(0)}%`);
  } else {
    limitations.push(`Low statistical confidence: ${(input.detectionConfidence * 100).toFixed(0)}%`);
  }

  // Spend coverage
  const totalSpend = input.controlSpend + input.challengerSpend;
  if (totalSpend >= 500) {
    score += 20;
    reasons.push("Sufficient spend coverage across both variants");
  } else if (totalSpend >= 100) {
    score += 10;
    limitations.push("Spend volume is low — results may not generalise");
  } else {
    limitations.push("Very low spend coverage — insufficient for reliable conclusions");
  }

  // Conversion coverage
  const totalOrders = input.controlOrders + input.challengerOrders;
  if (totalOrders >= 20) {
    score += 20;
    reasons.push("Sufficient conversions for statistical evaluation");
  } else if (totalOrders >= 5) {
    score += 8;
    limitations.push(`Only ${totalOrders} total conversions — more data would improve reliability`);
  } else {
    limitations.push("Very few conversions — results are unreliable");
  }

  // Duration
  if (input.daysRunning >= 7) {
    score += 10;
    reasons.push("Experiment ran for full 7-day attribution cycle");
  } else {
    limitations.push(`Experiment ran for ${input.daysRunning} days — may not cover full 7-day attribution`);
  }

  // Outcome quality
  if (["failed_test", "insufficient_data"].includes(input.outcome)) {
    score = Math.min(score, 25);
    limitations.push("Outcome could not be conclusively determined");
  }

  const finalScore = Math.max(0, Math.min(100, score));
  return { level: scoreToLevel(finalScore), score: finalScore, reasons, limitations };
}

// ── Creative score ────────────────────────────────────────────────────────────

interface CreativeConfidenceInput {
  overallScore:      number;    // 0–100
  approvalReadiness: string;
  hasBriefContext:   boolean;
  hasGoalContext:    boolean;
  failingCount:      number;
}

export function buildCreativeConfidence(input: CreativeConfidenceInput): DecisionConfidence {
  let score = 0;
  const reasons: string[] = [];
  const limitations: string[] = [];

  // Overall score
  if (input.overallScore >= 70) {
    score += 40;
    reasons.push("Overall creative score above passing threshold");
  } else if (input.overallScore >= 50) {
    score += 25;
    limitations.push("Creative score is marginal — review failing dimensions");
  } else {
    score += 10;
    limitations.push("Low creative score — significant revision likely needed");
  }

  // Brief context
  if (input.hasBriefContext) {
    score += 20;
    reasons.push("Brief intent and strategy context available for scoring");
  } else {
    limitations.push("No brief context — goal alignment scoring is estimated");
  }

  // Goal context
  if (input.hasGoalContext) {
    score += 20;
    reasons.push("Campaign goal context used in goal alignment dimension");
  } else {
    limitations.push("No campaign goal context — goal alignment dimension is generic");
  }

  // Failing dimensions
  if (input.failingCount === 0) {
    score += 20;
    reasons.push("No failing score dimensions");
  } else {
    score -= input.failingCount * 8;
    limitations.push(`${input.failingCount} dimension${input.failingCount !== 1 ? "s" : ""} below passing threshold`);
  }

  // Approval readiness
  if (input.approvalReadiness === "ready") {
    reasons.push("Passed approval readiness check");
  } else if (input.approvalReadiness === "needs_review") {
    limitations.push("Creative flagged for human review before approval");
  } else {
    score = Math.min(score, 30);
    limitations.push("Creative is not ready for approval — revision required");
  }

  const finalScore = Math.max(0, Math.min(100, score));
  return { level: scoreToLevel(finalScore), score: finalScore, reasons, limitations };
}

// ── Publish guardrail ─────────────────────────────────────────────────────────

interface GuardrailConfidenceInput {
  requiredPassed:  number;
  requiredFailed:  number;
  optionalPassed:  number;
  optionalFailed:  number;
  totalChecks:     number;
}

export function buildGuardrailConfidence(input: GuardrailConfidenceInput): DecisionConfidence {
  let score = 0;
  const reasons: string[] = [];
  const limitations: string[] = [];

  if (input.requiredFailed === 0) {
    score += 50;
    reasons.push("All required guardrails passed");
  } else {
    score = 10;
    limitations.push(`${input.requiredFailed} required guardrail${input.requiredFailed !== 1 ? "s" : ""} failed — launch blocked`);
  }

  if (input.optionalFailed === 0 && input.optionalPassed > 0) {
    score += 30;
    reasons.push("All optional guardrails passed");
  } else if (input.optionalFailed > 0) {
    limitations.push(`${input.optionalFailed} optional guardrail${input.optionalFailed !== 1 ? "s" : ""} failed`);
  }

  const passPct = input.totalChecks > 0 ? (input.requiredPassed + input.optionalPassed) / input.totalChecks : 1;
  score += Math.round(passPct * 20);
  if (passPct === 1) reasons.push("100% check pass rate");

  const finalScore = Math.max(0, Math.min(100, score));
  return { level: scoreToLevel(finalScore), score: finalScore, reasons, limitations };
}

// ── Assistant response ────────────────────────────────────────────────────────

interface AssistantConfidenceInput {
  isGrounded:      boolean;
  dataWarnings:    string[];
  evidenceCount:   number;
  intent:          string;
  hasEntities:     boolean;
}

export function buildAssistantConfidence(input: AssistantConfidenceInput): DecisionConfidence {
  let score = 0;
  const reasons: string[] = [];
  const limitations: string[] = [];

  if (input.isGrounded) {
    score += 35;
    reasons.push("Response grounded in live dashboard data");
  }

  if (input.evidenceCount >= 4) {
    score += 25;
    reasons.push(`${input.evidenceCount} data points used as evidence`);
  } else if (input.evidenceCount >= 2) {
    score += 15;
    reasons.push(`${input.evidenceCount} data points used as evidence`);
  } else if (input.evidenceCount === 0) {
    limitations.push("No specific data points found to support this response");
  }

  if (input.hasEntities) {
    score += 15;
    reasons.push("Specific entities referenced in response");
  }

  if (input.intent !== "unknown") {
    score += 15;
    reasons.push("Question intent classified clearly");
  } else {
    limitations.push("Question intent could not be precisely classified");
  }

  input.dataWarnings.forEach((w) => {
    score -= 15;
    limitations.push(w);
  });

  const finalScore = Math.max(0, Math.min(100, score));
  return { level: scoreToLevel(finalScore), score: finalScore, reasons, limitations };
}

// ── Generic public API ────────────────────────────────────────────────────────

export function buildDecisionConfidence(
  type: "campaign" | "experiment" | "creative" | "guardrail" | "assistant",
  input: CampaignConfidenceInput | ExperimentConfidenceInput | CreativeConfidenceInput | GuardrailConfidenceInput | AssistantConfidenceInput
): DecisionConfidence {
  switch (type) {
    case "campaign":    return buildCampaignConfidence(input as CampaignConfidenceInput);
    case "experiment":  return buildExperimentConfidence(input as ExperimentConfidenceInput);
    case "creative":    return buildCreativeConfidence(input as CreativeConfidenceInput);
    case "guardrail":   return buildGuardrailConfidence(input as GuardrailConfidenceInput);
    case "assistant":   return buildAssistantConfidence(input as AssistantConfidenceInput);
  }
}
