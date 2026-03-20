// lib/governance/types.ts
// Typed models for the approval routing, override, and emergency stop layer.
//
// This layer sits above the policy evaluation layer and adds runtime
// operator controls: stops, overrides, defers, and escalations.

// ---------------------------------------------------------------------------
// Approval decision states (superset of AutomationActionStatus)
// ---------------------------------------------------------------------------

export type ApprovalDecision =
  | "pending"    // awaiting review
  | "approved"   // explicitly approved
  | "rejected"   // explicitly rejected
  | "deferred"   // postponed; will resurface after deferral period
  | "escalated"  // sent to elevated review
  | "expired";   // exceeded expiry without action

// ---------------------------------------------------------------------------
// Approval routing
// ---------------------------------------------------------------------------

/**
 * The type of review path for a given action.
 *
 *  auto_approve     — policy + governance allow proceeding without human review
 *  standard_review  — normal operator review required
 *  elevated_review  — escalated; requires senior review or explicit override clearance
 *  blocked          — policy or governance prevents any approval path
 */
export type ApprovalRouteType =
  | "auto_approve"
  | "standard_review"
  | "elevated_review"
  | "blocked";

/**
 * A governance flag signals an active condition affecting the approval route.
 */
export interface GovernanceFlag {
  type:    "emergency_stop" | "override_active" | "escalation_pending" | "policy_block" | "deferred";
  scope:   string;
  scopeId: string;
  message: string;
}

/**
 * The computed approval route for a specific action in a specific context.
 * Returned by buildApprovalRoute().
 */
export interface ApprovalRoute {
  actionId:         string;
  actionType:       string;
  routeType:        ApprovalRouteType;
  requiresApproval: boolean;
  canAutoApprove:   boolean;
  escalationNeeded: boolean;
  blockedReason:    string | null;
  governanceFlags:  GovernanceFlag[];
  suggestedAction:  string;    // human-readable next step for the operator
  routedAt:         string;
}

/**
 * Result of evaluateApprovalRequirement() — focused on the approval decision only.
 */
export interface ApprovalRequirement {
  required:        boolean;
  reason:          string;
  routeType:       ApprovalRouteType;
  governanceFlags: GovernanceFlag[];
}

// ---------------------------------------------------------------------------
// Emergency stop
// ---------------------------------------------------------------------------

/**
 * Scopes at which an emergency stop can be applied.
 *
 *  global      — halts all auto-execution workspace-wide
 *  client      — halts execution for a specific client
 *  ad_account  — halts execution for a specific ad account
 *  campaign    — halts execution for a specific campaign entity
 *  action_type — halts execution for a specific action type (e.g. "pause_campaign")
 */
export type EmergencyStopScope =
  | "global"
  | "client"
  | "ad_account"
  | "campaign"
  | "action_type";

/** Persisted row from GovernanceStop. */
export interface EmergencyStopState {
  id:          string;
  workspaceId: string;
  scope:       EmergencyStopScope;
  scopeId:     string;
  reason:      string;
  stoppedBy:   string | null;
  isActive:    boolean;
  expiresAt:   string | null;
  clearedAt:   string | null;
  clearedBy:   string | null;
  createdAt:   string;
  updatedAt:   string;
}

/** Result of isStopActiveForExecution() — used by guardrail layer. */
export interface StopCheckResult {
  stopped: boolean;
  reason:  string;
  stopId:  string | null;
}

// ---------------------------------------------------------------------------
// Overrides
// ---------------------------------------------------------------------------

/**
 * Types of operator overrides.
 *
 *  pause_scope          — stop all auto-execution in a scope
 *  require_approval_all — temporarily force approval for every action in a scope
 *  defer_action         — defer a specific action to a later time
 *  override_block       — override a policy block (requires explicit reason)
 *  resume_scope         — explicitly resume a previously paused scope
 */
export type OverrideType =
  | "pause_scope"
  | "require_approval_all"
  | "defer_action"
  | "override_block"
  | "resume_scope";

/**
 * Standard reason codes for overrides — surfaces clearly in audit trail.
 */
export type AutomationOverrideReason =
  | "policy_exception"    // explicit exception to normal policy
  | "operator_decision"   // operator made a deliberate choice
  | "system_fault"        // system issue requiring intervention
  | "client_instruction"  // client specifically requested
  | "risk_escalation"     // escalated due to detected risk
  | "manual_review";      // moved to manual review pending investigation

/** Persisted row from AutomationOverride. */
export interface AutomationOverrideRecord {
  id:           string;
  workspaceId:  string;
  overrideType: OverrideType;
  scope:        EmergencyStopScope;
  scopeId:      string;
  actionId:     string | null;
  reason:       string;
  appliedBy:    string | null;
  isActive:     boolean;
  expiresAt:    string | null;
  clearedAt:    string | null;
  clearedBy:    string | null;
  metadata:     Record<string, unknown>;
  createdAt:    string;
  updatedAt:    string;
}

// ---------------------------------------------------------------------------
// Input shapes
// ---------------------------------------------------------------------------

export interface SetStopInput {
  workspaceId: string;
  scope:       EmergencyStopScope;
  scopeId:     string;
  reason:      string;
  stoppedBy?:  string;
  expiresAt?:  Date;
}

export interface ApplyOverrideInput {
  workspaceId:  string;
  overrideType: OverrideType;
  scope:        EmergencyStopScope;
  scopeId:      string;
  actionId?:    string;
  reason:       string;
  appliedBy?:   string;
  expiresAt?:   Date;
  metadata?:    Record<string, unknown>;
}

export interface DeferActionInput {
  actionId:    string;
  workspaceId: string;
  reason:      string;
  appliedBy?:  string;
  deferUntil?: Date;
}

export interface EscalateActionInput {
  actionId:       string;
  workspaceId:    string;
  escalationNote: string;
  appliedBy?:     string;
}

// ---------------------------------------------------------------------------
// Governance summary
// ---------------------------------------------------------------------------

/** Context used to check governance state for a specific action + scope. */
export interface GovernanceContext {
  workspaceId:  string;
  clientId?:    string;
  adAccountId?: string;
  campaignId?:  string;
  actionType?:  string;
  actionId?:    string;
}

/** Workspace-wide governance control summary. */
export interface GovernanceControlSummary {
  workspaceId:        string;
  automationPaused:   boolean;   // true if global stop is active
  activeStopCount:    number;
  activeOverrideCount: number;
  pendingEscalations: number;
  pendingApprovals:   number;
  deferredActions:    number;
  activeStops:        EmergencyStopState[];
  activeOverrides:    AutomationOverrideRecord[];
  resolvedAt:         string;
}

/** Per-action-type approval queue policy. */
export interface ApprovalQueuePolicy {
  actionType:    string;
  routeType:     ApprovalRouteType;
  governanceFlags: GovernanceFlag[];
}
