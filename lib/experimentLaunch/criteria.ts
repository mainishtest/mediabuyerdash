// lib/experimentLaunch/criteria.ts
// Builds success criteria and guardrails for creative experiment launch plans.
// All functions are pure — no DB access.
//
// Design rules:
//   - evaluationWindowDays is always 7 to align with 7-day CRM attribution.
//   - CRM metrics (roas_7d, cpa_7d) are preferred as primary metric defaults.
//   - Guardrails gate launch readiness — separate from success criteria evaluation.

import type {
  CreativeExperimentSuccessCriteria,
  CreativeExperimentGuardrail,
  CreativeExperimentLaunchPlan,
} from "../../types/experimentLaunch";
import { isMappingComplete } from "./mapping";

// ---------------------------------------------------------------------------
// Default success criteria values
// ---------------------------------------------------------------------------

const DEFAULTS = {
  primaryMetric:            "roas_7d",
  secondaryMetrics:         ["cpa_7d", "ctr"],
  guardrailMetrics:         ["cpm"],
  successThreshold:         0.10,   // 10% relative lift
  minSpendPerVariant:       50.0,   // $50 minimum spend per variant
  minConversionsPerVariant: 5,      // 5 conversions minimum
  evaluationWindowDays:     7,      // enforced 7-day CRM attribution window
} as const;

// ---------------------------------------------------------------------------
// Build success criteria
// ---------------------------------------------------------------------------

export function buildCreativeExperimentSuccessCriteria(opts?: {
  primaryMetric?:            string;
  secondaryMetrics?:         string[];
  guardrailMetrics?:         string[];
  successThreshold?:         number;
  minSpendPerVariant?:       number;
  minConversionsPerVariant?: number;
  evaluationWindowDays?:     number;
  hypothesis?:               string | null;
}): CreativeExperimentSuccessCriteria {
  // Always enforce 7-day window to match CRM attribution
  const evaluationWindowDays = 7;

  return {
    primaryMetric:            opts?.primaryMetric            ?? DEFAULTS.primaryMetric,
    secondaryMetrics:         opts?.secondaryMetrics         ?? [...DEFAULTS.secondaryMetrics],
    guardrailMetrics:         opts?.guardrailMetrics         ?? [...DEFAULTS.guardrailMetrics],
    successThreshold:         opts?.successThreshold         ?? DEFAULTS.successThreshold,
    minSpendPerVariant:       opts?.minSpendPerVariant       ?? DEFAULTS.minSpendPerVariant,
    minConversionsPerVariant: opts?.minConversionsPerVariant ?? DEFAULTS.minConversionsPerVariant,
    evaluationWindowDays,
    hypothesisStatement:      opts?.hypothesis ?? null,
  };
}

// ---------------------------------------------------------------------------
// Individual guardrail checks
// ---------------------------------------------------------------------------

function guardrailChallengerAssigned(
  challengerPrepItemId: string | null,
  challengerBriefId:    string | null,
): CreativeExperimentGuardrail {
  const passed = !!(challengerPrepItemId || challengerBriefId);
  return {
    key:      "challenger_assigned",
    label:    "Challenger Creative Assigned",
    passed,
    required: true,
    message:  passed
      ? "Challenger creative is linked from an approved publish-prep item."
      : "No challenger creative assigned — link an approved creative draft before proceeding.",
  };
}

function guardrailControlAssigned(
  controlCreativeId: string | null,
  controlAdExternalId: string | null,
): CreativeExperimentGuardrail {
  const passed = !!(controlCreativeId || controlAdExternalId);
  return {
    key:      "control_assigned",
    label:    "Control Creative Assigned",
    passed,
    required: true,
    message:  passed
      ? "Control creative is identified for comparison."
      : "No control creative assigned — select an existing creative as the baseline.",
  };
}

