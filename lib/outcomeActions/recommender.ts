// lib/outcomeActions/recommender.ts
// Core recommendation engine for post-experiment outcome actions.
// All functions are pure — deterministic from experiment result input.
//
// Architecture rules:
//   - No DB access. No API calls. Input is ExperimentWithResult, output is recommendations.
//   - Recommendations are proposals only. Approval routes through lib/automation/persist.ts.
//   - Readiness and blockers computed separately from action type to keep logic composable.

import type {
  OutcomeActionRecommendation,
  OutcomeActionType,
  OutcomeActionPriority,
  ActionReadinessState,
  OutcomeActionReason,
  OutcomeActionSummary,
}                          from "../../types/outcomeActions";
import type {
  ExperimentWithResult,
  ExperimentMetricSnapshot,
  ExperimentOutcome,
}                          from "../../types/experiment";
import {
  buildScalePlan,
  buildLoserHandlingPlan,
  buildFollowUpExperimentPlan,
}                          from "./plans";

// ---------------------------------------------------------------------------
// Priority computation
// ---------------------------------------------------------------------------

export function computeOutcomeActionPriority(
  actionType:  OutcomeActionType,
  outcome:     ExperimentOutcome,
  confidence:  number,
  loserRoas?:  number,
): OutcomeActionPriority {
  switch (actionType) {
    case "scale_winner_budget":
      if (confidence >= 0.75) return "urgent";
      if (confidence >= 0.5)  return "high";
      return "medium";

    case "pause_loser_candidate":
      if (loserRoas !== undefined && loserRoas < 0.5) return "urgent";
      if (loserRoas !== undefined && loserRoas < 1.0) return "high";
      return "medium";

    case "reduce_loser_budget":
      return "high";

    case "send_loser_to_creative_lab":
      return outcome === "failed_test" ? "high" : "medium";

    case "duplicate_winner_to_new_test":
    case "launch_follow_up_experiment":
      return "medium";

    case "keep_winner_running":
      return "low";

    case "monitor_only":
      return outcome === "mixed_result" ? "medium" : "low";

    default:
      return "low";
  }
}

// ---------------------------------------------------------------------------
// Readiness and blocker computation
// ---------------------------------------------------------------------------

export function computeActionReadiness(
  actionType:   OutcomeActionType,
  experiment:   ExperimentWithResult,
  confidence:   number,
): { readiness: ActionReadinessState; blockers: string[] } {
  const blockers: string[] = [];
  const outcome = experiment.result?.outcome;
  const windowComplete = experiment.evaluationWindow.isComplete;

  // Global blockers
  if (!outcome || outcome === "archived") {
    blockers.push("No experiment outcome available — run evaluation first.");
  }
  if (confidence < 0.15 && actionType !== "monitor_only" && actionType !== "send_loser_to_creative_lab") {
    blockers.push(`Confidence (${Math.round(confidence * 100)}%) is too low to act — wait for more data or extend the evaluation window.`);
  }

  // Action-specific checks
  if (actionType === "scale_winner_budget") {
    if (!experiment.challengerAdExternalId && !experiment.controlAdExternalId) {
      blockers.push("No Meta external ID on winning variant — cannot propose budget change without entity reference.");
    }
    if (!windowComplete) {
      blockers.push("Evaluation window is not yet complete — scaling before window closes increases risk.");
    }
  }

  if (actionType === "pause_loser_candidate" || actionType === "reduce_loser_budget") {
    if (!experiment.challengerAdExternalId && !experiment.controlAdExternalId) {
      blockers.push("No Meta external ID on losing variant — cannot propose pause without entity reference.");
    }
  }

  if (actionType === "launch_follow_up_experiment") {
    if (!experiment.clientAccountId) {
      blockers.push("No client account ID — cannot plan follow-up experiment without client context.");
    }
  }

  // Derive readiness
  let readiness: ActionReadinessState;

  if (blockers.length > 0) {
    if (!outcome || confidence < 0.15) {
      readiness = "not_ready";
    } else {
      readiness = "approval_blocked";
    }
  } else if (!windowComplete && actionType !== "monitor_only" && actionType !== "send_loser_to_creative_lab") {
    readiness = "review_required";
  } else if (confidence >= 0.4 || actionType === "monitor_only" || actionType === "send_loser_to_creative_lab" || actionType === "launch_follow_up_experiment") {
    readiness = "ready_for_approval";
  } else {
    readiness = "review_required";
  }

  return { readiness, blockers };
}

