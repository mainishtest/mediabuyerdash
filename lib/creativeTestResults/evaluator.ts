// lib/creativeTestResults/evaluator.ts
// Wraps existing experiment comparator/detector with creative-test context.
// All functions are pure — no DB access.
//
// Design rule: Do not re-implement comparison or winner detection math.
// Delegate to lib/experiments/comparator and lib/experiments/detector.

import { compareExperimentVariants } from "../experiments/comparator";
import { detectWinner }               from "../experiments/detector";
import { buildEvaluationWindow }      from "../experiments/builder";
import type { ExperimentMetricSnapshot } from "../../types/experiment";
import type {
  CreativeTestOutcome,
  CreativeTestComparison,
  CreativeTestEvaluationWindow,
  CreativeTestConfidence,
  CreativeTestConfidenceLevel,
  CreativeTestOutcomeReason,
  CreativeTestMetricSnapshot,
} from "../../types/creativeTestResults";

// ---------------------------------------------------------------------------
// Adapt ExperimentMetricSnapshot to CreativeTestMetricSnapshot
// ---------------------------------------------------------------------------

export function adaptSnapshot(
  snap:         ExperimentMetricSnapshot,
  creativeName: string | null,
  creativeId:   string | null,
  adExternalId: string | null,
): CreativeTestMetricSnapshot {
  return {
    role:         snap.variantType,
    label:        snap.variantLabel,
    creativeName,
    creativeId,
    adExternalId,
    windowStart:  snap.windowStart,
    windowEnd:    snap.windowEnd,
    spend:        snap.spend,
    impressions:  snap.impressions,
    clicks:       snap.clicks,
    ctr:          snap.ctr,
    cpm:          snap.cpm,
    orders:       snap.orders,
    revenue:      snap.revenue,
    roas:         snap.roas,
    cpa:          snap.cpa,
    dataSource:   snap.dataSource,
    isComplete:   snap.isComplete,
    missingFields: snap.missingFields,
  };
}

// ---------------------------------------------------------------------------
// Build evaluation window from test result fields
// ---------------------------------------------------------------------------

export function buildTestEvaluationWindow(
  startedAt:           string,
  windowDays:          number,
  evaluationEndsAt?:   string | null,
): CreativeTestEvaluationWindow {
  const w = buildEvaluationWindow(startedAt, windowDays, evaluationEndsAt ?? null);
  return {
    windowDays:    w.windowDays,
    startedAt:     w.startedAt,
    endsAt:        w.endsAt,
    isComplete:    w.isComplete,
    daysRemaining: w.daysRemaining,
    progressPct:   w.progressPct,
  };
}

// ---------------------------------------------------------------------------
// Compare test variants using the existing comparator
// ---------------------------------------------------------------------------

export function compareCreativeTestVariants(
  controlSnap:    ExperimentMetricSnapshot,
  challengerSnap: ExperimentMetricSnapshot,
  criteria: {
    primaryMetric:            string;
    secondaryMetrics:         string[];
    successThreshold:         number;
    minSpendPerVariant:       number;
    minConversionsPerVariant: number;
  },
): CreativeTestComparison {
  const cmp = compareExperimentVariants(controlSnap, challengerSnap, {
    primaryMetric:            criteria.primaryMetric,
    secondaryMetrics:         criteria.secondaryMetrics,
    successThreshold:         criteria.successThreshold,
    minSpendPerVariant:       criteria.minSpendPerVariant,
    minConversionsPerVariant: criteria.minConversionsPerVariant,
  });

  const secondaryDeltas: Record<string, { delta: number; lift: number }> = {};
  for (const [k, v] of Object.entries(cmp.secondaryDeltas)) {
    secondaryDeltas[k] = { delta: v.delta, lift: v.lift };
  }

  return {
    primaryMetric:             cmp.primaryMetric,
    primaryDelta:              cmp.primaryDelta.delta,
    primaryLift:               cmp.primaryDelta.lift,
    secondaryDeltas,
    guardrailBreaches:         cmp.guardrailBreaches,
    isStatisticallyMeaningful: cmp.isStatisticallyMeaningful,
    confidenceNote:            cmp.confidenceNote,
  };
}

// ---------------------------------------------------------------------------
// Evaluate test outcome using the existing detector
// ---------------------------------------------------------------------------

