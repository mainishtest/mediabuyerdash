// lib/imageVariation/results.ts
// Results ingestion and outcome evaluation for image variation experiments.
//
// Architecture:
//   - Reuses existing experiment evaluation pipeline (ingestor, comparator, detector)
//   - Adapts CreativeExperimentLaunchPlan → ExperimentPlan shape for evaluation
//   - Wraps results with image-variation-specific context and lifecycle linkage
//   - No new Prisma models — results computed from synced data at query time

import type { CreativeExperimentLaunchPlan } from "../../types/experimentLaunch";
import type { ExperimentPlan, ExperimentMetricSnapshot } from "../../types/experiment";
import { ingestExperimentResults } from "../experiments/ingestor";
import { compareExperimentVariants } from "../experiments/comparator";
import { detectWinner } from "../experiments/detector";
import { buildEvaluationWindow } from "../experiments/builder";
import type {
  ImageVariationTestResult,
  ImageVariationTestOutcome,
  ImageVariationTrackingState,
  ImageVariationOutcomeConfidence,
  ImageVariationMetricSnapshot,
  ImageVariationTestComparison,
  ImageVariationEvaluationWindow,
  ImageVariationResultSummary,
  ImageVariationLifecycleResultLink,
} from "./resultsTypes";

// ---------------------------------------------------------------------------
// Public: ingestImageVariationResults
// Loads performance data and evaluates outcome for a launched plan.
// ---------------------------------------------------------------------------

export async function ingestImageVariationResults(
  plan: CreativeExperimentLaunchPlan,
): Promise<ImageVariationTestResult> {
  const now = new Date().toISOString();

  // Check if plan has enough data to evaluate
  if (!plan.linkedExperimentId && plan.readiness.state !== "launched") {
    return buildPendingResult(plan, now);
  }

  // Adapt launch plan to ExperimentPlan shape for existing evaluation functions
  const experimentPlan = adaptToExperimentPlan(plan);

  // If no start date available, return pending
  if (!experimentPlan.startedAt) {
    return buildPendingResult(plan, now);
  }

  // Build evaluation window
  const evalWindow = buildEvaluationWindow(
    experimentPlan.startedAt,
    experimentPlan.evaluationWindowDays,
    experimentPlan.evaluationEndsAt,
  );

  // Ingest performance data
  let controlSnapshot: ExperimentMetricSnapshot;
  let challengerSnapshot: ExperimentMetricSnapshot;

  try {
    const ingested = await ingestExperimentResults(experimentPlan);
    controlSnapshot = ingested.controlSnapshot;
    challengerSnapshot = ingested.challengerSnapshot;
  } catch {
    return buildErrorResult(plan, "Failed to ingest performance data.", now);
  }

  // Compare variants
  const comparison = compareExperimentVariants(
    controlSnapshot,
    challengerSnapshot,
    experimentPlan,
  );

  // Detect winner
  const detection = detectWinner(
    controlSnapshot,
    challengerSnapshot,
    comparison,
    evalWindow,
    experimentPlan,
  );

  // Map to image variation types
  const outcome = mapOutcome(detection.outcome, evalWindow);
  const trackingState = computeTrackingState(plan, evalWindow, outcome);
  const confidence = computeConfidence(detection.confidence, detection.outcomeReasons, evalWindow);

  return {
    planId:            plan.id,
    planName:          plan.name,
    outcome,
    trackingState,
    confidence,
    controlSnapshot:   mapSnapshot(controlSnapshot),
    challengerSnapshot: mapSnapshot(challengerSnapshot),
    comparison:        mapComparison(comparison),
    evaluationWindow:  mapWindow(evalWindow),
    outcomeReasons:    detection.outcomeReasons,
    recommendedAction: detection.recommendedAction,
    recommendedNote:   detection.recommendedNote,
    sourceRequestId:   null,
    sourceCandidateId: plan.variantId,
    sourceCreativeId:  plan.control.creativeId,
    clientAccountId:   plan.clientAccountId,
    campaignId:        plan.mapping.campaignId,
    variationIntent:   plan.challenger.briefIntent,
    evaluatedAt:       now,
  };
}

// ---------------------------------------------------------------------------
// Public: summarizeImageVariationResults
// Aggregate stats across evaluated results.
// ---------------------------------------------------------------------------