// ---------------------------------------------------------------------------
// Reason tagging
// ---------------------------------------------------------------------------

function buildReasons(
  actionType:  OutcomeActionType,
  outcome:     ExperimentOutcome,
  confidence:  number,
  winner?:     ExperimentMetricSnapshot,
  loser?:      ExperimentMetricSnapshot,
  windowComplete?: boolean,
): OutcomeActionReason[] {
  const reasons: OutcomeActionReason[] = [];

  if (confidence >= 0.65) reasons.push("high_confidence_winner");
  else if (confidence > 0) reasons.push("low_confidence_result");

  if (windowComplete) reasons.push("evaluation_window_complete");
  else reasons.push("evaluation_window_incomplete");

  if (outcome === "challenger_wins" && winner) reasons.push("challenger_showed_lift");
  if (outcome === "control_holds")             reasons.push("control_maintained_advantage");
  if (outcome === "failed_test")               reasons.push("test_failed_no_data");

  if (winner && winner.roas > 2.0)  reasons.push("strong_roas_signal");
  if (winner && winner.roas < 1.5)  reasons.push("weak_roas_signal");
  if (loser  && loser.roas < 1.0)   reasons.push("poor_roas_economics");
  if (loser  && loser.spend > 50)   reasons.push("loser_has_material_spend");

  if (winner && winner.orders < 5)  reasons.push("insufficient_conversions");
  if (winner && winner.spend < 50)  reasons.push("insufficient_spend");

  return [...new Set(reasons)];
}

// ---------------------------------------------------------------------------
// Build recommendations for a single experiment result
// ---------------------------------------------------------------------------

