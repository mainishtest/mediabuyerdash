// lib/alerts/persist.ts
// DB read/write helpers for alert events.
//
// Upsert logic:
//   - If an open/acknowledged alert with the same deduplicationKey exists
//     → update lastDetectedAt only (don't overwrite user status)
//   - If none exists (or all resolved) → create new open alert
//   This allows re-alerting after a user resolves and the condition recurs.

import { prisma }              from "../db";
import type { AlertEventDraft, AlertEventRow, AlertStatus } from "./types";

// ---------------------------------------------------------------------------
// Upsert a set of drafts into the DB
// ---------------------------------------------------------------------------

export async function upsertAlerts(drafts: AlertEventDraft[]): Promise<void> {
  if (drafts.length === 0) return;

  // Fetch all active (open/acknowledged) alerts whose dedup keys are in this batch.
  const keys = drafts.map((d) => d.deduplicationKey);
  const existing = await prisma.alertEvent.findMany({
    where: {
      deduplicationKey: { in: keys },
      status:           { in: ["open", "acknowledged"] },
    },
    select: { id: true, deduplicationKey: true },
  });
  const activeKeySet = new Map(existing.map((e) => [e.deduplicationKey, e.id]));

  const now        = new Date();
  const toCreate:  AlertEventDraft[] = [];
  const toUpdateIds: string[]        = [];

  for (const draft of drafts) {
    const existingId = activeKeySet.get(draft.deduplicationKey);
    if (existingId) {
      toUpdateIds.push(existingId);
    } else {
      toCreate.push(draft);
    }
  }

  // Batch update existing — just refresh lastDetectedAt
  if (toUpdateIds.length > 0) {
    await prisma.alertEvent.updateMany({
      where: { id: { in: toUpdateIds } },
      data:  { lastDetectedAt: now, updatedAt: now },
    });
  }

  // Create new alerts one by one (Prisma createMany can't use per-row data easily)
  if (toCreate.length > 0) {
    await prisma.$transaction(
      toCreate.map((d) =>
        prisma.alertEvent.create({
          data: {
            clientAccountId:  d.clientAccountId,
            clientName:       d.clientName,
            workspaceId:      d.workspaceId,
            alertType:        d.alertType,
            severity:         d.severity,
            status:           "open",
            source:           d.source,
            entityType:       d.entityType,
            entityId:         d.entityId,
            entityName:       d.entityName,
            summary:          d.summary,
            supportingMetrics: JSON.stringify(d.supportingMetrics),
            deduplicationKey: d.deduplicationKey,
            detectedAt:       now,
            lastDetectedAt:   now,
          },
        })
      )
    );
  }
}

// ---------------------------------------------------------------------------
// Load alerts (for the alerts page)
// ---------------------------------------------------------------------------

export async function loadAlerts(
  workspaceId: string | null,
  options: {
    status?:    AlertStatus[];
    limit?:     number;
    orderBy?:   "lastDetectedAt" | "detectedAt";
  } = {}
): Promise<AlertEventRow[]> {
  const { status, limit = 500, orderBy = "lastDetectedAt" } = options;

  const where: Record<string, unknown> = {};
  if (workspaceId) where.workspaceId = workspaceId;
  if (status)      where.status      = { in: status };

  const rows = await prisma.alertEvent.findMany({
    where,
    orderBy: { [orderBy]: "desc" },
    take:    limit,
  });

  return rows.map(deserializeAlert);
}

// ---------------------------------------------------------------------------
// Load top open alerts for the Operations page
// ---------------------------------------------------------------------------

export async function loadTopOpenAlerts(
  workspaceId: string | null,
  limit = 5
): Promise<AlertEventRow[]> {
  const where: Record<string, unknown> = { status: "open" };
  if (workspaceId) where.workspaceId = workspaceId;

  const rows = await prisma.alertEvent.findMany({
    where,
    orderBy: [
      { severity:        "desc" },   // high first
      { lastDetectedAt:  "desc" },
    ],
    take: limit,
  });

  return rows.map(deserializeAlert);
}

// ---------------------------------------------------------------------------
// Acknowledge / Resolve
// ---------------------------------------------------------------------------

export async function acknowledgeAlert(alertId: string): Promise<void> {
  await prisma.alertEvent.update({
    where: { id: alertId },
    data:  { status: "acknowledged", acknowledgedAt: new Date() },
  });
}

export async function resolveAlert(alertId: string): Promise<void> {
  await prisma.alertEvent.update({
    where: { id: alertId },
    data:  { status: "resolved", resolvedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Deserialise DB row → AlertEventRow
// ---------------------------------------------------------------------------

function deserializeAlert(row: {
  id:               string;
  workspaceId:      string | null;
  clientAccountId:  string;
  clientName:       string;
  alertType:        string;
  severity:         string;
  status:           string;
  source:           string;
  entityType:       string;
  entityId:         string;
  entityName:       string;
  summary:          string;
  supportingMetrics: string;
  deduplicationKey: string;
  detectedAt:       Date;
  lastDetectedAt:   Date;
  acknowledgedAt:   Date | null;
  resolvedAt:       Date | null;
}): AlertEventRow {
  let metrics: Record<string, string | number> = {};
  try { metrics = JSON.parse(row.supportingMetrics); } catch { /* keep empty */ }

  return {
    id:               row.id,
    workspaceId:      row.workspaceId,
    clientAccountId:  row.clientAccountId,
    clientName:       row.clientName,
    alertType:        row.alertType        as AlertEventRow["alertType"],
    severity:         row.severity         as AlertEventRow["severity"],
    status:           row.status           as AlertEventRow["status"],
    source:           row.source           as AlertEventRow["source"],
    entityType:       row.entityType       as AlertEventRow["entityType"],
    entityId:         row.entityId,
    entityName:       row.entityName,
    summary:          row.summary,
    supportingMetrics: metrics,
    deduplicationKey: row.deduplicationKey,
    detectedAt:       row.detectedAt.toISOString(),
    lastDetectedAt:   row.lastDetectedAt.toISOString(),
    acknowledgedAt:   row.acknowledgedAt?.toISOString() ?? null,
    resolvedAt:       row.resolvedAt?.toISOString()     ?? null,
  };
}
