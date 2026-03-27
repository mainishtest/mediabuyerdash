// lib/experiments/learnings.ts
// Captures and summarises experiment learnings for reuse across Creative Lab,
// brief generation, and future experiment planning.
//
// Design rules:
//   - Learnings are tagged with briefIntent + draftType for cross-workflow reuse.
//   - insightText is always human-readable (1–2 sentences).
//   - detailJson stores raw deltas for programmatic consumption by scoring/briefs.
//   - No mutations to other models — learnings are independent records.

import type {
  ExperimentPlan,
  ExperimentMetricSnapshot,
  ExperimentComparison,
  WinnerDetectionResult,
  ExperimentLearning,
  ExperimentOutcome,
} from "../../types/experiment";
import { OUTCOME_LABEL } from "../../types/experiment";

// ---------------------------------------------------------------------------
// Build the learning insight text from detection output
// ---------------------------------------------------------------------------

function buildInsightText(
  plan:      Pick<ExperimentPlan, "primaryMetric" | "successThreshold">,
  detection: WinnerDetectionResult,
  control:   ExperimentMetricSnapshot,
  challenger: ExperimentMetricSnapshot,
): string {
  const lift = (detection.primaryLift * 100).toFixed(1);
  const metric = plan.primaryMetric.replace(/_/g, " ").toUpperCase();

  switch (detection.outcome) {
    case "challenger_wins":
      return `Challenger creative delivered a ${lift}% lift on ${metric} (control: ${control.roas.toFixed(2)}x, challenger: ${challenger.roas.toFixed(2)}x ROAS). Pattern shows strong performance with current audience — candidate for scale review.`;
    case "control_holds":
      return `Control creative held the advantage with a ${Math.abs(detection.primaryLift * 100).toFixed(1)}% difference on ${metric} against challenger (control: ${control.roas.toFixed(2)}x vs ${challenger.roas.toFixed(2)}x ROAS). Challenger did not outperform — consider refreshing the creative angle or offer.`;
    case "no_clear_winner":
      return `No meaningful difference detected between control and challenger on ${metric} (lift: ${lift}%). Both variants performed similarly within the ${(plan.successThreshold * 100).toFixed(0)}% threshold.`;
    case "mixed_result":
      return `Mixed signals observed: primary metric (${metric}) favoured ${detection.primaryLift > 0 ? "challenger" : "control"}, but secondary metrics pointed the other direction. Investigate attribution quality before drawing conclusions.`;
    case "insufficient_data":
      return `Experiment ended with insufficient data volume to conclude — spend or conversion thresholds were not met. Revisit test design or budget allocation.`;
    case "failed_test":
      return `Test failed due to missing delivery data. Verify Meta external IDs and sync status before relaunching.`;
    default:
      return "Experiment was archived without a conclusion.";
  }
}

// ---------------------------------------------------------------------------
// Infer winning pattern label from detection output
// ---------------------------------------------------------------------------

function inferWinningPattern(
  detection:  WinnerDetectionResult,
  control:    ExperimentMetricSnapshot,
  challenger: ExperimentMetricSnapshot,
): string | null {
  if (detection.outcome !== "challenger_wins" && detection.outcome !== "control_holds") return null;
  const winner = detection.winningVariant === "challenger" ? challenger : control;
  if (winner.roas > 2.5) return "high_roas_angle";
  if (winner.ctr > 0.03) return "high_ctr_hook";
  if (winner.cpa < 20)   return "low_cpa_conversion";
  return "consistent_performance";
}

// ---------------------------------------------------------------------------
// Public API: summarizeExperimentLearnings
// Builds learning record(s) from a completed experiment.
// Returns in-memory learning objects — caller persists via db.ts.
// ---------------------------------------------------------------------------

export function summarizeExperimentLearnings(opts: {
  experimentId:    string;
  plan:            ExperimentPlan;
  detection:       WinnerDetectionResult;
  control:         ExperimentMetricSnapshot;
  challenger:      ExperimentMetricSnapshot;
  comparison:      ExperimentComparison;
  briefIntent?:    string | null;
  draftType?:      string | null;
}): Omit<ExperimentLearning, "id" | "createdAt">[] {
  const { experimentId, plan, detection, control, challenger, comparison, briefIntent, draftType } = opts;

  const insightText    = buildInsightText(plan, detection, control, challenger);
  const winningPattern = inferWinningPattern(detection, control, challenger);
  const outcomeLabel   = OUTCOME_LABEL[detection.outcome];

  // Primary learning — always one
  const primary: Omit<ExperimentLearning, "id" | "createdAt"> = {
    experimentId,
    clientAccountId:  plan.clientAccountId,
    briefIntent:      briefIntent ?? null,
    draftType:        draftType   ?? null,
    winningPattern,
    outcomeLabel,
    insightText,
    detail: {
      primaryMetric:         plan.primaryMetric,
      primaryLift:           detection.primaryLift,
      confidence:            detection.confidence,
      controlRoas:           control.roas,
      challengerRoas:        challenger.roas,
      controlSpend:          control.spend,
      challengerSpend:       challenger.spend,
      controlOrders:         control.orders,
      challengerOrders:      challenger.orders,
      guardrailBreaches:     comparison.guardrailBreaches,
      secondaryDeltas:       comparison.secondaryDeltas,
      recommendedAction:     detection.recommendedAction,
    },
    usableForBriefs:  ["challenger_wins", "control_holds", "no_clear_winner"].includes(detection.outcome),
    usableForScoring: ["challenger_wins", "control_holds"].includes(detection.outcome),
  };

  return [primary];
}

// ---------------------------------------------------------------------------
// attachOutcomeToCreativeHistory
// Returns a summary object that can be referenced by CreativeLab brief
// generation to inform the next iteration's direction.
// No DB write here — this is a pure assembly function.
// ---------------------------------------------------------------------------

export function attachOutcomeToCreativeHistory(opts: {
  outcome:      ExperimentOutcome;
  primaryLift:  number;
  winningVariant: "control" | "challenger" | null;
  briefIntent:  string | null;
  draftType:    string | null;
  clientAccountId: string;
}): Record<string, unknown> {
  return {
    type:            "experiment_outcome",
    outcome:         opts.outcome,
    primaryLift:     opts.primaryLift,
    winningVariant:  opts.winningVariant,
    briefIntent:     opts.briefIntent,
    draftType:       opts.draftType,
    clientAccountId: opts.clientAccountId,
    // Signals for brief generation:
    suggestNewAngle:     opts.outcome === "control_holds" || opts.outcome === "no_clear_winner",
    reinforcePattern:    opts.outcome === "challenger_wins",
    investigateData:     opts.outcome === "mixed_result" || opts.outcome === "failed_test",
    insufficientBudget:  opts.outcome === "insufficient_data",
  };
}
