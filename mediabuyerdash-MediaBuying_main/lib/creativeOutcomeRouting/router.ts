// lib/creativeOutcomeRouting/router.ts
// Pure routing-decision functions. No DB access.
//
// Design rules:
//   - All decisions are explicit and explainable (reason array always populated)
//   - No autonomous scaling or pausing — routing only proposes next workflow
//   - Low confidence always routes to monitor regardless of outcome

import { randomUUID } from "crypto";
import type { CreativeTestResult } from "../../types/creativeTestResults";
import type {
  CreativeOutcomeRoute,
  CreativeOutcomeRouteType,
  CreativeOutcomeReason,
} from "../../types/creativeOutcomeRouting";
import { extractCreativeIterationLearning } from "./learnings";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function buildCreativeOutcomeRoute(
  result: CreativeTestResult,
): CreativeOutcomeRoute {
  const routeType = determineRouteType(result);
  const reasons   = buildRouteReasons(result, routeType);
  const evidence  = buildRouteEvidence(result);
  const learning  = extractCreativeIterationLearning(result);
  const { nextActionLabel, nextActionHint, linkedWorkflow } = buildNextAction(routeType, result);

  return {
    id:              randomUUID(),
    clientAccountId: result.clientAccountId,
    testResultId:    result.id,

    routeType,
    readinessState: "pending_action",

    outcome:         result.outcome ?? null,
    confidenceLevel: result.confidence?.level ?? null,
    confidenceScore: result.confidence?.score ?? null,
    primaryLift:     result.comparison?.primaryLift ?? null,
    winningVariant:  result.comparison
      ? (result.comparison.primaryLift > 0 ? "challenger" : "control")
      : null,

    challengerVariantTitle: result.challengerVariantTitle,
    controlCreativeName:    result.controlCreativeName,
    campaignName:           result.campaignName,
    primaryMetric:          result.primaryMetric,

    reasons,
    evidence,
    nextActionLabel,
    nextActionHint,
    linkedWorkflow,

    learning,
    learningSummary: learning?.sourceSummary ?? null,

    actionedAt: null,
    actionedBy: null,
    actionNote: null,
    archivedAt: null,

    launchPlanId: result.launchPlanId,
    experimentId: result.experimentId,
    briefId:      result.briefId,
    variantId:    null,
    prepItemId:   result.prepItemId,

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Routing decision
// ---------------------------------------------------------------------------

function determineRouteType(result: CreativeTestResult): CreativeOutcomeRouteType {
  const outcome    = result.outcome;
  const confLevel  = result.confidence?.level;
  const confScore  = result.confidence?.score ?? 0;

  // Unresolved / in-flight
  if (!outcome || outcome === "in_progress" || outcome === "insufficient_data") {
    return "monitor_until_more_data";
  }

  // Explicitly closed without decision
  if (outcome === "archived") return "archive_creative_outcome";

  // Failed tests — capture what went wrong
  if (outcome === "failed_test") return "capture_learning_only";

  // Low confidence across any resolved outcome → need more data
  if (confScore < 0.40) return "monitor_until_more_data";

  if (outcome === "challenger_wins") {
    return (confLevel === "high" || confLevel === "very_high")
      ? "send_winner_to_scale_review"
      : "keep_winner_running";
  }

  if (outcome === "control_holds") return "send_loser_to_creative_lab";

  if (outcome === "mixed_result" || outcome === "no_clear_winner") {
    return "send_mixed_result_to_follow_up_test";
  }

  return "capture_learning_only";
}

// ---------------------------------------------------------------------------
// Reasons
// ---------------------------------------------------------------------------

function buildRouteReasons(
  result:    CreativeTestResult,
  routeType: CreativeOutcomeRouteType,
): CreativeOutcomeReason[] {
  const reasons: CreativeOutcomeReason[] = [];
  const outcome   = result.outcome;
  const lift      = result.comparison?.primaryLift ?? null;
  const confScore = result.confidence?.score ?? 0;
  const confLevel = result.confidence?.level ?? "low";
  const window    = result.evaluationWindow;

  // Always include outcome reason
  if (outcome) {
    reasons.push({
      key:       "outcome",
      label:     "Test Outcome",
      detail:    outcomeDetail(outcome, lift, result.primaryMetric),
      isBlocker: false,
    });
  }

  // Confidence reason
  reasons.push({
    key:       "confidence",
    label:     "Confidence Level",
    detail:    `${confLevel} confidence (${(confScore * 100).toFixed(0)}% score)`,
    isBlocker: confScore < 0.40,
  });

  // Evaluation window
  if (window) {
    reasons.push({
      key:       "window",
      label:     "Evaluation Window",
      detail:    window.isComplete
        ? `${window.windowDays}-day window complete`
        : `${window.progressPct}% of ${window.windowDays}-day window elapsed`,
      isBlocker: !window.isComplete && routeType === "send_winner_to_scale_review",
    });
  }

  // Route-specific reasons
  if (routeType === "send_winner_to_scale_review") {
    reasons.push({
      key:       "scale_ready",
      label:     "Scale Readiness",
      detail:    "High confidence win — ready for scale review with existing approval workflow.",
      isBlocker: false,
    });
  }

  if (routeType === "keep_winner_running") {
    reasons.push({
      key:       "more_data_needed",
      label:     "More Data Needed",
      detail:    "Challenger is ahead but confidence is below the threshold for scale recommendation.",
      isBlocker: true,
    });
  }

  if (routeType === "send_loser_to_creative_lab") {
    reasons.push({
      key:       "iterate",
      label:     "Creative Iteration Required",
      detail:    "Control held — challenger did not meet the success threshold. Brief can be iterated.",
      isBlocker: false,
    });
  }

  if (routeType === "send_mixed_result_to_follow_up_test") {
    reasons.push({
      key:       "conflicting_signals",
      label:     "Conflicting Signals",
      detail:    "Primary metric is inconclusive or secondary metrics diverge. A follow-up test with tighter criteria is recommended.",
      isBlocker: false,
    });
  }

  // Guardrail breaches
  const breaches = result.comparison?.guardrailBreaches ?? [];
  for (const breach of breaches) {
    reasons.push({
      key:       `guardrail_${breach.replace(/\s+/g, "_").toLowerCase()}`,
      label:     "Guardrail Breach",
      detail:    breach,
      isBlocker: true,
    });
  }

  // Outcome reasons from test
  for (const r of result.outcomeReasons) {
    reasons.push({
      key:       r.key,
      label:     r.label,
      detail:    r.description,
      isBlocker: false,
    });
  }

  return reasons;
}

function outcomeDetail(outcome: string, lift: number | null, metric: string): string {
  const liftStr = lift != null
    ? ` (${lift > 0 ? "+" : ""}${(lift * 100).toFixed(1)}% on ${metric})`
    : "";
  const labels: Record<string, string> = {
    challenger_wins:    `Challenger won${liftStr}`,
    control_holds:      `Control held — challenger did not meet threshold${liftStr}`,
    no_clear_winner:    `No clear winner${liftStr}`,
    mixed_result:       `Mixed signals${liftStr}`,
    insufficient_data:  "Insufficient data to evaluate",
    in_progress:        "Test still in progress",
    failed_test:        "Test failed — guardrail or data issue",
    archived:           "Test archived without decision",
  };
  return labels[outcome] ?? outcome;
}

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

function buildRouteEvidence(result: CreativeTestResult): Record<string, unknown> {
  return {
    primaryMetric:    result.primaryMetric,
    primaryLift:      result.comparison?.primaryLift ?? null,
    primaryDelta:     result.comparison?.primaryDelta ?? null,
    confidenceScore:  result.confidence?.score ?? null,
    confidenceLevel:  result.confidence?.level ?? null,
    windowComplete:   result.evaluationWindow?.isComplete ?? false,
    windowProgressPct: result.evaluationWindow?.progressPct ?? null,
    guardrailBreaches: result.comparison?.guardrailBreaches ?? [],
    controlSnapshot:  result.controlSnapshot
      ? { roas: result.controlSnapshot.roas, spend: result.controlSnapshot.spend, orders: result.controlSnapshot.orders }
      : null,
    challengerSnapshot: result.challengerSnapshot
      ? { roas: result.challengerSnapshot.roas, spend: result.challengerSnapshot.spend, orders: result.challengerSnapshot.orders }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Next action
// ---------------------------------------------------------------------------

function buildNextAction(
  routeType: CreativeOutcomeRouteType,
  result:    CreativeTestResult,
): { nextActionLabel: string; nextActionHint: string; linkedWorkflow: string | null } {
  switch (routeType) {
    case "send_winner_to_scale_review":
      return {
        nextActionLabel: "Send to Scale Review",
        nextActionHint:  "Submit this winning creative for scale approval through the existing governance workflow.",
        linkedWorkflow:  result.experimentId
          ? `/experiments?highlight=${result.experimentId}`
          : "/experiments",
      };

    case "keep_winner_running":
      return {
        nextActionLabel: "Keep Running",
        nextActionHint:  "Continue the test — check back when the evaluation window completes or confidence improves.",
        linkedWorkflow:  `/creative-lab/results`,
      };

    case "send_loser_to_creative_lab":
      return {
        nextActionLabel: "Iterate in Creative Lab",
        nextActionHint:  "Send this challenger back to the Creative Lab for a new iteration using the captured learning.",
        linkedWorkflow:  result.briefId
          ? `/creative-lab?briefId=${result.briefId}`
          : "/creative-lab",
      };

    case "send_mixed_result_to_follow_up_test":
      return {
        nextActionLabel: "Create Follow-Up Test",
        nextActionHint:  "Design a more targeted test based on the signals from this run.",
        linkedWorkflow:  result.prepItemId
          ? `/creative-lab/launch?prepItemId=${result.prepItemId}`
          : "/creative-lab/launch",
      };

    case "monitor_until_more_data":
      return {
        nextActionLabel: "Monitor",
        nextActionHint:  "Re-ingest when the evaluation window completes or more data is available.",
        linkedWorkflow:  `/creative-lab/results`,
      };

    case "capture_learning_only":
      return {
        nextActionLabel: "Capture Learning",
        nextActionHint:  "Save this outcome as a learning record for future brief generation and scoring.",
        linkedWorkflow:  "/insights/memory",
      };

    case "archive_creative_outcome":
      return {
        nextActionLabel: "Archive",
        nextActionHint:  "This outcome has been archived. No further action required.",
        linkedWorkflow:  null,
      };
  }
}
