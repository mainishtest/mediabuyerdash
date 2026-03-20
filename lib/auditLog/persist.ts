// lib/auditLog/persist.ts
// Database persistence for the Automation Audit Log layer.
//
// Three data sources:
//   1. AutomationAuditLog  — native audit entries written by this module.
//   2. AutoExecutionLog    — bridged: synthesised from the guarded executor.
//   3. ProposedAutomationAction — bridged: lifecycle events from action status.
//
// loadCombinedAuditHistory() merges all three, deduplicates by relatedId,
// and returns a unified sorted list.

import { prisma } from "../db";
import {
  buildAutomationAuditEntry,
  buildRollbackReadiness,
  computeRollbackReadiness,
  eventTypeFromExecutionStatus,
  eventTypeFromActionStatus,
  buildExecutionRecord,
  buildApprovalRecord,
  SYSTEM_ACTOR,
  CRON_ACTOR,
} from "./builders";
import type {
  AutomationAuditEntry,
  AutomationEventScope,
  AutomationBlockRecord,
  AuditHistoryFilterInput,
  BuildAuditEntryInput,
  RecordExecutionInput,
  RecordApprovalInput,
  RecordBlockInput,
} from "./types";

// ---------------------------------------------------------------------------
// Helpers — parse JSON blobs stored in the DB
// ---------------------------------------------------------------------------

function safeParseJson<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; }
  catch { return fallback; }
}

// ---------------------------------------------------------------------------
// Convert a raw AutomationAuditLog DB row → AutomationAuditEntry
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToEntry(row: any): AutomationAuditEntry {
  return {
    id:                    row.id,
    workspaceId:           row.workspaceId ?? null,
    clientAccountId:       row.clientAccountId ?? null,
    clientName:            row.clientName ?? null,
    eventType:             row.eventType,
    actionType:            row.actionType,
    scope:                 safeParseJson(row.scopeJson, { entityType: "client", entityId: "", entityName: "Unknown" }),
    actor:                 safeParseJson(row.actorJson, SYSTEM_ACTOR),
    approval:              safeParseJson(row.approvalJson, null),
    execution:             safeParseJson(row.executionJson, null),
    block:                 safeParseJson(row.blockJson, null),
    rollback:              safeParseJson(row.rollbackJson, { state: "rollback_unavailable", preview: null, blockers: [], notes: null }),
    policyDecision:        row.policyDecision ?? null,
    policyReason:          row.policyReason ?? null,
    relatedActionId:       row.relatedActionId ?? null,
    relatedExecutionLogId: row.relatedExecutionLogId ?? null,
    notes:                 row.notes ?? null,
    occurredAt:            new Date(row.occurredAt).toISOString(),
    createdAt:             new Date(row.createdAt).toISOString(),
    source:                "native",
  };
}

// ---------------------------------------------------------------------------
// Write a native audit entry
// ---------------------------------------------------------------------------

export async function writeAuditEntry(
  input: BuildAuditEntryInput
): Promise<AutomationAuditEntry> {
  const draft = buildAutomationAuditEntry(input, "native");

  const row = await prisma.automationAuditLog.create({
    data: {
      workspaceId:           draft.workspaceId,
      clientAccountId:       draft.clientAccountId,
      clientName:            draft.clientName,
      eventType:             draft.eventType,
      actionType:            draft.actionType,
      scopeJson:             JSON.stringify(draft.scope),
      actorJson:             JSON.stringify(draft.actor),
      approvalJson:          draft.approval ? JSON.stringify(draft.approval) : null,
      executionJson:         draft.execution ? JSON.stringify(draft.execution) : null,
      blockJson:             draft.block ? JSON.stringify(draft.block) : null,
      rollbackJson:          JSON.stringify(draft.rollback),
      policyDecision:        draft.policyDecision,
      policyReason:          draft.policyReason,
      relatedActionId:       draft.relatedActionId,
      relatedExecutionLogId: draft.relatedExecutionLogId,
      notes:                 draft.notes,
      occurredAt:            input.occurredAt ?? new Date(),
    },
  });

  return rowToEntry(row);
}

