// ─── Executive Reporting — Aggregator ────────────────────────────────────────
//
// Assembles the full ExecutiveSummary from the database.
// All Prisma queries are direct — no circular imports from other lib modules.
// Narrative and KPI card assembly are delegated to pure-function siblings.

import { prisma }                from "../db";
import { buildExecutiveKpiCards } from "./kpis";
import { buildExecutiveNarrative } from "./narrative";
import type {
  ExecutiveSummary,
  ExecutiveTrendSummary,
  ExecutiveTrendPoint,
  ExecutiveExperimentSummary,
  ExecutiveExperimentItem,
  ExecutiveCreativeSummary,
  ExecutiveCreativeItem,
  ExecutiveImpactSummary,
  ExecutiveApprovalSummary,
  ExecutiveApprovalItem,
  ExecutiveAlertItem,
} from "./types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
}

function shiftDateRange(from: string, to: string): { from: string; to: string } {
  const msFrom = new Date(from + "T00:00:00").getTime();
  const msTo   = new Date(to   + "T00:00:00").getTime();
  const span   = msTo - msFrom + 864e5; // inclusive
  return {
    from: new Date(msFrom - span).toISOString().slice(0, 10),
    to:   new Date(msTo   - span).toISOString().slice(0, 10),
  };
}

// ── Trend builder (period-agnostic) ──────────────────────────────────────────

