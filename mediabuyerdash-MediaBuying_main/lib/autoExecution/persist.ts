// lib/autoExecution/persist.ts
// Database access for auto-execution settings and logs.
// All writes use cuid() IDs to match the rest of the app.

import { prisma } from "../db";
import type {
  AutoExecutionSettingsRow,
  AutoExecutionLogRow,
  AutoExecutionLogInput,
} from "./types";

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/**
 * Returns auto-execution settings for a client account, creating a default
 * disabled row if one does not exist yet.
 */
export async function getOrCreateAutoExecutionSettings(
  clientAccountId: string,
  workspaceId:     string | null
): Promise<AutoExecutionSettingsRow> {
  const existing = await prisma.autoExecutionSettings.findUnique({
    where: { clientAccountId },
  });

  if (existing) {
    return existing as AutoExecutionSettingsRow;
  }

  const created = await prisma.autoExecutionSettings.create({
    data: {
      clientAccountId,
      workspaceId,
      enabled:            false,
      allowRunSync:       true,
      allowPauseCampaign: false,
      maxDailyExecutions: 5,
      maxSpendThreshold:  500,
      minRoasThreshold:   0.4,
    },
  });

  return created as AutoExecutionSettingsRow;
}

/**
 * Updates a subset of auto-execution settings for a client.
 */
export async function updateAutoExecutionSettings(
  clientAccountId: string,
  updates: Partial<Omit<AutoExecutionSettingsRow, "id" | "clientAccountId" | "createdAt" | "updatedAt">>
): Promise<AutoExecutionSettingsRow> {
  const updated = await prisma.autoExecutionSettings.update({
    where: { clientAccountId },
    data:  updates,
  });
  return updated as AutoExecutionSettingsRow;
}

/**
 * Loads all auto-execution settings for all clients in a workspace.
 * Used by the executor to determine which clients are eligible.
 */
export async function loadAllAutoExecutionSettings(
  workspaceId: string | null
): Promise<AutoExecutionSettingsRow[]> {
  const rows = await prisma.autoExecutionSettings.findMany({
    where: workspaceId ? { workspaceId } : {},
    orderBy: { createdAt: "asc" },
  });
  return rows as AutoExecutionSettingsRow[];
}

// ---------------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------------

/**
 * Creates an audit log entry for one auto-execution attempt.
 */
export async function logAutoExecutionRun(
  input: AutoExecutionLogInput
): Promise<AutoExecutionLogRow> {
  const row = await prisma.autoExecutionLog.create({
    data: {
      workspaceId:    input.workspaceId,
      clientAccountId: input.clientAccountId,
      actionType:     input.actionType,
      entityType:     input.entityType,
      entityId:       input.entityId,
      entityName:     input.entityName,
      status:         input.status,
      guardrailJson:  JSON.stringify(input.guardrailResults),
      decision:       input.decision,
      decisionReason: input.decisionReason,
      durationMs:     input.durationMs,
      errorMessage:   input.errorMessage,
    },
  });

  return toLogRow(row);
}

/**
 * Loads recent auto-execution log entries for a workspace.
 */
export async function loadAutoExecutionHistory(
  workspaceId: string | null,
  limit = 50
): Promise<AutoExecutionLogRow[]> {
  const rows = await prisma.autoExecutionLog.findMany({
    where: workspaceId ? { workspaceId } : {},
    orderBy: { executedAt: "desc" },
    take: limit,
  });
  return rows.map(toLogRow);
}

/**
 * Counts how many successful or attempted executions have run today for a client.
 * Used to enforce maxDailyExecutions.
 */
export async function countTodayExecutions(
  clientAccountId: string
): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  return prisma.autoExecutionLog.count({
    where: {
      clientAccountId,
      status:    { in: ["success", "failed", "pending"] },
      executedAt: { gte: startOfDay },
    },
  });
}

/**
 * Returns the most recent execution log for a specific entity + action type.
 * Used to prevent re-executing too frequently (e.g. pausing a campaign twice).
 */
export async function getLastExecutionForEntity(
  entityId:   string,
  actionType: string
): Promise<AutoExecutionLogRow | null> {
  const row = await prisma.autoExecutionLog.findFirst({
    where:   { entityId, actionType },
    orderBy: { executedAt: "desc" },
  });
  return row ? toLogRow(row) : null;
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function toLogRow(raw: {
  id:              string;
  workspaceId:     string | null;
  clientAccountId: string | null;
  actionType:      string;
  entityType:      string;
  entityId:        string;
  entityName:      string;
  status:          string;
  guardrailJson:   string;
  decision:        string;
  decisionReason:  string;
  durationMs:      number | null;
  errorMessage:    string | null;
  executedAt:      Date;
  createdAt:       Date;
}): AutoExecutionLogRow {
  return {
    ...raw,
    status:          raw.status          as AutoExecutionLogRow["status"],
    decision:        raw.decision        as AutoExecutionLogRow["decision"],
    guardrailResults: (() => {
      try { return JSON.parse(raw.guardrailJson); } catch { return []; }
    })(),
  };
}