// ---------------------------------------------------------------------------
// High-level convenience: record an execution outcome
// ---------------------------------------------------------------------------

export async function recordAutomationExecution(
  input: RecordExecutionInput
): Promise<AutomationAuditEntry> {
  const isSuccess  = input.status === "success";
  const isBlocked  = input.status === "guardrail_blocked" || input.status === "skipped";
  const eventType  = eventTypeFromExecutionStatus(input.status);
  const rollback   = computeRollbackReadiness(input.actionType, isSuccess ? "success" : "failed");

  const execution = {
    executionLogId:   input.executionLogId,
    status:           input.status,
    durationMs:       input.durationMs,
    errorMessage:     input.errorMessage,
    guardrailResults: input.guardrailResults,
    decisionReason:   input.decisionReason,
    executedAt:       new Date().toISOString(),
  };

  const blockRecord = isBlocked ? {
    source:       "guardrail" as const,
    reason:       input.decisionReason,
    policyReason: null,
    scopeId:      input.scope.entityId,
    blockedAt:    new Date().toISOString(),
  } : null;

  return writeAuditEntry({
    workspaceId:           input.workspaceId,
    clientAccountId:       input.clientAccountId,
    clientName:            input.clientName,
    eventType,
    actionType:            input.actionType,
    scope:                 input.scope,
    actor:                 CRON_ACTOR,
    execution,
    block:                 blockRecord,
    rollback,
    relatedActionId:       input.actionId,
    relatedExecutionLogId: input.executionLogId,
  });
}

// ---------------------------------------------------------------------------
// High-level convenience: record an approval decision
// ---------------------------------------------------------------------------

export async function recordAutomationApproval(
  input: RecordApprovalInput
): Promise<AutomationAuditEntry> {
  const eventType = eventTypeFromActionStatus(input.decision);

  const approval = {
    approvalState: input.decision,
    approvedBy:    input.decision === "approved" ? input.decidedBy : null,
    rejectedBy:    input.decision === "rejected" ? input.decidedBy : null,
    reason:        input.reason,
    routeType:     input.routeType,
    decidedAt:     new Date().toISOString(),
  };

  return writeAuditEntry({
    workspaceId:     input.workspaceId,
    clientAccountId: input.clientAccountId,
    clientName:      input.clientName,
    eventType,
    actionType:      input.actionType,
    scope:           input.scope,
    actor:           {
      type:  "operator",
      id:    input.decidedBy ?? "unknown",
      label: input.decidedBy ?? "Operator",
    },
    approval,
    rollback: buildRollbackReadiness({ state: "rollback_unavailable", blockers: ["Action has not been executed yet"] }),
    relatedActionId: input.actionId,
  });
}

// ---------------------------------------------------------------------------
// High-level convenience: record a block event
// ---------------------------------------------------------------------------

export async function recordAutomationBlock(
  input: RecordBlockInput
): Promise<AutomationAuditEntry> {
  const block: AutomationBlockRecord = {
    source:       input.source,
    reason:       input.reason,
    policyReason: input.policyReason,
    scopeId:      input.scope.entityId,
    blockedAt:    new Date().toISOString(),
  };

  const isStop = input.source === "governance_stop";

  return writeAuditEntry({
    workspaceId:     input.workspaceId,
    clientAccountId: input.clientAccountId,
    clientName:      input.clientName,
    eventType:       isStop ? "emergency_stopped" : "blocked",
    actionType:      input.actionType,
    scope:           input.scope,
    actor:           SYSTEM_ACTOR,
    block,
    rollback:        buildRollbackReadiness({ state: "rollback_unavailable", blockers: ["Action was blocked before execution"] }),
    relatedActionId: input.actionId,
  });
}

// ---------------------------------------------------------------------------
// Load native audit entries
// ---------------------------------------------------------------------------

