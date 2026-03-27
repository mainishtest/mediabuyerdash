// lib/operations/types.ts
// Typed models for the Daily Operations Command Center.
// All types are plain data objects — no UI, no DB logic.

// ---------------------------------------------------------------------------
// Enums / literals
// ---------------------------------------------------------------------------

export type OperationsPriority = "low" | "medium" | "high";

export type OperationsIssueType =
  | "stale_sync"
  | "sync_failed"
  | "missing_meta_mapping"
  | "missing_shopify"
  | "campaigns_below_goal"
  | "no_campaign_goals"
  | "no_reconciliation";

export type OperationsOpportunityType =
  | "above_roas_goal"
  | "ready_to_scale"
  | "strong_performer";

export type OperationsActionType =
  | "run_sync"
  | "fix_sync"
  | "connect_meta"
  | "connect_shopify"
  | "set_campaign_goals"
  | "run_reconciliation"
  | "review_campaign"
  | "scale_campaign";

export type ClientReadinessStatus =
  | "live"                  // meta + shopify + recent sync + goals + reconciliation
  | "partially_configured"  // some integrations present, some missing
  | "missing_integrations"  // no meta mapping AND no shopify
  | "needs_setup";          // brand new, nothing configured

// ---------------------------------------------------------------------------
// Core models
// ---------------------------------------------------------------------------

export type OperationsIssue = {
  id:               string;
  clientAccountId:  string;
  clientName:       string;
  entityType:       "client" | "campaign";
  entityId:         string;
  entityName:       string;
  issueType:        OperationsIssueType;
  priority:         OperationsPriority;
  summary:          string;
  supportingMetrics: Record<string, string | number>;
};

export type OperationsOpportunity = {
  id:               string;
  clientAccountId:  string;
  clientName:       string;
  entityType:       "client" | "campaign";
  entityId:         string;
  entityName:       string;
  opportunityType:  OperationsOpportunityType;
  priority:         OperationsPriority;
  summary:          string;
  supportingMetrics: Record<string, string | number>;
};

export type OperationsAction = {
  id:              string;
  clientAccountId: string;
  clientName:      string;
  actionType:      OperationsActionType;
  priority:        OperationsPriority;
  title:           string;
  summary:         string;
  destinationUrl:  string;
};

export type ClientReadinessRow = {
  clientAccountId:  string;
  clientName:       string;
  status:           ClientReadinessStatus;
  hasMetaMapping:   boolean;
  hasShopify:       boolean;
  lastSyncAt:       string | null;  // ISO datetime or null
  syncIsStale:      boolean;
  hasGoals:         boolean;
  hasReconciliation: boolean;
  issueCount:       number;
};

// ---------------------------------------------------------------------------
// Top-level snapshot
// ---------------------------------------------------------------------------

export type OperationsSnapshot = {
  workspaceId:              string | null;
  generatedAt:              string;           // ISO datetime
  totalClientsCount:        number;
  liveClientsCount:         number;
  staleClientsCount:        number;
  clientsNeedingAttention:  number;
  activeIssuesCount:        number;
  activeOpportunitiesCount: number;
  pendingActionsCount:      number;
  needsSetupCount:          number;
  issues:                   OperationsIssue[];
  opportunities:            OperationsOpportunity[];
  actions:                  OperationsAction[];
  clientReadiness:          ClientReadinessRow[];
};
