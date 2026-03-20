// ─── Command Center — Aggregator ─────────────────────────────────────────────
//
// Pulls data from the database and assembles the CommandCenterPayload.
// All queries are direct Prisma calls — no circular imports from other lib
// modules. Keep aggregation separate from priority logic and rendering.

import { prisma }             from "../db";
import { buildPriorityCards, formatAlertType, formatActionType } from "./priorityEngine";
import type {
  CommandCenterPayload,
  CommandCenterSummary,
  CommandCenterAlertItem,
  CommandCenterApprovalItem,
  CommandCenterExperimentItem,
  CommandCenterCreativeItem,
  CommandCenterPacingItem,
  CommandCenterPriority,
} from "./types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Main aggregator ───────────────────────────────────────────────────────────

export async function buildCommandCenterPayload(params: {
  clientId?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<CommandCenterPayload> {
  const dateFrom = params.dateFrom ?? daysAgo(30);
  const dateTo   = params.dateTo   ?? todayStr();
  const { clientId } = params;
  const clientFilter = clientId ? { clientAccountId: clientId } : {};
  const now = new Date();

  // ── 1. Clients ────────────────────────────────────────────────────────────
  const clients = await prisma.clientAccount.findMany({
    where:   { status: "active" },
    select:  { id: true, name: true, currency: true },
    orderBy: { name: "asc" },
  });

  // ── 2. KPI: reconciliation summaries ─────────────────────────────────────
  const recoSummaries = await prisma.reconciliationSummary.findMany({
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

  const totalSpend   = recoSummaries.reduce((s, r) => s + r.totalMetaSpend,  0);
  const totalRevenue = recoSummaries.reduce((s, r) => s + r.totalCrmRevenue, 0);
  const totalOrders  = recoSummaries.reduce((s, r) => s + r.totalCrmOrders,  0);
  const overallRoas  = totalSpend > 0 ? totalRevenue / totalSpend : null;
  const overallCpa   = totalOrders > 0 ? totalSpend / totalOrders : null;

  // ── 3. Alerts ─────────────────────────────────────────────────────────────
  const rawAlerts = await prisma.alertEvent.findMany({
    where: {
      ...clientFilter,
      status: { in: ["open", "acknowledged"] },
    },
    orderBy: [{ severity: "desc" }, { lastDetectedAt: "desc" }],
    take: 50,
    select: {
      id:              true,
      alertType:       true,
      severity:        true,
      clientAccountId: true,
      clientName:      true,
      entityName:      true,
      summary:         true,
      status:          true,
      detectedAt:      true,
    },
  });

  const alertItems: CommandCenterAlertItem[] = rawAlerts.map((a) => ({
    id:              a.id,
    alertType:       a.alertType,
    severity:        a.severity as "low" | "medium" | "high",
    title:           `${formatAlertType(a.alertType)}: ${a.entityName}`,
    body:            a.summary,
    clientId:        a.clientAccountId,
    clientName:      a.clientName,
    entityName:      a.entityName,
    isAcknowledged:  a.status === "acknowledged",
    detectedAt:      a.detectedAt.toISOString(),
    href:            "/alerts",
  }));

  // ── 4. Pending approvals ──────────────────────────────────────────────────
  const rawApprovals = await prisma.proposedAutomationAction.findMany({
    where: {
      ...clientFilter,
      status: "proposed",
    },
    orderBy: [{ priority: "desc" }, { proposedAt: "desc" }],
    take: 30,
    select: {
      id:              true,
      actionType:      true,
      clientAccountId: true,
      clientName:      true,
      entityName:      true,
      rationale:       true,
      priority:        true,
      proposedAt:      true,
    },
  });

  const approvals: CommandCenterApprovalItem[] = rawApprovals.map((a) => ({
    id:         a.id,
    actionType: a.actionType,
    title:      `${formatActionType(a.actionType)}: ${a.entityName}`,
    rationale:  a.rationale,
    clientId:   a.clientAccountId,
    clientName: a.clientName,
    entityName: a.entityName,
    priority:   a.priority as CommandCenterPriority,
    proposedAt: a.proposedAt.toISOString(),
    href:       "/automation",
  }));

  // ── 5. Experiments ────────────────────────────────────────────────────────
  const rawExperiments = await prisma.experimentRecord.findMany({
    where: {
      ...(clientId ? { clientAccountId: clientId } : {}),
      status: { in: ["active", "evaluating", "completed"] },
    },
    orderBy: { startedAt: "desc" },
    take: 20,
    include: { results: { take: 1 } },
  });

  const experiments: CommandCenterExperimentItem[] = rawExperiments.map((e) => {
    const result      = e.results[0] ?? null;
    const daysRunning = Math.floor((now.getTime() - new Date(e.startedAt).getTime()) / 864e5);
    return {
      id:                e.id,
      name:              e.name,
      status:            e.status,
      outcome:           result?.outcome           ?? null,
      winningVariant:    result?.winningVariant    ?? null,
      recommendedAction: result?.recommendedAction ?? null,
      clientId:          e.clientAccountId,
      daysRunning,
      hasResult:         !!result,
      href:              "/experiments",
    };
  });

  // ── 6. Creative / publish-prep items ─────────────────────────────────────
  const rawPrep = await prisma.publishPrepRecord.findMany({
    where: {
      ...(clientId ? { clientAccountId: clientId } : {}),
      status: { in: ["draft", "validated", "guardrails_passed"] },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id:               true,
      variantTitle:     true,
      variantType:      true,
      briefIntent:      true,
      clientAccountId:  true,
      clientName:       true,
      campaignName:     true,
      status:           true,
      approvedForLaunch: true,
    },
  });

  const creativeItems: CommandCenterCreativeItem[] = rawPrep.map((p) => ({
    id:          p.id,
    title:       p.variantTitle,
    variantType: p.variantType,
    briefIntent: p.briefIntent,
    direction:
      p.approvedForLaunch         ? "ready_to_publish" :
      p.status === "draft"        ? "in_progress"      : "awaiting_review",
    clientId:    p.clientAccountId,
    clientName:  p.clientName,
    campaignName: p.campaignName ?? null,
    status:      p.status,
    href:        "/creative-lab",
  }));

  // ── 7. Pacing ─────────────────────────────────────────────────────────────
  // Fetch client-level targets, then batch-query actual spend for this month.
  const pacingTargets = await prisma.budgetPacingTarget.findMany({
    where: {
      ...(clientId ? { clientAccountId: clientId } : {}),
      campaignId: null,   // client-level only
    },
    include: {
      clientAccount: { select: { id: true, name: true, currency: true } },
    },
  });

  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth   = now.getDate();
  const clientIds    = pacingTargets.map((t) => t.clientAccountId);

  let spendByClient: Record<string, number> = {};
  if (clientIds.length > 0) {
    const spendRows = await prisma.uTMPerformanceRow.groupBy({
      by:    ["clientAccountId"],
      where: {
        clientAccountId: { in: clientIds },
        date: { gte: monthStart, lte: todayStr() },
      },
      _sum:  { spend: true },
    });
    for (const row of spendRows) {
      spendByClient[row.clientAccountId] = row._sum.spend ?? 0;
    }
  }

  const pacingItems: CommandCenterPacingItem[] = [];
  for (const t of pacingTargets) {
    const spendSoFar     = spendByClient[t.clientAccountId] ?? 0;
    const expectedSpend  = (dayOfMonth / daysInMonth) * t.monthlyBudget;
    const pacingPct      = expectedSpend > 0 ? (spendSoFar / expectedSpend) * 100 : 100;

    let status: CommandCenterPacingItem["status"];
    if      (pacingPct > 115) status = "over_pacing";
    else if (pacingPct < 85)  status = "under_pacing";
    else                      status = "on_pacing";

    if (status !== "on_pacing") {
      pacingItems.push({
        id:            t.id,
        clientId:      t.clientAccountId,
        clientName:    t.clientAccount.name,
        monthlyBudget: t.monthlyBudget,
        currency:      t.clientAccount.currency,
        spendSoFar,
        expectedSpend,
        pacingPct,
        status,
        href: "/pacing",
      });
    }
  }

  // ── 8. Priority queue ─────────────────────────────────────────────────────
  const priorities = buildPriorityCards({ alertItems, approvals, experiments, creativeItems, pacingItems });

  // ── 9. Summary ────────────────────────────────────────────────────────────
  const summary: CommandCenterSummary = {
    generatedAt:             now.toISOString(),
    dateRange:               { from: dateFrom, to: dateTo },
    totalSpend,
    totalRevenue,
    overallRoas,
    overallCpa,
    totalOrders,
    activeClientsCount:      clients.length,
    activeExperimentsCount:  experiments.filter((e) => e.status === "active" || e.status === "evaluating").length,
    pendingApprovalsCount:   approvals.length,
    highPriorityCreativeIssues: creativeItems.filter(
      (c) => c.direction === "ready_to_publish" || c.direction === "awaiting_review"
    ).length,
    pacingRisksCount:        pacingItems.length,
    unresolvedAlertsCount:   alertItems.filter((a) => !a.isAcknowledged).length,
  };

  return {
    summary,
    priorities,
    approvals,
    experiments,
    creativeItems,
    pacingItems,
    alertItems,
    clients: clients.map((c) => ({ id: c.id, name: c.name })),
  };
}
