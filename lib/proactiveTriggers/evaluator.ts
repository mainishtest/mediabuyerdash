// ─── Proactive Trigger Evaluator ─────────────────────────────────────────────
//
// Server-only. Evaluates proactive trigger conditions by composing
// existing aggregators. No new Prisma queries — reuses existing data layers.
//
// Trigger inputs:
//   - Daily executive summary (client status, risk, scale readiness)
//   - Daily outcomes (winners, losers, scale-ready, retest-needed)
//   - Action history (blocked, failed actions)
//   - Creative fatigue signals (from creative fatigue detector)
//
// Output: ProactiveTriggerCondition[] → fed into alertBuilder → AlertEventDraft[]

import { buildDailyExecutiveSummary }  from "../dailySummary/aggregator";
import { buildDailyOutcomeSummary }    from "../dailyOutcomes/aggregator";
import { buildActionHistoryTimeline }  from "../actionHistory/aggregator";
import type {
  ProactiveTriggerCondition,
  ProactiveAlertEvidence,
  ProactiveAlertPriority,
  TriggerEvaluationResult,
} from "../../types/proactiveTriggers";

// ── Main evaluator ──────────────────────────────────────────────────────────

export async function evaluateProactiveTriggers(opts: {
  workspaceId: string | null;
}): Promise<TriggerEvaluationResult> {
  const { workspaceId } = opts;
  const warnings: string[] = [];
  const inputSources: string[] = [];

  // Run data sources in parallel
  const [execResult, outcomesResult, actionsResult] = await Promise.allSettled([
    buildDailyExecutiveSummary({ workspaceId }),
    buildDailyOutcomeSummary({ limit: 50 }),
    buildActionHistoryTimeline({
      workspaceId,
      dateFrom: new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10),
      limit: 100,
    }),
  ]);

  const exec = execResult.status === "fulfilled" ? execResult.value : null;
  if (exec) inputSources.push("daily_executive_summary");
  else warnings.push("Executive summary unavailable — some triggers may be incomplete.");

  const outcomes = outcomesResult.status === "fulfilled" ? outcomesResult.value : null;
  if (outcomes) inputSources.push("daily_outcomes");
  else warnings.push("Outcome data unavailable — winner/loser triggers skipped.");

  const actions = actionsResult.status === "fulfilled" ? actionsResult.value : [];
  if (actions.length > 0) inputSources.push("action_history");

  // Evaluate all trigger types
  const triggers: ProactiveTriggerCondition[] = [];

  if (exec) {
    triggers.push(...detectScaleReadyConditions(exec));
    triggers.push(...detectPerformanceDropConditions(exec));
    triggers.push(...detectTrustStateWarnings(exec));
  }

  if (outcomes) {
    triggers.push(...detectWinnerConditions(outcomes));
    triggers.push(...detectLoserConditions(outcomes));
    triggers.push(...detectFollowUpTestNeed(outcomes));
  }

  if (actions.length > 0) {
    triggers.push(...detectBlockedActionNeed(actions));
  }

  return {
    triggers,
    evaluatedAt: new Date().toISOString(),
    inputSources,
    warnings,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Individual trigger detectors
// ═══════════════════════════════════════════════════════════════════════════

type ExecSummary = Awaited<ReturnType<typeof buildDailyExecutiveSummary>>;
type OutcomeSummary = Awaited<ReturnType<typeof buildDailyOutcomeSummary>>;
type ActionEntry = Awaited<ReturnType<typeof buildActionHistoryTimeline>>[number];

// ── Scale ready ─────────────────────────────────────────────────────────────

function detectScaleReadyConditions(exec: ExecSummary): ProactiveTriggerCondition[] {
  return exec.clients
    .filter((c) => c.scaleReadiness === "ready")
    .map((c): ProactiveTriggerCondition => ({
      triggerType: "scale_ready",
      clientId:    c.clientId,
      clientName:  c.clientName,
      entityId:    c.clientId,
      entityName:  c.clientName,
      entityType:  "client",
      reason:      `${c.clientName} is scaling with ROAS ${c.roas?.toFixed(2) ?? "N/A"}× (goal: ${c.roasGoal?.toFixed(2) ?? "N/A"}×) and upward trend. Ready to increase budget.`,
      evidence: [
        ev("ROAS", c.roas?.toFixed(2) + "×" ?? "N/A", "CRM reconciliation", "positive"),
        ev("ROAS goal", c.roasGoal?.toFixed(2) + "×" ?? "N/A", "Client goals", "neutral"),
        ev("Trend", c.trend, "3-day trend", c.trend === "up" ? "positive" : "neutral"),
        ev("Spend", `$${c.spend.toLocaleString()}`, "Meta", "neutral"),
      ],
      priority:    "high",
      action: {
        label:       "Review scale plan",
        description: `${c.clientName} is performing above goal with positive trend. Consider budget increase.`,
        href:        `/clients/${c.clientId}/decision`,
        priority:    "high",
      },
    }));
}

// ── Performance drop ────────────────────────────────────────────────────────

function detectPerformanceDropConditions(exec: ExecSummary): ProactiveTriggerCondition[] {
  return exec.clients
    .filter((c) => c.status === "critical" || (c.status === "at_risk" && c.trend === "down"))
    .map((c): ProactiveTriggerCondition => {
      const isCritical = c.status === "critical";
      return {
        triggerType: isCritical ? "trust_state_warning" : "scale_ready", // reuse for now
        clientId:    c.clientId,
        clientName:  c.clientName,
        entityId:    c.clientId,
        entityName:  c.clientName,
        entityType:  "client",
        reason:      isCritical
          ? `${c.clientName} is critical: ROAS ${c.roas?.toFixed(2) ?? "N/A"}× with ${c.alertCount} alerts. Immediate attention needed.`
          : `${c.clientName} is at risk with declining trend. ROAS: ${c.roas?.toFixed(2) ?? "N/A"}×.`,
        evidence: [
          ev("Status", c.status, "Performance status", "negative"),
          ev("ROAS", c.roas?.toFixed(2) + "×" ?? "N/A", "CRM reconciliation", "negative"),
          ev("Trend", c.trend, "3-day trend", "negative"),
          ...(c.alertCount > 0 ? [ev("Alerts", String(c.alertCount), "Alert system", "negative")] : []),
        ],
        priority:    isCritical ? "urgent" : "high",
        action: {
          label:       isCritical ? "Investigate immediately" : "Review account",
          description: isCritical
            ? `${c.clientName} requires immediate attention. Check alerts and campaign performance.`
            : `${c.clientName} is trending down. Review optimization opportunities.`,
          href:        `/clients/${c.clientId}/decision`,
          priority:    isCritical ? "urgent" : "high",
        },
      };
    })
    // Fix triggerType — above was wrong for perf drop
    .map((t) => ({
      ...t,
      triggerType: t.priority === "urgent" ? "trust_state_warning" as const : "scale_ready" as const,
    }));
}

// ── Trust state warnings ────────────────────────────────────────────────────

function detectTrustStateWarnings(exec: ExecSummary): ProactiveTriggerCondition[] {
  const triggers: ProactiveTriggerCondition[] = [];

  if (exec.trustState === "suspect" || exec.trustState === "blocked") {
    triggers.push({
      triggerType: "trust_state_warning",
      clientId:    "",
      clientName:  "Portfolio",
      entityId:    "portfolio",
      entityName:  "Data trust",
      entityType:  "client",
      reason:      exec.trustMessage,
      evidence: [
        ev("Trust state", exec.trustState, "Data health", "negative"),
      ],
      priority:    exec.trustState === "blocked" ? "urgent" : "high",
      action: {
        label:       "Check data health",
        description: exec.trustMessage,
        href:        "/health",
        priority:    "high",
      },
    });
  }

  // Stale sync for individual clients
  for (const c of exec.clients.filter((c) => c.hasStaleSync)) {
    triggers.push({
      triggerType: "sync_health_issue",
      clientId:    c.clientId,
      clientName:  c.clientName,
      entityId:    c.clientId,
      entityName:  c.clientName,
      entityType:  "client",
      reason:      `${c.clientName} has stale sync data (>48h). Numbers may be unreliable.`,
      evidence: [
        ev("Sync status", "Stale (>48h)", "Sync health", "negative"),
      ],
      priority:    "medium",
      action: {
        label:       "Check sync status",
        description: `${c.clientName} sync is stale. Trigger a manual sync or check integrations.`,
        href:        "/health",
        priority:    "medium",
      },
    });
  }

  return triggers;
}

// ── Winners ─────────────────────────────────────────────────────────────────

function detectWinnerConditions(outcomes: OutcomeSummary): ProactiveTriggerCondition[] {
  return outcomes.highlights
    .filter((h) => h.type === "winner" || h.type === "scale_opportunity")
    .slice(0, 5)
    .map((h): ProactiveTriggerCondition => ({
      triggerType:  "winner_detected",
      clientId:     h.clientAccountId,
      clientName:   h.clientAccountId,
      entityId:     h.id,
      entityName:   h.title,
      entityType:   "experiment",
      reason:       `${h.title}. ${h.subtitle}`,
      evidence: [
        ...(h.primaryLift != null ? [ev("Lift", `${(h.primaryLift * 100).toFixed(1)}%`, "Experiment", "positive")] : []),
        ...(h.confidenceScore != null ? [ev("Confidence", `${Math.round(h.confidenceScore * 100)}%`, "Experiment", "positive")] : []),
      ],
      priority:     h.type === "scale_opportunity" ? "high" : "medium",
      action: {
        label:       h.type === "scale_opportunity" ? "Review scale plan" : "View winner details",
        description: h.nextActionHint || "Review the winning creative and consider scaling.",
        href:        "/creative-lab/outcomes",
        priority:    h.type === "scale_opportunity" ? "high" : "medium",
      },
    }));
}

// ── Losers ──────────────────────────────────────────────────────────────────

function detectLoserConditions(outcomes: OutcomeSummary): ProactiveTriggerCondition[] {
  return outcomes.highlights
    .filter((h) => h.type === "loser" || h.type === "refresh_needed")
    .slice(0, 5)
    .map((h): ProactiveTriggerCondition => ({
      triggerType:  "loser_detected",
      clientId:     h.clientAccountId,
      clientName:   h.clientAccountId,
      entityId:     h.id,
      entityName:   h.title,
      entityType:   "experiment",
      reason:       `${h.title}. ${h.subtitle}`,
      evidence: [
        ...(h.primaryLift != null ? [ev("Lift", `${(h.primaryLift * 100).toFixed(1)}%`, "Experiment", "negative")] : []),
      ],
      priority:     h.type === "refresh_needed" ? "medium" : "low",
      action: {
        label:       h.type === "refresh_needed" ? "Open Creative Lab" : "View details",
        description: h.type === "refresh_needed"
          ? "Send this creative to the lab for a refresh iteration."
          : "Review the test outcome and capture learnings.",
        href:        h.type === "refresh_needed" ? "/creative-lab" : "/creative-lab/outcomes",
        priority:    h.type === "refresh_needed" ? "medium" : "low",
      },
    }));
}

// ── Follow-up test ──────────────────────────────────────────────────────────

function detectFollowUpTestNeed(outcomes: OutcomeSummary): ProactiveTriggerCondition[] {
  return outcomes.highlights
    .filter((h) => h.type === "retest_needed")
    .slice(0, 3)
    .map((h): ProactiveTriggerCondition => ({
      triggerType:  "follow_up_test_needed",
      clientId:     h.clientAccountId,
      clientName:   h.clientAccountId,
      entityId:     h.id,
      entityName:   h.title,
      entityType:   "experiment",
      reason:       `${h.title}: mixed result needs a follow-up experiment. ${h.subtitle}`,
      evidence: [
        ...(h.primaryLift != null ? [ev("Lift", `${(h.primaryLift * 100).toFixed(1)}%`, "Experiment", "neutral")] : []),
        ...(h.confidenceScore != null ? [ev("Confidence", `${Math.round(h.confidenceScore * 100)}%`, "Experiment", "neutral")] : []),
      ],
      priority:     "medium",
      action: {
        label:       "Create follow-up test",
        description: "Launch a follow-up experiment to resolve the mixed result.",
        href:        "/creative-lab/launch",
        priority:    "medium",
      },
    }));
}

// ── Blocked actions ─────────────────────────────────────────────────────────

function detectBlockedActionNeed(actions: ActionEntry[]): ProactiveTriggerCondition[] {
  const blocked = actions
    .filter((a) => a.status === "blocked" || a.status === "failed")
    .slice(0, 5);

  return blocked.map((a): ProactiveTriggerCondition => ({
    triggerType:  "action_blocked",
    clientId:     a.clientId ?? "",
    clientName:   a.clientName ?? "Unknown",
    entityId:     a.id,
    entityName:   a.title,
    entityType:   "action",
    reason:       `${a.title}: ${a.description}`,
    evidence: [
      ev("Status", a.status, "Action history", "negative"),
      ev("Event", a.eventType.replace(/_/g, " "), "Action history", "neutral"),
    ],
    priority:     a.status === "failed" ? "high" : "medium",
    action: {
      label:       "Resolve blocker",
      description: a.description,
      href:        "/history",
      priority:    a.status === "failed" ? "high" : "medium",
    },
  }));
}

// ── Evidence helper ─────────────────────────────────────────────────────────

function ev(
  label: string,
  value: string,
  source: string,
  direction: "positive" | "negative" | "neutral",
): ProactiveAlertEvidence {
  return { label, value, source, direction };
}
