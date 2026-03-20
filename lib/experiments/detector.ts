// lib/experiments/detector.ts
// Winner detection and outcome classification.
// All functions are pure — no side effects, no DB access.
//
// Detection order:
//   1. Check for data quality failures (failed_test)
//   2. Check for insufficient data (spend + conversions)
//   3. Apply guardrail checks
//   4. Check if evaluation window is complete
//   5. Evaluate primary metric lift against threshold
//   6. Check for mixed signals across secondary metrics
//   7. Classify outcome and build recommended action

import type {
  ExperimentOutcome,
  ExperimentComparison,
  ExperimentMetricSnapshot,
  ExperimentEvaluationWindow,
  WinnerDetectionResult,
  ExperimentPlan,
} from "../../types/experiment";

// ---------------------------------------------------------------------------
// Detect outcome
// ---------------------------------------------------------------------------

export function detectWinner(
  control:    ExperimentMetricSnapshot,
  challenger: ExperimentMetricSnapshot,
  comparison: ExperimentComparison,
  window:     ExperimentEvaluationWindow,
  plan: Pick<
    ExperimentPlan,
    "primaryMetric" | "secondaryMetrics"
    | "minSpendPerVariant" | "minConversionsPerVariant"
    | "successThreshold"
  >,
): WinnerDetectionResult {
  const reasons: string[] = [];

  // ── 1. Data quality failure ───────────────────────────────────────────────
  if (control.spend === 0 && challenger.spend === 0) {
    return {
      outcome:           "failed_test",
      winningVariant:    null,
      confidence:        0,
      primaryLift:       0,
      outcomeReasons:    ["No delivery data found for either variant. Verify Meta IDs and sync status."],
      recommendedAction: "investigate",
      recommendedNote:   "Check Meta sync logs and verify external ad IDs on the experiment.",
    };
  }

  // ── 2. Insufficient data ──────────────────────────────────────────────────
  const hasEnoughSpend = control.spend >= plan.minSpendPerVariant
    && challenger.spend >= plan.minSpendPerVariant;
  const hasEnoughConversions = control.orders >= plan.minConversionsPerVariant
    && challenger.orders >= plan.minConversionsPerVariant;

  if (!hasEnoughSpend || !hasEnoughConversions) {
    if (!hasEnoughSpend) {
      reasons.push(`Spend thresholds not met (control: $${control.spend.toFixed(0)}, challenger: $${challenger.spend.toFixed(0)}, min: $${plan.minSpendPerVariant})`);
    }
    if (!hasEnoughConversions) {
      reasons.push(`Conversion thresholds not met (control: ${control.orders}, challenger: ${challenger.orders}, min: ${plan.minConversionsPerVariant})`);
    }
    return {
      outcome:           "insufficient_data",
      winningVariant:    null,
      confidence:        0,
      primaryLift:       comparison.primaryDelta.lift,
      outcomeReasons:    reasons,
      recommendedAction: "wait",
      recommendedNote:   window.isComplete
        ? "Window is complete but data volume is too low to conclude. Consider extending the test or increasing budget."
        : `Continue running — ${window.daysRemaining} day${window.daysRemaining !== 1 ? "s" : ""} remaining in the evaluation window.`,
    };
  }

  // ── 3. Guardrail breaches (non-spend/conversion — already handled above) ──
  const nonVolumeBreaches = comparison.guardrailBreaches.filter(
    (b) => !b.includes("spend") && !b.includes("conversion"),
  );
  if (nonVolumeBreaches.length > 0) {
    for (const b of nonVolumeBreaches) reasons.push(b);
  }

  // ── 4. Window completion warning ─────────────────────────────────────────
  if (!window.isComplete) {
    reasons.push(`Evaluation window still running — ${window.daysRemaining} day${window.daysRemaining !== 1 ? "s" : ""} remaining (${window.progressPct}% complete). Results are preliminary.`);
  }

  const lift = comparison.primaryDelta.lift;

  // ── 5. Evaluate primary metric ────────────────────────────────────────────
  if (!comparison.isStatisticallyMeaningful) {
    reasons.push(`Primary metric lift (${(lift * 100).toFixed(1)}%) is within the ±${(plan.successThreshold * 100).toFixed(0)}% threshold — no meaningful difference.`);
    const noWinnerConf = plan.successThreshold > 0
      ? Math.min(0.5, Math.abs(lift) / plan.successThreshold * 0.5)
      : 0;
    return {
      outcome:           "no_clear_winner",
      winningVariant:    null,
      confidence:        noWinnerConf,
      primaryLift:       lift,
      outcomeReasons:    reasons,
      recommendedAction: "monitor",
      recommendedNote:   "Continue running or extend the window. Consider testing a bolder creative variation.",
    };
  }

  // ── 6. Check for mixed signals ────────────────────────────────────────────
  // ROAS pointing one way while CPA or orders point the other way
  const secondaryKeys = Object.keys(comparison.secondaryDeltas);
  const opposingSignals = secondaryKeys.filter((k) => {
    const secLift = comparison.secondaryDeltas[k].lift;
    return Math.abs(secLift) > plan.successThreshold && Math.sign(secLift) !== Math.sign(lift);
  });

  if (opposingSignals.length > 0) {
    reasons.push(`Mixed signals: primary metric favours ${lift > 0 ? "challenger" : "control"}, but ${opposingSignals.join(", ")} point the other way.`);
    return {
      outcome:           "mixed_result",
      winningVariant:    null,
      confidence:        0.3,
      primaryLift:       lift,
      outcomeReasons:    reasons,
      recommendedAction: "investigate",
      recommendedNote:   "Conflicting signals may indicate attribution issues or audience differences. Review raw data before acting.",
    };
  }

  // ── 7. Declare winner ─────────────────────────────────────────────────────
  const challWins = lift > 0;
  const outcome: ExperimentOutcome = challWins ? "challenger_wins" : "control_holds";
  const winner: "control" | "challenger" = challWins ? "challenger" : "control";

  // Confidence: magnitude-based proxy, capped at 0.95
  const rawConf = plan.successThreshold > 0
    ? Math.min(0.95, Math.abs(lift) / (plan.successThreshold * 2))
    : 0;
  const confidence = window.isComplete ? rawConf : rawConf * 0.8;

  reasons.push(
    `${challWins ? "Challenger" : "Control"} has a ${(Math.abs(lift) * 100).toFixed(1)}% ${challWins ? "higher" : "lower"} ${plan.primaryMetric}.`,
  );
  if (!window.isComplete) reasons.push("Window not yet complete — result is preliminary.");

  const recommendedAction = challWins ? "mark_for_scale_review" : "archive_challenger";
  const recommendedNote   = challWins
    ? `Challenger shows ${(lift * 100).toFixed(1)}% uplift on ${plan.primaryMetric}. Mark for scale review and return control to refresh queue.`
    : `Control outperforms challenger by ${(Math.abs(lift) * 100).toFixed(1)}% on ${plan.primaryMetric}. Archive challenger and continue with control creative.`;

  return {
    outcome,
    winningVariant:    winner,
    confidence,
    primaryLift:       lift,
    outcomeReasons:    reasons,
    recommendedAction,
    recommendedNote,
  };
}

// ---------------------------------------------------------------------------
// Build the full experiment outcome object (wraps detectWinner output)
// ---------------------------------------------------------------------------

export function buildExperimentOutcome(
  detection:  WinnerDetectionResult,
  comparison: ExperimentComparison,
): {
  outcome:          ExperimentOutcome;
  winningVariant:   "control" | "challenger" | null;
  confidence:       number;
  primaryMetricDelta: number;
  primaryMetricLift:  number;
  guardrailBreaches:  string[];
  outcomeReasons:     string[];
  recommendedAction:  string;
  recommendedNote:    string;
} {
  return {
    outcome:            detection.outcome,
    winningVariant:     detection.winningVariant,
    confidence:         detection.confidence,
    primaryMetricDelta: comparison.primaryDelta.delta,
    primaryMetricLift:  comparison.primaryDelta.lift,
    guardrailBreaches:  comparison.guardrailBreaches,
    outcomeReasons:     detection.outcomeReasons,
    recommendedAction:  detection.recommendedAction,
    recommendedNote:    detection.recommendedNote,
  };
}
