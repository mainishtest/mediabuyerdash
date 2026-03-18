// lib/automation/types.ts
// Typed models for the automation rules and approval workflow system.

export type AutomationActionType =
  | "pause_campaign"
  | "reduce_budget"
  | "increase_budget"
  | "review_creative"
  | "refresh_creative"
  | "run_sync"
  | "investigate_client"
  | "set_goals"
  | "review_pacing";

export type AutomationActionStatus =
  | "proposed"
  | "approved"
  | "rejected"
  | "executed"
  | "expired";

export type AutomationPriority = "low" | "medium" | "high";

export type AutomationApprovalDecision = "approved" | "rejected";

// In-memory draft produced by rule evaluation — not yet persisted.
export type ProposedAutomationActionDraft = {
  workspaceId:      string | null;
  clientAccountId:  string;
  clientName:       string;
  automationRuleId: string | null;
  actionType:       AutomationActionType;
  priority:         AutomationPriority;
  entityType:       "campaign" | "client" | "integration";
  entityId:         string;
  entityName:       string;
  rationale:        string;
  supportingData:   Record<string, string | number>;
  deduplicationKey: string; // "{clientId}:{actionType}:{entityId}"
  expiresAt:        Date | null;
};

// A persisted ProposedAutomationAction — matches Prisma model shape but typed.
export type ProposedAutomationActionRow = {
  id:               string;
  workspaceId:      string | null;
  clientAccountId:  string;
  clientName:       string;
  actionType:       AutomationActionType;
  status:           AutomationActionStatus;
  priority:         AutomationPriority;
  entityType:       "campaign" | "client" | "integration";
  entityId:         string;
  entityName:       string;
  rationale:        string;
  supportingData:   Record<string, string | number>;
  deduplicationKey: string;
  proposedAt:       string; // ISO datetime
  expiresAt:        string | null;
  approvedAt:       string | null;
  rejectedAt:       string | null;
  rejectionReason:  string | null;
};

// Counts for summary cards.
export type AutomationSummary = {
  proposedCount:      number;
  highPriorityCount:  number;
  approvedCount:      number;
  rejectedCount:      number;
  totalCount:         number;
};
