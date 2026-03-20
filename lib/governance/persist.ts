// lib/governance/persist.ts
// Database access for GovernanceStop and AutomationOverride records.

import { prisma } from "../db";
import type {
  EmergencyStopState,
  EmergencyStopScope,
  AutomationOverrideRecord,
  OverrideType,
  SetStopInput,
  ApplyOverrideInput,
} from "./types";

// ---------------------------------------------------------------------------
// Serialisation helpers
// ---------------------------------------------------------------------------

function toStop(row: {
  id:          string;
  workspaceId: string;
  scope:       string;
  scopeId:     string;
  reason:      string;
  stoppedBy:   string | null;
  isActive:    boolean;
  expiresAt:   Date | null;
  clearedAt:   Date | null;
  clearedBy:   string | null;
  createdAt:   Date;
  updatedAt:   Date;
}): EmergencyStopState {
  return {
    ...row,
    scope:     row.scope as EmergencyStopScope,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    clearedAt: row.clearedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toOverride(row: {
  id:           string;
  workspaceId:  string;
  overrideType: string;
  scope:        string;
  scopeId:      string;
  actionId:     string | null;
  reason:       string;
  appliedBy:    string | null;
  isActive:     boolean;
  expiresAt:    Date | null;
  clearedAt:    Date | null;
  clearedBy:    string | null;
  metadata:     string;
  createdAt:    Date;
  updatedAt:    Date;
}): AutomationOverrideRecord {
  let metadata: Record<string, unknown> = {};
  try { metadata = JSON.parse(row.metadata) as Record<string, unknown>; } catch { /* ok */ }

  return {
    ...row,
    overrideType: row.overrideType as OverrideType,
    scope:        row.scope as EmergencyStopScope,
    metadata,
    expiresAt:    row.expiresAt?.toISOString() ?? null,
    clearedAt:    row.clearedAt?.toISOString() ?? null,
    createdAt:    row.createdAt.toISOString(),
    updatedAt:    row.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// GovernanceStop — reads
// ---------------------------------------------------------------------------

export async function getActiveStops(
  workspaceId: string
): Promise<EmergencyStopState[]> {
  const now  = new Date();
  const rows = await prisma.governanceStop.findMany({
    where: {
      workspaceId,
      isActive:  true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toStop);
}

/**
 * Check if any active stop covers a given execution context.
 * Checks in order: global → client → action_type → campaign.
 * One DB query; returns first matching stop.
 */
export async function queryActiveStopsForExecution(input: {
  workspaceId: string;
  clientId:    string;
  actionType:  string;
  entityId:    string;
}): Promise<EmergencyStopState | null> {
  const now     = new Date();
  const orItems = [
    { scope: "global",      scopeId: "global" },
    { scope: "client",      scopeId: input.clientId },
    { scope: "action_type", scopeId: input.actionType },
    { scope: "campaign",    scopeId: input.entityId },
  ];

  const row = await prisma.governanceStop.findFirst({
    where: {
      workspaceId: input.workspaceId,
      isActive:    true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      AND: [{ OR: orItems }],
    },
    orderBy: { createdAt: "asc" },
  });

  return row ? toStop(row) : null;
}

// ---------------------------------------------------------------------------
// GovernanceStop — writes
// ---------------------------------------------------------------------------

export async function createGovernanceStop(
  input: SetStopInput
): Promise<EmergencyStopState> {
  const row = await prisma.governanceStop.create({
    data: {
      workspaceId: input.workspaceId,
      scope:       input.scope,
      scopeId:     input.scopeId,
      reason:      input.reason,
      stoppedBy:   input.stoppedBy ?? null,
      isActive:    true,
      expiresAt:   input.expiresAt ?? null,
    },
  });
  return toStop(row);
}

export async function clearGovernanceStop(
  stopId:    string,
  clearedBy: string | null
): Promise<EmergencyStopState | null> {
  const existing = await prisma.governanceStop.findUnique({ where: { id: stopId } });
  if (!existing) return null;

  const row = await prisma.governanceStop.update({
    where: { id: stopId },
    data: {
      isActive:  false,
      clearedAt: new Date(),
      clearedBy: clearedBy ?? null,
    },
  });
  return toStop(row);
}

// ---------------------------------------------------------------------------
// AutomationOverride — reads
// ---------------------------------------------------------------------------

export async function getActiveOverrides(
  workspaceId: string
): Promise<AutomationOverrideRecord[]> {
  const now  = new Date();
  const rows = await prisma.automationOverride.findMany({
    where: {
      workspaceId,
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toOverride);
}

export async function getActiveOverridesForScope(
  workspaceId: string,
  scope:       string,
  scopeId:     string
): Promise<AutomationOverrideRecord[]> {
  const now  = new Date();
  const rows = await prisma.automationOverride.findMany({
    where: {
      workspaceId,
      scope,
      scopeId,
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toOverride);
}

export async function getActiveOverrideForAction(
  actionId: string
): Promise<AutomationOverrideRecord | null> {
  const now = new Date();
  const row = await prisma.automationOverride.findFirst({
    where: {
      actionId,
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
  });
  return row ? toOverride(row) : null;
}

// ---------------------------------------------------------------------------
// AutomationOverride — writes
// ---------------------------------------------------------------------------

export async function createAutomationOverride(
  input: ApplyOverrideInput
): Promise<AutomationOverrideRecord> {
  const row = await prisma.automationOverride.create({
    data: {
      workspaceId:  input.workspaceId,
      overrideType: input.overrideType,
      scope:        input.scope,
      scopeId:      input.scopeId,
      actionId:     input.actionId ?? null,
      reason:       input.reason,
      appliedBy:    input.appliedBy ?? null,
      isActive:     true,
      expiresAt:    input.expiresAt ?? null,
      metadata:     JSON.stringify(input.metadata ?? {}),
    },
  });
  return toOverride(row);
}

export async function clearAutomationOverride(
  overrideId: string,
  clearedBy:  string | null
): Promise<AutomationOverrideRecord | null> {
  const existing = await prisma.automationOverride.findUnique({ where: { id: overrideId } });
  if (!existing) return null;

  const row = await prisma.automationOverride.update({
    where: { id: overrideId },
    data: {
      isActive:  false,
      clearedAt: new Date(),
      clearedBy: clearedBy ?? null,
    },
  });
  return toOverride(row);
}

// ---------------------------------------------------------------------------
// Aggregate counts for governance summary
// ---------------------------------------------------------------------------

export async function getGovernanceCounts(workspaceId: string): Promise<{
  activeStops:     number;
  activeOverrides: number;
  pendingApprovals: number;
  deferredActions:  number;
  pendingEscalations: number;
}> {
  const now = new Date();

  const [stops, overrides, pending, deferred, escalated] = await Promise.all([
    prisma.governanceStop.count({
      where: {
        workspaceId,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    }),
    prisma.automationOverride.count({
      where: {
        workspaceId,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    }),
    prisma.proposedAutomationAction.count({
      where: {
        workspaceId: workspaceId ?? undefined,
        status: "proposed",
      },
    }),
    prisma.proposedAutomationAction.count({
      where: {
        workspaceId: workspaceId ?? undefined,
        status: "deferred",
      },
    }),
    prisma.proposedAutomationAction.count({
      where: {
        workspaceId: workspaceId ?? undefined,
        status: "escalated",
      },
    }),
  ]);

  return {
    activeStops:        stops,
    activeOverrides:    overrides,
    pendingApprovals:   pending,
    deferredActions:    deferred,
    pendingEscalations: escalated,
  };
}
