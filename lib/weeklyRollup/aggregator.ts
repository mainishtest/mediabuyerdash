// ─── Weekly Strategy Rollup — Server-Only Aggregator ─────────────────────────
//
// Composes existing aggregators with week-scoped date ranges:
//   - buildDailyExecutiveSummary()  → spend/revenue/ROAS/CPA + client status
//   - buildDailyOutcomeSummary()    → winners/losers/scale-ready highlights
//   - buildActionHistoryTimeline()  → actions taken this week
//   - queryLearningMemory()         → learnings and creative patterns
//
// NO new data tables. NO side effects. Pure read-only aggregation.
// CRM/Shopify is the source of truth for ROAS and CPA.

import { prisma } from "../db";
import { buildDailyExecutiveSummary }       from "../dailySummary/aggregator";
import { buildDailyOutcomeSummary }         from "../dailyOutcomes/aggregator";
import { buildActionHistoryTimeline }       from "../actionHistory/aggregator";
import { buildActionHistorySummary }        from "../actionHistory/utils";
import { queryLearningMemory, buildLearningSummary } from "../learningMemory/aggregator";
import { extractLearningPatterns }          from "../learningMemory/patterns";
import type {
  WeeklyStrategyRollup,
  WeeklyRollupSummary,
  WeeklyWinnerSummary,
  WeeklyLoserSummary,
  WeeklyExperimentSummary,
  WeeklyCreativePattern,
  WeeklyScaleOpportunity,
  WeeklyDeclineSignal,
  WeeklyNextStep,
  WeeklyRollupEvidenceLink,
} from "../../types/weeklyRollup";

// ── Date helpers ────────────────────────────────────────────────────────────

