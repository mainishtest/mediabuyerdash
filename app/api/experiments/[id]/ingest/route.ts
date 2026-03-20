// app/api/experiments/[id]/ingest/route.ts
// POST — trigger result ingestion for an experiment.
//
// Flow:
//   1. Load experiment plan
//   2. Ingest performance data (Meta + CRM)
//   3. Compare variants
//   4. Detect winner
//   5. Summarise learnings
//   6. Persist result + learnings
//   7. Return full result

import { NextRequest, NextResponse }              from "next/server";
import {
  loadExperimentById,
  ingestExperimentResults,
  compareExperimentVariants,
  detectWinner,
  buildExperimentOutcome,
  summarizeExperimentLearnings,
  upsertExperimentResult,
  saveExperimentLearnings,
  buildEvaluationWindow,
}                                                 from "../../../../../lib/experiments";
import type { ExperimentResult }                  from "../../../../../types/experiment";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Load plan
  const experiment = await loadExperimentById(id).catch(() => null);
  if (!experiment) return NextResponse.json({ error: "Experiment not found." }, { status: 404 });

  if (experiment.status === "archived") {
    return NextResponse.json({ error: "Cannot ingest results for an archived experiment." }, { status: 400 });
  }

  try {
    // Step 1: Ingest performance data
    const { controlSnapshot, challengerSnapshot } = await ingestExperimentResults(experiment);

    // Step 2: Compare variants
    const comparison = compareExperimentVariants(controlSnapshot, challengerSnapshot, {
      primaryMetric:            experiment.primaryMetric,
      secondaryMetrics:         experiment.secondaryMetrics,
      successThreshold:         experiment.successThreshold,
      minSpendPerVariant:       experiment.minSpendPerVariant,
      minConversionsPerVariant: experiment.minConversionsPerVariant,
    });

    // Step 3: Detect winner
    const evalWindow = buildEvaluationWindow(
      experiment.startedAt,
      experiment.evaluationWindowDays,
      experiment.evaluationEndsAt,
    );
    const detection = detectWinner(controlSnapshot, challengerSnapshot, comparison, evalWindow, {
      primaryMetric:            experiment.primaryMetric,
      secondaryMetrics:         experiment.secondaryMetrics,
      successThreshold:         experiment.successThreshold,
      minSpendPerVariant:       experiment.minSpendPerVariant,
      minConversionsPerVariant: experiment.minConversionsPerVariant,
    });

    // Step 4: Build outcome
    const outcomeData = buildExperimentOutcome(detection, comparison);

    // Learning summary: concatenate insight texts
    const learnings = summarizeExperimentLearnings({
      experimentId:    id,
      plan:            experiment,
      detection,
      control:         controlSnapshot,
      challenger:      challengerSnapshot,
      comparison,
    });
    const learningSummary = learnings.map((l) => l.insightText).join(" ");

    // Step 5: Persist result
    const now: string = new Date().toISOString();
    const result: Omit<ExperimentResult, "id"> = {
      experimentId:      id,
      outcome:           outcomeData.outcome,
      winningVariant:    outcomeData.winningVariant,
      confidence:        detection.confidence,
      controlSnapshot,
      challengerSnapshot,
      comparison,
      primaryMetricDelta: outcomeData.primaryMetricDelta,
      primaryMetricLift:  outcomeData.primaryMetricLift,
      guardrailBreaches:  outcomeData.guardrailBreaches,
      outcomeReasons:     outcomeData.outcomeReasons,
      recommendedAction:  outcomeData.recommendedAction,
      recommendedNote:    outcomeData.recommendedNote,
      learningSummary,
      evaluatedAt:        now,
    };

    await upsertExperimentResult(result);
    await saveExperimentLearnings(learnings);

    // Step 6: Return
    return NextResponse.json({
      ok:        true,
      id,
      outcome:   outcomeData.outcome,
      winner:    outcomeData.winningVariant,
      confidence: detection.confidence,
      primaryLift: detection.primaryLift,
      result,
      learnings,
    });
  } catch (err) {
    console.error("[experiments/[id]/ingest]", err);
    return NextResponse.json({
      ok:    false,
      error: "Result ingestion failed. Check server logs.",
    }, { status: 500 });
  }
}
