// ─── Portfolio Command Center — Aggregator ────────────────────────────────────
//
// Assembles PortfolioPayload from direct Prisma queries.
// Health scoring and risk/opportunity logic live in health.ts (pure).
// This module owns: DB access, map building, and payload assembly only.

import { prisma }    from "../db";
import { scoreHealth } from "./health";
import type {
  PortfolioPayload,
  PortfolioSummary,
  PortfolioHealthBoardItem,
  PortfolioRiskItem,
  PortfolioOpportunityItem,
  PortfolioApprovalSummary,
  PortfolioAutomationSummary,
  PortfolioPacingStatus,
  PortfolioAutonomyMode,
} from "./types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function hoursElapsed(d: Date | string): number {
  return (Date.now() - new Date(d).getTime()) / 3_600_000;
}

const PRIORITY_WEIGHT: Record<string, number> = {
  critical: 4, high: 3, medium: 2, low: 1,
};

// ── Main aggregator ───────────────────────────────────────────────────────────

export async function buildPortfolioPayload(params: {
  workspaceId: string | null;
  dateFrom?:   string;
  dateTo?:     string;
  clientId?:   string;
}): Promise<PortfolioPayload> {
  const dateFrom   = params.dateFrom ?? daysAgo(30);
  const dateTo     = params.dateTo   ?? todayStr();
  const { workspaceId, clientId } = params;

  const clientFilter = clientId ? { clientAccountId: clientId } : {};
  const now          = new Date();

  // Month-to-date pacing window
  const monthStart  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth  = now.getDate();

  // ── Parallel fetch ─────────────────────────────────────────────────────────

  const [
    clients,
    recoSummaries,
    rawAlerts,
    rawApprovals,
    governanceStops,
    safetyPolicies,
    autoExecSettings,
    pacingTargets,
    experiments,
    syncRuns,
    goalDefaults,
    recentExecLogs,
    readyCreatives,
  ] = await Promise.all([

    // 1. Active clients
    prisma.clientAccount.findMany({
      where:   { status: "active" },
      select:  { id: true, name: true, currency: true },
      orderBy: { name: "asc" },
    }),

    // 2. Reconciliation summaries (CRM source of truth for ROAS/CPA)
    prisma.reconciliationSummary.findMany({
      where: {
        ...clientFilter,
        dateFrom: { gte: dateFrom },
        dateTo:   { lte: dateTo },
      },
      select: {
        clientAccountId: true,
        totalMetaSpend:  true,
        totalCrmRevenue: true,
        totalCrmOrders:  true,
      },
    }),

    // 3. Open / acknowledged alerts
    prisma.alertEvent.findMany({
      where: {
        ...clientFilter,
        status: { in: ["open", "acknowledged"] },
      },
      select: {
        clientAccountId: true,
        severity:        true,
      },
    }),

    // 4. Pending approvals (proposed only)
    prisma.proposedAutomationAction.findMany({
      where: {
        ...clientFilter,
        status: "proposed",
      },
      select: {
        clientAccountId: true,
        clientName:      true,
        priority:        true,
        proposedAt:      true,
      },
      orderBy: { proposedAt: "asc" },
    }),

    // 5. Active governance stops — client scope
    workspaceId
      ? prisma.governanceStop.findMany({
          where: { workspaceId, isActive: true, scope: "client" },
          select: { scopeId: true },
        })
      : Promise.resolve([] as { scopeId: string }[]),

    // 6. Safety policies — client scope
    workspaceId
      ? prisma.actionSafetyPolicy.findMany({
          where: { workspaceId, scope: "client", isActive: true },
          select: { scopeId: true, autonomyMode: true },
        })
      : Promise.resolve([] as { scopeId: string; autonomyMode: string }[]),

    // 7. Auto-execution settings
    prisma.autoExecutionSettings.findMany({
      where:  clientFilter,
      select: { clientAccountId: true, enabled: true },
    }),

    // 8. Client-level pacing targets
    prisma.budgetPacingTarget.findMany({
      where:  { ...clientFilter, campaignId: null },
      select: { clientAccountId: true, monthlyBudget: true },
    }),

    // 9. Active/completed experiments (with latest result)
    prisma.experimentRecord.findMany({
      where: {
        ...clientFilter,
        status: { in: ["active", "evaluating", "completed"] },
      },
      orderBy: { startedAt: "desc" },
      take:    200,
      include: { results: { take: 1 } },
    }),

    // 10. Most recent sync run per client
    prisma.clientSyncRun.findMany({
      where:    { ...clientFilter, status: { not: "running" } },
      select:   { clientAccountId: true, completedAt: true, status: true },
      orderBy:  { startedAt: "desc" },
      distinct: ["clientAccountId"],
    }),

    // 11. Client goal defaults
    prisma.clientGoalDefaults.findMany({
      where:  clientFilter,
      select: {
        clientAccountId:      true,
        targetRoas:           true,
        targetCpa:            true,
        defaultRoasGoalValue: true,
        defaultCpaGoalValue:  true,
      },
    }),

    // 12. Recent auto-execution logs (last 7 days)
    prisma.autoExecutionLog.findMany({
      where: {
        ...(clientId ? { clientAccountId: clientId } : {}),
        executedAt: { gte: new Date(Date.now() - 7 * 864e5) },
      },
      select: { clientAccountId: true },
    }),

    // 13. Creative items awaiting launch approval
    prisma.publishPrepRecord.findMany({
      where: {
        ...clientFilter,
        status:            { in: ["validated", "guardrails_passed"] },
        approvedForLaunch: false,
      },
      select: { clientAccountId: true, id: true },
      take:   100,
    }),
  ]);

  // ── Pacing spend (needs pacing targets list first) ─────────────────────────

  const pacingClientIds = [...new Set(pacingTargets.map((t) => t.clientAccountId))];
  const spendByClient: Record<string, number> = {};

  if (pacingClientIds.length > 0) {
    const spendRows = await prisma.uTMPerformanceRow.groupBy({
      by:    ["clientAccountId"],
      where: {
        clientAccountId: { in: pacingClientIds },
        date: { gte: monthStart, lte: todayStr() },
      },
      _sum: { spend: true },
    });
    for (const row of spendRows) {
      spendByClient[row.clientAccountId] = row._sum.spend ?? 0;
    }
  }

  // ── Build per-client lookup maps ───────────────────────────────────────────

  // Reconciliation: aggregate across all summary rows per client
  type RecoAgg = { spend: number; revenue: number; orders: number; roas: number | null; cpa: number | null };
  const recoByClient: Record<string, RecoAgg> = {};
  for (const r of recoSummaries) {
    const cid = r.clientAccountId;
    if (!recoByClient[cid]) recoByClient[cid] = { spend: 0, revenue: 0, orders: 0, roas: null, cpa: null };
    recoByClient[cid].spend   += r.totalMetaSpend;
    recoByClient[cid].revenue += r.totalCrmRevenue;
    recoByClient[cid].orders  += r.totalCrmOrders;
  }
  for (const cid of Object.keys(recoByClient)) {
    const r = recoByClient[cid];
    r.roas = r.spend  > 0 ? r.revenue / r.spend  : null;
    r.cpa  = r.orders > 0 ? r.spend   / r.orders : null;
  }

  // Alert counts by client
  type AlertAgg = { total: number; high: number };
  const alertsByClient: Record<string, AlertAgg> = {};
  for (const a of rawAlerts) {
    const cid = a.clientAccountId;
    if (!alertsByClient[cid]) alertsByClient[cid] = { total: 0, high: 0 };
    alertsByClient[cid].total++;
    if (a.severity === "high") alertsByClient[cid].high++;
  }

  // Approval data by client
  type ApprovalAgg = { count: number; oldestAt: Date; hasCritical: boolean };
  const approvalsByClient: Record<string, ApprovalAgg> = {};
  for (const a of rawApprovals) {
    const cid = a.clientAccountId;
    const at  = new Date(a.proposedAt);
    if (!approvalsByClient[cid]) {
      approvalsByClient[cid] = { count: 0, oldestAt: at, hasCritical: false };
    }
    approvalsByClient[cid].count++;
    if (at < approvalsByClient[cid].oldestAt) approvalsByClient[cid].oldestAt = at;
    if (hoursElapsed(at) > 48) approvalsByClient[cid].hasCritical = true;
  }

  // Governance stops by client scopeId
  const stoppedClientIds = new Set(governanceStops.map((s) => s.scopeId));

  // Safety policies by client scopeId
  const policyByClient: Record<string, string> = {};
  for (const p of safetyPolicies) policyByClient[p.scopeId] = p.autonomyMode;

  // Auto-exec enabled by client
  const autoExecByClient: Record<string, boolean> = {};
  for (const ae of autoExecSettings) autoExecByClient[ae.clientAccountId] = ae.enabled;

  // Pacing by client
  type PacingAgg = { status: PortfolioPacingStatus; pct: number; monthlyBudget: number };
  const pacingByClient: Record<string, PacingAgg> = {};
  for (const t of pacingTargets) {
    const cid        = t.clientAccountId;
    const spendSoFar = spendByClient[cid] ?? 0;
    const expected   = (dayOfMonth / daysInMonth) * t.monthlyBudget;
    const pct        = expected > 0 ? (spendSoFar / expected) * 100 : 100;
    let status: PortfolioPacingStatus;
    if      (pct > 115) status = "over_pacing";
    else if (pct < 85)  status = "under_pacing";
    else                status = "on_pacing";
    pacingByClient[cid] = { status, pct, monthlyBudget: t.monthlyBudget };
  }

  // Experiments by client
  const experimentsByClient: Record<string, typeof experiments> = {};
  for (const e of experiments) {
    const cid = e.clientAccountId;
    if (!experimentsByClient[cid]) experimentsByClient[cid] = [];
    experimentsByClient[cid].push(e);
  }

  // Sync state by client
  type SyncAgg = { completedAt: Date | null };
  const syncByClient: Record<string, SyncAgg> = {};
  for (const s of syncRuns) syncByClient[s.clientAccountId] = { completedAt: s.completedAt };

  // Goal defaults by client
  type GoalAgg = { roasGoal: number | null; cpaGoal: number | null };
  const goalsByClient: Record<string, GoalAgg> = {};
  for (const g of goalDefaults) {
    goalsByClient[g.clientAccountId] = {
      roasGoal: g.targetRoas ?? g.defaultRoasGoalValue ?? null,
      cpaGoal:  g.targetCpa  ?? g.defaultCpaGoalValue  ?? null,
    };
  }

  // Recent auto-exec log counts by client
  const execLogsByClient: Record<string, number> = {};
  for (const log of recentExecLogs) {
    if (log.clientAccountId) {
      execLogsByClient[log.clientAccountId] = (execLogsByClient[log.clientAccountId] ?? 0) + 1;
    }
  }

  // Creative items ready by client
  const creativesByClient: Record<string, number> = {};
  for (const c of readyCreatives) {
    creativesByClient[c.clientAccountId] = (creativesByClient[c.clientAccountId] ?? 0) + 1;
  }

  // ── Build health board ─────────────────────────────────────────────────────

  const healthBoard: PortfolioHealthBoardItem[] = clients.map((client) => {
    const cid       = client.id;
    const reco      = recoByClient[cid]      ?? { spend: 0, revenue: 0, orders: 0, roas: null, cpa: null };
    const alerts    = alertsByClient[cid]    ?? { total: 0, high: 0 };
    const approvals = approvalsByClient[cid] ?? null;
    const pacing    = pacingByClient[cid]    ?? null;
    const sync      = syncByClient[cid]      ?? null;
    const goals     = goalsByClient[cid]     ?? { roasGoal: null, cpaGoal: null };

    const hasEmergencyStop   = stoppedClientIds.has(cid);
    const autonomyMode       = (policyByClient[cid] ?? null) as PortfolioAutonomyMode | null;
    const isRestricted       = autonomyMode === "restricted";
    const hasOverdueApproval = approvals?.hasCritical ?? false;
    const pacingStatus       = pacing?.status ?? "no_data";
    const pacingPct          = pacing?.pct    ?? null;

    // Stale sync: has a sync run older than 48 h (or no completed run recorded)
    const hasStaleSync =
      sync !== null
        ? sync.completedAt === null || hoursElapsed(sync.completedAt) > 48
        : false;

    const { score, label, priority } = scoreHealth({
      hasEmergencyStop,
      isRestricted,
      highAlertCount:     alerts.high,
      hasOverdueApproval,
      pacingStatus,
      pacingPct,
      hasStaleSync,
      roas:     reco.roas,
      roasGoal: goals.roasGoal,
    });

    const activeExp = (experimentsByClient[cid] ?? []).filter(
      (e) => e.status === "active" || e.status === "evaluating"
    ).length;

    return {
      clientId:   cid,
      clientName: client.name,
      currency:   client.currency,
      healthScore: score,
      healthLabel: label,
      priority,
      spend:   reco.spend,
      revenue: reco.revenue,
      roas:    reco.roas,
      cpa:     reco.cpa,
      orders:  reco.orders,
      roasGoal: goals.roasGoal,
      cpaGoal:  goals.cpaGoal,
      pacingStatus,
      pacingPct,
      alertCount:             alerts.total,
      highAlertCount:         alerts.high,
      approvalCount:          approvals?.count ?? 0,
      activeExperimentsCount: activeExp,
      autonomyMode,
      hasEmergencyStop,
      isRestricted,
      hasStaleSync,
      lastSyncAt: sync?.completedAt ? sync.completedAt.toISOString() : null,
      links: {
        client:        `/clients/${cid}`,
        commandCenter: `/command-center?clientId=${cid}`,
        approvals:     `/automation?clientId=${cid}`,
        governance:    `/automation/governance`,
        creativeLab:   `/creative-lab`,
      },
    };
  });

  // Sort: worst health first (lowest score first)
  healthBoard.sort((a, b) => a.healthScore - b.healthScore);

  // ── Extract risks ──────────────────────────────────────────────────────────

  const risks: PortfolioRiskItem[] = [];

  for (const item of healthBoard) {
    const cid  = item.clientId;
    const name = item.clientName;

    if (item.hasEmergencyStop) {
      risks.push({
        id:          `stop-${cid}`,
        clientId:    cid,
        clientName:  name,
        riskType:    "emergency_stop",
        title:       `${name} — Emergency stop active`,
        description: "All auto-execution is blocked. Review governance controls.",
        priority:    "critical",
        href:        "/automation/governance",
      });
    }

    if (item.isRestricted) {
      risks.push({
        id:          `restricted-${cid}`,
        clientId:    cid,
        clientName:  name,
        riskType:    "restricted_mode",
        title:       `${name} — Restricted automation mode`,
        description: "Automation is restricted for this account. Review safety policies.",
        priority:    "high",
        href:        "/automation/policies",
      });
    }

    if (item.highAlertCount >= 2) {
      risks.push({
        id:          `alerts-${cid}`,
        clientId:    cid,
        clientName:  name,
        riskType:    "high_alert",
        title:       `${name} — ${item.highAlertCount} high-severity alert${item.highAlertCount !== 1 ? "s" : ""}`,
        description: "Multiple high-severity alerts require attention.",
        priority:    item.highAlertCount >= 4 ? "critical" : "high",
        href:        "/alerts",
      });
    }

    if (
      item.pacingStatus === "under_pacing" &&
      item.pacingPct !== null && item.pacingPct < 60
    ) {
      risks.push({
        id:          `pacing-under-${cid}`,
        clientId:    cid,
        clientName:  name,
        riskType:    "critical_pacing",
        title:       `${name} — Severely under pacing (${Math.round(item.pacingPct)}%)`,
        description: "Account is spending far less than the expected monthly target.",
        priority:    "critical",
        href:        "/pacing",
      });
    } else if (
      item.pacingStatus === "over_pacing" &&
      item.pacingPct !== null && item.pacingPct > 130
    ) {
      risks.push({
        id:          `pacing-over-${cid}`,
        clientId:    cid,
        clientName:  name,
        riskType:    "critical_pacing",
        title:       `${name} — Over pacing (${Math.round(item.pacingPct)}%)`,
        description: "Account is spending significantly above the expected monthly target.",
        priority:    "critical",
        href:        "/pacing",
      });
    }

    const appr = approvalsByClient[cid];
    if (appr?.hasCritical) {
      risks.push({
        id:          `approval-${cid}`,
        clientId:    cid,
        clientName:  name,
        riskType:    "approval_overdue",
        title:       `${name} — Approval pending >48 hours`,
        description: `${appr.count} action${appr.count !== 1 ? "s" : ""} awaiting approval. Oldest is overdue.`,
        priority:    "high",
        href:        `/automation?clientId=${cid}`,
      });
    }

    if (item.hasStaleSync) {
      risks.push({
        id:          `sync-${cid}`,
        clientId:    cid,
        clientName:  name,
        riskType:    "stale_sync",
        title:       `${name} — Stale data sync`,
        description: "No successful sync in the last 48 hours. Metrics may be outdated.",
        priority:    "medium",
        href:        "/integrations",
      });
    }

    if (
      item.roas !== null && item.roasGoal !== null &&
      item.roasGoal > 0 && item.roas < item.roasGoal * 0.7
    ) {
      risks.push({
        id:          `goal-${cid}`,
        clientId:    cid,
        clientName:  name,
        riskType:    "goal_miss",
        title:       `${name} — ROAS significantly below goal`,
        description: `ROAS ${item.roas.toFixed(2)}x vs goal ${item.roasGoal.toFixed(2)}x (CRM, 7-day attribution).`,
        priority:    "high",
        href:        item.links.commandCenter,
      });
    }
  }

  risks.sort((a, b) => (PRIORITY_WEIGHT[b.priority] ?? 0) - (PRIORITY_WEIGHT[a.priority] ?? 0));

  // ── Extract opportunities ──────────────────────────────────────────────────

  const opportunities: PortfolioOpportunityItem[] = [];

  for (const item of healthBoard) {
    const cid  = item.clientId;
    const name = item.clientName;

    // Experiments with winners needing action
    const expsWithWinner = (experimentsByClient[cid] ?? []).filter(
      (e) => e.status === "completed" && e.results[0]?.outcome === "challenger_wins"
    );
    for (const exp of expsWithWinner.slice(0, 2)) {
      opportunities.push({
        id:              `exp-${exp.id}`,
        clientId:        cid,
        clientName:      name,
        opportunityType: "experiment_winner",
        title:           `${name} — Experiment winner ready`,
        description:     exp.results[0]?.recommendedAction ?? "Challenger won. Review and deploy the winning variant.",
        priority:        "high",
        href:            "/experiments",
      });
    }

    // Strong ROAS well above goal
    if (
      item.roas !== null && item.roasGoal !== null &&
      item.roasGoal > 0 && item.roas > item.roasGoal * 1.3
    ) {
      opportunities.push({
        id:              `roas-${cid}`,
        clientId:        cid,
        clientName:      name,
        opportunityType: "strong_roas",
        title:           `${name} — ROAS ${item.roas.toFixed(2)}x (above goal)`,
        description:     `Goal: ${item.roasGoal.toFixed(2)}x. Performance is strong — consider scaling budget.`,
        priority:        "medium",
        href:            item.links.commandCenter,
      });
    }

    // Creative items approved and awaiting launch
    const readyCount = creativesByClient[cid] ?? 0;
    if (readyCount > 0) {
      opportunities.push({
        id:              `creative-${cid}`,
        clientId:        cid,
        clientName:      name,
        opportunityType: "creative_ready",
        title:           `${name} — ${readyCount} creative${readyCount !== 1 ? "s" : ""} ready to launch`,
        description:     "Approved variants are awaiting publication to Meta.",
        priority:        "medium",
        href:            "/creative-lab",
      });
    }

    // Under-budget with goal-meeting ROAS (opportunity to scale spend)
    if (
      item.pacingStatus === "under_pacing" &&
      item.pacingPct !== null && item.pacingPct > 40 && item.pacingPct < 85 &&
      item.roas !== null && item.roasGoal !== null && item.roas >= item.roasGoal
    ) {
      opportunities.push({
        id:              `budget-${cid}`,
        clientId:        cid,
        clientName:      name,
        opportunityType: "under_budget",
        title:           `${name} — Under-spending with on-goal ROAS`,
        description:     `Pacing at ${Math.round(item.pacingPct)}% while meeting ROAS goal. Budget increase may drive growth.`,
        priority:        "medium",
        href:            "/pacing",
      });
    }
  }

  opportunities.sort((a, b) => (PRIORITY_WEIGHT[b.priority] ?? 0) - (PRIORITY_WEIGHT[a.priority] ?? 0));

  // ── Build approval snapshots ───────────────────────────────────────────────

  const approvalSnapshots: PortfolioApprovalSummary[] = [];
  for (const client of clients) {
    const data = approvalsByClient[client.id];
    if (!data || data.count === 0) continue;
    approvalSnapshots.push({
      clientId:        client.id,
      clientName:      client.name,
      count:           data.count,
      oldestPendingAt: data.oldestAt.toISOString(),
      hasCritical:     data.hasCritical,
      href:            `/automation?clientId=${client.id}`,
    });
  }
  approvalSnapshots.sort((a, b) => {
    if (a.hasCritical !== b.hasCritical) return a.hasCritical ? -1 : 1;
    return b.count - a.count;
  });

  // ── Build automation snapshots ─────────────────────────────────────────────

  const automationSnapshots: PortfolioAutomationSummary[] = clients.map((client) => {
    const cid         = client.id;
    const autonomyMode = (policyByClient[cid] ?? null) as PortfolioAutonomyMode | null;
    return {
      clientId:             cid,
      clientName:           client.name,
      autonomyMode,
      hasEmergencyStop:     stoppedClientIds.has(cid),
      isRestricted:         autonomyMode === "restricted",
      autoExecutionEnabled: autoExecByClient[cid] ?? false,
      recentExecutionCount: execLogsByClient[cid]  ?? 0,
      href:                 "/automation/governance",
    };
  });

  // ── Portfolio summary ──────────────────────────────────────────────────────

  const totalSpend   = healthBoard.reduce((s, h) => s + h.spend,   0);
  const totalRevenue = healthBoard.reduce((s, h) => s + h.revenue, 0);
  const totalOrders  = healthBoard.reduce((s, h) => s + h.orders,  0);

  const summary: PortfolioSummary = {
    generatedAt:  now.toISOString(),
    dateRange:    { from: dateFrom, to: dateTo },
    totalSpend,
    totalRevenue,
    portfolioRoas: totalSpend  > 0 ? totalRevenue / totalSpend  : null,
    portfolioCpa:  totalOrders > 0 ? totalSpend   / totalOrders : null,
    totalOrders,
    totalClients: clients.length,
    accountsAtRisk:
      healthBoard.filter((h) => h.healthLabel === "critical" || h.healthLabel === "at_risk").length,
    accountsWithUrgentApprovals:
      approvalSnapshots.filter((a) => a.hasCritical).length,
    accountsWithHighPriorityOpportunities:
      new Set(
        opportunities
          .filter((o) => o.priority === "high" || o.priority === "critical")
          .map((o) => o.clientId)
      ).size,
    accountsUnderEmergencyStop:
      healthBoard.filter((h) => h.hasEmergencyStop).length,
    accountsUnderRestrictedMode:
      healthBoard.filter((h) => h.isRestricted).length,
    pendingApprovalsCount:  rawApprovals.length,
    unresolvedAlertsCount:  rawAlerts.length,
    activeExperimentsCount: experiments.filter(
      (e) => e.status === "active" || e.status === "evaluating"
    ).length,
  };

  return {
    summary,
    healthBoard,
    risks:               risks.slice(0, 20),
    opportunities:       opportunities.slice(0, 20),
    approvalSnapshots,
    automationSnapshots,
    clients: clients.map((c) => ({ id: c.id, name: c.name })),
  };
}
