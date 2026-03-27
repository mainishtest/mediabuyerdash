// lib/auditLog/types.ts
// Typed models for the Automation Audit Log, Execution History,
// and Rollback Readiness layer.
//
// Design principles:
//  - Schema is explicit and complete — every lifecycle event maps to a type.
//  - Nested objects (scope, actor, execution, etc.) are typed here but stored
//    as JSON blobs in the DB; deserialized in persist.ts.
//  - Rollback readiness is computed from event/action state, not a separate flow.
//  - Builder input shapes are separate from the full entry shape.

// ---------------------------------------------------------------------------
// Automation event types
// ---------------------------------------------------------------------------

/**
 * Every automation lifecycle event maps to one of these.
 * Events are additive — a single action generates multiple entries.
 */
export type AutomationEventType =
  | "recommended"          // Rule surfaced a recommendation
  | "prepared"             // System prepared (drafted) an action
  | "approval_requested"   // Action entered the approval queue
  | "approved"             // Operator explicitly approved the action
  | "rejected"             // Operator explicitly rejected the action
  | "deferred"             // Operator deferred the action
  | "blocked"              // Policy, governance, or guardrail blocked the action
  | "execution_started"    // Auto-execution attempt began
  | "execution_succeeded"  // Auto-execution completed successfully
  | "execution_failed"     // Auto-execution failed
  | "rollback_ready"       // A rollback snapshot has been prepared
  | "rollback_not_available" // Rollback is unavailable for this action
  | "emergency_stopped";   // Emergency stop was applied to this action's scope

// ---------------------------------------------------------------------------
// Actor
// ---------------------------------------------------------------------------

export type AutomationActorType =
  | "system"    // Automation engine / rule evaluator
  | "operator"  // Human operator
  | "cron"      // Scheduled job (Vercel cron)
  | "api";      // External API caller

export interface AutomationActor {
  type:  AutomationActorType;
  id:    string;   // userId, system component identifier, or "cron"
  label: string;   // human-readable name
}

// ---------------------------------------------------------------------------
// Event scope — the target entity this event concerns
// ---------------------------------------------------------------------------

export type AutomationEventEntityType =
  | "campaign"
  | "client"
  | "ad_account"
  | "integration"
  | "workspace"
  | "action_type";

export interface AutomationEventScope {
  entityType:  AutomationEventEntityType;
  entityId:    string;
  entityName:  string;
  clientId?:   string;
  clientName?: string;
}

// ---------------------------------------------------------------------------
// Execution record
// ---------------------------------------------------------------------------

export type AutomationExecutionStatus =
  | "pending"
  | "success"
  | "failed"
  | "skipped"
  | "guardrail_blocked";

export interface AutomationExecutionRecord {
  executionLogId:   string | null;  // AutoExecutionLog.id
  status:           AutomationExecutionStatus;
  durationMs:       number | null;
  errorMessage:     string | null;
  guardrailResults: { name: string; passed: boolean; reason: string }[];
  decisionReason:   string;
  executedAt:       string;  // ISO timestamp
}

// ---------------------------------------------------------------------------
// Approval record
// ---------------------------------------------------------------------------

export type AutomationApprovalState =
  | "pending"
  | "approved"
  | "rejected"
  | "deferred"
  | "escalated"
  | "expired";

export interface AutomationApprovalRecord {
  approvalState: AutomationApprovalState;
  approvedBy:    string | null;
  rejectedBy:    string | null;
  reason:        string | null;
  routeType:     string | null;  // auto_approve | standard_review | elevated_review | blocked
  decidedAt:     string | null;  // ISO timestamp
}

// ---------------------------------------------------------------------------
// Block record
// ---------------------------------------------------------------------------

export type AutomationBlockSource =
  | "policy"
  | "governance_stop"
  | "override"
  | "guardrail"
  | "safety_mode"
  | "unknown";

export interface AutomationBlockRecord {
  source:       AutomationBlockSource;
  reason:       string;
  policyReason: string | null;
  scopeId:      string | null;
  blockedAt:    string;  // ISO timestamp
}

// ---------------------------------------------------------------------------
// Rollback readiness
// ---------------------------------------------------------------------------

export type RollbackReadinessState =
  | "rollback_available"       // A rollback action is defined and ready
  | "rollback_unavailable"     // No rollback path exists for this action type
  | "rollback_requires_review"; // A rollback path exists but needs human sign-off

export interface RollbackActionPreview {
  actionType:   string;    // what the rollback action would do
  targetEntity: string;    // human-readable target
  description:  string;    // plain-language rollback summary
  warnings:     string[];  // risks or caveats about rolling back
}

