// lib/creativeTestResults/lifecycle.ts
// Builds lifecycle links and summaries for creative test results.
// All pure functions except attachCreativeTestResultToLifecycle (DB write via db.ts).

import type {
  CreativeTestResult,
  CreativeTestOutcome,
  CreativeLifecycleResultLink,
  CreativeTestResultSummary,
  CreativeTestTrackingState,
} from "../../types/creativeTestResults";
import {
  TEST_OUTCOME_LABEL,
  TEST_TRACKING_STATE_LABEL,
} from "../../types/creativeTestResults";

// ---------------------------------------------------------------------------
// Build a lifecycle link from a result
// ---------------------------------------------------------------------------

export function buildCreativeLifecycleResultLink(
  result: Pick<
    CreativeTestResult,
    | "id"
    | "clientAccountId"
    | "prepItemId"
    | "briefId"
    | "launchPlanId"
    | "experimentId"
    | "outcome"
    | "winningVariant"
    | "confidence"
  > & { variantId?: string | null },
): CreativeLifecycleResultLink {
  return {
    testResultId:    result.id,
    clientAccountId: result.clientAccountId,
    prepItemId:      result.prepItemId,
    briefId:         result.briefId,
    variantId:       result.variantId ?? null,
    launchPlanId:    result.launchPlanId,
    experimentId:    result.experimentId,
    outcome:         result.outcome,
    winningRole:     result.winningVariant,
    confidence:      result.confidence?.score ?? null,
    primaryLift:     result.outcome === "in_progress" ? null :
                     result.outcome == null ? null : null,
    attachedAt:      new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Build aggregate summary across a list of results
// ---------------------------------------------------------------------------

export function buildCreativeTestResultSummary(
  results: Pick<CreativeTestResult, "trackingState" | "outcome">[],
): CreativeTestResultSummary {
  const s: CreativeTestResultSummary = {
    total:          results.length,
    pendingLaunch:  0,
    active:         0,
    evaluating:     0,
    completed:      0,
    stale:          0,
    blocked:        0,
    challengerWins: 0,
    controlHolds:   0,
    noWinner:       0,
  };

  for (const r of results) {
    switch (r.trackingState as CreativeTestTrackingState) {
      case "pending_launch": s.pendingLaunch++; break;
      case "active":         s.active++;        break;
      case "evaluating":     s.evaluating++;    break;
      case "completed":      s.completed++;     break;
      case "stale":          s.stale++;         break;
      case "blocked":        s.blocked++;       break;
    }
    if (r.outcome === "challenger_wins") s.challengerWins++;
    if (r.outcome === "control_holds")   s.controlHolds++;
    if (r.outcome === "no_clear_winner") s.noWinner++;
  }

  return s;
}

// ---------------------------------------------------------------------------
// Human-readable single-line summary
// ---------------------------------------------------------------------------

export function summarizeCreativeTestResult(result: CreativeTestResult): string {
  const challenger = result.challengerVariantTitle ?? "Challenger";
  const control    = result.controlCreativeName    ?? "Control";
  const state      = TEST_TRACKING_STATE_LABEL[result.trackingState];

  if (result.trackingState === "pending_launch") {
    return `${result.name} — waiting for experiment to go live.`;
  }

  if (result.trackingState === "blocked") {
    return `${result.name} — blocked: missing control or challenger ad mapping.`;
  }

  if (!result.outcome || result.outcome === "in_progress") {
    const progress = result.evaluationWindow
      ? ` (${result.evaluationWindow.progressPct}% of window complete)`
      : "";
    return `${challenger} vs ${control} — ${state}${progress}.`;
  }

  const outcomeLabel = TEST_OUTCOME_LABEL[result.outcome];
  const lift = result.comparison?.primaryLift;
  const liftStr = lift != null ? ` ${(Math.abs(lift) * 100).toFixed(1)}% ${lift > 0 ? "up" : "down"}` : "";

  if (result.outcome === "challenger_wins") {
    return `Challenger wins: ${challenger} outperforms ${control} by${liftStr} on ${result.primaryMetric}.`;
  }
  if (result.outcome === "control_holds") {
    return `Control holds: ${control} outperforms ${challenger} by${liftStr} on ${result.primaryMetric}.`;
  }

  return `${challenger} vs ${control} — ${outcomeLabel}${liftStr}.`;
}

// ---------------------------------------------------------------------------
// Determine recommended next step based on outcome
// ---------------------------------------------------------------------------

export function buildRecommendedNextStep(
  outcome:          CreativeTestOutcome | null,
  winningVariant:   "control" | "challenger" | null,
  isWindowComplete: boolean,
  daysRemaining:    number,
): string {
  if (!outcome || outcome === "in_progress") {
    return isWindowComplete
      ? "Window complete — run ingestion to evaluate results."
      : `Continue running — ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining in the evaluation window.`;
  }

  switch (outcome) {
    case "challenger_wins":
      return "Challenger wins — mark for winner review. Return losing creative to Creative Lab for analysis.";
    case "control_holds":
      return "Control holds — archive challenger. Consider returning it to Creative Lab with learnings for iteration.";
    case "no_clear_winner":
      return "No clear winner — consider extending the test, increasing budget, or testing a bolder variation.";
    case "mixed_result":
      return "Mixed signals — review raw data for attribution issues. Do not act until the data conflict is resolved.";
    case "insufficient_data":
      return isWindowComplete
        ? "Insufficient data after full window — consider rerunning with higher budget or longer duration."
        : `Waiting for data volume. ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining.`;
    case "failed_test":
      return "Test failed — verify Meta sync logs and confirm ad external IDs are correctly mapped.";
    case "archived":
      return "Test archived — no further action required.";
    default:
      return "Review results and determine next action.";
  }
}
