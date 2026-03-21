// ─── Client Decision — Aggregator ────────────────────────────────────────────
//
// Assembles ClientDecisionSummary from Prisma queries.
// Detection and action logic live in detect.ts and actions.ts (pure).
// This module owns DB access and payload assembly only.

import { prisma } from "../db";
import { detectClientChanges, detectPerformanceDrivers } from "./detect";
import { buildClientActionRecommendations, buildClientIssues, buildClientOpportunities } from "./actions";
import type { ClientDecisionSummary, DaySnapshot } from "../../types/clientDecision";

// ── Helpers ────────────────────────────────────────────────────────────────

function dateStr(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 864e5).toISOString().slice(0, 10);
}

// ── Main builder ───────────────────────────────────────────────────────────

export async function buildClientDecisionSummary(
  clientId: string,
): Promise<ClientDecisionSummary | null> {
  const yesterday = dateStr(1);
  const priorDay  = dateStr(2);

  // ── Parallel fetch ─────────────────────────────────────────────────────

  const [
    client,
    yesterdayRecos,
    priorDayRecos,
    alerts,
    goalDefaults,
  ] = await Promise.all([

    // 1. Client account
    prisma.clientAccount.findUnique({
      where:  { id: clientId },
      select: { id: true, name: true, currency: true },
    }),

    // 2. Yesterday's reconciliation summaries
    prisma.reconciliationSummary.findMany({
      where: {
        clientAccountId: clientId,
        dateFrom: { lte: yesterday },
        dateTo:   { gte: yesterday },
      },
      select: {
        totalMetaSpend:  true,
        totalCrmRevenue: true,
        totalCrmOrders:  true,
      },
    }),

    // 3. Prior day's reconciliation summaries
    prisma.reconciliationSummary.findMany({
      where: {
        clientAccountId: clientId,
        dateFrom: { lte: priorDay },
        dateTo:   { gte: priorDay },
      },
      select: {
        totalMetaSpend:  true,
        totalCrmRevenue: true,
        totalCrmOrders:  true,
      },
    }),

    // 4. Open alerts for this client
    prisma.alertEvent.findMany({
      where: {
        clientAccountId: clientId,
        status: { in: ["open", "acknowledged"] },
      },
      select: {
        id:        true,
        severity:  true,
        summary:   true,
        alertType: true,
      },
      orderBy: { detectedAt: "desc" },
      take: 10,
    }),

    // 5. Client goal defaults
    prisma.clientGoalDefaults.findFirst({
      where:  { clientAccountId: clientId },
      select: {
        targetRoas:           true,
        targetCpa:            true,
        defaultRoasGoalValue: true,
        defaultCpaGoalValue:  true,
      },
    }),
  ]);

  if (!client) return null;

  // ── Build day snapshots ────────────────────────────────────────────────

  const yesterdaySnap = buildDaySnapshot(yesterday, yesterdayRecos);
  const priorDaySnap  = buildDaySnapshot(priorDay, priorDayRecos);

  // ── Goals ──────────────────────────────────────────────────────────────

  const roasGoal = goalDefaults?.targetRoas ?? goalDefaults?.defaultRoasGoalValue ?? null;
  const cpaGoal  = goalDefaults?.targetCpa  ?? goalDefaults?.defaultCpaGoalValue  ?? null;

  // ── Edge cases ─────────────────────────────────────────────────────────

  const noData = yesterdaySnap.spend <= 0 && yesterdaySnap.revenue <= 0;
  const hasPartialData = yesterdaySnap.spend > 0 && yesterdaySnap.revenue <= 0;
  const hasMissingGoals = roasGoal === null && cpaGoal === null;

  // ── Detect changes (Section 1: What changed) ──────────────────────────

  const changes = detectClientChanges(yesterdaySnap, priorDaySnap);

  // ── Detect drivers (Section 2: Why it changed) ────────────────────────

  const drivers = detectPerformanceDrivers({
    yesterday:       yesterdaySnap,
    priorDay:        priorDaySnap,
    roasGoal,
    cpaGoal,
    alertSummaries:  alerts.map((a) => a.summary),
    alertSeverities: alerts.map((a) => a.severity),
  });

  // ── Build issues ──────────────────────────────────────────────────────

  const issues = buildClientIssues({
    clientId,
    alertRows: alerts,
    drivers,
  });

  // ── Build opportunities ───────────────────────────────────────────────

  const opportunities = buildClientOpportunities({
    clientId,
    yesterday: yesterdaySnap,
    roasGoal,
    changes,
  });

  // ── Build actions (Section 3: What to do) ─────────────────────────────

  const actions = buildClientActionRecommendations({
    clientId,
    yesterday: yesterdaySnap,
    roasGoal,
    cpaGoal,
    changes,
    drivers,
    issues,
  });

  return {
    clientId:      client.id,
    clientName:    client.name,
    currency:      client.currency,
    generatedAt:   new Date().toISOString(),
    yesterday:     yesterdaySnap,
    priorDay:      priorDaySnap,
    roasGoal,
    cpaGoal,
    changes,
    drivers,
    actions,
    issues,
    opportunities,
    noData,
    hasPartialData,
    hasMissingGoals,
  };
}

// ── Day snapshot builder ────────────────────────────────────────────────────

function buildDaySnapshot(
  date: string,
  recos: { totalMetaSpend: number; totalCrmRevenue: number; totalCrmOrders: number }[],
): DaySnapshot {
  let spend = 0, revenue = 0, orders = 0;
  for (const r of recos) {
    spend   += r.totalMetaSpend;
    revenue += r.totalCrmRevenue;
    orders  += r.totalCrmOrders;
  }
  return {
    date,
    spend,
    revenue,
    orders,
    roas: spend > 0 ? revenue / spend : null,
    cpa:  orders > 0 ? spend / orders : null,
  };
}
