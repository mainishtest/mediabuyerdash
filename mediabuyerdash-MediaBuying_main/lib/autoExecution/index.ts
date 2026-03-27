// lib/autoExecution/index.ts
// Public surface area for the guarded auto-execution module.

export type {
  AutoExecutionStatus,
  AutoExecutionDecision,
  GuardrailResult,
  AutoExecutionSettingsRow,
  AutoExecutionLogRow,
  AutoExecutionLogInput,
  AutoExecutionRunSummary,
} from "./types";

export {
  getOrCreateAutoExecutionSettings,
  updateAutoExecutionSettings,
  loadAllAutoExecutionSettings,
  logAutoExecutionRun,
  loadAutoExecutionHistory,
  countTodayExecutions,
  getLastExecutionForEntity,
} from "./persist";

export {
  evaluateAutoExecutionEligibility,
} from "./eligibility";

export {
  runEligibleAutoExecutions,
} from "./executor";