export function summarizeImageVariationResults(
  results: ImageVariationTestResult[],
): ImageVariationResultSummary {
  const total = results.length;
  const confidences = results.filter((r) => r.confidence.value > 0).map((r) => r.confidence.value);
  const avgConf = confidences.length > 0
    ? Math.round((confidences.reduce((s, c) => s + c, 0) / confidences.length) * 100) / 100
    : 0;

  return {
    totalTests:        total,
    inProgress:        results.filter((r) => r.outcome === "in_progress").length,
    completed:         results.filter((r) => r.trackingState === "completed").length,
    challengerWins:    results.filter((r) => r.outcome === "challenger_wins").length,
    controlHolds:      results.filter((r) => r.outcome === "control_holds").length,
    noClearWinner:     results.filter((r) => r.outcome === "no_clear_winner").length,
    insufficientData:  results.filter((r) => r.outcome === "insufficient_data").length,
    failedTests:       results.filter((r) => r.outcome === "failed_test").length,
    averageConfidence: avgConf,
  };
}

// ---------------------------------------------------------------------------
// Public: buildImageVariationLifecycleLink
// Creates a linkage record from a result back to the variation lifecycle.
// ---------------------------------------------------------------------------

export function buildImageVariationLifecycleLink(
  result: ImageVariationTestResult,
): ImageVariationLifecycleResultLink | null {
  if (!result.sourceCandidateId) return null;

  return {
    candidateId:  result.sourceCandidateId,
    requestId:    result.sourceRequestId ?? "",
    planId:       result.planId,
    outcome:      result.outcome,
    confidence:   result.confidence.value,
    primaryLift:  result.comparison?.primaryLift ?? 0,
    linkedAt:     result.evaluatedAt,
  };
}

// ---------------------------------------------------------------------------
// Internal: adapt launch plan to ExperimentPlan shape
// ---------------------------------------------------------------------------

