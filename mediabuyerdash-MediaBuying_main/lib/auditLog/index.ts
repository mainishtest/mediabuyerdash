// lib/auditLog/index.ts
// Public exports for the Automation Audit Log layer.

export type {
  AutomationEventType,
  AutomationActorType,
  AutomationActor,
  AutomationEventEntityType,
  AutomationEventScope,
  AutomationExecutionStatus,
  AutomationExecutionRecord,
  AutomationApprovalState,
  AutomationApprovalRecord,
  AutomationBlockSource,
  AutomationBlockRecord,
  RollbackReadinessState,
  RollbackActionPreview,
  RollbackReadiness,
  AutomationAuditEntry,
  AutomationAuditSummary,
  AuditHistoryFilterInput,
  BuildAuditEntryInput,
  RecordExecutionInput,
  RecordApprovalInput,
  RecordBlockInput,
  BuildRollbackReadinessInput,
} from "./types";

export {
  SYSTEM_ACTOR,
  CRON_ACTOR,
  buildAutomationAuditEntry,
  buildRollbackReadiness,
  computeRollbackReadiness,
  eventTypeFromExecutionStatus,
  eventTypeFromActionStatus,
  buildExecutionRecord,
  buildApprovalRecord,
  summarizeAutomationHistory,
} from "./builders";

export {
  writeAuditEntry,
  recordAutomationExecution,
  recordAutomationApproval,
  recordAutomationBlock,
  loadCombinedAuditHistory,
} from "./persist";
