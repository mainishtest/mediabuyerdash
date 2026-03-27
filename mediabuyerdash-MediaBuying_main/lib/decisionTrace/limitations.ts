// ─── Decision Trace — Limitations Builder ────────────────────────────────────
//
// Pure functions. Surfaces data quality issues, missing context, and known
// system constraints as human-readable limitation items.

import type { DecisionLimitation } from "./types";

// ── Standard system constraints ───────────────────────────────────────────────
// These are always displayed to set user expectations.

export const STANDARD_ATTRIBUTION_LIMITATION: DecisionLimitation = {
  label:       "7-day attribution window",
  description: "Results include only conversions attributed within 7 days of ad exposure. Conversions occurring after this window are not counted in ROAS or CPA.",
  severity:    "informational",
};

export const STANDARD_CRM_SYNC_LIMITATION: DecisionLimitation = {
  label:       "CRM reconciliation delay",
  description: "CRM revenue data can take 24–48 hours to reconcile. Very recent spend may show temporarily inflated CPA or deflated ROAS until reconciliation completes.",
  severity:    "informational",
};

// ── Campaign recommendation limitations ───────────────────────────────────────

interface CampaignLimitationsInput {
  hasGoal:          boolean;
  roasGoalValue:    number | null;
  cpaGoalValue:     number | null;
  dataWindowDays:   number;
  healthStatus:     string;
  evaluatedRoas:    number;
  crmOrders:        number;
  dataWarnings:     string[];
}

export function buildCampaignLimitations(input: CampaignLimitationsInput): DecisionLimitation[] {
  const limitations: DecisionLimitation[] = [
    STANDARD_ATTRIBUTION_LIMITATION,
    STANDARD_CRM_SYNC_LIMITATION,
  ];

  if (!input.hasGoal) {
    limitations.push({
      label:       "No goals configured",
      description: "This campaign has no ROAS or CPA goals set. Recommendations are based on spend thresholds only — set goals to enable accurate goal-aware evaluation.",
      severity:    "warning",
    });
  } else if (input.roasGoalValue === null) {
    limitations.push({
      label:       "No ROAS goal",
      description: "Only a CPA goal is configured. ROAS evaluation uses a generic threshold. Configure a ROAS goal for full evaluation.",
      severity:    "warning",
    });
  } else if (input.cpaGoalValue === null) {
    limitations.push({
      label:       "No CPA goal",
      description: "Only a ROAS goal is configured. CPA evaluation uses a generic threshold. Configure a CPA goal for full evaluation.",
      severity:    "warning",
    });
  }

  if (input.dataWindowDays < 7) {
    limitations.push({
      label:       "Short data window",
      description: `Only ${input.dataWindowDays} day${input.dataWindowDays !== 1 ? "s" : ""} of data were available. The full 7-day attribution window is required for reliable evaluation. Results are preliminary.`,
      severity:    input.dataWindowDays < 3 ? "blocking" : "warning",
    });
  }

  if (input.evaluatedRoas === 0 && input.crmOrders === 0) {
    limitations.push({
      label:       "No CRM conversion data",
      description: "No orders were recorded in the CRM for this campaign in this window. ROAS and CPA could not be evaluated. Verify CRM integration and attribution setup.",
      severity:    "warning",
    });
  }

  if (input.healthStatus === "watch") {
    limitations.push({
      label:       "Mixed performance signals",
      description: "The campaign meets one goal but not the other. The recommendation is directional — manual review of the specific underperforming metric is advised.",
      severity:    "informational",
    });
  }

  input.dataWarnings.forEach((w) => {
    limitations.push({ label: "Data warning", description: w, severity: "warning" });
  });

  return limitations;
}

// ── Experiment limitations ────────────────────────────────────────────────────

interface ExperimentLimitationsInput {
  outcome:          string;
  daysRunning:      number;
  controlSpend:     number;
  challengerSpend:  number;
  controlOrders:    number;
  challengerOrders: number;
  guardrailBreaches: string[];
  confidence:       number;
}

export function buildExperimentLimitations(input: ExperimentLimitationsInput): DecisionLimitation[] {
  const limitations: DecisionLimitation[] = [
    STANDARD_ATTRIBUTION_LIMITATION,
  ];

  if (input.daysRunning < 7) {
    limitations.push({
      label:       "Experiment duration below 7 days",
      description: `Experiment ran for ${input.daysRunning} day${input.daysRunning !== 1 ? "s" : ""}. The 7-day attribution cycle was not completed — conversions may still be accumulating.`,
      severity:    "warning",
    });
  }

  const totalOrders = input.controlOrders + input.challengerOrders;
  if (totalOrders < 10) {
    limitations.push({
      label:       "Low conversion count",
      description: `Only ${totalOrders} total conversions recorded. Statistical reliability requires at least 10–20 conversions per variant. Results should be treated as directional.`,
      severity:    totalOrders < 5 ? "blocking" : "warning",
    });
  }

  if (input.confidence < 0.5) {
    limitations.push({
      label:       "Low statistical confidence",
      description: `Detection confidence is ${(input.confidence * 100).toFixed(0)}%. A confidence of at least 70% is recommended before acting on this result.`,
      severity:    "warning",
    });
  }

  if (input.guardrailBreaches.length > 0) {
    limitations.push({
      label:       "Guardrail breach detected",
      description: `${input.guardrailBreaches.length} guardrail${input.guardrailBreaches.length !== 1 ? "s" : ""} were breached during this experiment. This may affect the reliability of outcome metrics.`,
      severity:    "warning",
    });
  }

  if (["failed_test", "insufficient_data"].includes(input.outcome)) {
    limitations.push({
      label:       "Inconclusive outcome",
      description: "The experiment did not produce a conclusive result. Do not apply directional learnings from this test without additional validation.",
      severity:    "blocking",
    });
  }

  return limitations;
}