function adaptToExperimentPlan(plan: CreativeExperimentLaunchPlan): ExperimentPlan {
  return {
    id:                         plan.id,
    clientAccountId:            plan.clientAccountId,
    campaignId:                 plan.mapping.campaignId,
    name:                       plan.name,
    description:                plan.hypothesis,
    status:                     plan.readiness.state === "launched" ? "active" : "evaluating",
    comparisonMode:             plan.mapping.comparisonMode,
    controlCreativeId:          plan.control.creativeId,
    controlAdExternalId:        plan.control.adExternalId,
    controlAdSetExternalId:     plan.control.adSetExternalId ?? plan.mapping.adSetExternalId,
    controlCampaignExternalId:  plan.control.campaignExternalId ?? plan.mapping.campaignExternalId,
    controlLabel:               plan.control.label,
    challengerPrepItemId:       plan.challenger.prepItemId,
    challengerAdExternalId:     plan.challenger.adExternalId,
    challengerAdSetExternalId:  plan.challenger.adSetExternalId ?? plan.mapping.adSetExternalId,
    challengerCampaignExternalId: plan.challenger.campaignExternalId ?? plan.mapping.campaignExternalId,
    challengerLabel:            plan.challenger.label,
    externalAdAccountId:        plan.mapping.externalAdAccountId,
    primaryMetric:              plan.successCriteria.primaryMetric,
    secondaryMetrics:           plan.successCriteria.secondaryMetrics,
    successThreshold:           plan.successCriteria.successThreshold,
    minSpendPerVariant:         plan.successCriteria.minSpendPerVariant,
    minConversionsPerVariant:   plan.successCriteria.minConversionsPerVariant,
    evaluationWindowDays:       plan.successCriteria.evaluationWindowDays,
    startedAt:                  plan.launchedAt ?? plan.createdAt,
    evaluationEndsAt:           null,
    completedAt:                null,
    createdAt:                  plan.createdAt,
    updatedAt:                  plan.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Internal: build pending/error results
// ---------------------------------------------------------------------------

function buildPendingResult(
  plan: CreativeExperimentLaunchPlan,
  now: string,
): ImageVariationTestResult {
  return {
    planId:            plan.id,
    planName:          plan.name,
    outcome:           "in_progress",
    trackingState:     "pending_launch",
    confidence:        { value: 0, level: "low", reasons: ["Plan not yet launched."] },
    controlSnapshot:   null,
    challengerSnapshot: null,
    comparison:        null,
    evaluationWindow:  null,
    outcomeReasons:    ["Plan has not been launched yet."],
    recommendedAction: "Launch the experiment to begin collecting data.",
    recommendedNote:   "",
    sourceRequestId:   null,
    sourceCandidateId: plan.variantId,
    sourceCreativeId:  plan.control.creativeId,
    clientAccountId:   plan.clientAccountId,
    campaignId:        plan.mapping.campaignId,
    variationIntent:   plan.challenger.briefIntent,
    evaluatedAt:       now,
  };
}

function buildErrorResult(
  plan: CreativeExperimentLaunchPlan,
  error: string,
  now: string,
): ImageVariationTestResult {
  return {
    ...buildPendingResult(plan, now),
    outcome:           "failed_test",
    trackingState:     "blocked",
    outcomeReasons:    [error],
    recommendedAction: "Check data sync and retry.",
    confidence:        { value: 0, level: "low", reasons: [error] },
  };
}

// ---------------------------------------------------------------------------
// Internal: map experiment types to image variation types
// ---------------------------------------------------------------------------

function mapOutcome(
  experimentOutcome: string,
  window: { isComplete: boolean },
): ImageVariationTestOutcome {
  if (!window.isComplete && experimentOutcome === "insufficient_data") return "in_progress";
  const validOutcomes: ImageVariationTestOutcome[] = [
    "insufficient_data", "no_clear_winner", "challenger_wins",
    "control_holds", "mixed_result", "failed_test", "archived",
  ];
  return validOutcomes.includes(experimentOutcome as ImageVariationTestOutcome)
    ? (experimentOutcome as ImageVariationTestOutcome)
    : "in_progress";
}

function computeTrackingState(
  plan: CreativeExperimentLaunchPlan,
  window: { isComplete: boolean },
  outcome: ImageVariationTestOutcome,
): ImageVariationTrackingState {
  if (plan.readiness.state !== "launched") return "pending_launch";
  if (outcome === "failed_test") return "blocked";
  if (window.isComplete) return "completed";
  if (outcome === "in_progress" || outcome === "insufficient_data") return "active";
  return "evaluating";
}

function computeConfidence(
  rawConfidence: number,
  reasons: string[],
  window: { isComplete: boolean; progressPct: number },
): ImageVariationOutcomeConfidence {
  const value = Math.round(rawConfidence * 100) / 100;
  const level: "low" | "medium" | "high" =
    value >= 0.7 ? "high" : value >= 0.4 ? "medium" : "low";

  const confReasons: string[] = [];
  if (!window.isComplete) confReasons.push(`Evaluation window ${window.progressPct}% complete.`);
  if (value < 0.4) confReasons.push("Low confidence — more data needed.");
  if (reasons.length > 0) confReasons.push(...reasons.slice(0, 2));

  return { value, level, reasons: confReasons };
}

function mapSnapshot(s: ExperimentMetricSnapshot): ImageVariationMetricSnapshot {
  return {
    variantLabel:  s.variantLabel,
    variantType:   s.variantType,
    windowStart:   s.windowStart,
    windowEnd:     s.windowEnd,
    spend:         s.spend,
    impressions:   s.impressions,
    clicks:        s.clicks,
    ctr:           s.ctr,
    cpm:           s.cpm,
    orders:        s.orders,
    revenue:       s.revenue,
    roas:          s.roas,
    cpa:           s.cpa,
    dataSource:    s.dataSource,
    isComplete:    s.isComplete,
  };
}

function mapComparison(c: {
  primaryMetric: string;
  primaryDelta: { delta: number; lift: number };
  secondaryDeltas: Record<string, { delta: number; lift: number }>;
  guardrailBreaches: string[];
  isStatisticallyMeaningful: boolean;
}): ImageVariationTestComparison {
  return {
    primaryMetric:     c.primaryMetric,
    primaryDelta:      c.primaryDelta.delta,
    primaryLift:       c.primaryDelta.lift,
    secondaryDeltas:   c.secondaryDeltas,
    guardrailBreaches: c.guardrailBreaches,
    isMeaningful:      c.isStatisticallyMeaningful,
  };
}

function mapWindow(w: {
  windowDays: number;
  startedAt: string;
  endsAt: string;
  isComplete: boolean;
  daysRemaining: number;
  progressPct: number;
}): ImageVariationEvaluationWindow {
  return {
    windowDays:    w.windowDays,
    startedAt:     w.startedAt,
    endsAt:        w.endsAt,
    isComplete:    w.isComplete,
    daysRemaining: w.daysRemaining,
    progressPct:   w.progressPct,
  };
}