async function fetchTrendSummary(params: {
  clientId?:   string;
  campaignId?: string;
  dateFrom:    string;
  dateTo:      string;
}): Promise<ExecutiveTrendSummary> {
  const { clientId, campaignId, dateFrom, dateTo } = params;
  const clientFilter = clientId ? { clientAccountId: clientId } : {};

  // Daily spend from UTMPerformanceRow (has both spend + revenue fields)
  const spendRows = await prisma.uTMPerformanceRow.groupBy({
    by:    ["date"],
    where: {
      ...clientFilter,
      ...(campaignId ? { campaignId } : {}),
      date: { gte: dateFrom, lte: dateTo },
    },
    _sum:  { spend: true, revenue: true, conversions: true },
    orderBy: { date: "asc" },
  });

  // Daily revenue from CRMPerformanceRow (CRM source of truth for orders)
  const crmRows = await prisma.cRMPerformanceRow.groupBy({
    by:    ["date"],
    where: {
      ...clientFilter,
      date: { gte: dateFrom, lte: dateTo },
    },
    _sum:  { revenue: true, orders: true },
    orderBy: { date: "asc" },
  });

  // ── Fallback to live synced tables when intermediary tables are empty ──
  // UTMPerformanceRow and CRMPerformanceRow are not populated by the sync
  // jobs. When empty, read directly from MetaSyncedInsight and ShopifyOrder.

  let metaSpendByDate:  Record<string, number> = {};
  let shopifyByDate:    Record<string, { revenue: number; orders: number }> = {};
  let usedSyncedFallback = false;

  if (spendRows.length === 0) {
    // Resolve external ad account IDs for this client (or all)
    const selectedAccounts = await prisma.metaSelectedAdAccount.findMany({
      where: clientId ? { clientAccountId: clientId } : {},
      include: { accessibleAdAccount: { select: { externalAdAccountId: true } } },
    });
    const externalAdAccountIds = selectedAccounts.map(
      (sa) => sa.accessibleAdAccount.externalAdAccountId
    );

    if (externalAdAccountIds.length > 0) {
      const insightRows = await prisma.metaSyncedInsight.groupBy({
        by:    ["dateStart"],
        where: {
          externalAdAccountId: { in: externalAdAccountIds },
          dateStart:           { gte: dateFrom, lte: dateTo },
        },
        _sum:  { spend: true },
        orderBy: { dateStart: "asc" },
      });

      for (const r of insightRows) {
        metaSpendByDate[r.dateStart] = (metaSpendByDate[r.dateStart] ?? 0) + (r._sum.spend ?? 0);
      }
      if (insightRows.length > 0) usedSyncedFallback = true;
    }
  }

  if (crmRows.length === 0) {
    const dateFromDt = new Date(dateFrom + "T00:00:00.000Z");
    const dateToDt   = new Date(dateTo   + "T23:59:59.999Z");

    // Prisma groupBy on DateTime groups by exact timestamp, not by date.
    // Load orders and aggregate by date string in JS.
    const orders = await prisma.shopifyOrder.findMany({
      where: {
        ...(clientId ? { clientAccountId: clientId } : {}),
        orderCreatedAt: { gte: dateFromDt, lte: dateToDt },
      },
      select: { orderCreatedAt: true, totalPrice: true },
    });

    for (const o of orders) {
      const dateKey = o.orderCreatedAt.toISOString().slice(0, 10);
      const prev = shopifyByDate[dateKey] ?? { revenue: 0, orders: 0 };
      shopifyByDate[dateKey] = {
        revenue: prev.revenue + (o.totalPrice ?? 0),
        orders:  prev.orders + 1,
      };
    }
    if (orders.length > 0) usedSyncedFallback = true;
  }

  // Build date-keyed maps from UTMPerformanceRow (or MetaSyncedInsight fallback)
  const spendByDate: Record<string, number> = {};
  if (spendRows.length > 0) {
    for (const r of spendRows) spendByDate[r.date] = r._sum.spend ?? 0;
  } else {
    Object.assign(spendByDate, metaSpendByDate);
  }

  const crmByDate: Record<string, { revenue: number; orders: number }> = {};
  if (crmRows.length > 0) {
    for (const r of crmRows) {
      crmByDate[r.date] = {
        revenue: r._sum.revenue ?? 0,
        orders:  r._sum.orders  ?? 0,
      };
    }
  } else {
    Object.assign(crmByDate, shopifyByDate);
  }

  // Build unified day array covering the full range
  const allDates = Array.from(
    new Set([...Object.keys(spendByDate), ...Object.keys(crmByDate)])
  ).sort();

  const byDay: ExecutiveTrendPoint[] = allDates.map((date) => {
    const spend   = spendByDate[date]        ?? 0;
    const revenue = crmByDate[date]?.revenue ?? 0;
    const roas    = spend > 0 ? revenue / spend : null;
    return { date, spend, revenue, roas };
  });

  // Overall KPIs from ReconciliationSummary (rolled-up, CRM source of truth)
  const recoRows = await prisma.reconciliationSummary.findMany({
    where: {
      ...clientFilter,
      dateFrom: { gte: dateFrom },
      dateTo:   { lte: dateTo },
    },
    select: {
      totalMetaSpend:  true,
      totalCrmRevenue: true,
      totalCrmOrders:  true,
    },
  });

  const totalSpend   = recoRows.reduce((s, r) => s + r.totalMetaSpend,  0);
  const totalRevenue = recoRows.reduce((s, r) => s + r.totalCrmRevenue, 0);
  const totalOrders  = recoRows.reduce((s, r) => s + r.totalCrmOrders,  0);

  // Fall back to daily rows (from UTM/CRM tables or synced tables) if no reconciliation data
  const fallbackSpend   = byDay.reduce((s, d) => s + d.spend,   0);
  const fallbackRevenue = byDay.reduce((s, d) => s + d.revenue, 0);
  const fallbackOrders  = crmRows.length > 0
    ? crmRows.reduce((s, r) => s + (r._sum.orders ?? 0), 0)
    : Object.values(crmByDate).reduce((s, d) => s + d.orders, 0);

  const effectiveSpend   = recoRows.length > 0 ? totalSpend   : fallbackSpend;
  const effectiveRevenue = recoRows.length > 0 ? totalRevenue : fallbackRevenue;
  const effectiveOrders  = recoRows.length > 0 ? totalOrders  : fallbackOrders;
  const overallRoas      = effectiveSpend > 0 ? effectiveRevenue / effectiveSpend : null;
  const overallCpa       = effectiveOrders > 0 ? effectiveSpend / effectiveOrders : null;

  return {
    dateFrom,
    dateTo,
    byDay,
    totalSpend:   effectiveSpend,
    totalRevenue: effectiveRevenue,
    overallRoas,
    overallCpa,
    totalOrders:  effectiveOrders,
    hasSpendData: byDay.length > 0 || effectiveSpend > 0,
  };
}

