// lib/outcomeActions/plans.ts
// Pure builders for ScalePlan, LoserHandlingPlan, and FollowUpExperimentPlan.
// All functions are deterministic — no DB access, no API calls.

import type {
  ScalePlan,
  LoserHandlingPlan,
  FollowUpExperimentPlan,
}                          from "../../types/outcomeActions";
import type {
  ExperimentMetricSnapshot,
  ExperimentWithResult,
}                          from "../../types/experiment";

// ---------------------------------------------------------------------------
// Scale plan — structures what budget scaling would look like
// Does NOT execute any budget change.
// ---------------------------------------------------------------------------

export function buildScalePlan(
  winner:     ExperimentMetricSnapshot,
  experiment: ExperimentWithResult,
): ScalePlan {
  const variantType = winner.variantType;

  // Conservative multiplier based on confidence
  const confidence = experiment.result?.confidence ?? 0;
  const multiplier = confidence >= 0.7 ? 1.5 : confidence >= 0.5 ? 1.25 : 1.1;

  const dailyNote = winner.spend > 0
    ? `Current ${variantType} spend over window: $${winner.spend.toFixed(0)}. A ${((multiplier - 1) * 100).toFixed(0)}% increase would target ~$${(winner.spend * multiplier / experiment.evaluationWindowDays).toFixed(0)}/day.`
    : "Actual spend data unavailable — verify spend before scaling.";

  const safetyChecks: string[] = [
    "Verify ROAS remains above goal after scaling (CRM data, 7-day window).",
    "Check campaign monthly pacing before approving budget increase.",
    "Confirm Meta ad account daily budget limits allow the increase.",
    "Ensure attribution window aligns with the 7-day CRM measurement window.",
  ];

  const requiredApprovals = [
    "Operator must approve the proposed budget change via the automation approval workflow.",
    "Budget change must pass the existing automation guardrails before execution.",
  ];

  return {
    targetVariant:             variantType,
    currentSpend:              winner.spend,
    suggestedBudgetMultiplier: multiplier,
    suggestedDailyBudgetNote:  dailyNote,
    scaleRationale:            `${variantType === "challenger" ? "Challenger" : "Control"} showed ${((experiment.result?.primaryMetricLift ?? 0) * 100).toFixed(1)}% lift on ${experiment.primaryMetric.replace(/_/g, " ")}. Scaling at ${((multiplier - 1) * 100).toFixed(0)}% is consistent with confidence level (${Math.round(confidence * 100)}%).`,
    safetyChecks,
    requiredApprovals,
    automationActionType: "increase_budget",
  };
}

// ---------------------------------------------------------------------------
// Loser handling plan — structures what to do with the underperformer
// ---------------------------------------------------------------------------

export function buildLoserHandlingPlan(
  loser:       ExperimentMetricSnapshot,
  experiment:  ExperimentWithResult,
  briefLabLink: string | null,
): LoserHandlingPlan {
  const variantType   = loser.variantType;
  const hasMaterial   = loser.spend >= experiment.minSpendPerVariant;
  const poorEconomics = loser.roas < 1.0;

  let suggestedAction: LoserHandlingPlan["suggestedAction"];
  let actionRationale: string;

  if (poorEconomics && hasMaterial) {
    suggestedAction = "pause_review";
    actionRationale = `${variantType === "challenger" ? "Challenger" : "Control"} ROAS (${loser.roas.toFixed(2)}x) is below 1.0 — spending more than earning. Flagged for pause review.`;
  } else if (hasMaterial) {
    suggestedAction = "reduce_budget";
    actionRationale = `${variantType === "challenger" ? "Challenger" : "Control"} underperformed with $${loser.spend.toFixed(0)} spend. A budget reduction reduces exposure while results are reviewed.`;
  } else {
    suggestedAction = "send_to_lab";
    actionRationale = `Insufficient spend to draw strong conclusions. Return to Creative Lab for creative refresh and re-test with updated brief direction.`;
  }

  const safeguards: string[] = [
    "No pause or budget change executes without approval from the automation workflow.",
    "Verify campaign is not the only active creative before pausing.",
    "Check that pausing or reducing will not violate minimum delivery commitments.",
  ];

  return {
    targetVariant:   variantType,
    currentSpend:    loser.spend,
    currentRoas:     loser.roas,
    suggestedAction,
    actionRationale,
    safeguards,
    briefLabLink,
  };
}

// ---------------------------------------------------------------------------
// Follow-up experiment plan — next creative iteration direction
// ---------------------------------------------------------------------------

export function buildFollowUpExperimentPlan(
  experiment: ExperimentWithResult,
  winner:     ExperimentMetricSnapshot | null,
): FollowUpExperimentPlan {
  const outcome = experiment.result?.outcome ?? "no_clear_winner";
  const lift    = experiment.result?.primaryMetricLift ?? 0;

  let suggestedDirection: string;
  let suggestedBriefIntent: string;
  let suggestedDraftType:   string;
  let controlChoice: FollowUpExperimentPlan["controlVariantChoice"];
  let rationale: string;

  switch (outcome) {
    case "challenger_wins":
      suggestedDirection   = "Reinforce the winning challenger pattern — test a bolder variation of the same creative angle with a new hook or offer presentation.";
      suggestedBriefIntent = "preserve_winner_pattern";
      suggestedDraftType   = "copy_variation";
      controlChoice        = "use_challenger";
      rationale            = `Challenger won with ${(lift * 100).toFixed(1)}% lift. Set challenger as new control and push for further gains with a bolder variant.`;
      break;
    case "control_holds":
      suggestedDirection   = "The challenger creative angle did not outperform. Try a substantially different angle — new hook, new offer framing, or a full visual refresh.";
      suggestedBriefIntent = "refresh_angle";
      suggestedDraftType   = "angle_variation";
      controlChoice        = "keep_current_winner";
      rationale            = "Control held. The challenger creative direction needs a more significant departure. Return to brief generation with fresh angle direction.";
      break;
    case "no_clear_winner":
      suggestedDirection   = "No clear signal — try a more differentiated test with a bolder creative difference to generate a clearer signal.";
      suggestedBriefIntent = "refresh_hook";
      suggestedDraftType   = "headline_variation";
      controlChoice        = "keep_current_winner";
      rationale            = "Results were within noise threshold. Next test should have a more distinct creative difference to produce a measurable signal.";
      break;
    case "mixed_result":
      suggestedDirection   = "Investigate attribution quality and audience overlap before planning the next test. If data is clean, try sequencing the test (before/after rather than simultaneous).";
      suggestedBriefIntent = "refresh_visual_direction";
      suggestedDraftType   = "image_brief";
      controlChoice        = "keep_current_winner";
      rationale            = "Mixed signals require data investigation before the next creative iteration.";
      break;
    default:
      suggestedDirection   = "Reset with a clean brief — refresh the creative hook and offer angle.";
      suggestedBriefIntent = "full_reset";
      suggestedDraftType   = "full_refresh_brief";
      controlChoice        = "start_fresh";
      rationale            = "Insufficient or failed test. Start fresh with a new brief and verified tracking setup.";
  }

  return {
    suggestedDirection,
    suggestedBriefIntent,
    suggestedDraftType,
    controlVariantChoice: controlChoice,
    rationale,
  };
}
