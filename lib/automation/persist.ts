// lib/automation/persist.ts
// DB persistence layer for proposed automation actions.

import { prisma } from "../db";
import type {
  ProposedAutomationActionDraft,
  ProposedAutomationActionRow,
  AutomationSummary,
} from "./types";

// ---------------------------------------------------------------------------
// Upsert logic
//   - If a proposed action with the same deduplicationKey is already in
//     "proposed" status → skip (don't create a duplicate)
//   - If no active proposed action with that key → create a new one
//   - Approved/rejected/executed/expired actions allow re-proposal
// ---------------------------------------------------------------------------

export async function upsertProposedActions(
  drafts: ProposedAutomationActionDraft[]
): Promise<void> {
  if (drafts.length === 0) return;

  const keys = drafts.map((d) => d.deduplicationKey);

  const existing = await prisma.proposedAutomationAction.findMany({
    where: {
      deduplicationKey: { in: keys },
      status:           "proposed",
    },
    select: { deduplicationKey: true },
  });

  const activeKeys = new Set(existing.map((e) => e.deduplicationKey));

  const toCreate = drafts.filter((d) => !activeKeys.has(d.deduplicationKey));
  if (toCreate.length === 0) return;

  await prisma.proposedAutomationAction.createMany({
    data: toCreate.map((d) => ({
      id:               crypto.randomUUID(),
      workspaceId:      d.workspaceId,
      clientAccountId:  d.clientAccountId,
      clientName:       d.clientName,
      automationRuleId: d.automationRuleId,
      actionType:       d.actionType,
      status:           "proposed",
      priority:         d.priority,
      entityType:       d.entityType,
      entityId:         d.entityId,
      entityName:       d.entityName,
      rationale:        d.rationale,
      supportingData:   JSON.stringify(d.supportingData),
      deduplicationKey: d.deduplicationKey,
      expiresAt:        d.expiresAt,
    })),
  });
}

// ---------------------------------------------------------------------------
// Load all actions for a workspace (filterable)
// ---------------------------------------------------------------------------

type LoadOptions = {
  clientId?:  string;
  actionType?: string;
  priority?:  string;
  status?:    string;
};

function mapRow(r: {
  id: string;
  workspaceId: string | null;
  clientAccountId: string;
  clientName: string;
  actionType: string;
  status: string;
  priority: string;
  entityType: string;
  entityId: string;
  entityName: string;
  rationale: string;
  supportingData: string;
  deduplicationKey: string;
  proposedAt: Date;
  expiresAt: Date | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  deferredUntil?: Date | null;
  escalatedAt?: Date | null;
  escalationNote?: string | null;
}): ProposedAutomationActionRow {
  let supportingData: Record<string, string | number> = {};
  try { supportingData = JSON.parse(r.supportingData); } catch { /* noop */ }

  return {
    id:               r.id,
    workspaceId:      r.workspaceId,
    clientAccountId:  r.clientAccountId,
    clientName:       r.clientName,
    actionType:       r.actionType as ProposedAutomationActionRow["actionType"],
    status:           r.status as ProposedAutomationActionRow["status"],
    priority:         r.priority as ProposedAutomationActionRow["priority"],
    entityType:       r.entityType as ProposedAutomationActionRow["entityType"],
    entityId:         r.entityId,
    entityName:       r.entityName,
    rationale:        r.rationale,
    supportingData,
    deduplicationKey: r.deduplicationKey,
    proposedAt:       r.proposedAt.toISOString(),
    expiresAt:        r.expiresAt?.toISOString()    ?? null,
    approvedAt:       r.approvedAt?.toISOString()   ?? null,
    rejectedAt:       r.rejectedAt?.toISOString()   ?? null,
    rejectionReason:  r.rejectionReason,
    deferredUntil:    r.deferredUntil?.toISOString() ?? null,
    escalatedAt:      r.escalatedAt?.toISOString()   ?? null,
    escalationNote:   r.escalationNote               ?? null,
  };
}

export async function loadProposedActions(
  workspaceId: string | null,
  options: LoadOptions = {}
): Promise<ProposedAutomationActionRow[]> {
  const where: Record<string, unknown> = {};
  if (workspaceId) where.workspaceId = workspaceId;
  if (options.clientId)   where.clientAccountId = options.clientId;
  if (options.actionType) where.actionType = options.actionType;
  if (options.priority)   where.priority   = options.priority;
  if (options.status)     where.status     = options.status;

  const rows = await prisma.proposedAutomationAction.findMany({
    where,
    orderBy: [{ priority: "desc" }, { proposedAt: "desc" }],
    take:    500,
  });

  return rows.map(mapRow);
}

// ---------------------------------------------------------------------------
// Load top proposed (high priority first) for Operations page
// ---------------------------------------------------------------------------

export async function loadTopProposedActions(
  workspaceId: string | null,
  limit = 5
): Promise<ProposedAutomationActionRow[]> {
  const where: Record<string, unknown> = { status: "proposed" };
  if (workspaceId) where.workspaceId = workspaceId;

  const rows = await prisma.proposedAutomationAction.findMany({
    where,
    orderBy: [{ priority: "desc" }, { proposedAt: "desc" }],
    take:    limit,
  });

  return rows.map(mapRow);
}

// ---------------------------------------------------------------------------
// Approve / reject
// ---------------------------------------------------------------------------

export async function approveAutomationAction(actionId: string): Promise<void> {
  await prisma.proposedAutomationAction.update({
    where: { id: actionId },
    data:  { status: "approved", approvedAt: new Date() },
  });
}

export async function rejectAutomationAction(
  actionId: string,
  reason?: string
): Promise<void> {
  await prisma.proposedAutomationAction.update({
    where: { id: actionId },
    data:  {
      status:         "rejected",
      rejectedAt:     new Date(),
      rejectionReason: reason ?? null,
    },
  });
}

// ---------------------------------------------------------------------------
// Summary counts
// ---------------------------------------------------------------------------

export async function buildAutomationSummary(
  workspaceId: string | null
): Promise<AutomationSummary> {
  const where: Record<string, unknown> = {};
  if (workspaceId) where.workspaceId = workspaceId;

  const groups = await prisma.proposedAutomationAction.groupBy({
    by:    ["status", "priority"],
    where,
    _count: { _all: true },
  });

  let proposedCount     = 0;
  let highPriorityCount = 0;
  let approvedCount     = 0;
  let rejectedCount     = 0;
  let totalCount        = 0;

  for (const g of groups) {
    const n = g._count._all;
    totalCount += n;
    if (g.status === "proposed")  proposedCount     += n;
    if (g.status === "approved")  approvedCount     += n;
    if (g.status === "rejected")  rejectedCount     += n;
    if (g.priority === "high" && g.status === "proposed") highPriorityCount += n;
  }

  return { proposedCount, highPriorityCount, approvedCount, rejectedCount, totalCount };
}
