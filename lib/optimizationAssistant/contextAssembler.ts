// ─── Optimization Assistant — Context Assembler ───────────────────────────────
//
// Server-side only. Pulls data from existing aggregators in parallel and
// compresses it into the OptimizationAssistantContext shape.
// No new Prisma queries — reuses existing aggregation layers.

import { buildCommandCenterPayload } from "../commandCenter/aggregator";
import { buildExecutiveSummary }     from "../executiveReporting/aggregator";
import {
  queryLearningMemory,
  buildLearningInsightSummary,
} from "../learningMemory/aggregator";
import type { OptimizationAssistantContext } from "./types";

// ── Defaults ──────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Main assembler ────────────────────────────────────────────────────────────

export async function buildOptimizationAssistantContext(params: {
  clientId?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<OptimizationAssistantContext> {
  const dateFrom = params.dateFrom ?? daysAgo(30);
  const dateTo   = params.dateTo   ?? todayStr();
  const { clientId } = params;

  const dataWarnings: string[] = [];

  // ── Parallel fetch from existing aggregators ───────────────────────────────
  const [ccResult, execResult, learningsResult] = await Promise.allSettled([
    buildCommandCenterPayload({ clientId, dateFrom, dateTo }),
    buildExecutiveSummary({ clientId, dateFrom, dateTo, compareWithPrevious: false }),
    queryLearningMemory({ clientId, dateFrom, dateTo, limit: 15 }),
  ]);

  // ── Unpack command center ──────────────────────────────────────────────────
  const cc = ccResult.status === "fulfilled"
    ? ccResult.value
    : (() => {
        dataWarnings.push("Command center data unavailable — some context may be missing.");
        return null;
      })();

  // ── Unpack executive reporting ────────────────────────────────────────────
  const exec = execResult.status === "fulfilled"
    ? execResult.value
    : (() => {
        dataWarnings.push("Executive KPI data unavailable — trend context may be missing.");
        return null;
      })();

  // ── Unpack learning memory ────────────────────────────────────────────────
  const learnings = learningsResult.status === "fulfilled"
    ? learningsResult.value
    : (() => {
        dataWarnings.push("Learning memory unavailable — pattern context missing.");
        return [];
      })();

  // ── Resolve client name ───────────────────────────────────────────────────
  const clientName = clientId
    ? cc?.clients.find((c) => c.id === clientId)?.name
    : undefined;

  // ── Summary ───────────────────────────────────────────────────────────────
  const summary = {
    totalSpend:        cc?.summary.totalSpend        ?? 0,
    totalRevenue:      cc?.summary.totalRevenue      ?? 0,
    overallRoas:       cc?.summary.overallRoas       ?? null,
    overallCpa:        cc?.summary.overallCpa        ?? null,
    activeClientsCount:cc?.summary.activeClientsCount ?? 0,
    openAlerts:        cc?.summary.unresolvedAlertsCount ?? 0,
    pendingApprovals:  cc?.summary.pendingApprovalsCount ?? 0,
    activeExperiments: cc?.summary.activeExperimentsCount ?? 0,
    pacingRisksCount:  cc?.summary.pacingRisksCount  ?? 0,
  };

  // Warn on sparse data
  if (summary.totalSpend === 0 && summary.totalRevenue === 0) {
    dataWarnings.push("No spend or revenue data found for this period. Data may not be synced yet.");
  }

  const learningSummary = learnings.length > 0
    ? buildLearningInsightSummary(learnings)
    : "No learning memory entries available for this period.";

  return {
    clientId,
    clientName,
    dateFrom,
    dateTo,
    summary,
    topPriorities:  cc?.priorities.slice(0, 5)    ?? [],
    alerts:         cc?.alertItems                  ?? [],
    approvals:      cc?.approvals                   ?? [],
    experiments:    cc?.experiments                 ?? [],
    creativeItems:  cc?.creativeItems               ?? [],
    pacingItems:    cc?.pacingItems                 ?? [],
    kpis:           exec?.kpiCards                  ?? [],
    narrative:      exec?.narrative,
    learnings,
    learningSummary,
    dataWarnings,
    assembledAt: new Date().toISOString(),
  };
}
