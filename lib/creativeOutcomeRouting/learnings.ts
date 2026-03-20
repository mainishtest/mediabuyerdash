// lib/creativeOutcomeRouting/learnings.ts
// Learning extraction and iteration feedback generation.
// Pure functions — no DB access.
//
// Design rules:
//   - Learning is always explicit (shown to user before being saved)
//   - Does not overwrite existing learning records — always additive
//   - Extraction confidence is surfaced to prevent over-relying on thin data

import type { CreativeTestResult } from "../../types/creativeTestResults";
import type {
  CreativeIterationLearning,
  CreativeIterationFeedback,
  CreativeOutcomeRouteType,
} from "../../types/creativeOutcomeRouting";

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

export function extractCreativeIterationLearning(
  result: CreativeTestResult,
): CreativeIterationLearning | null {
  const outcome = result.outcome;

  // Nothing to extract from in-flight tests
  if (!outcome || outcome === "in_progress" || outcome === "insufficient_data") {
    return null;
  }

  const lift       = result.comparison?.primaryLift ?? null;
  const metric     = result.primaryMetric;
  const reasons    = result.outcomeReasons.map((r) => r.description);
  const challenger = result.challengerVariantTitle ?? "Challenger";
  const control    = result.controlCreativeName ?? "Control";
  const confScore  = result.confidence?.score ?? 0;

  const winningPattern  = buildWinningPattern(outcome, lift, metric, challenger, control);
  const losingPattern   = buildLosingPattern(outcome, lift, metric, challenger, control);
  const iterationHints  = buildIterationHints(outcome, lift, metric, reasons, challenger);
  const briefAdjustments = buildBriefAdjustments(outcome, lift, reasons);
  const avoidList       = buildAvoidList(outcome, result);

  const extractionConfidence = computeExtractionConfidence(result, confScore);
  const sourceSummary        = buildSourceSummary(outcome, lift, metric, challenger, control);

  return {
    winningPattern,
    losingPattern,
    iterationHints,
    briefAdjustments,
    avoidList,
    applicableTo: {
      clientAccountId: result.clientAccountId,
      briefIntent:     null,
      draftType:       null,
      campaignName:    result.campaignName,
    },
    extractionConfidence,
    sourceSummary,
  };
}

// ---------------------------------------------------------------------------
// Iteration feedback (for brief generation context)
// ---------------------------------------------------------------------------