async function loadNativeEntries(
  workspaceId: string | null,
  limit: number
): Promise<AutomationAuditEntry[]> {
  try {
    const rows = await prisma.automationAuditLog.findMany({
      where:   workspaceId ? { workspaceId } : {},
      orderBy: { occurredAt: "desc" },
      take:    limit,
    });
    return rows.map(rowToEntry);
  } catch {
    // Table may not exist yet (migration pending) — graceful fallback
    return [];
  }
}

// ---------------------------------------------------------------------------
// Bridge: AutoExecutionLog → AutomationAuditEntry[]
// ---------------------------------------------------------------------------

async function loadBridgedExecutionEntries(
  workspaceId: string | null,
  limit: number
): Promise<AutomationAuditEntry[]> {
  const rows = await prisma.autoExecutionLog.findMany({
    where:   workspaceId ? { workspaceId } : {},
    orderBy: { executedAt: "desc" },
    take:    limit,
  });

  return rows.map((row) => {
    const guardrailResults = safeParseJson<{ name: string; passed: boolean; reason: string }[]>(
      (row as { guardrailJson?: string }).guardrailJson ?? "[]",
      []
    );

    const scope: AutomationEventScope = {
      entityType: (row.entityType || "campaign") as AutomationEventScope["entityType"],
      entityId:   row.entityId,
      entityName: row.entityName,
      clientId:   row.clientAccountId ?? undefined,
    };

    const execRecord = buildExecutionRecord({
      id:              row.id,
      status:          row.status,
      durationMs:      row.durationMs ?? null,
      errorMessage:    row.errorMessage ?? null,
      guardrailResults,
      decisionReason:  row.decisionReason,
      executedAt:      row.executedAt,
    });

    const rollback = computeRollbackReadiness(
      row.actionType,
      row.status === "success" ? "success" : null
    );

    const isBlocked = row.status === "guardrail_blocked" || row.status === "skipped";
    const blockRecord: AutomationBlockRecord | null = isBlocked ? {
      source:       "guardrail",
      reason:       row.decisionReason,
      policyReason: null,
      scopeId:      row.entityId,
      blockedAt:    new Date(row.executedAt).toISOString(),
    } : null;

    const draft = buildAutomationAuditEntry(
      {
        workspaceId:           row.workspaceId ?? null,
        clientAccountId:       row.clientAccountId ?? null,
        eventType:             eventTypeFromExecutionStatus(row.status),
        actionType:            row.actionType,
        scope,
        actor:                 CRON_ACTOR,
        execution:             execRecord,
        block:                 blockRecord,
        rollback,
        relatedExecutionLogId: row.id,
        occurredAt:            new Date(row.executedAt),
      },
      "bridged_execution"
    );

    return {
      ...draft,
      id:        `bridged_exec_${row.id}`,
      createdAt: new Date(row.createdAt).toISOString(),
      source:    "bridged_execution",
    };
  });
}

// ---------------------------------------------------------------------------
// Bridge: ProposedAutomationAction → AutomationAuditEntry[]
// ---------------------------------------------------------------------------