export function evaluateCreativeTestOutcome(
  controlSnap:    ExperimentMetricSnapshot,
  challengerSnap: ExperimentMetricSnapshot,
  comparison:     CreativeTestComparison,
  evalWindow:     CreativeTestEvaluationWindow,
  criteria: {
    primaryMetric:            string;
    secondaryMetrics:         string[];
    successThreshold:         number;
    minSpendPerVariant:       number;
    minConversionsPerVariant: number;
  },
): {
  outcome:          CreativeTestOutcome;
  winningVariant:   "control" | "challenger" | null;
  outcomeReasons:   CreativeTestOutcomeReason[];
  recommendedNextStep: string;
  rawConfidence:    number;
  primaryLift:      number;
} {
  // Adapt comparison to ExperimentComparison shape for detectWinner
  const experimentComparison = {
    primaryMetric:             comparison.primaryMetric,
    primaryDelta:              { delta: comparison.primaryDelta, lift: comparison.primaryLift },
    secondaryDeltas:           Object.fromEntries(
      Object.entries(comparison.secondaryDeltas).map(([k, v]) => [k, { delta: v.delta, lift: v.lift }]),
    ),
    guardrailBreaches:         comparison.guardrailBreaches,
    isStatisticallyMeaningful: comparison.isStatisticallyMeaningful,
    confidenceNote:            comparison.confidenceNote,
  };

  const experimentWindow = {
    windowDays:    evalWindow.windowDays,
    startedAt:     evalWindow.startedAt,
    endsAt:        evalWindow.endsAt,
    isComplete:    evalWindow.isComplete,
    daysRemaining: evalWindow.daysRemaining,
    progressPct:   evalWindow.progressPct,
  };

  const detection = detectWinner(
    controlSnap,
    challengerSnap,
    experimentComparison,
    experimentWindow,
    {
      primaryMetric:            criteria.primaryMetric,
      secondaryMetrics:         criteria.secondaryMetrics,
      minSpendPerVariant:       criteria.minSpendPerVariant,
      minConversionsPerVariant: criteria.minConversionsPerVariant,
      successThreshold:         criteria.successThreshold,
    },
  );

  // Map ExperimentOutcome to CreativeTestOutcome (add in_progress if window open)
  let outcome: CreativeTestOutcome;
  if (detection.outcome === "insufficient_data" && !evalWindow.isComplete) {
    outcome = "in_progress";
  } else {
    outcome = detection.outcome as CreativeTestOutcome;
  }

  const outcomeReasons: CreativeTestOutcomeReason[] = detection.outcomeReasons.map((r, i) => ({
    key:         `reason_${i}`,
    label:       `Reason ${i + 1}`,
    description: r,
  }));

  return {
    outcome,
    winningVariant:      detection.winningVariant,
    outcomeReasons,
    recommendedNextStep: detection.recommendedNote,
    rawConfidence:       detection.confidence,
    primaryLift:         detection.primaryLift,
  };
}

// ---------------------------------------------------------------------------
// Compute structured confidence output
// ---------------------------------------------------------------------------

export function computeCreativeTestConfidence(
  rawScore:         number,
  isWindowComplete: boolean,
  outcome:          CreativeTestOutcome,
): CreativeTestConfidence {
  // Confidence doesn't apply to non-evaluatable states
  if (outcome === "in_progress" || outcome === "failed_test" || outcome === "archived") {
    return {
      score:            0,
      level:            "low",
      label:            "Not yet evaluated",
      rationale:        outcome === "failed_test"
        ? "No delivery data — cannot compute confidence."
        : outcome === "in_progress"
          ? "Test is still running — confidence will be computed when the window closes."
          : "Test archived without evaluation.",
      isWindowComplete,
    };
  }

  const score = Math.max(0, Math.min(1, rawScore));

  let level: CreativeTestConfidenceLevel;
  if (score >= 0.8)      level = "very_high";
  else if (score >= 0.6) level = "high";
  else if (score >= 0.35) level = "medium";
  else                   level = "low";

  const levelLabels: Record<CreativeTestConfidenceLevel, string> = {
    very_high: "Very High",
    high:      "High",
    medium:    "Medium",
    low:       "Low",
  };

  let rationale: string;
  if (!isWindowComplete) {
    rationale = `Window not yet complete — preliminary result. Confidence may improve as data accumulates.`;
  } else if (score >= 0.8) {
    rationale = "Strong lift with full window data — high confidence in this result.";
  } else if (score >= 0.6) {
    rationale = "Meaningful lift with sufficient data — good confidence in direction.";
  } else if (score >= 0.35) {
    rationale = "Moderate lift — result is directionally clear but not definitive.";
  } else {
    rationale = "Weak lift signal — interpret this result with caution.";
  }

  return {
    score,
    level,
    label:           levelLabels[level],
    rationale,
    isWindowComplete,
  };
}

// ---------------------------------------------------------------------------
// Derive tracking state from test data
// ---------------------------------------------------------------------------

export function deriveTrackingState(opts: {
  experimentId:    string | null;
  launchPlanId:    string | null;
  windowEndsAt:    Date | string | null;
  outcome:         CreativeTestOutcome | null;
  controlAdExternalId:    string | null;
  challengerAdExternalId: string | null;
}): import("../../types/creativeTestResults").CreativeTestTrackingState {
  if (!opts.experimentId && !opts.launchPlanId) return "pending_launch";

  if (!opts.controlAdExternalId || !opts.challengerAdExternalId) return "blocked";

  if (opts.outcome === "archived") return "completed";

  if (
    opts.outcome &&
    opts.outcome !== "in_progress" &&
    opts.outcome !== "insufficient_data"
  ) {
    return "completed";
  }

  if (opts.windowEndsAt) {
    const end = new Date(opts.windowEndsAt);
    const now = new Date();
    if (now >= end) return "evaluating";
  }

  return "active";
}
