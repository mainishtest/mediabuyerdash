// lib/creativeTestResults/ingestor.ts
// Orchestrates performance data ingestion for a creative test result.
//
// Design rules:
//   - Delegates all Meta + CRM data loading to lib/experiments/ingestor.
//   - Delegates comparison math to lib/experiments/comparator.
//   - Delegates outcome detection to lib/experiments/detector.
//   - Writes back to both CreativeTestResultRecord AND ExperimentResultRecord.
//   - 7-day attribution window enforced — evaluationWindowDays is always 7.

import { ingestExperimentResults }     from "../experiments/ingestor";
import { upsertExperimentResult, saveExperimentLearnings, loadExperimentById } from "../experiments/db";
import { summarizeExperimentLearnings } from "../experiments/learnings";
import type { ExperimentPlan }          from "../../types/experiment";
import {
  compareCreativeTestVariants,
  evaluateCreativeTestOutcome,
  computeCreativeTestConfidence,
  buildTestEvaluationWindow,
  adaptSnapshot,
  deriveTrackingState,
} from "./evaluator";
import { buildRecommendedNextStep } from "./lifecycle";
import {
  loadCreativeTestResultById,
  updateCreativeTestResult,
  saveCreativeLifecycleResultLink,
  loadLifecycleLinksForResult,
} from "./db";
import type { CreativeTestResult } from "../../types/creativeTestResults";

// ---------------------------------------------------------------------------
// Build an ExperimentPlan-compatible object from CreativeTestResult fields.
// Used when there is no linked ExperimentRecord.
// ---------------------------------------------------------------------------