async function loadBridgedActionEntries(
  workspaceId: string | null,
  limit: number
): Promise<AutomationAuditEntry[]> {
  const rows = await prisma.proposedAutomationAction.findMany({
    where:   workspaceId ? { workspaceId } : {},
    orderBy: { proposedAt: "desc" },
    take:    limit,
  });

  return rows.map((row) => {
    const scope: AutomationEventScope = {
      entityType: (row.entityType || "campaign") as AutomationEventScope["entityType"],
      entityId:   row.entityId,
      entityName: row.entityName,
      clientId:   row.clientAccountId,
      clientName: row.clientName,
    };

    const approval = buildApprovalRecord({
      status:          row.status,
      approvedAt:      row.approvedAt,
      rejectedAt:      row.rejectedAt,
      rejectionReason: row.rejectionReason,
      deferredUntil:   row.deferredUntil,
      escalatedAt:     row.escalatedAt,
      escalationNote:  row.escalationNote,
    });

    const eventType = eventTypeFromActionStatus(row.status);

    // Escalated actions are blocked pending elevated review
    const blockRecord: AutomationBlockRecord | null = (row.status === "escalated" || row.status === "expired") ? {
      source:       "safety_mode",
      reason:       row.escalationNote ?? `Action ${row.status}`,
      policyReason: null,
      scopeId:      row.entityId,
      blockedAt:    new Date(row.escalatedAt ?? row.proposedAt).toISOString(),
    } : null;

    // Executed actions may have rollback consideration
    const rollback = row.status === "executed"
      ? computeRollbackReadiness(row.actionType, "success")
      : buildRollbackReadiness({ state: "rollback_unavailable", blockers: ["Action has not been executed"] });

    const occurredAt =
      row.approvedAt  ?? row.rejectedAt  ??
      row.escalatedAt ?? row.deferredUntil ??
      row.proposedAt;

    const draft = buildAutomationAuditEntry(
      {
        workspaceId:     row.workspaceId ?? null,
        clientAccountId: row.clientAccountId,
        clientName:      row.clientName,
        eventType,
        actionType:      row.actionType,
        scope,
        actor:           SYSTEM_ACTOR,
        approval,
        block:           blockRecord,
        rollback,
        relatedActionId: row.id,
        notes:           row.rationale,
        occurredAt:      new Date(occurredAt),
      },
      "bridged_action"
    );

    return {
      ...draft,
      id:        `bridged_action_${row.id}`,
      createdAt: new Date(row.createdAt).toISOString(),
      source:    "bridged_action",
    };
  });
}

// ---------------------------------------------------------------------------
// Combined loader — merges all three sources
// ---------------------------------------------------------------------------

export async function loadCombinedAuditHistory(
  filter: AuditHistoryFilterInput
): Promise<AutomationAuditEntry[]> {
  const limit = filter.limit ?? 80;

  const [native, execution, actions] = await Promise.all([
    loadNativeEntries(filter.workspaceId, limit),
    loadBridgedExecutionEntries(filter.workspaceId, limit),
    loadBridgedActionEntries(filter.workspaceId, limit),
  ]);

  // Deduplicate: prefer native over bridged if both reference the same action
  const nativeActionIds  = new Set(native.map((e) => e.relatedActionId).filter(Boolean));
  const nativeExecIds    = new Set(native.map((e) => e.relatedExecutionLogId).filter(Boolean));

  const filteredActions  = actions.filter(
    (e) => !e.relatedActionId || !nativeActionIds.has(e.relatedActionId)
  );
  const filteredExec     = execution.filter(
    (e) => !e.relatedExecutionLogId || !nativeExecIds.has(e.relatedExecutionLogId)
  );

  let combined = [...native, ...filteredExec, ...filteredActions];

  // Apply client filter
  if (filter.clientId) {
    combined = combined.filter(
      (e) =>
        e.clientAccountId === filter.clientId ||
        e.scope.clientId  === filter.clientId
    );
  }

  // Apply event type filter
  if (filter.eventType) {
    combined = combined.filter((e) => e.eventType === filter.eventType);
  }

  // Apply action type filter
  if (filter.actionType) {
    combined = combined.filter((e) => e.actionType === filter.actionType);
  }

  // Apply rollback readiness filter
  if (filter.rollbackReadiness) {
    combined = combined.filter((e) => e.rollback.state === filter.rollbackReadiness);
  }

  // Apply date range
  if (filter.dateFrom) {
    const from = new Date(filter.dateFrom).getTime();
    combined = combined.filter((e) => new Date(e.occurredAt).getTime() >= from);
  }
  if (filter.dateTo) {
    const to = new Date(filter.dateTo).getTime() + 86_400_000; // inclusive
    combined = combined.filter((e) => new Date(e.occurredAt).getTime() <= to);
  }

  // Sort descending by occurredAt
  combined.sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );

  // Trim to limit
  return combined.slice(filter.offset ?? 0, (filter.offset ?? 0) + limit);
}
