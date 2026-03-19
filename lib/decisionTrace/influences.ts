// ─── Decision Trace — Influences Builder ─────────────────────────────────────
//
// Pure functions. Builds the list of rules, thresholds, learnings, and goals
// that influenced a decision. These make the "why" legible.

import type { DecisionInfluence } from "./types";

// ── Campaign recommendation influences ───────────────────────────────────────

interface CampaignInfluencesInput {
  healthStatus:    string;
  meetsRoasGoal:   boolean;
  meetsCpaGoal:    boolean;
  roasGoalValue:   number | null;
  cpaGoalValue:    number | null;
  evaluatedRoas:   number;
  evaluatedCpa:    number;
  actionType:      string;
}

export function buildCampaignInfluences(input: CampaignInfluencesInput): DecisionInfluence[] {
  const influences: DecisionInfluence[] = [];

  // Attribution policy (always present)
  influences.push({
    label:       "Attribution policy: 7-day window",
    source:      "rule",
    description: "All ROAS and CPA evaluations use a 7-day attribution window. Conversions occurring after 7 days are excluded from these metrics.",
    weight:      "primary",
  });

  // CRM source of truth rule
  influences.push({
    label:       "CRM as source of truth",
    source:      "rule",
    description: "ROAS and CPA are calculated from Shopify/CRM data, not Meta-reported revenue. This ensures accurate business outcomes are used for decisions.",
    weight:      "primary",
  });

  // Goal thresholds
  if (input.roasGoalValue !== null) {
    influences.push({
      label:       `ROAS goal: ${input.roasGoalValue.toFixed(2)}×`,
      source:      "goal",
      description: `Campaign recommendation used a ROAS goal of ${input.roasGoalValue.toFixed(2)}×. Evaluated ROAS was ${input.evaluatedRoas.toFixed(2)}× — ${input.meetsRoasGoal ? "goal met" : "goal not met"}.`,
      weight:      "primary",
    });
  }

  if (input.cpaGoalValue !== null) {
    influences.push({
      label:       `CPA goal: $${input.cpaGoalValue.toFixed(2)}`,
      source:      "goal",
      description: `Campaign recommendation used a CPA goal of $${input.cpaGoalValue.toFixed(2)}. Evaluated CPA was $${input.evaluatedCpa.toFixed(2)} — ${input.meetsCpaGoal ? "goal met" : "goal not met"}.`,
      weight:      "primary",
    });
  }

  // Status-specific thresholds
  if (input.healthStatus === "strong") {
    influences.push({
      label:       "Scale threshold: ROAS ≥ 110% of goal",
      source:      "threshold",
      description: "A campaign qualifies as 'strong' when ROAS exceeds 110% of goal and CPA is at least 10% below goal. This threshold drives the scale recommendation.",
      weight:      "secondary",
    });
  } else if (input.healthStatus === "below_goal") {
    influences.push({
      label:       "Reduce threshold: ROAS < 80% of goal",
      source:      "threshold",
      description: "A 'reduce_spend' recommendation is triggered when ROAS falls below 80% of goal. This protects budget from underperforming campaigns.",
      weight:      "secondary",
    });
  }

  return influences;
}

// ── Experiment outcome influences ─────────────────────────────────────────────

interface ExperimentInfluencesInput {
  outcome:          string;
  successThreshold: number;
  primaryMetric:    string;
  winningVariant:   "control" | "challenger" | null;
  guardrailBreaches: string[];
  recommendedAction: string;
}

export function buildExperimentInfluences(input: ExperimentInfluencesInput): DecisionInfluence[] {
  const influences: DecisionInfluence[] = [];

  // Primary metric rule
  influences.push({
    label:       `Primary metric: ${input.primaryMetric.replace(/_/g, " ")}`,
    source:      "rule",
    description: `Winner detection evaluates the ${input.primaryMetric.replace(/_/g, " ")} as the primary decision metric. A lift of at least ${(input.successThreshold * 100).toFixed(0)}% is required to declare a winner.`,
    weight:      "primary",
  });

  // Attribution policy
  influences.push({
    label:       "7-day attribution policy",
    source:      "rule",
    description: "All conversion metrics in this experiment use a 7-day attribution window per platform policy.",
    weight:      "primary",
  });

  // Detection algorithm
  influences.push({
    label:       `Success threshold: ${(input.successThreshold * 100).toFixed(0)}% lift required`,
    source:      "threshold",
    description: `The experiment plan required at least a ${(input.successThreshold * 100).toFixed(0)}% lift to declare the ${input.winningVariant ?? "challenging"} variant a winner.`,
    weight:      "secondary",
  });

  // Guardrail breaches
  if (input.guardrailBreaches.length > 0) {
    input.guardrailBreaches.forEach((b) => {
      influences.push({
        label:       `Guardrail: ${b}`,
        source:      "guardrail",
        description: `A guardrail breach was detected: ${b}. This may have influenced the confidence and outcome classification.`,
        weight:      "secondary",
      });
    });
  }

  // Recommended action rule
  influences.push({
    label:       `Recommended action: ${input.recommendedAction.replace(/_/g, " ")}`,
    source:      "rule",
    description: `Based on the outcome '${input.outcome}', the system recommends: ${input.recommendedAction.replace(/_/g, " ")}.`,
    weight:      "informational",
  });

  return influences;
}

// ── Creative scoring influences ───────────────────────────────────────────────

interface CreativeScoringInfluencesInput {
  variantType:     string;
  policyRiskFound: boolean;
  briefIntent:     string | null;
  topDimensions:   Array<{ name: string; score: number }>;
}