function getWeekBounds(referenceDate?: Date): { weekStart: string; weekEnd: string; weekLabel: string } {
  const ref = referenceDate ?? new Date();
  const day = ref.getDay();
  // Monday = start of week
  const monday = new Date(ref);
  monday.setDate(ref.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const weekStart = monday.toISOString().slice(0, 10);
  const weekEnd   = sunday.toISOString().slice(0, 10);
  const weekLabel = `${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}–${sunday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  return { weekStart, weekEnd, weekLabel };
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

// ── Main builder ────────────────────────────────────────────────────────────

export async function buildWeeklyStrategyRollup(opts: {
  workspaceId: string | null;
  weekOffset?: number;  // 0 = current, 1 = last week, etc.
}): Promise<WeeklyStrategyRollup> {
  const { workspaceId, weekOffset = 1 } = opts;

  // Compute week bounds (default: last week)
  const refDate = new Date();
  refDate.setDate(refDate.getDate() - weekOffset * 7);
  const { weekStart, weekEnd, weekLabel } = getWeekBounds(refDate);

  // Run all data sources in parallel
  const [execSummary, outcomes, actionEntries, learnings, experiments] = await Promise.all([
    buildDailyExecutiveSummary({ workspaceId }),
    buildDailyOutcomeSummary({ limit: 50 }),
    buildActionHistoryTimeline({ workspaceId, dateFrom: weekStart, dateTo: weekEnd, limit: 200 }),
    queryLearningMemory({ dateFrom: weekStart, dateTo: weekEnd, limit: 100 }),
    loadExperiments(weekStart, weekEnd),
  ]);

  const actionSummary = buildActionHistorySummary(actionEntries);

  // ── Build sections ────────────────────────────────────────────────────
  const winners          = buildWeeklyWinners(outcomes);
  const losers           = buildWeeklyLosers(outcomes);
  const experimentsList  = buildWeeklyExperiments(experiments);
  const creativePatterns = buildWeeklyPatterns(learnings);
  const scaleOpps        = buildWeeklyScaleOpportunities(execSummary);
  const declines         = buildWeeklyDeclineSignals(execSummary);
  const nextSteps        = buildWeeklyNextSteps(execSummary, outcomes, winners, losers, declines);

  // ── Summary ───────────────────────────────────────────────────────────
  const { portfolio } = execSummary;
  const topLine = buildTopLineMessage(winners, losers, scaleOpps, declines, experimentsList);
  const isSparse = actionEntries.length < 3 && winners.length === 0 && losers.length === 0;

  const summary: WeeklyRollupSummary = {
    weekLabel,
    totalSpend:         portfolio.totalSpend,
    totalRevenue:       portfolio.totalRevenue,
    blendedRoas:        portfolio.blendedRoas,
    blendedCpa:         portfolio.blendedCpa,
    winnersCount:       winners.length,
    losersCount:        losers.length,
    experimentsRun:     experimentsList.length,
    patternsFound:      creativePatterns.length,
    scaleOpportunities: scaleOpps.length,
    declineSignals:     declines.length,
    nextStepsCount:     nextSteps.length,
    actionsThisWeek:    actionSummary.totalEntries,
    topLineMessage:     topLine,
  };

  return {
    id:               `weekly_${weekStart}_${Date.now()}`,
    weekStart,
    weekEnd,
    generatedAt:      new Date().toISOString(),
    workspaceId,
    summary,
    winners,
    losers,
    experiments:      experimentsList,
    creativePatterns,
    scaleOpportunities: scaleOpps,
    declineSignals:   declines,
    nextSteps,
    isSparse,
    trustMessage:     execSummary.trustState !== "healthy" ? execSummary.trustMessage : null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Section builders
// ═══════════════════════════════════════════════════════════════════════════

// ── Winners ─────────────────────────────────────────────────────────────────

type OutcomeSummary = Awaited<ReturnType<typeof buildDailyOutcomeSummary>>;

function buildWeeklyWinners(outcomes: OutcomeSummary): WeeklyWinnerSummary[] {
  return outcomes.highlights
    .filter((h) => h.type === "winner" || h.type === "scale_opportunity")
    .slice(0, 10)
    .map((h): WeeklyWinnerSummary => ({
      id:         h.id,
      title:      h.title,
      subtitle:   h.subtitle,
      lift:       h.primaryLift,
      confidence: h.confidenceScore,
      clientName: h.clientAccountId,
      scaleReady: h.type === "scale_opportunity",
      evidence:   [{
        entityType: "outcome",
        entityId:   h.id,
        label:      h.nextActionLabel,
        href:       "/creative-lab/outcomes",
      }],
      href:       "/creative-lab/outcomes",
    }));
}

// ── Losers ──────────────────────────────────────────────────────────────────

function buildWeeklyLosers(outcomes: OutcomeSummary): WeeklyLoserSummary[] {
  return outcomes.highlights
    .filter((h) => h.type === "loser" || h.type === "refresh_needed")
    .slice(0, 10)
    .map((h): WeeklyLoserSummary => ({
      id:            h.id,
      title:         h.title,
      subtitle:      h.subtitle,
      lift:          h.primaryLift,
      confidence:    h.confidenceScore,
      clientName:    h.clientAccountId,
      refreshQueued: h.type === "refresh_needed",
      evidence:      [{
        entityType: "outcome",
        entityId:   h.id,
        label:      h.nextActionLabel,
        href:       "/creative-lab/outcomes",
      }],
      href:          "/creative-lab/outcomes",
    }));
}

// ── Experiments ─────────────────────────────────────────────────────────────

async function loadExperiments(weekStart: string, weekEnd: string): Promise<any[]> {
  try {
    return await prisma.experimentRecord.findMany({
      where: {
        OR: [
          { startedAt: { gte: new Date(weekStart), lte: new Date(weekEnd + "T23:59:59Z") } },
          { completedAt: { gte: new Date(weekStart), lte: new Date(weekEnd + "T23:59:59Z") } },
          { status: "active", startedAt: { lte: new Date(weekEnd + "T23:59:59Z") } },
        ],
      },
      include: {
        results: { take: 1 },
        learnings: { take: 3 },
      },
      orderBy: { startedAt: "desc" },
      take: 20,
    });
  } catch {
    return [];
  }
}

function buildWeeklyExperiments(experiments: any[]): WeeklyExperimentSummary[] {
  return experiments.map((e): WeeklyExperimentSummary => {
    const result   = e.results?.[0] ?? null;
    const learning = e.learnings?.[0] ?? null;
    const days     = Math.floor((Date.now() - new Date(e.startedAt).getTime()) / 86_400_000);

    return {
      id:             e.id,
      name:           e.name,
      status:         e.status,
      outcome:        result?.outcome ?? null,
      winningVariant: result?.winningVariant ?? null,
      clientName:     e.clientAccountId,
      daysRunning:    days,
      insightText:    learning?.insightText ?? null,
      evidence: [{
        entityType: "experiment",
        entityId:   e.id,
        label:      e.name,
        href:       "/creative-lab/results",
      }],
      href:           "/creative-lab/results",
    };
  });
}

// ── Creative patterns ───────────────────────────────────────────────────────

function buildWeeklyPatterns(
  learnings: Awaited<ReturnType<typeof queryLearningMemory>>,
): WeeklyCreativePattern[] {
  const patterns = extractLearningPatterns(learnings);

  return patterns.slice(0, 8).map((p, i): WeeklyCreativePattern => ({
    id:             `pattern_${i}`,
    patternLabel:   p.patternLabel,
    category:       p.category,
    occurrences:    p.occurrences,
    confidence:     p.confidence,
    exampleInsight: p.exampleInsight,
    clientNames:    p.clientNames,
    evidence: [{
      entityType: "learning",
      entityId:   `pattern_${p.category}_${p.patternLabel}`,
      label:      p.exampleInsight.slice(0, 80),
      href:       "/insights/memory",
    }],
  }));
}

// ── Scale opportunities ─────────────────────────────────────────────────────

type ExecSummary = Awaited<ReturnType<typeof buildDailyExecutiveSummary>>;

function buildWeeklyScaleOpportunities(exec: ExecSummary): WeeklyScaleOpportunity[] {
  return exec.clients
    .filter((c) => c.scaleReadiness === "ready" || (c.scaleReadiness === "possible" && c.trend === "up"))
    .map((c): WeeklyScaleOpportunity => {
      const reason = c.scaleReadiness === "ready"
        ? `ROAS ${c.roas?.toFixed(2) ?? "N/A"} above goal ${c.roasGoal?.toFixed(2) ?? "N/A"} with upward trend`
        : `Stable performance with positive trend — possible scale candidate`;

      return {
        id:          `scale_${c.clientId}`,
        clientName:  c.clientName,
        reason,
        currentRoas: c.roas,
        roasGoal:    c.roasGoal,
        spend:       c.spend,
        evidence: [{
          entityType: "campaign",
          entityId:   c.clientId,
          label:      `${c.clientName} — ${c.status}`,
          href:       c.href,
        }],
        href:        c.href,
      };
    });
}

// ── Decline signals ─────────────────────────────────────────────────────────

function buildWeeklyDeclineSignals(exec: ExecSummary): WeeklyDeclineSignal[] {
  return exec.clients
    .filter((c) => c.status === "at_risk" || c.status === "critical")
    .map((c): WeeklyDeclineSignal => {
      const signal = c.status === "critical"
        ? `Critical: ROAS ${c.roas?.toFixed(2) ?? "N/A"} well below goal. ${c.alertCount} alerts.`
        : `At risk: ROAS trending ${c.trend}, ${c.alertCount > 0 ? `${c.alertCount} alerts` : "needs attention"}`;

      return {
        id:         `decline_${c.clientId}`,
        clientName: c.clientName,
        signal,
        severity:   c.status === "critical" ? "high" : "medium",
        evidence: [{
          entityType: "campaign",
          entityId:   c.clientId,
          label:      `${c.clientName} — ${c.status}`,
          href:       c.href,
        }],
        href:       c.href,
      };
    });
}

// ── Next steps (evidence-backed) ────────────────────────────────────────────

function buildWeeklyNextSteps(
  exec:     ExecSummary,
  outcomes: OutcomeSummary,
  winners:  WeeklyWinnerSummary[],
  losers:   WeeklyLoserSummary[],
  declines: WeeklyDeclineSignal[],
): WeeklyNextStep[] {
  const steps: WeeklyNextStep[] = [];
  let seq = 0;

  // Scale winners
  for (const w of winners.filter((w) => w.scaleReady).slice(0, 3)) {
    steps.push({
      id:          `next_${seq++}`,
      label:       `Scale winning creative for ${w.clientName}`,
      description: `${w.title} shows ${w.lift != null ? `+${(w.lift * 100).toFixed(0)}% lift` : "strong performance"}. Review scale plan.`,
      priority:    "high",
      category:    "scale",
      clientName:  w.clientName,
      evidence:    w.evidence,
      href:        "/creative-lab/outcomes",
    });
  }

  // Investigate declines
  for (const d of declines.filter((d) => d.severity === "high").slice(0, 3)) {
    steps.push({
      id:          `next_${seq++}`,
      label:       `Investigate ${d.clientName} decline`,
      description: d.signal,
      priority:    "high",
      category:    "investigate",
      clientName:  d.clientName,
      evidence:    d.evidence,
      href:        d.href,
    });
  }

  // Refresh losers
  for (const l of losers.filter((l) => l.refreshQueued).slice(0, 3)) {
    steps.push({
      id:          `next_${seq++}`,
      label:       `Create refresh for ${l.clientName}`,
      description: `${l.title} underperformed. Send to Creative Lab for a new iteration.`,
      priority:    "medium",
      category:    "refresh",
      clientName:  l.clientName,
      evidence:    l.evidence,
      href:        "/creative-lab",
    });
  }

  // Follow-up tests for retest-needed outcomes
  for (const h of outcomes.highlights.filter((h) => h.type === "retest_needed").slice(0, 3)) {
    steps.push({
      id:          `next_${seq++}`,
      label:       `Create follow-up test for ${h.clientAccountId}`,
      description: `${h.title}: mixed result needs a follow-up experiment.`,
      priority:    "medium",
      category:    "test",
      clientName:  h.clientAccountId,
      evidence: [{
        entityType: "outcome",
        entityId:   h.id,
        label:      h.nextActionLabel,
        href:       "/creative-lab/outcomes",
      }],
      href:        "/creative-lab/launch",
    });
  }

  // Monitor at-risk clients
  for (const d of declines.filter((d) => d.severity === "medium").slice(0, 2)) {
    steps.push({
      id:          `next_${seq++}`,
      label:       `Monitor ${d.clientName} closely`,
      description: d.signal,
      priority:    "low",
      category:    "monitor",
      clientName:  d.clientName,
      evidence:    d.evidence,
      href:        d.href,
    });
  }

  // Sort by priority
  const ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
  steps.sort((a, b) => (ORDER[a.priority] ?? 9) - (ORDER[b.priority] ?? 9));

  return steps.slice(0, 12);
}

// ── Top-line message ────────────────────────────────────────────────────────

function buildTopLineMessage(
  winners:  WeeklyWinnerSummary[],
  losers:   WeeklyLoserSummary[],
  scaleOpps: WeeklyScaleOpportunity[],
  declines: WeeklyDeclineSignal[],
  experiments: WeeklyExperimentSummary[],
): string {
  const parts: string[] = [];

  const scaleReady = winners.filter((w) => w.scaleReady).length;
  if (scaleReady > 0) parts.push(`${scaleReady} winner${scaleReady > 1 ? "s" : ""} ready to scale`);
  else if (winners.length > 0) parts.push(`${winners.length} winner${winners.length > 1 ? "s" : ""}`);

  if (losers.length > 0) parts.push(`${losers.length} need${losers.length === 1 ? "s" : ""} refresh`);

  const highDeclines = declines.filter((d) => d.severity === "high").length;
  if (highDeclines > 0) parts.push(`${highDeclines} account${highDeclines > 1 ? "s" : ""} critical`);
  else if (declines.length > 0) parts.push(`${declines.length} at risk`);

  if (scaleOpps.length > 0) parts.push(`${scaleOpps.length} scale opportunit${scaleOpps.length > 1 ? "ies" : "y"}`);

  const completed = experiments.filter((e) => e.status === "completed").length;
  if (completed > 0) parts.push(`${completed} experiment${completed > 1 ? "s" : ""} completed`);

  return parts.length > 0
    ? parts.join(", ")
    : "Quiet week. No significant outcomes or changes detected.";
}
