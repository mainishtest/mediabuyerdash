// lib/experimentLaunch/readiness.ts
// Computes launch readiness state and human-readable summaries for experiment plans.
// All functions are pure — no DB access.
//
// State machine:
//   draft → needs_mapping → needs_approval → ready_for_launch
//   (any state can transition to blocked if guardrails fail)
//   ready_for_launch → launched (when linked to ExperimentRecord)

import type {
  CreativeExperimentLaunchPlan,
  CreativeExperimentLaunchReadiness,
  CreativeExperimentReadinessState,
  CreativeExperimentLaunchReason,
  CreativeExperimentLaunchSummary,
} from "../../types/experimentLaunch";
import { isMappingComplete } from "./mapping";
import { allRequiredGuardrailsPass } from "./criteria";

// ---------------------------------------------------------------------------
// Compute readiness state and reasons
// ---------------------------------------------------------------------------

export function computeCreativeExperimentLaunchReadiness(
  plan: Pick<
    CreativeExperimentLaunchPlan,
    | "control"
    | "challenger"
    | "mapping"
    | "successCriteria"
    | "guardrails"
    | "hypothesis"
    | "approvedAt"
    | "launchedAt"
    | "linkedExperimentId"
  >,
): CreativeExperimentLaunchReadiness {
  const blockers: CreativeExperimentLaunchReason[] = [];
  const warnings: CreativeExperimentLaunchReason[] = [];
  const infos:    CreativeExperimentLaunchReason[] = [];

  // Already launched
  if (plan.launchedAt || plan.linkedExperimentId) {
    return {
      state:         "launched",
      blockers:      [],
      warnings:      [],
      infos: [{
        key:      "already_launched",
        label:    "Already Launched",
        severity: "info",
        message:  plan.linkedExperimentId
          ? `Linked to experiment ${plan.linkedExperimentId}.`
          : "This plan has been launched.",
      }],
      nextAction:    "View the linked experiment for results.",
      isLaunchReady: false,
    };
  }

  // Check challenger
  if (!plan.challenger.prepItemId && !plan.challenger.briefId) {
    blockers.push({
      key:      "no_challenger",
      label:    "No Challenger Creative",
      severity: "blocking",
      message:  "Link an approved creative draft as the challenger before proceeding.",
    });
  }

  // Check control
  if (!plan.control.creativeId && !plan.control.adExternalId) {
    blockers.push({
      key:      "no_control",
      label:    "No Control Creative",
      severity: "blocking",
      message:  "Select an existing creative as the control baseline.",
    });
  }

  // Check mapping
  const mappingOk = isMappingComplete(plan.mapping);
  if (!mappingOk) {
    const hasCampaign = !!(plan.mapping.campaignId || plan.mapping.campaignExternalId);
    const hasAdSet    = !!(plan.mapping.adSetId    || plan.mapping.adSetExternalId);
    if (!hasCampaign) {
      blockers.push({
        key:      "no_campaign",
        label:    "No Target Campaign",
        severity: "blocking",
        message:  "Map this test to a target campaign before it can run.",
      });
    }
    if (!hasAdSet) {
      blockers.push({
        key:      "no_ad_set",
        label:    "No Target Ad Set",
        severity: "blocking",
        message:  "Map this test to a target ad set before it can run.",
      });
    }
  }

  // Check success criteria
  if (!plan.successCriteria.primaryMetric) {
    blockers.push({
      key:      "no_primary_metric",
      label:    "No Primary Metric",
      severity: "blocking",
      message:  "Define a primary success metric (e.g. ROAS 7-day, CPA 7-day).",
    });
  }

  // Check hypothesis (warning, not blocking)
  if (!plan.hypothesis || plan.hypothesis.trim().length === 0) {
    warnings.push({
      key:      "no_hypothesis",
      label:    "No Hypothesis",
      severity: "warning",
      message:  "Document what this test is expected to prove — improves learning value.",
    });
  }

  // Check guardrail flags
  const failedRequired = plan.guardrails.filter((g) => g.required && !g.passed);
  const failedWarnings = plan.guardrails.filter((g) => !g.required && !g.passed);

  for (const g of failedRequired) {
    if (!blockers.some((b) => b.key === g.key)) {
      blockers.push({
        key:      g.key,
        label:    g.label,
        severity: "blocking",
        message:  g.message,
      });
    }
  }
  for (const g of failedWarnings) {
    if (!warnings.some((w) => w.key === g.key)) {
      warnings.push({
        key:      g.key,
        label:    g.label,
        severity: "warning",
        message:  g.message,
      });
    }
  }

  // Compute state
  const hasChallenger = !!(plan.challenger.prepItemId || plan.challenger.briefId);
  const hasControl    = !!(plan.control.creativeId    || plan.control.adExternalId);

  let state: CreativeExperimentReadinessState;
  let nextAction: string;

  if (blockers.length > 0 && (!hasChallenger || !hasControl)) {
    // Missing core creative assignments — still in draft
    state = "draft";
    nextAction = "Assign a challenger creative from an approved publish-prep item, then select a control creative.";
  } else if (!mappingOk) {
    state = "needs_mapping";
    nextAction = "Map this test to a target campaign and ad set.";
  } else if (blockers.length > 0) {
    state = "blocked";
    nextAction = `Resolve ${blockers.length} blocker${blockers.length !== 1 ? "s" : ""} before this plan can proceed.`;
  } else if (!plan.approvedAt) {
    state = "needs_approval";
    nextAction = "All checks pass — send this plan for approval to mark it ready for launch.";
  } else {
    state      = "ready_for_launch";
    nextAction = "Plan is approved and launch-ready — create an experiment record to begin tracking.";
    infos.push({
      key:      "approved",
      label:    "Approved",
      severity: "info",
      message:  `Approved on ${new Date(plan.approvedAt).toLocaleDateString()}.`,
    });
  }

  return {
    state,
    blockers,
    warnings,
    infos,
    nextAction,
    isLaunchReady: state === "ready_for_launch",
  };
}

