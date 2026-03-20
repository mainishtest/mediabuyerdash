// lib/auditLog/builders.ts
// Pure utility functions for constructing audit log entries and rollback readiness
// objects in memory. No database calls — all persistence is in persist.ts.

import type {
  AutomationAuditEntry,
  AutomationActor,
  AutomationEventScope,
  AutomationApprovalRecord,
  AutomationExecutionRecord,
  AutomationBlockRecord,
  RollbackReadiness,
  RollbackActionPreview,
  BuildAuditEntryInput,
  BuildRollbackReadinessInput,
  AutomationAuditSummary,
  AutomationEventType,
} from "./types";

// ---------------------------------------------------------------------------
// System actor constant — used for engine-initiated events
// ---------------------------------------------------------------------------

export const SYSTEM_ACTOR: AutomationActor = {
  type:  "system",
  id:    "automation_engine",
  label: "Automation Engine",
};

export const CRON_ACTOR: AutomationActor = {
  type:  "cron",
  id:    "vercel_cron",
  label: "Scheduled Job",
};

// ---------------------------------------------------------------------------
// Build a complete in-memory AutomationAuditEntry (no DB ID assigned here)
// ---------------------------------------------------------------------------

export function buildAutomationAuditEntry(
  input: BuildAuditEntryInput,
  source: "native" | "bridged_execution" | "bridged_action" = "native"
): Omit<AutomationAuditEntry, "id" | "createdAt"> {
  const now = (input.occurredAt ?? new Date()).toISOString();

  return {
    workspaceId:           input.workspaceId,
    clientAccountId:       input.clientAccountId ?? null,
    clientName:            input.clientName ?? null,
    eventType:             input.eventType,
    actionType:            input.actionType,
    scope:                 input.scope,
    actor:                 input.actor,
    approval:              input.approval ?? null,
    execution:             input.execution ?? null,
    block:                 input.block ?? null,
    rollback:              input.rollback ?? buildRollbackReadiness({ state: "rollback_unavailable", blockers: ["No execution has occurred yet"] }),
    policyDecision:        input.policyDecision ?? null,
    policyReason:          input.policyReason ?? null,
    relatedActionId:       input.relatedActionId ?? null,
    relatedExecutionLogId: input.relatedExecutionLogId ?? null,
    notes:                 input.notes ?? null,
    occurredAt:            now,
    source,
  };
}

// ---------------------------------------------------------------------------
// Build rollback readiness
// ---------------------------------------------------------------------------

export function buildRollbackReadiness(
  input: BuildRollbackReadinessInput
): RollbackReadiness {
  return {
    state:    input.state,
    preview:  input.preview ?? null,
    blockers: input.blockers ?? [],
    notes:    input.notes ?? null,
  };
}

/**
 * Compute rollback readiness from action type + execution result.
 * Called by persist.ts when synthesising bridged entries.
 */
export function computeRollbackReadiness(
  actionType: string,
  executionStatus: string | null
): RollbackReadiness {
  // Only successfully executed actions have any rollback consideration.
  if (executionStatus !== "success") {
    return buildRollbackReadiness({
      state:    "rollback_unavailable",
      blockers: ["Action was not successfully executed — nothing to roll back"],
    });
  }

  if (actionType === "pause_campaign") {
    const preview: RollbackActionPreview = {
      actionType:   "unpause_campaign",
      targetEntity: "Campaign",
      description:  "Unpause the campaign on Meta Ads Manager to restore delivery",
      warnings: [
        "Unpausing resumes spend immediately",
        "Campaign may re-enter the learning phase",
        "Requires a new approved action — not automatic",
      ],
    };
    return buildRollbackReadiness({
      state:   "rollback_requires_review",
      preview,
      blockers: [],
      notes:   "A pause_campaign action was executed. Rollback requires creating and approving an unpause_campaign action.",
    });
  }

  if (actionType === "run_sync") {
    return buildRollbackReadiness({
      state:    "rollback_unavailable",
      blockers: ["Data sync is idempotent — re-running sync is the corrective action, not a rollback"],
    });
  }

  if (actionType === "reduce_budget" || actionType === "increase_budget") {
    return buildRollbackReadiness({
      state:   "rollback_requires_review",
      preview: {
        actionType:   actionType === "reduce_budget" ? "increase_budget" : "reduce_budget",
        targetEntity: "Campaign budget",
        description:  "Reverse the budget change by creating an opposing budget action",
        warnings:     ["Budget changes require a new approved action"],
      },
      blockers: [],
      notes:   "Budget changes require a new approval cycle to reverse",
    });
  }

  // Default: most action types don't have a defined rollback path yet
  return buildRollbackReadiness({
    state:    "rollback_unavailable",
    blockers: [`No rollback path is defined for action type: ${actionType}`],
    notes:   "Full rollback orchestration is planned for a future phase",
  });
}