export function buildCreativeScoringInfluences(input: CreativeScoringInfluencesInput): DecisionInfluence[] {
  const influences: DecisionInfluence[] = [];

  // Scoring model
  influences.push({
    label:       `${input.variantType === "copy" ? "Copy" : "Image"} scoring weights applied`,
    source:      "rule",
    description: `Creative scoring uses variant-type-specific dimension weights. ${input.variantType === "copy" ? "Copy weights emphasise hook strength (20%) and goal alignment (15%)." : "Image weights emphasise offer clarity (25%) and goal alignment (20%)."}`,
    weight:      "primary",
  });

  // Policy risk check
  if (input.policyRiskFound) {
    influences.push({
      label:       "Policy risk detected",
      source:      "guardrail",
      description: "Patterns that may violate Meta ad policies were detected in this creative. The policy_risk dimension score reflects this.",
      weight:      "primary",
    });
  }

  // Brief intent
  if (input.briefIntent) {
    influences.push({
      label:       `Brief intent: ${input.briefIntent.replace(/_/g, " ")}`,
      source:      "goal",
      description: `The creative was evaluated against the brief intent '${input.briefIntent.replace(/_/g, " ")}', which informed goal alignment and angle novelty scoring.`,
      weight:      "secondary",
    });
  }

  // Top dimensions
  input.topDimensions.slice(0, 2).forEach((d) => {
    influences.push({
      label:       `Dimension: ${d.name.replace(/_/g, " ")} scored ${d.score}/10`,
      source:      "threshold",
      description: `The ${d.name.replace(/_/g, " ")} dimension received a score of ${d.score}/10. A score below 4 is considered failing.`,
      weight:      "informational",
    });
  });

  return influences;
}

// ── Guardrail influences ──────────────────────────────────────────────────────

interface GuardrailInfluencesInput {
  executionMode:    string;
  approvalStatus:   boolean;
  validationPassed: boolean;
}

export function buildGuardrailInfluences(input: GuardrailInfluencesInput): DecisionInfluence[] {
  const influences: DecisionInfluence[] = [];

  influences.push({
    label:       "Human approval requirement",
    source:      "guardrail",
    description: "All publish-prep items require explicit human approval before any launch action can proceed. This is a non-bypassable safety gate.",
    weight:      "primary",
  });

  influences.push({
    label:       `Execution mode: ${input.executionMode.replace(/_/g, " ")}`,
    source:      "rule",
    description: `The selected execution mode '${input.executionMode.replace(/_/g, " ")}' determines which automated launch paths are permitted.`,
    weight:      "primary",
  });

  if (!input.validationPassed) {
    influences.push({
      label:       "Validation failure blocks launch",
      source:      "guardrail",
      description: "Validation checks must pass before guardrail evaluation proceeds. Outstanding validation failures block all launch paths.",
      weight:      "primary",
    });
  }

  return influences;
}

// ── Assistant response influences ─────────────────────────────────────────────

interface AssistantInfluencesInput {
  intent:          string;
  isAiGenerated:   boolean;
  evidenceCount:   number;
  learningCount:   number;
}

export function buildAssistantInfluences(input: AssistantInfluencesInput): DecisionInfluence[] {
  const influences: DecisionInfluence[] = [];

  influences.push({
    label:       `Intent: ${input.intent.replace(/_/g, " ")}`,
    source:      "rule",
    description: `The question was classified as '${input.intent.replace(/_/g, " ")}' using keyword scoring. This intent determines which data context is emphasised in the response.`,
    weight:      "primary",
  });

  influences.push({
    label:       input.isAiGenerated ? "Claude AI summary generation" : "Template-based fallback response",
    source:      "rule",
    description: input.isAiGenerated
      ? "The summary was generated by Claude using only the provided data context. The system prompt instructs the model not to fabricate metrics."
      : "No AI API key configured — the summary was built deterministically from live data using response templates.",
    weight:      "primary",
  });

  if (input.evidenceCount > 0) {
    influences.push({
      label:       `${input.evidenceCount} evidence items from live data`,
      source:      "rule",
      description: "Evidence items are built deterministically from the assembled context — they are not generated by the AI model.",
      weight:      "secondary",
    });
  }

  if (input.learningCount > 0) {
    influences.push({
      label:       `${input.learningCount} learning memory entr${input.learningCount !== 1 ? "ies" : "y"} referenced`,
      source:      "learning",
      description: "Learning memory entries from past experiments, campaigns, and creative outcomes were included in the response context.",
      weight:      "informational",
    });
  }

  // Always present: grounding rule
  influences.push({
    label:       "Grounded response constraint",
    source:      "rule",
    description: "The assistant is instructed to use only the provided data context. CRM is the source of truth for ROAS and CPA. Dayparting uses ad account timezone. Attribution window is 7 days.",
    weight:      "secondary",
  });

  return influences;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function buildDecisionInfluences(
  type: "campaign" | "experiment" | "creative" | "guardrail" | "assistant",
  input: unknown
): DecisionInfluence[] {
  switch (type) {
    case "campaign":   return buildCampaignInfluences(input as CampaignInfluencesInput);
    case "experiment": return buildExperimentInfluences(input as ExperimentInfluencesInput);
    case "creative":   return buildCreativeScoringInfluences(input as CreativeScoringInfluencesInput);
    case "guardrail":  return buildGuardrailInfluences(input as GuardrailInfluencesInput);
    case "assistant":  return buildAssistantInfluences(input as AssistantInfluencesInput);
  }
}