export function buildCreativeIterationFeedback(
  result:    CreativeTestResult,
  routeType: CreativeOutcomeRouteType,
  learning:  CreativeIterationLearning,
): CreativeIterationFeedback {
  const briefContextHints: Record<string, unknown> = {
    priorTestOutcome:   result.outcome,
    priorPrimaryMetric: result.primaryMetric,
    priorLift:          result.comparison?.primaryLift ?? null,
    winningPattern:     learning.winningPattern,
    losingPattern:      learning.losingPattern,
    avoidList:          learning.avoidList,
    iterationHints:     learning.iterationHints,
    routeType,
    testResultId:       result.id,
  };

  return {
    testResultId:    result.id,
    clientAccountId: result.clientAccountId,
    routeType,
    learning,
    briefContextHints,
    attachedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Pattern builders
// ---------------------------------------------------------------------------

function buildWinningPattern(
  outcome:   string,
  lift:      number | null,
  metric:    string,
  challenger: string,
  control:   string,
): string | null {
  if (outcome !== "challenger_wins") return null;
  const liftStr = lift != null ? ` by ${(lift * 100).toFixed(1)}%` : "";
  return `${challenger} outperformed ${control} on ${metric}${liftStr}.`;
}

function buildLosingPattern(
  outcome:   string,
  lift:      number | null,
  metric:    string,
  challenger: string,
  control:   string,
): string | null {
  if (outcome === "control_holds") {
    const liftStr = lift != null ? ` by ${Math.abs(lift * 100).toFixed(1)}%` : "";
    return `${challenger} underperformed ${control} on ${metric}${liftStr}. The challenger concept did not improve over the baseline.`;
  }
  if (outcome === "mixed_result" || outcome === "no_clear_winner") {
    return `${challenger} produced mixed signals — no reliable directional result vs ${control}.`;
  }
  if (outcome === "failed_test") {
    return `Test failed before a valid comparison could be made. Review guardrail breaches before iterating.`;
  }
  return null;
}

function buildIterationHints(
  outcome:   string,
  lift:      number | null,
  metric:    string,
  reasons:   string[],
  challenger: string,
): string[] {
  const hints: string[] = [];

  if (outcome === "challenger_wins" && lift != null && lift > 0) {
    hints.push(`The winning angle for ${challenger} worked — reinforce this hook in future briefs.`);
    hints.push(`Consider testing a variation of ${challenger} with increased spend to validate scale performance.`);
  }

  if (outcome === "control_holds") {
    hints.push(`The challenger concept did not beat control. Try a different hook, angle, or creative format.`);
    hints.push(`Review the primary metric (${metric}) — consider whether the brief intent aligns with the campaign goal.`);
  }

  if (outcome === "mixed_result" || outcome === "no_clear_winner") {
    hints.push(`Tighten the test criteria — use a single clear primary metric and longer evaluation window.`);
    hints.push(`Simplify the creative difference between challenger and control to isolate the variable being tested.`);
  }

  if (outcome === "failed_test") {
    hints.push(`Fix the underlying delivery or data issue before launching a new iteration.`);
    hints.push(`Review guardrail breaches in the test result before creating a follow-up brief.`);
  }

  // Add up to 2 reasons as hints
  for (const r of reasons.slice(0, 2)) {
    hints.push(r);
  }

  return hints;
}

function buildBriefAdjustments(
  outcome: string,
  lift:    number | null,
  reasons: string[],
): string[] {
  const adjustments: string[] = [];

  if (outcome === "control_holds") {
    adjustments.push("Change the core hook or angle — current approach did not differentiate from control.");
    if (lift != null && Math.abs(lift) < 0.05) {
      adjustments.push("The lift gap was very small — even a modest hook change may be sufficient.");
    }
  }

  if (outcome === "challenger_wins") {
    adjustments.push("Preserve the winning hook in the next brief. Build on this direction.");
  }

  if (outcome === "mixed_result") {
    adjustments.push("Narrow the hypothesis — pick one metric to optimise and state it clearly in the brief.");
  }

  if (reasons.length > 0) {
    adjustments.push(`Address: ${reasons[0]}`);
  }

  return adjustments;
}

function buildAvoidList(
  outcome: string,
  result:  CreativeTestResult,
): string[] {
  const avoid: string[] = [];

  if (outcome === "control_holds") {
    if (result.challengerVariantTitle) {
      avoid.push(`Hook / angle used in "${result.challengerVariantTitle}" — did not beat control.`);
    }
  }

  if (outcome === "failed_test") {
    avoid.push("Launching without confirming both variants are delivering before the evaluation window begins.");
  }

  const breaches = result.comparison?.guardrailBreaches ?? [];
  for (const b of breaches.slice(0, 2)) {
    avoid.push(`Guardrail: ${b}`);
  }

  return avoid;
}

// ---------------------------------------------------------------------------
// Extraction confidence
// ---------------------------------------------------------------------------

function computeExtractionConfidence(
  result:    CreativeTestResult,
  confScore: number,
): "low" | "medium" | "high" {
  // Need window complete + sufficient data + real comparison to extract reliably
  const windowComplete = result.evaluationWindow?.isComplete ?? false;
  const hasComparison  = result.comparison != null;
  const hasSnapshots   = result.controlSnapshot != null && result.challengerSnapshot != null;

  if (!windowComplete || !hasComparison || !hasSnapshots) return "low";
  if (confScore >= 0.65) return "high";
  if (confScore >= 0.40) return "medium";
  return "low";
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

function buildSourceSummary(
  outcome:   string,
  lift:      number | null,
  metric:    string,
  challenger: string,
  control:   string,
): string {
  const liftStr = lift != null
    ? ` ${lift > 0 ? "+" : ""}${(lift * 100).toFixed(1)}% on ${metric}`
    : "";
  const labels: Record<string, string> = {
    challenger_wins:    `${challenger} beat ${control}${liftStr}`,
    control_holds:      `${control} held against ${challenger}${liftStr}`,
    no_clear_winner:    `No clear winner between ${challenger} and ${control}${liftStr}`,
    mixed_result:       `Mixed signals between ${challenger} and ${control}${liftStr}`,
    failed_test:        `Test failed — ${challenger} vs ${control}`,
    archived:           `Archived: ${challenger} vs ${control}`,
    insufficient_data:  `Insufficient data — ${challenger} vs ${control}`,
    in_progress:        `In progress — ${challenger} vs ${control}`,
  };
  return labels[outcome] ?? `${challenger} vs ${control}`;
}
