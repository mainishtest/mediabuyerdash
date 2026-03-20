// lib/autoExecution/types.ts
// Typed models for the guarded auto-execution layer.
//
// v1 scope: run_sync and pause_campaign only.
// All other action types require human approval and are never auto-executed.

// Status of an individual auto-execution attempt.
export type AutoExecutionStatus =
  | "pending"
  | "success"
  | "failed"
  | "skipped"
  | "guardrail_blocked";

// Decision reached after evaluating guardrails.
export type AutoExecutionDecision = "execute" | "skip" | "block";

// Result of evaluating one named guardrail condition.
export interface GuardrailResult {
  name:   string;   // e.g. "client_enabled" | "daily_cap" | "min_spend"
  passed: boolean;
  reason: string;   // human-readable explanation
}

// Persisted row from AutoExecutionSettings.
export interface AutoExecutionSettingsRow {
  id:                 string;
  clientAccountId:    string;
  workspaceId:        string | null;
  enabled:            boolean;
  allowRunSync:       boolean;
  allowPauseCampaign: boolean;
  maxDailyExecutions: number;
  maxSpendThreshold:  number;  // min spend (USD) a campaign must have to be paused
  minRoasThreshold:   number;  // ROAS must be ≤ goal × this factor to trigger pause
  createdAt:          Date;
  updatedAt:          Date;
}

// Persisted row from AutoExecutionLog.
export interface AutoExecutionLogRow {
  id:              string;
  workspaceId:     string | null;
  clientAccountId: string | null;
  actionType:      string;
  entityType:      string;
  entityId:        string;
  entityName:      string;
  status:          AutoExecutionStatus;
  guardrailResults: GuardrailResult[];
  decision:        AutoExecutionDecision;
  decisionReason:  string;
  durationMs:      number | null;
  errorMessage:    string | null;
  executedAt:      Date;
  createdAt:       Date;
}

// Input required to write a new log entry.
export interface AutoExecutionLogInput {
  workspaceId:     string | null;
  clientAccountId: string | null;
  actionType:      string;
  entityType:      string;
  entityId:        string;
  entityName:      string;
  status:          AutoExecutionStatus;
  guardrailResults: GuardrailResult[];
  decision:        AutoExecutionDecision;
  decisionReason:  string;
  durationMs:      number | null;
  errorMessage:    string | null;
}

// Summary of a full auto-execution run (returned by runEligibleAutoExecutions).
export interface AutoExecutionRunSummary {
  candidatesEvaluated: number;
  guardrailsBlocked:   number;
  skipped:             number;
  executed:            number;
  failed:              number;
  logs:                AutoExecutionLogRow[];
}
