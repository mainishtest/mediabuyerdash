// lib/governance/index.ts
// Public exports for the Approval Routing, Override, and Emergency Stop layer.

// Types
export type {
  ApprovalDecision,
  ApprovalRouteType,
  ApprovalRoute,
  ApprovalRequirement,
  ApprovalQueuePolicy,
  GovernanceFlag,
  GovernanceContext,
  GovernanceControlSummary,
  EmergencyStopScope,
  EmergencyStopState,
  StopCheckResult,
  OverrideType,
  AutomationOverrideReason,
  AutomationOverrideRecord,
  SetStopInput,
  ApplyOverrideInput,
  DeferActionInput,
  EscalateActionInput,
} from "./types";

// Emergency stop
export {
  setEmergencyStopState,
  clearEmergencyStop,
  loadActiveStops,
  isStopActiveForExecution,
  isGlobalStopActive,
  stopsToGovernanceFlags,
} from "./emergencyStop";

// Overrides
export {
  applyAutomationOverride,
  clearOverride,
  loadActiveOverrides,
  deferAction,
  escalateAction,
  overridesToGovernanceFlags,
  isScopePausedOrOverridden,
} from "./overrides";

// Approval routing
export {
  buildApprovalRoute,
  evaluateApprovalRequirement,
} from "./routing";

// Summary
export {
  summarizeGovernanceControls,
  buildApprovalControlSummary,
} from "./summary";

// DB access (for API routes that need lower-level access)
export {
  getActiveStops,
  getActiveOverrides,
  createGovernanceStop,
  clearGovernanceStop,
  createAutomationOverride,
  clearAutomationOverride,
  getGovernanceCounts,
} from "./persist";