// ---------------------------------------------------------------------------
// Derive eventType from execution status
// ---------------------------------------------------------------------------

export function eventTypeFromExecutionStatus(
  status: string
): AutomationEventType {
  switch (status) {
    case "success":          return "execution_succeeded";
    case "failed":           return "execution_failed";
    case "guardrail_blocked": return "blocked";
    case "skipped":          return "blocked";
    default:                 return "execution_failed";
  }
}

/**
 * Derive eventType from ProposedAutomationAction.status.
 */
export function eventTypeFromActionStatus(
  status: string
): AutomationEventType {
  switch (status) {
    case "proposed":   return "approval_requested";
    case "approved":   return "approved";
    case "rejected":   return "rejected";
    case "deferred":   return "deferred";
    case "escalated":  return "blocked";      // escalated = requires elevated review (blocked path)
    case "executed":   return "execution_succeeded";
    case "expired":    return "blocked";
    default:           return "approval_requested";
  }
}

// ---------------------------------------------------------------------------
// Build execution record from AutoExecutionLog row
// ---------------------------------------------------------------------------

export function buildExecutionRecord(row: {
  id:              string;
  status:          string;
  durationMs:      number | null;
  errorMessage:    string | null;
  guardrailResults: { name: string; passed: boolean; reason: string }[];
  decisionReason:  string;
  executedAt:      Date | string;
}): AutomationExecutionRecord {
  return {
    executionLogId:   row.id,
    status:           row.status as AutomationExecutionRecord["status"],
    durationMs:       row.durationMs,
    errorMessage:     row.errorMessage,
    guardrailResults: row.guardrailResults,
    decisionReason:   row.decisionReason,
    executedAt:       new Date(row.executedAt).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Build approval record from ProposedAutomationAction row
// ---------------------------------------------------------------------------

export function buildApprovalRecord(row: {
  status:         string;
  approvedAt:     Date | string | null;
  rejectedAt:     Date | string | null;
  rejectionReason: string | null;
  deferredUntil:  Date | string | null;
  escalatedAt:    Date | string | null;
  escalationNote: string | null;
}): AutomationApprovalRecord {
  const state = row.status as AutomationApprovalRecord["approvalState"];
  const decidedAt =
    row.approvedAt  ? new Date(row.approvedAt).toISOString()  :
    row.rejectedAt  ? new Date(row.rejectedAt).toISOString()  :
    row.escalatedAt ? new Date(row.escalatedAt).toISOString() :
    null;

  return {
    approvalState: state,
    approvedBy:    null,   // userId not stored on the action row
    rejectedBy:    null,
    reason:        row.rejectionReason ?? row.escalationNote ?? null,
    routeType:     null,
    decidedAt,
  };
}

// ---------------------------------------------------------------------------
// Summarise a list of audit entries
// ---------------------------------------------------------------------------

export function summarizeAutomationHistory(
  entries: AutomationAuditEntry[]
): AutomationAuditSummary {
  const byEventType: Partial<Record<AutomationEventType, number>> = {};

  for (const e of entries) {
    byEventType[e.eventType] = (byEventType[e.eventType] ?? 0) + 1;
  }

  const dates = entries.map((e) => e.occurredAt).sort();

  return {
    totalEntries:             entries.length,
    byEventType,
    rollbackAvailableCount:   entries.filter((e) => e.rollback.state === "rollback_available").length,
    rollbackUnavailableCount: entries.filter((e) => e.rollback.state === "rollback_unavailable").length,
    rollbackReviewCount:      entries.filter((e) => e.rollback.state === "rollback_requires_review").length,
    failedExecutionCount:     entries.filter((e) => e.eventType === "execution_failed").length,
    blockedCount:             entries.filter((e) => e.eventType === "blocked").length,
    approvedCount:            entries.filter((e) => e.eventType === "approved").length,
    rejectedCount:            entries.filter((e) => e.eventType === "rejected").length,
    emergencyStoppedCount:    entries.filter((e) => e.eventType === "emergency_stopped").length,
    periodFrom:               dates.length > 0 ? dates[0] : null,
    periodTo:                 dates.length > 0 ? dates[dates.length - 1] : null,
  };
}
