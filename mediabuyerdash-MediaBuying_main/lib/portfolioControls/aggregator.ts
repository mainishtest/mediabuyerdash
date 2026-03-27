// ─── Portfolio Controls — Main Aggregator ─────────────────────────────────────
//
// Single entry point for the Portfolio Control Board.
// Makes direct Prisma queries — this is the authoritative control surface.
// Does NOT reuse PortfolioPayload: control board needs fresh, detailed state.
//
// Orchestrates:
//   - approval board (pending / deferred / escalated)
//   - automation state per client
//   - governance controls (stops + overrides)
//   - governance blockers

import { prisma }    from "../db";
import { buildPortfolioApprovalBoard, summarizePortfolioApprovalAging } from "./approvalBoard";
import { buildPortfolioAutomationStateBoard, summarizePortfolioAutonomyState } from "./automationState";
import {
  buildPortfolioGovernanceControlBoard,
  summarizePortfolioEmergencyStops,
  buildGovernanceBlockers,
} from "./governanceControl";
import type {
  PortfolioControlsPayload,
  PortfolioControlSummary,
  PortfolioApprovalAging,
} from "./types";

// ── Main function ─────────────────────────────────────────────────────────────

export async function buildPortfolioControlsPayload(params: {
  workspaceId: string | null;
  clientId?:   string;
}): Promise<PortfolioControlsPayload> {
  const { workspaceId, clientId } = params;
  const clientFilter = clientId ? { clientAccountId: clientId } : {};
  const wsFilter     = workspaceId ? { workspaceId } : {};

  // ── Parallel DB fetch ────────────────────────────────────────────────────

  const [
    clients,
    rawApprovals,
    rawStops,
    rawOverrides,
    safetyPolicies,
    autoExecSettings,
    recentExecLogs,
  ] = await Promise.all([

    // 1. Active clients
    prisma.clientAccount.findMany({
      where:   { status: "active" },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),

    // 2. Actionable approvals — proposed + deferred + escalated
    prisma.proposedAutomationAction.findMany({
      where: {
        ...clientFilter,
        status: { in: ["proposed", "deferred", "escalated"] },
      },
      select: {
        id:              true,
        clientAccountId: true,
        clientName:      true,
        actionType:      true,
        priority:        true,
        status:          true,
        entityName:      true,
        entityType:      true,
        rationale:       true,
        proposedAt:      true,
        deferredUntil:   true,
        escalatedAt:     true,
        escalationNote:  true,
      },
      orderBy: { proposedAt: "asc" },
    }),

    // 3. Active governance stops
    workspaceId
      ? prisma.governanceStop.findMany({
          where:  { workspaceId, isActive: true },
          select: {
            id:          true,
            workspaceId: true,
            scope:       true,
            scopeId:     true,
            reason:      true,
            stoppedBy:   true,
            isActive:    true,
            expiresAt:   true,
            createdAt:   true,
          },
        })
      : Promise.resolve([]),

    // 4. Active automation overrides
    workspaceId
      ? prisma.automationOverride.findMany({
          where:  { workspaceId, isActive: true },
          select: {
            id:           true,
            workspaceId:  true,
            overrideType: true,
            scope:        true,
            scopeId:      true,
            reason:       true,
            appliedBy:    true,
            isActive:     true,
            expiresAt:    true,
            createdAt:    true,
          },
        })
      : Promise.resolve([]),

    // 5. Safety policies (autonomy modes per client)
    workspaceId
      ? prisma.actionSafetyPolicy.findMany({
          where:  { workspaceId, scope: "client", isActive: true },
          select: { scopeId: true, autonomyMode: true },
        })
      : Promise.resolve([]),

    // 6. Auto-execution settings per client
    prisma.autoExecutionSettings.findMany({
      where:  clientId ? { clientAccountId: clientId } : {},
      select: { clientAccountId: true, enabled: true },
    }),

    // 7. Recent auto-execution logs (last 7 days per client)
    prisma.autoExecutionLog.findMany({
      where: {
        ...(clientId ? { clientAccountId: clientId } : {}),
        executedAt: { gte: new Date(Date.now() - 7 * 864e5) },
        status: "success",
      },
      select: { clientAccountId: true },
    }),
  ]);

  // ── Build lookup maps ────────────────────────────────────────────────────

  const clientNames = new Map(clients.map((c) => [c.id, c.name]));

  // Safety policies by client
  const policyByClient: Record<string, string> = {};
  for (const p of safetyPolicies) policyByClient[p.scopeId] = p.autonomyMode;

  // Auto-exec enabled by client
  const autoExecByClient: Record<string, boolean> = {};
  for (const ae of autoExecSettings) autoExecByClient[ae.clientAccountId] = ae.enabled;

  // Recent exec count by client
  const execCountByClient: Record<string, number> = {};
  for (const log of recentExecLogs) {
    if (log.clientAccountId) {
      execCountByClient[log.clientAccountId] = (execCountByClient[log.clientAccountId] ?? 0) + 1;
    }
  }

  // Pending approvals per client (all actionable statuses)
  const pendingByClient: Record<string, number> = {};
  for (const a of rawApprovals) {
    pendingByClient[a.clientAccountId] = (pendingByClient[a.clientAccountId] ?? 0) + 1;
  }

  // Stop state per client
  const stoppedClientIds = new Set(
    rawStops.filter((s) => s.scope === "client").map((s) => s.scopeId)
  );
  const hasGlobalStop = rawStops.some((s) => s.scope === "global");

  // ── Build approval board ─────────────────────────────────────────────────

  const approvalBoard = buildPortfolioApprovalBoard(rawApprovals.map((r) => ({
    id:              r.id,
    clientAccountId: r.clientAccountId,
    clientName:      r.clientName,
    actionType:      r.actionType,
    priority:        r.priority,
    status:          r.status,
    entityName:      r.entityName,
    entityType:      r.entityType,
    rationale:       r.rationale,
    proposedAt:      r.proposedAt,
    deferredUntil:   r.deferredUntil,
    escalatedAt:     r.escalatedAt,
    escalationNote:  r.escalationNote,
  })));

  const approvalAging: PortfolioApprovalAging = summarizePortfolioApprovalAging(approvalBoard);

  // ── Build automation state board ─────────────────────────────────────────

  const automationState = buildPortfolioAutomationStateBoard(
    clients.map((c) => {
      const autonomyMode = policyByClient[c.id] ?? null;
      const hasStop      = hasGlobalStop || stoppedClientIds.has(c.id);
      const isRestricted = autonomyMode === "restricted";

      return {
        clientId:             c.id,
        clientName:           c.name,
        autoExecEnabled:      autoExecByClient[c.id] ?? false,
        autonomyMode,
        hasEmergencyStop:     hasStop,
        isRestricted,
        recentExecutionCount: execCountByClient[c.id] ?? 0,
        pendingApprovalCount: pendingByClient[c.id] ?? 0,
      };
    })
  );

  const autonomySummary = summarizePortfolioAutonomyState(automationState);

  // ── Build governance control items ───────────────────────────────────────

  const governanceControls = buildPortfolioGovernanceControlBoard({
    stops:       rawStops,
    overrides:   rawOverrides,
    clientNames,
  });

  const emergencyStopSummary = summarizePortfolioEmergencyStops(
    governanceControls,
    clientNames
  );

  // ── Build governance blockers ────────────────────────────────────────────

  // Overdue approvals per client (>48h)
  const overdueByClient = new Map<string, number>();
  for (const a of approvalBoard) {
    if (a.agingBucket === "critical") {
      overdueByClient.set(a.clientId, (overdueByClient.get(a.clientId) ?? 0) + 1);
    }
  }

  const governanceBlockers = buildGovernanceBlockers(
    automationState,
    overdueByClient,
    new Set(stoppedClientIds)
  );

  // ── Portfolio control summary ────────────────────────────────────────────

  const criticalAgingApprovals = approvalAging.critical;
  const overdueApprovals       = approvalAging.critical + approvalAging.overdue;

  const accountsReady = automationState.filter(
    (s) => s.executionReadiness === "ready"
  ).length;

  const accountsRestricted = automationState.filter(
    (s) => s.executionReadiness === "restricted" || s.executionReadiness === "stopped"
  ).length;

  const accountsAutoExecEnabled = automationState.filter(
    (s) => s.autoExecEnabled
  ).length;

  const summary: PortfolioControlSummary = {
    generatedAt:             new Date().toISOString(),
    totalPendingApprovals:   approvalBoard.length,
    criticalAgingApprovals,
    overdueApprovals,
    totalActiveStops:        rawStops.length,
    globalStopsActive:       rawStops.filter((s) => s.scope === "global").length,
    totalActiveOverrides:    rawOverrides.length,
    accountsWithBlockers:    governanceBlockers.length,
    accountsReady,
    accountsRestricted,
    accountsAutoExecEnabled,
    totalClients:            clients.length,
  };

  return {
    summary,
    approvalBoard,
    approvalAging,
    automationState,
    autonomySummary,
    governanceControls,
    emergencyStopSummary,
    governanceBlockers,
    clients: clients.map((c) => ({ id: c.id, name: c.name })),
  };
}
