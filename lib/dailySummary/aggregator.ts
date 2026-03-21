// ─── Daily Executive Summary — Aggregator ────────────────────────────────────
//
// Assembles DailyExecutiveSummary from Prisma queries.
// Decision logic lives in status.ts (pure). This module owns DB access only.
// CRM is the source of truth for ROAS and CPA. Attribution window: 7 days.

import { prisma } from "../db";
import {
  computeClientTrend,
  computeClientPerformanceStatus,
  computeRiskLevel,
  computeScaleReadiness,
  buildClientActionRecommendations,
} from "./status";
import type {
  DailyExecutiveSummary,
  PortfolioDailySummary,
  ClientDailySummary,
} from "../../types/dailySummary";

// ── Helpers ────────────────────────────────────────────────────────────────

function dateStr(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 864e5).toISOString().slice(0, 10);
}

function formatDateLabel(dateString: string): string {
  const d = new Date(dateString + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function hoursElapsed(d: Date | string): number {
  return (Date.now() - new Date(d).getTime()) / 3_600_000;
}

// ── Main builder ───────────────────────────────────────────────────────────

export async function buildDailyExecutiveSummary(params: {
  workspaceId: string | null;
}): Promise<DailyExecutiveSummary> {
  const { workspaceId } = params;
  const yesterday = dateStr(1);

  // Dates for 3-day trend: day-3, day-2, day-1 (yesterday)
  const trendDates = [dateStr(3), dateStr(2), dateStr(1)];

  // ── Parallel fetch ─────────────────────────────────────────────────────

  const [
    clients,
    yesterdayRecos,
    trendRecos,
    rawAlerts,
    goalDefaults,
    syncRuns,
  ] = await Promise.all([

    // 1. Active clients
    prisma.clientAccount.findMany({
      where:   { status: "active" },
      select:  { id: true, name: true, currency: true },
      orderBy: { name: "asc" },
    }),

    // 2. Yesterday's reconciliation summaries (CRM source of truth)
    prisma.reconciliationSummary.findMany({
      where: {
        dateFrom: { lte: yesterday },
        dateTo:   { gte: yesterday },
      },
      select: {
        clientAccountId: true,
        totalMetaSpend:  true,
        totalCrmRevenue: true,
        totalCrmOrders:  true,
      },
    }),

    // 3. Last 3 days of recos for trend (each day separately)
    prisma.reconciliationSummary.findMany({
      where: {
        dateFrom: { gte: trendDates[0] },
        dateTo:   { lte: trendDates[2] },
      },
      select: {
        clientAccountId: true,
        dateFrom:        true,
        dateTo:          true,
        totalMetaSpend:  true,
        totalCrmRevenue: true,
        totalCrmOrders:  true,
      },
    }),

    // 4. Open/acknowledged alerts
    prisma.alertEvent.findMany({
      where:  { status: { in: ["open", "acknowledged"] } },
      select: { clientAccountId: true, severity: true },
    }),

    // 5. Client goal defaults
    prisma.clientGoalDefaults.findMany({
      select: {
        clientAccountId:      true,
        targetRoas:           true,
        targetCpa:            true,
        defaultRoasGoalValue: true,
        defaultCpaGoalValue:  true,
      },
    }),

    // 6. Most recent sync run per client
    prisma.clientSyncRun.findMany({
      where:    { status: { not: "running" } },
      select:   { clientAccountId: true, completedAt: true },
      orderBy:  { startedAt: "desc" },
      distinct: ["clientAccountId"],
    }),
  ]);

  // ── Build lookup maps ──────────────────────────────────────────────────

  // Yesterday's metrics by client
  type DayAgg = { spend: number; revenue: number; orders: number };
  const yesterdayByClient: Record<string, DayAgg> = {};
  for (const r of yesterdayRecos) {
    const cid = r.clientAccountId;
    if (!yesterdayByClient[cid]) yesterdayByClient[cid] = { spend: 0, revenue: 0, orders: 0 };
    yesterdayByClient[cid].spend   += r.totalMetaSpend;
    yesterdayByClient[cid].revenue += r.totalCrmRevenue;
    yesterdayByClient[cid].orders  += r.totalCrmOrders;
  }

  // 3-day trend data by client → per-date aggregation
  // Group by client then by date bucket
  const trendByClient: Record<string, Record<string, DayAgg>> = {};
  for (const r of trendRecos) {
    const cid = r.clientAccountId;
    // Use dateFrom as the bucket key
    const dateKey = typeof r.dateFrom === "string"
      ? r.dateFrom.slice(0, 10)
      : new Date(r.dateFrom).toISOString().slice(0, 10);
    if (!trendByClient[cid]) trendByClient[cid] = {};
    if (!trendByClient[cid][dateKey]) trendByClient[cid][dateKey] = { spend: 0, revenue: 0, orders: 0 };
    trendByClient[cid][dateKey].spend   += r.totalMetaSpend;
    trendByClient[cid][dateKey].revenue += r.totalCrmRevenue;
    trendByClient[cid][dateKey].orders  += r.totalCrmOrders;
  }

  // Alert counts by client
  const alertsByClient: Record<string, number> = {};
  for (const a of rawAlerts) {
    alertsByClient[a.clientAccountId] = (alertsByClient[a.clientAccountId] ?? 0) + 1;
  }

  // Goals by client
  type GoalAgg = { roasGoal: number | null; cpaGoal: number | null };
  const goalsByClient: Record<string, GoalAgg> = {};
  for (const g of goalDefaults) {
    goalsByClient[g.clientAccountId] = {
      roasGoal: g.targetRoas ?? g.defaultRoasGoalValue ?? null,
      cpaGoal:  g.targetCpa  ?? g.defaultCpaGoalValue  ?? null,
    };
  }

  // Sync state by client
  const syncByClient: Record<string, Date | null> = {};
  for (const s of syncRuns) {
    syncByClient[s.clientAccountId] = s.completedAt;
  }

  // ── Build client daily summaries ───────────────────────────────────────

  let hasAnyData = false;
  let hasPartialCrm = false;
  let hasMissingGoals = false;
  let hasStaleSync = false;

  const clientSummaries: ClientDailySummary[] = clients.map((client) => {
    const cid = client.id;
    const day = yesterdayByClient[cid] ?? { spend: 0, revenue: 0, orders: 0 };
    const goals = goalsByClient[cid] ?? { roasGoal: null, cpaGoal: null };
    const alerts = alertsByClient[cid] ?? 0;
    const lastSync = syncByClient[cid] ?? null;

    // Data flags
    const hasData = day.spend > 0 || day.revenue > 0;
    if (hasData) hasAnyData = true;
    const clientHasPartialData = day.spend > 0 && day.revenue === 0;
    if (clientHasPartialData) hasPartialCrm = true;
    const clientHasMissingGoals = goals.roasGoal === null && goals.cpaGoal === null;
    if (clientHasMissingGoals) hasMissingGoals = true;
    const clientHasStaleSync = lastSync !== null
      ? hoursElapsed(lastSync) > 48
      : false;
    if (clientHasStaleSync) hasStaleSync = true;

    // Compute ROAS and CPA
    const roas = day.spend > 0 ? day.revenue / day.spend : null;
    const cpa = day.orders > 0 ? day.spend / day.orders : null;

    // Goal vs actual
    const roasVsGoalPct = (roas !== null && goals.roasGoal !== null && goals.roasGoal > 0)
      ? ((roas - goals.roasGoal) / goals.roasGoal) * 100
      : null;
    const cpaVsGoalPct = (cpa !== null && goals.cpaGoal !== null && goals.cpaGoal > 0)
      ? ((cpa - goals.cpaGoal) / goals.cpaGoal) * 100
      : null;

    // 3-day trend ROAS values
    const clientTrend = trendByClient[cid] ?? {};
    const trendValues: (number | null)[] = trendDates.map((d) => {
      const entry = clientTrend[d];
      if (!entry || entry.spend <= 0) return null;
      return entry.revenue / entry.spend;
    });

    const trend = computeClientTrend(trendValues);

    const status = computeClientPerformanceStatus({
      roas,
      roasGoal: goals.roasGoal,
      cpa,
      cpaGoal: goals.cpaGoal,
      trend,
      alertCount: alerts,
      hasStaleSync: clientHasStaleSync,
    });

    const riskLevel = computeRiskLevel(status);
    const scaleReadiness = computeScaleReadiness(status, trend, clientHasStaleSync);
    const actions = buildClientActionRecommendations(cid, status);

    return {
      clientId:      cid,
      clientName:    client.name,
      currency:      client.currency,
      spend:         day.spend,
      revenue:       day.revenue,
      roas,
      cpa,
      orders:        day.orders,
      roasGoal:      goals.roasGoal,
      cpaGoal:       goals.cpaGoal,
      cpaVsGoalPct,
      roasVsGoalPct,
      trend,
      trendValues:   trendValues.filter((v): v is number => v !== null),
      status,
      riskLevel,
      scaleReadiness,
      actions,
      alertCount:    alerts,
      hasStaleSync:  clientHasStaleSync,
      hasMissingGoals: clientHasMissingGoals,
      hasPartialData:  clientHasPartialData,
      href:          `/clients/${cid}`,
    };
  });

  // Sort: critical first, then at_risk, then scaling, then stable
  const STATUS_ORDER: Record<string, number> = { critical: 0, at_risk: 1, scaling: 2, stable: 3 };
  clientSummaries.sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));

  // ── Build portfolio summary ────────────────────────────────────────────

  const totalSpend   = clientSummaries.reduce((s, c) => s + c.spend, 0);
  const totalRevenue = clientSummaries.reduce((s, c) => s + c.revenue, 0);
  const totalOrders  = clientSummaries.reduce((s, c) => s + c.orders, 0);

  const portfolio: PortfolioDailySummary = {
    generatedAt:  new Date().toISOString(),
    dateLabel:    `Yesterday — ${formatDateLabel(yesterday)}`,
    totalSpend,
    totalRevenue,
    blendedRoas:   totalSpend > 0 ? totalRevenue / totalSpend : null,
    blendedCpa:    totalOrders > 0 ? totalSpend / totalOrders : null,
    cpaVsTarget:   null, // Would need a portfolio-level CPA target
    totalOrders,
    totalClients:  clients.length,
    scalingCount:  clientSummaries.filter((c) => c.status === "scaling").length,
    stableCount:   clientSummaries.filter((c) => c.status === "stable").length,
    atRiskCount:   clientSummaries.filter((c) => c.status === "at_risk").length,
    criticalCount: clientSummaries.filter((c) => c.status === "critical").length,
  };

  return {
    portfolio,
    clients:       clientSummaries,
    clientOptions: clients.map((c) => ({ id: c.id, name: c.name })),
    noDataYesterday: !hasAnyData,
    hasPartialCrm,
    hasMissingGoals,
    hasStaleSync,
  };
}