// ── Creative score limitations ────────────────────────────────────────────────

interface CreativeLimitationsInput {
  overallScore:      number;
  isHeuristicOnly:   boolean;
  hasLivePerformance: boolean;
  variantType:       string;
}

export function buildCreativeLimitations(input: CreativeLimitationsInput): DecisionLimitation[] {
  const limitations: DecisionLimitation[] = [];

  limitations.push({
    label:       "Heuristic scoring — no live performance data",
    description: "Creative scores are based on structural heuristics (hook strength, offer clarity, policy risk, etc.) and do not use live CTR, CVR, or ROAS data. Scores are predictive, not definitive.",
    severity:    "informational",
  });

  if (!input.hasLivePerformance) {
    limitations.push({
      label:       "No historical performance context",
      description: "This creative has not run before. Goal alignment and angle novelty scores are estimated from brief context only.",
      severity:    "informational",
    });
  }

  if (input.overallScore < 50) {
    limitations.push({
      label:       "Low overall score — revision recommended",
      description: "This creative scored below the passing threshold. Launching low-scoring creatives may negatively impact campaign performance.",
      severity:    "warning",
    });
  }

  return limitations;
}

// ── Publish guardrail limitations ─────────────────────────────────────────────

interface GuardrailLimitationsInput {
  requiredFailed: number;
  optionalFailed: number;
  hasValidation:  boolean;
}

export function buildGuardrailLimitations(input: GuardrailLimitationsInput): DecisionLimitation[] {
  const limitations: DecisionLimitation[] = [];

  if (input.requiredFailed > 0) {
    limitations.push({
      label:       "Required guardrail failures block launch",
      description: `${input.requiredFailed} required guardrail${input.requiredFailed !== 1 ? "s" : ""} failed. All required checks must pass before any launch action can be initiated.`,
      severity:    "blocking",
    });
  }

  if (!input.hasValidation) {
    limitations.push({
      label:       "Validation not yet run",
      description: "Validation checks have not been run for this item. Run validation before approving for launch.",
      severity:    "warning",
    });
  }

  if (input.optionalFailed > 0) {
    limitations.push({
      label:       "Optional guardrail failures",
      description: `${input.optionalFailed} optional guardrail${input.optionalFailed !== 1 ? "s" : ""} failed. These do not block launch but should be reviewed before proceeding.`,
      severity:    "informational",
    });
  }

  return limitations;
}

// ── Assistant limitations ─────────────────────────────────────────────────────

interface AssistantLimitationsInput {
  dataWarnings:    string[];
  isTemplateOnly:  boolean;
  evidenceCount:   number;
  intent:          string;
}

export function buildAssistantLimitations(input: AssistantLimitationsInput): DecisionLimitation[] {
  const limitations: DecisionLimitation[] = [
    STANDARD_ATTRIBUTION_LIMITATION,
  ];

  if (input.isTemplateOnly) {
    limitations.push({
      label:       "Template-based response (no AI)",
      description: "The AI API is not configured. This response was generated from a data template rather than Claude. The information is accurate but may be less nuanced.",
      severity:    "informational",
    });
  }

  if (input.evidenceCount < 2) {
    limitations.push({
      label:       "Sparse supporting data",
      description: "Few data points were found to support this response. Results may be incomplete — check that data syncs are up to date.",
      severity:    "warning",
    });
  }

  if (input.intent === "unknown") {
    limitations.push({
      label:       "Ambiguous question intent",
      description: "The question could not be precisely classified. The response defaults to showing the highest-priority issues. Rephrase for more targeted results.",
      severity:    "informational",
    });
  }

  input.dataWarnings.forEach((w) => {
    limitations.push({ label: "Data warning", description: w, severity: "warning" });
  });

  return limitations;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function buildDecisionLimitations(
  type: "campaign" | "experiment" | "creative" | "guardrail" | "assistant",
  input: unknown
): DecisionLimitation[] {
  switch (type) {
    case "campaign":   return buildCampaignLimitations(input as CampaignLimitationsInput);
    case "experiment": return buildExperimentLimitations(input as ExperimentLimitationsInput);
    case "creative":   return buildCreativeLimitations(input as CreativeLimitationsInput);
    case "guardrail":  return buildGuardrailLimitations(input as GuardrailLimitationsInput);
    case "assistant":  return buildAssistantLimitations(input as AssistantLimitationsInput);
  }
}