// ── Main aggregator ───────────────────────────────────────────────────────────

export async function buildExecutiveSummary(params: {
  clientId?:           string;
  campaignId?:         string;
  dateFrom?:           string;
  dateTo?:             string;
  compareWithPrevious: boolean;
}): Promise<ExecutiveSummary> {
  const dateFrom   = params.dateFrom ?? daysAgo(30);
  const dateTo     = params.dateTo   ?? new Date().toISOString().slice(0, 10);
  const { clientId, campaignId, compareWithPrevious } = params;
  const clientFilter = clientId ? { clientAccountId: clientId } : {};
  const now = new Date();

  // ── Clients ───────────────────────────────────────────────────────────────
  const rawClients = await prisma.clientAccount.findMany({
    where:   { status: "active" },
    select:  { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const clients = rawClients.map((c) => ({ id: c.id, name: c.name }));
  const clientName = clientId ? (rawClients.find((c) => c.id === clientId)?.name ?? null) : null;

  // ── Trend ─────────────────────────────────────────────────────────────────
  const trend = await fetchTrendSummary({ clientId, campaignId, dateFrom, dateTo });

  let comparisonTrend: ExecutiveTrendSummary | null = null;
  let comparisonRange: { from: string; to: string } | null = null;
  if (compareWithPrevious) {
    comparisonRange = shiftDateRange(dateFrom, dateTo);
    comparisonTrend = await fetchTrendSummary({
      clientId,
      campaignId,
      dateFrom: comparisonRange.from,
      dateTo:   comparisonRange.to,
    });
  }

  // ── Experiments ───────────────────────────────────────────────────────────
  const rawExperiments = await prisma.experimentRecord.findMany({
    where: {
      ...(clientId ? { clientAccountId: clientId } : {}),
      status: { in: ["active", "evaluating", "completed"] },
    },
    orderBy: { startedAt: "desc" },
    take: 20,
    include: { results: { take: 1 } },
  });

  const experimentItems: ExecutiveExperimentItem[] = rawExperiments.map((e) => {
    const result      = e.results[0] ?? null;
    const daysRunning = Math.floor((now.getTime() - new Date(e.startedAt).getTime()) / 864e5);
    return {
      id:                e.id,
      name:              e.name,
      status:            e.status,
      outcome:           result?.outcome           ?? null,
      winningVariant:    result?.winningVariant    ?? null,
      recommendedAction: result?.recommendedAction ?? null,
      primaryMetricLift: result?.primaryMetricLift ?? null,
      daysRunning,
      hasResult:         !!result,
    };
  });

  const completedInPeriod = rawExperiments.filter(
    (e) => e.completedAt &&
      e.completedAt.toISOString().slice(0, 10) >= dateFrom &&
      e.completedAt.toISOString().slice(0, 10) <= dateTo
  );

  const experiments: ExecutiveExperimentSummary = {
    totalRun:             rawExperiments.length,
    activeCount:          rawExperiments.filter((e) => e.status === "active" || e.status === "evaluating").length,
    completedThisPeriod:  completedInPeriod.length,
    winnersCount:         experimentItems.filter(
      (e) => e.outcome === "challenger_wins" || e.outcome === "control_holds"
    ).length,
    noWinnerCount:        experimentItems.filter(
      (e) => e.outcome === "no_clear_winner" || e.outcome === "mixed_result"
    ).length,
    insufficientDataCount: experimentItems.filter(
      (e) => e.outcome === "insufficient_data"
    ).length,
    items: experimentItems,
  };

  // ── Creative ──────────────────────────────────────────────────────────────
  const briefsCreated = await prisma.creativeBriefRecord.count({
    where: {
      ...clientFilter,
      createdAt: { gte: new Date(dateFrom + "T00:00:00"), lte: new Date(dateTo + "T23:59:59") },
    },
  });

  const rawPrep = await prisma.publishPrepRecord.findMany({
    where: {
      ...clientFilter,
      createdAt: { gte: new Date(dateFrom + "T00:00:00"), lte: new Date(dateTo + "T23:59:59") },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id:               true,
      variantTitle:     true,
      variantType:      true,
      briefIntent:      true,
      clientName:       true,
      campaignName:     true,
      status:           true,
      approvedForLaunch: true,
      publishedAt:      true,
    },
  });

  const creativeItems: ExecutiveCreativeItem[] = rawPrep.map((p) => ({
    id:           p.id,
    title:        p.variantTitle,
    variantType:  p.variantType,
    briefIntent:  p.briefIntent,
    clientName:   p.clientName,
    campaignName: p.campaignName ?? null,
    status:       p.status,
    isLaunched:   !!p.publishedAt,
    publishedAt:  p.publishedAt?.toISOString() ?? null,
  }));

  const creative: ExecutiveCreativeSummary = {
    briefsCreated,
    variantsGenerated: rawPrep.length,
    variantsApproved:  rawPrep.filter((p) => p.approvedForLaunch).length,
    variantsLaunched:  rawPrep.filter((p) => !!p.publishedAt).length,
    items:             creativeItems,
  };

  // ── Approvals ─────────────────────────────────────────────────────────────
  const rawApprovals = await prisma.proposedAutomationAction.findMany({
    where: {
      ...clientFilter,
      proposedAt: { gte: new Date(dateFrom + "T00:00:00"), lte: new Date(dateTo + "T23:59:59") },
    },
    orderBy: { proposedAt: "desc" },
    take: 30,
    select: {
      id:              true,
      actionType:      true,
      status:          true,
      clientName:      true,
      entityName:      true,
      rationale:       true,
      proposedAt:      true,
    },
  });

  const approvalItems: ExecutiveApprovalItem[] = rawApprovals.map((a) => ({
    id:         a.id,
    actionType: a.actionType,
    status:     a.status,
    entityName: a.entityName,
    clientName: a.clientName,
    rationale:  a.rationale,
    proposedAt: a.proposedAt.toISOString(),
    resolvedAt: null,
  }));

  const approvals: ExecutiveApprovalSummary = {
    pendingCount:       rawApprovals.filter((a) => a.status === "proposed").length,
    approvedThisPeriod: rawApprovals.filter((a) => a.status === "approved").length,
    rejectedThisPeriod: rawApprovals.filter((a) => a.status === "rejected").length,
    executedThisPeriod: rawApprovals.filter((a) => a.status === "executed").length,
    items:              approvalItems,
  };

  // ── Impact ────────────────────────────────────────────────────────────────
  const rawAlerts = await prisma.alertEvent.findMany({
    where: {
      ...clientFilter,
      severity: { in: ["high", "medium"] },
      status:   { in: ["open", "acknowledged"] },
    },
    orderBy: [{ severity: "desc" }, { lastDetectedAt: "desc" }],
    take: 10,
    select: {
      id:              true,
      alertType:       true,
      severity:        true,
      status:          true,
      entityName:      true,
      clientName:      true,
      summary:         true,
      detectedAt:      true,
    },
  });

  const notableAlerts: ExecutiveAlertItem[] = rawAlerts.map((a) => ({
    id:         a.id,
    alertType:  a.alertType,
    severity:   a.severity,
    entityName: a.entityName,
    clientName: a.clientName,
    summary:    a.summary,
    detectedAt: a.detectedAt.toISOString(),
  }));

  // Auto-execution stats for the period
  const execLogs = await prisma.autoExecutionLog.findMany({
    where: {
      ...(clientId ? { clientAccountId: clientId } : {}),
      executedAt: { gte: new Date(dateFrom + "T00:00:00"), lte: new Date(dateTo + "T23:59:59") },
    },
    select: { status: true },
  });

  // Pacing risks (over/under pacing)
  const pacingTargets = await prisma.budgetPacingTarget.findMany({
    where: { ...clientFilter, campaignId: null },
    select: { clientAccountId: true, monthlyBudget: true },
  });
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthToday = now.toISOString().slice(0, 10);
  const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth   = now.getDate();

  let pacingRisksCount = 0;
  if (pacingTargets.length > 0) {
    const pClientIds = pacingTargets.map((t) => t.clientAccountId);

    // Try UTMPerformanceRow first
    const spendRows2 = await prisma.uTMPerformanceRow.groupBy({
      by:    ["clientAccountId"],
      where: { clientAccountId: { in: pClientIds }, date: { gte: monthStart, lte: monthToday } },
      _sum:  { spend: true },
    });

    const spendMap: Record<string, number> = {};

    if (spendRows2.length > 0) {
      for (const r of spendRows2) spendMap[r.clientAccountId] = r._sum.spend ?? 0;
    } else {
      // Fall back to MetaSyncedInsight via ad account mapping
      for (const cid of pClientIds) {
        const selectedAccts = await prisma.metaSelectedAdAccount.findMany({
          where: { clientAccountId: cid },
          include: { accessibleAdAccount: { select: { externalAdAccountId: true } } },
        });
        const extIds = selectedAccts.map((sa) => sa.accessibleAdAccount.externalAdAccountId);
        if (extIds.length === 0) continue;

        const agg = await prisma.metaSyncedInsight.aggregate({
          where: {
            externalAdAccountId: { in: extIds },
            dateStart:           { gte: monthStart, lte: monthToday },
          },
          _sum: { spend: true },
        });
        spendMap[cid] = agg._sum.spend ?? 0;
      }
    }

    for (const t of pacingTargets) {
      const spent    = spendMap[t.clientAccountId] ?? 0;
      const expected = (dayOfMonth / daysInMonth) * t.monthlyBudget;
      const pct      = expected > 0 ? spent / expected : 1;
      if (pct > 1.15 || pct < 0.85) pacingRisksCount++;
    }
  }

  // Data warnings
  const dataWarnings: string[] = [];
  if (!trend.hasSpendData)
    dataWarnings.push("No spend data found for this period. Ensure Meta sync has run.");
  if (trend.totalRevenue === 0 && trend.totalSpend > 0)
    dataWarnings.push("Spend tracked but no CRM revenue attributed. Reconciliation may not have run yet.");
  if (experiments.insufficientDataCount > 0)
    dataWarnings.push(`${experiments.insufficientDataCount} experiment(s) have insufficient data for evaluation.`);

  const impact: ExecutiveImpactSummary = {
    pacingRisksCount,
    unresolvedAlertsCount:     rawAlerts.filter((a) => a.status === "open").length,
    notableAlerts,
    autoExecutionsThisPeriod:  execLogs.length,
    autoExecutionSuccessCount: execLogs.filter((l) => l.status === "success").length,
    guardrailBlocksCount:      execLogs.filter((l) => l.status === "guardrail_blocked").length,
    dataWarnings,
  };

  // ── KPI cards ─────────────────────────────────────────────────────────────
  const kpiCards = buildExecutiveKpiCards(trend, comparisonTrend, experiments, creative, approvals);

  // ── Narrative ─────────────────────────────────────────────────────────────
  const narrative = buildExecutiveNarrative({
    dateRange: { from: dateFrom, to: dateTo },
    clientName,
    trend,
    comparison: comparisonTrend,
    experiments,
    creative,
    approvals,
    impact,
  });

  return {
    generatedAt:     now.toISOString(),
    dateRange:       { from: dateFrom, to: dateTo },
    comparisonRange,
    clientId:        clientId ?? null,
    clientName,
    kpiCards,
    trend,
    comparisonTrend,
    experiments,
    creative,
    impact,
    approvals,
    narrative,
    hasData:         trend.hasSpendData,
    clients,
  };
}