function buildExperimentPlanProxy(result: CreativeTestResult): ExperimentPlan {
  const now = new Date();
  const startedAt = result.evaluationWindow?.startedAt
    ? new Date(result.evaluationWindow.startedAt + "T00:00:00Z")
    : new Date(now.getTime() - result.evaluationWindowDays * 86_400_000);

  return {
    id:              result.id,
    clientAccountId: result.clientAccountId,
    campaignId:      null,
    name:            result.name,
    description:     null,
    status:          "active",
    comparisonMode:  "simultaneous",
    // Control
    controlCreativeId:         result.controlCreativeId,
    controlAdExternalId:       result.controlAdExternalId,
    controlAdSetExternalId:    null,
    controlCampaignExternalId: result.targetCampaignExternalId,
    controlLabel:              result.controlCreativeName ?? "Control",
    // Challenger
    challengerPrepItemId:          result.prepItemId,
    challengerAdExternalId:        result.challengerAdExternalId,
    challengerAdSetExternalId:     result.targetAdSetExternalId,
    challengerCampaignExternalId:  result.targetCampaignExternalId,
    challengerLabel:               result.challengerVariantTitle ?? "Challenger",
    // Shared
    externalAdAccountId: result.externalAdAccountId,
    // Criteria
    primaryMetric:            result.primaryMetric,
    secondaryMetrics:         ["cpa_7d", "ctr"],
    successThreshold:         result.successThreshold,
    minSpendPerVariant:       result.minSpendPerVariant,
    minConversionsPerVariant: result.minConversionsPerVariant,
    evaluationWindowDays:     result.evaluationWindowDays,
    // Timeline
    startedAt:        startedAt.toISOString(),
    evaluationEndsAt: null,
    completedAt:      null,
    createdAt:        result.createdAt,
    updatedAt:        result.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Main ingestion function
// ---------------------------------------------------------------------------

export async function ingestCreativeTestResults(
  testResultId: string,
): Promise<CreativeTestResult> {
  // Load the test result
  const result = await loadCreativeTestResultById(testResultId);
  if (!result) {
    throw new Error(`CreativeTestResult not found: ${testResultId}`);
  }

  // Determine which ExperimentPlan to use for data loading
  let plan: ExperimentPlan;

  if (result.experimentId) {
    // Prefer the linked ExperimentRecord — it has the canonical Meta IDs
    const experiment = await loadExperimentById(result.experimentId);
    if (experiment) {
      plan = experiment as ExperimentPlan;
    } else {
      plan = buildExperimentPlanProxy(result);
    }
  } else {
    plan = buildExperimentPlanProxy(result);
  }

  // Compute evaluation window
  const evalWindow = buildTestEvaluationWindow(
    plan.startedAt,
    plan.evaluationWindowDays,
    plan.evaluationEndsAt,
  );

  // Ingest Meta + CRM data for both variants
  const { controlSnapshot, challengerSnapshot } = await ingestExperimentResults(plan);

  // Adapt to CreativeTestMetricSnapshot
  const ctrlSnap = adaptSnapshot(
    controlSnapshot,
    result.controlCreativeName,
    result.controlCreativeId,
    result.controlAdExternalId,
  );
  const challSnap = adaptSnapshot(
    challengerSnapshot,
    result.challengerVariantTitle,
    null,
    result.challengerAdExternalId,
  );

  // Compare variants
  const comparison = compareCreativeTestVariants(controlSnapshot, challengerSnapshot, {
    primaryMetric:            plan.primaryMetric,
    secondaryMetrics:         plan.secondaryMetrics,
    successThreshold:         plan.successThreshold,
    minSpendPerVariant:       plan.minSpendPerVariant,
    minConversionsPerVariant: plan.minConversionsPerVariant,
  });

  // Evaluate outcome
  const evaluation = evaluateCreativeTestOutcome(
    controlSnapshot,
    challengerSnapshot,
    comparison,
    evalWindow,
    {
      primaryMetric:            plan.primaryMetric,
      secondaryMetrics:         plan.secondaryMetrics,
      successThreshold:         plan.successThreshold,
      minSpendPerVariant:       plan.minSpendPerVariant,
      minConversionsPerVariant: plan.minConversionsPerVariant,
    },
  );

  // Compute confidence
  const confidence = computeCreativeTestConfidence(
    evaluation.rawConfidence,
    evalWindow.isComplete,
    evaluation.outcome,
  );

  // Derive tracking state
  const trackingState = deriveTrackingState({
    experimentId:           result.experimentId,
    launchPlanId:           result.launchPlanId,
    windowEndsAt:           evalWindow.endsAt,
    outcome:                evaluation.outcome,
    controlAdExternalId:    result.controlAdExternalId,
    challengerAdExternalId: result.challengerAdExternalId,
  });

  // Build recommended next step
  const recommendedNextStep = buildRecommendedNextStep(
    evaluation.outcome,
    evaluation.winningVariant,
    evalWindow.isComplete,
    evalWindow.daysRemaining,
  );

  // Persist updated test result
  await updateCreativeTestResult(testResultId, {
    trackingState,
    outcome:               evaluation.outcome,
    controlSnapshotJson:   JSON.stringify(ctrlSnap),
    challengerSnapshotJson: JSON.stringify(challSnap),
    primaryMetricDelta:    comparison.primaryDelta,
    primaryMetricLift:     comparison.primaryLift,
    guardrailBreaches:     JSON.stringify(comparison.guardrailBreaches),
    outcomeReasons:        JSON.stringify(evaluation.outcomeReasons.map((r) => r.description)),
    confidence:            confidence.score,
    winningVariant:        evaluation.winningVariant,
    windowStartedAt:       new Date(evalWindow.startedAt),
    windowEndsAt:          new Date(evalWindow.endsAt),
    isWindowComplete:      evalWindow.isComplete,
    recommendedNextStep,
  });

  // Also sync back to ExperimentResultRecord if linked
  if (result.experimentId) {
    try {
      await upsertExperimentResult({
        experimentId:        result.experimentId,
        outcome:             evaluation.outcome === "in_progress" ? "insufficient_data" : evaluation.outcome,
        winningVariant:      evaluation.winningVariant,
        confidence:          confidence.score,
        controlSnapshot,
        challengerSnapshot,
        comparison: {
          primaryMetric:             comparison.primaryMetric,
          primaryDelta:              { delta: comparison.primaryDelta, lift: comparison.primaryLift },
          secondaryDeltas:           Object.fromEntries(
            Object.entries(comparison.secondaryDeltas).map(([k, v]) => [k, { delta: v.delta, lift: v.lift }])
          ),
          guardrailBreaches:         comparison.guardrailBreaches,
          isStatisticallyMeaningful: comparison.isStatisticallyMeaningful,
          confidenceNote:            comparison.confidenceNote,
        },
        primaryMetricDelta:  comparison.primaryDelta,
        primaryMetricLift:   comparison.primaryLift,
        guardrailBreaches:   comparison.guardrailBreaches,
        outcomeReasons:      evaluation.outcomeReasons.map((r) => r.description),
        recommendedAction:   evaluation.outcome,
        recommendedNote:     recommendedNextStep,
        learningSummary:     null,
        evaluatedAt:         new Date().toISOString(),
      });

      // Extract and save learnings for completed tests
      if (
        evalWindow.isComplete &&
        evaluation.outcome !== "in_progress" &&
        evaluation.outcome !== "failed_test"
      ) {
        const experiment = await loadExperimentById(result.experimentId);
        if (experiment) {
          const learnings = summarizeExperimentLearnings(
            result.experimentId,
            result.clientAccountId,
            {
              outcome:       evaluation.outcome === "in_progress" ? "insufficient_data" : evaluation.outcome,
              winningVariant: evaluation.winningVariant,
              confidence:    confidence.score,
              primaryLift:   evaluation.primaryLift,
              outcomeReasons: evaluation.outcomeReasons.map((r) => r.description),
              recommendedAction: evaluation.outcome,
              recommendedNote: recommendedNextStep,
            },
            {
              primaryMetric: plan.primaryMetric,
              primaryDelta: { delta: comparison.primaryDelta, lift: comparison.primaryLift },
              secondaryDeltas: Object.fromEntries(
                Object.entries(comparison.secondaryDeltas).map(([k, v]) => [k, { delta: v.delta, lift: v.lift }])
              ),
              guardrailBreaches: comparison.guardrailBreaches,
              isStatisticallyMeaningful: comparison.isStatisticallyMeaningful,
              confidenceNote: comparison.confidenceNote,
            },
            { briefIntent: null, draftType: null },
          );
          if (learnings.length > 0) {
            await saveExperimentLearnings(learnings);
          }
        }
      }
    } catch (err) {
      // Non-blocking — experiment sync failure should not prevent test result update
      console.warn("[ingestCreativeTestResults] Experiment sync failed:", err);
    }
  }

  // Create or update lifecycle link
  const existingLinks = await loadLifecycleLinksForResult(testResultId);
  if (existingLinks.length === 0) {
    await saveCreativeLifecycleResultLink({
      testResultId,
      clientAccountId:  result.clientAccountId,
      prepItemId:       result.prepItemId,
      briefId:          result.briefId,
      variantId:        null,
      launchPlanId:     result.launchPlanId,
      experimentId:     result.experimentId,
      outcome:          evaluation.outcome,
      winningRole:      evaluation.winningVariant,
      confidence:       confidence.score,
      primaryLift:      evaluation.primaryLift,
    });
  }

  // Return the refreshed result
  const updated = await loadCreativeTestResultById(testResultId);
  if (!updated) throw new Error("Failed to reload test result after ingestion");
  return updated;
}