export interface RollbackReadiness {
  state:    RollbackReadinessState;
  preview:  RollbackActionPreview | null;
  blockers: string[];   // why rollback is unavailable or requires review
  notes:    string | null;
}

// ---------------------------------------------------------------------------
// Full audit entry — matches the AutomationAuditLog DB row shape
// ---------------------------------------------------------------------------

export interface AutomationAuditEntry {
  id:                    string;
  workspaceId:           string | null;
  clientAccountId:       string | null;
  clientName:            string | null;

  // Event classification
  eventType:             AutomationEventType;
  actionType:            string;

  // Structured nested objects (stored as JSON in DB)
  scope:                 AutomationEventScope;
  actor:                 AutomationActor;
  approval:              AutomationApprovalRecord | null;
  execution:             AutomationExecutionRecord | null;
  block:                 AutomationBlockRecord | null;
  rollback:              RollbackReadiness;

  // Policy decision (flat fields for quick display)
  policyDecision:        string | null;
  policyReason:          string | null;

  // Cross-navigation links
  relatedActionId:       string | null;   // ProposedAutomationAction.id
  relatedExecutionLogId: string | null;   // AutoExecutionLog.id

  notes:                 string | null;
  occurredAt:            string;  // ISO timestamp
  createdAt:             string;  // ISO timestamp

  // Source — marks whether this came from the native audit table or a bridge
  source:                "native" | "bridged_execution" | "bridged_action";
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export interface AutomationAuditSummary {
  totalEntries:             number;
  byEventType:              Partial<Record<AutomationEventType, number>>;
  rollbackAvailableCount:   number;
  rollbackUnavailableCount: number;
  rollbackReviewCount:      number;
  failedExecutionCount:     number;
  blockedCount:             number;
  approvedCount:            number;
  rejectedCount:            number;
  emergencyStoppedCount:    number;
  periodFrom:               string | null;
  periodTo:                 string | null;
}

// ---------------------------------------------------------------------------
// Filter input
// ---------------------------------------------------------------------------

export interface AuditHistoryFilterInput {
  workspaceId:        string | null;
  clientId?:          string;
  dateFrom?:          string;   // YYYY-MM-DD
  dateTo?:            string;   // YYYY-MM-DD
  eventType?:         AutomationEventType;
  actionType?:        string;
  actor?:             string;
  rollbackReadiness?: RollbackReadinessState;
  limit?:             number;
  offset?:            number;
}

// ---------------------------------------------------------------------------
// Input shapes for builder and record functions
// ---------------------------------------------------------------------------

export interface BuildAuditEntryInput {
  workspaceId:            string | null;
  clientAccountId?:       string | null;
  clientName?:            string | null;
  eventType:              AutomationEventType;
  actionType:             string;
  scope:                  AutomationEventScope;
  actor:                  AutomationActor;
  approval?:              AutomationApprovalRecord | null;
  policyDecision?:        string | null;
  policyReason?:          string | null;
  execution?:             AutomationExecutionRecord | null;
  block?:                 AutomationBlockRecord | null;
  rollback?:              RollbackReadiness;
  relatedActionId?:       string | null;
  relatedExecutionLogId?: string | null;
  notes?:                 string | null;
  occurredAt?:            Date;
}

export interface RecordExecutionInput {
  workspaceId:      string | null;
  clientAccountId:  string | null;
  clientName:       string | null;
  actionId:         string;
  actionType:       string;
  scope:            AutomationEventScope;
  executionLogId:   string | null;
  status:           AutomationExecutionStatus;
  durationMs:       number | null;
  errorMessage:     string | null;
  guardrailResults: { name: string; passed: boolean; reason: string }[];
  decisionReason:   string;
}

export interface RecordApprovalInput {
  workspaceId:     string | null;
  clientAccountId: string | null;
  clientName:      string | null;
  actionId:        string;
  actionType:      string;
  scope:           AutomationEventScope;
  decision:        AutomationApprovalState;
  decidedBy:       string | null;
  reason:          string | null;
  routeType:       string | null;
}

export interface RecordBlockInput {
  workspaceId:     string | null;
  clientAccountId: string | null;
  clientName:      string | null;
  actionId:        string | null;
  actionType:      string;
  scope:           AutomationEventScope;
  source:          AutomationBlockSource;
  reason:          string;
  policyReason:    string | null;
}

export interface BuildRollbackReadinessInput {
  state:     RollbackReadinessState;
  preview?:  RollbackActionPreview | null;
  blockers?: string[];
  notes?:    string | null;
}
