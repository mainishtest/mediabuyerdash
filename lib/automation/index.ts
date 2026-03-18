// lib/automation/index.ts
// Public exports for the automation rules and approval workflow system.

export type {
  AutomationActionType,
  AutomationActionStatus,
  AutomationPriority,
  AutomationApprovalDecision,
  ProposedAutomationActionDraft,
  ProposedAutomationActionRow,
  AutomationSummary,
} from "./types";

export {
  evaluateReduceBudgetRule,
  evaluateIncreaseBudgetRule,
  evaluateRunSyncRule,
  evaluateMissingIntegrationRule,
  evaluateWeakRoasRule,
  evaluateCreativeFatigueRule,
  evaluateAutomationRules,
  loadDetectionInput,
} from "./rules";

export {
  upsertProposedActions,
  loadProposedActions,
  loadTopProposedActions,
  approveAutomationAction,
  rejectAutomationAction,
  buildAutomationSummary,
} from "./persist";