function guardrailMappingComplete(
  hasCampaign: boolean,
  hasAdSet:    boolean,
): CreativeExperimentGuardrail {
  const passed = hasCampaign && hasAdSet;
  return {
    key:      "mapping_complete",
    label:    "Campaign and Ad Set Mapped",
    passed,
    required: true,
    message:  passed
      ? "Both target campaign and ad set are mapped."
      : !hasCampaign && !hasAdSet
        ? "Neither campaign nor ad set is mapped."
        : !hasCampaign
          ? "Target campaign is not mapped."
          : "Target ad set is not mapped.",
  };
}

function guardrailSuccessCriteriaSet(
  criteria: CreativeExperimentSuccessCriteria,
): CreativeExperimentGuardrail {
  const passed = !!(
    criteria.primaryMetric &&
    criteria.successThreshold > 0 &&
    criteria.evaluationWindowDays > 0
  );
  return {
    key:      "success_criteria_set",
    label:    "Success Criteria Defined",
    passed,
    required: true,
    message:  passed
      ? `Primary metric: ${criteria.primaryMetric}, threshold: ${(criteria.successThreshold * 100).toFixed(0)}%, window: ${criteria.evaluationWindowDays}d.`
      : "Success criteria are incomplete — set primary metric, threshold, and evaluation window.",
  };
}

function guardrailMinSpendSet(
  minSpend: number,
): CreativeExperimentGuardrail {
  const passed = minSpend >= 10;
  return {
    key:      "min_spend_threshold",
    label:    "Minimum Spend Threshold",
    passed,
    required: false,  // warning only — low spend is a risk, not a hard blocker
    message:  passed
      ? `Minimum spend per variant: $${minSpend}.`
      : `Minimum spend per variant ($${minSpend}) is below $10 — data reliability risk.`,
  };
}

function guardrailHypothesisDefined(
  hypothesis: string | null,
): CreativeExperimentGuardrail {
  const passed = !!(hypothesis && hypothesis.trim().length > 0);
  return {
    key:      "hypothesis_defined",
    label:    "Hypothesis Defined",
    passed,
    required: false,  // warning — best practice, not a hard blocker
    message:  passed
      ? "Experiment hypothesis is documented."
      : "No hypothesis defined — document what you expect this test to prove.",
  };
}

function guardrailNotAlreadyLaunched(
  readinessState: string,
): CreativeExperimentGuardrail {
  const passed = readinessState !== "launched";
  return {
    key:      "not_already_launched",
    label:    "Not Already Launched",
    passed,
    required: true,
    message:  passed
      ? "This plan has not yet been launched."
      : "This plan is already launched — no further wiring changes are permitted.",
  };
}

// ---------------------------------------------------------------------------
// Public API: build full guardrail set for a plan
// ---------------------------------------------------------------------------

export function buildCreativeExperimentGuardrails(
  plan: Pick<
    CreativeExperimentLaunchPlan,
    "control" | "challenger" | "mapping" | "successCriteria" | "hypothesis"
  > & { readiness?: { state?: string } },
): CreativeExperimentGuardrail[] {
  const hasCampaign = isMappingComplete({ ...plan.mapping, adSetId: null, adSetExternalId: null, adSetName: null })
    || !!(plan.mapping.campaignId || plan.mapping.campaignExternalId);
  const hasAdSet    = !!(plan.mapping.adSetId || plan.mapping.adSetExternalId);

  return [
    guardrailChallengerAssigned(plan.challenger.prepItemId, plan.challenger.briefId),
    guardrailControlAssigned(plan.control.creativeId, plan.control.adExternalId),
    guardrailMappingComplete(hasCampaign, hasAdSet),
    guardrailSuccessCriteriaSet(plan.successCriteria),
    guardrailMinSpendSet(plan.successCriteria.minSpendPerVariant),
    guardrailHypothesisDefined(plan.hypothesis ?? null),
    guardrailNotAlreadyLaunched(plan.readiness?.state ?? "draft"),
  ];
}

// ---------------------------------------------------------------------------
// Check if all required guardrails pass
// ---------------------------------------------------------------------------

export function allRequiredGuardrailsPass(
  guardrails: CreativeExperimentGuardrail[],
): boolean {
  return guardrails.filter((g) => g.required).every((g) => g.passed);
}