export function buildOutcomeActionRecommendations(
  experiment: ExperimentWithResult,
): OutcomeActionRecommendation[] {
  const result     = experiment.result;
  const outcome    = result?.outcome;
  const confidence = result?.confidence ?? 0;
  const windowComplete = experiment.evaluationWindow.isComplete;

  const ctlSnap = result?.controlSnapshot    ?? null;
  const chlSnap = result?.challengerSnapshot ?? null;

  const winnerSnap: ExperimentMetricSnapshot | null =
    result?.winningVariant === "challenger" ? chlSnap
    : result?.winningVariant === "control" ? ctlSnap
    : null;

  const loserSnap: ExperimentMetricSnapshot | null =
    result?.winningVariant === "challenger" ? ctlSnap
    : result?.winningVariant === "control"  ? chlSnap
    : null;

  const now = new Date().toISOString();

  // Helper to build one recommendation
  function rec(
    actionType: OutcomeActionType,
    title:      string,
    rationale:  string,
    extras: Partial<Pick<OutcomeActionRecommendation,
      "scalePlan" | "loserHandlingPlan" | "followUpPlan"
      | "relatedEntityType" | "relatedEntityId" | "relatedEntityName"
      | "automationActionType"
    >> = {},
  ): OutcomeActionRecommendation {
    const priority = computeOutcomeActionPriority(actionType, outcome ?? "insufficient_data", confidence, loserSnap?.roas);
    const { readiness, blockers } = computeActionReadiness(actionType, experiment, confidence);
    const reasons  = buildReasons(actionType, outcome ?? "insufficient_data", confidence, winnerSnap ?? undefined, loserSnap ?? undefined, windowComplete);

    return {
      id:           `${experiment.id}_${actionType}`,
      experimentId: experiment.id,
      actionType,
      priority,
      readiness,
      title,
      rationale,
      reasons,
      blockers,
      scalePlan:         extras.scalePlan         ?? null,
      loserHandlingPlan: extras.loserHandlingPlan ?? null,
      followUpPlan:      extras.followUpPlan      ?? null,
      relatedEntityType: extras.relatedEntityType ?? null,
      relatedEntityId:   extras.relatedEntityId   ?? null,
      relatedEntityName: extras.relatedEntityName ?? null,
      automationActionType: extras.automationActionType ?? null,
      generatedAt: now,
    };
  }

  // Brief lab link for loser
  const loserBriefLink = experiment.challengerPrepItemId
    ? `/creative-lab/publish-prep`
    : `/creative-lab/review`;

  // ── No result yet ────────────────────────────────────────────────────────
  if (!outcome || !result) {
    return [
      rec("monitor_only",
        "Evaluate Experiment First",
        "No evaluation has been run yet. Trigger evaluation to generate outcome-based recommendations.",
      ),
    ];
  }

  // ── challenger_wins ──────────────────────────────────────────────────────
  if (outcome === "challenger_wins" && chlSnap) {
    const recs: OutcomeActionRecommendation[] = [];

    // Primary: scale or keep
    if (confidence >= 0.5) {
      recs.push(rec(
        "scale_winner_budget",
        `Scale Challenger Budget (+${((buildScalePlan(chlSnap, experiment).suggestedBudgetMultiplier - 1) * 100).toFixed(0)}%)`,
        `Challenger outperformed control with ${(confidence * 100).toFixed(0)}% confidence. Scale budget to capture incremental return.`,
        {
          scalePlan:           buildScalePlan(chlSnap, experiment),
          relatedEntityType:   "publish_prep",
          relatedEntityId:     experiment.challengerPrepItemId,
          relatedEntityName:   experiment.challengerLabel,
          automationActionType: "increase_budget",
        },
      ));
    } else {
      recs.push(rec(
        "keep_winner_running",
        "Keep Challenger Running — Monitor",
        `Challenger won but confidence is low (${(confidence * 100).toFixed(0)}%). Keep running and re-evaluate when more data is available.`,
        { relatedEntityType: "publish_prep", relatedEntityId: experiment.challengerPrepItemId },
      ));
    }

    // Loser handling
    if (ctlSnap) {
      recs.push(rec(
        ctlSnap.roas < 1.0 && ctlSnap.spend >= experiment.minSpendPerVariant
          ? "pause_loser_candidate"
          : "reduce_loser_budget",
        ctlSnap.roas < 1.0 ? "Review Control for Pause" : "Reduce Control Budget",
        `Control underperformed (ROAS: ${ctlSnap.roas.toFixed(2)}x). Review for budget reduction or pause.`,
        {
          loserHandlingPlan: buildLoserHandlingPlan(ctlSnap, experiment, loserBriefLink),
          automationActionType: ctlSnap.roas < 1.0 ? "pause_campaign" : "reduce_budget",
        },
      ));
    }

    // Follow-up
    recs.push(rec(
      "duplicate_winner_to_new_test",
      "Duplicate Winner to New Test",
      "Lock in the winner as the new control and launch a follow-up test with a bolder creative variation.",
      { followUpPlan: buildFollowUpExperimentPlan(experiment, chlSnap) },
    ));

    return recs;
  }

  // ── control_holds ────────────────────────────────────────────────────────
  if (outcome === "control_holds" && ctlSnap) {
    return [
      rec(
        "keep_winner_running",
        "Keep Control Running",
        `Control outperformed challenger. Continue with current control creative and prepare a new challenger.`,
        { relatedEntityType: "publish_prep", relatedEntityId: experiment.challengerPrepItemId },
      ),
      rec(
        "send_loser_to_creative_lab",
        "Send Challenger Back to Creative Lab",
        `Challenger did not beat control (ROAS: ${chlSnap?.roas.toFixed(2) ?? "?"}x vs ${ctlSnap.roas.toFixed(2)}x). Return for creative refresh.`,
        {
          loserHandlingPlan:   chlSnap ? buildLoserHandlingPlan(chlSnap, experiment, loserBriefLink) : null,
          relatedEntityType:   "brief",
          relatedEntityName:   "Creative Lab",
          automationActionType: "refresh_creative",
        },
      ),
      rec(
        "launch_follow_up_experiment",
        "Plan Follow-up Experiment",
        "Challenger angle did not win. Plan a more differentiated follow-up with a fresh creative direction.",
        { followUpPlan: buildFollowUpExperimentPlan(experiment, ctlSnap) },
      ),
    ];
  }

  // ── no_clear_winner ──────────────────────────────────────────────────────
  if (outcome === "no_clear_winner") {
    return [
      rec(
        "monitor_only",
        "Continue Monitoring — No Signal Yet",
        "Both variants performed similarly within the threshold. Extend the window or increase budget to generate a clearer signal.",
      ),
      rec(
        "launch_follow_up_experiment",
        "Plan Bolder Follow-up Test",
        "No clear winner. Design a more differentiated test to produce a measurable signal.",
        { followUpPlan: buildFollowUpExperimentPlan(experiment, null) },
      ),
    ];
  }

  // ── mixed_result ─────────────────────────────────────────────────────────
  if (outcome === "mixed_result") {
    return [
      rec(
        "monitor_only",
        "Investigate Mixed Signals Before Acting",
        "Primary and secondary metrics disagree. Review attribution quality and audience overlap before planning the next action.",
      ),
      rec(
        "launch_follow_up_experiment",
        "Plan Sequential Follow-up Test",
        "Consider a sequential (before/after) test design to reduce simultaneous delivery bias.",
        { followUpPlan: buildFollowUpExperimentPlan(experiment, null) },
      ),
    ];
  }

  // ── insufficient_data ────────────────────────────────────────────────────
  if (outcome === "insufficient_data") {
    const recs: OutcomeActionRecommendation[] = [
      rec(
        "monitor_only",
        "Wait for Sufficient Data",
        `Spend or conversion thresholds not met. ${windowComplete ? "Window is complete but volume too low — consider increasing budget." : `${experiment.evaluationWindow.daysRemaining} day${experiment.evaluationWindow.daysRemaining !== 1 ? "s" : ""} remaining in the evaluation window.`}`,
      ),
    ];

    // If loser has material spend and poor economics, still recommend handling
    const poorLoser = loserSnap && loserSnap.spend >= experiment.minSpendPerVariant && loserSnap.roas < 1.0;
    if (poorLoser && loserSnap) {
      recs.push(rec(
        "reduce_loser_budget",
        "Reduce Underperforming Variant Budget",
        `Despite insufficient test data, one variant has $${loserSnap.spend.toFixed(0)} spend with ${loserSnap.roas.toFixed(2)}x ROAS — below break-even.`,
        {
          loserHandlingPlan:    buildLoserHandlingPlan(loserSnap, experiment, loserBriefLink),
          automationActionType: "reduce_budget",
        },
      ));
    }

    return recs;
  }

  // ── failed_test ──────────────────────────────────────────────────────────
  if (outcome === "failed_test") {
    return [
      rec(
        "send_loser_to_creative_lab",
        "Return to Creative Lab — Fix Tracking",
        "Test failed due to missing delivery data. Fix Meta IDs, verify sync, and refresh the creative brief before relaunching.",
        {
          loserHandlingPlan: chlSnap ? buildLoserHandlingPlan(chlSnap, experiment, loserBriefLink) : null,
          relatedEntityType: "brief",
          automationActionType: "refresh_creative",
        },
      ),
      rec(
        "monitor_only",
        "Check Sync Status",
        "Verify Meta sync logs and external ad IDs before re-running the experiment.",
      ),
    ];
  }

  // ── archived / fallback ──────────────────────────────────────────────────
  return [
    rec(
      "monitor_only",
      "Experiment Archived",
      "This experiment has been archived. No active actions are recommended.",
    ),
  ];
}

// ---------------------------------------------------------------------------
// Summarize recommendations for the dashboard list view
// ---------------------------------------------------------------------------

export function summarizeOutcomeActions(
  experimentId:   string,
  experimentName: string,
  outcome:        string,
  recs:           OutcomeActionRecommendation[],
): OutcomeActionSummary {
  const urgentCount       = recs.filter((r) => r.priority === "urgent").length;
  const highCount         = recs.filter((r) => r.priority === "high").length;
  const readyForApproval  = recs.filter((r) => r.readiness === "ready_for_approval").length;
  const blockedCount      = recs.filter((r) => r.readiness === "approval_blocked").length;

  const top = recs.sort((a, b) => {
    const pOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    return pOrder[a.priority] - pOrder[b.priority];
  })[0] ?? null;

  return {
    experimentId,
    experimentName,
    outcome,
    totalActions:    recs.length,
    urgentCount,
    highCount,
    readyForApproval,
    blockedCount,
    topActionType:   top?.actionType   ?? null,
    topPriority:     top?.priority     ?? null,
  };
}