// ---------------------------------------------------------------------------
// Re-compute readiness on an existing plan (after updates)
// ---------------------------------------------------------------------------

export function recomputePlanReadiness(
  plan: CreativeExperimentLaunchPlan,
): CreativeExperimentLaunchPlan {
  const readiness = computeCreativeExperimentLaunchReadiness(plan);
  return { ...plan, readiness, updatedAt: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// Build an aggregate summary across a list of plans
// ---------------------------------------------------------------------------

export function buildExperimentLaunchSummary(
  plans: Pick<CreativeExperimentLaunchPlan, "readiness">[],
): CreativeExperimentLaunchSummary {
  const summary: CreativeExperimentLaunchSummary = {
    total:          plans.length,
    draft:          0,
    needsMapping:   0,
    needsApproval:  0,
    readyForLaunch: 0,
    blocked:        0,
    launched:       0,
  };

  for (const p of plans) {
    switch (p.readiness.state) {
      case "draft":            summary.draft++;          break;
      case "needs_mapping":    summary.needsMapping++;   break;
      case "needs_approval":   summary.needsApproval++;  break;
      case "ready_for_launch": summary.readyForLaunch++; break;
      case "blocked":          summary.blocked++;        break;
      case "launched":         summary.launched++;       break;
    }
  }

  return summary;
}

// ---------------------------------------------------------------------------
// Human-readable summary of a plan
// ---------------------------------------------------------------------------

export function summarizeCreativeExperimentLaunchPlan(
  plan: CreativeExperimentLaunchPlan,
): string {
  const challengerName = plan.challenger.variantTitle ?? plan.challenger.label;
  const controlName    = plan.control.creativeName    ?? plan.control.label;
  const state          = plan.readiness.state;
  const metric         = plan.successCriteria.primaryMetric;
  const threshold      = `${(plan.successCriteria.successThreshold * 100).toFixed(0)}%`;
  const windowDays     = plan.successCriteria.evaluationWindowDays;
  const campaign       = plan.mapping.campaignName ?? plan.mapping.campaignExternalId ?? "unmapped campaign";
  const adSet          = plan.mapping.adSetName    ?? plan.mapping.adSetExternalId    ?? "unmapped ad set";

  if (state === "launched") {
    return `${challengerName} vs ${controlName} — active in ${campaign} / ${adSet}. Tracking ${metric} over ${windowDays}d.`;
  }

  if (state === "draft") {
    const missing: string[] = [];
    if (!plan.challenger.prepItemId && !plan.challenger.briefId) missing.push("challenger creative");
    if (!plan.control.creativeId && !plan.control.adExternalId)  missing.push("control creative");
    return `Draft plan — missing: ${missing.join(", ") || "required fields"}.`;
  }

  if (state === "needs_mapping") {
    return `${challengerName} vs ${controlName} — needs campaign and ad set mapping.`;
  }

  if (state === "blocked") {
    const n = plan.readiness.blockers.length;
    return `${challengerName} vs ${controlName} — blocked (${n} issue${n !== 1 ? "s" : ""}).`;
  }

  if (state === "needs_approval") {
    return `${challengerName} vs ${controlName} in ${adSet}. Testing ${metric} (>${threshold} lift required over ${windowDays}d). Awaiting approval.`;
  }

  // ready_for_launch
  return `${challengerName} vs ${controlName} in ${adSet}. ${metric} target: ${threshold} lift in ${windowDays}d. Ready to launch.`;
}
