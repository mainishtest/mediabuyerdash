// lib/policy/types.ts
// Central type definitions for the Autonomy Modes and Action Safety Policy layer.
//
// Design principles:
//  - AutonomyMode defines the ceiling of what the system can do in a scope.
//  - ActionType is the governance unit — every executable action maps to one.
//  - Policy inheritance: campaign > ad_account > client > system default.
//  - Blocking is additive: any scope can block; most specific scope provides mode.
//  - All evaluation is deterministic and reusable across all workflow modules.

// ---------------------------------------------------------------------------
// Core enumerations
// ---------------------------------------------------------------------------

/**
 * Autonomy mode defines what class of actions the system may take in a scope.
 *
 *  restricted           — no automated activity; all actions blocked
 *  recommend_only       — system surfaces recommendations; no proposals or executions
 *  prepare_only         — system may prepare (draft) actions but not formally propose
 *  approval_required    — system proposes; a human must approve before any execution
 *  guarded_auto_execute — eligible action types may auto-execute under guardrails
 */
export type AutonomyMode =
  | "recommend_only"
  | "prepare_only"
  | "approval_required"
  | "guarded_auto_execute"
  | "restricted";

/**
 * Governance-level action types. Every automated action the system can take
 * must map to one of these. Used by policy evaluation, approval routing,
 * and execution guardrails.
 */
export type ActionType =
  | "budget_increase"           // increase campaign or ad set budget
  | "budget_decrease"           // decrease campaign or ad set budget
  | "pause_entity"              // pause a campaign, ad set, or ad
  | "unpause_entity"            // unpause a campaign, ad set, or ad
  | "publish_creative"          // publish an AI-generated creative to Meta
  | "duplicate_winner"          // duplicate a high-performing ad/campaign
  | "launch_experiment"         // start an A/B or creative experiment
  | "apply_schedule_change"     // apply dayparting or schedule override
  | "refresh_creative_candidate" // queue a new creative candidate for review
  | "send_to_creative_lab";     // send an ad to Creative Lab for iteration

/**
 * Scope levels for policy assignment. More specific scopes override less specific ones.
 * system is not stored in DB — it is the fallback defined in defaults.ts.
 */
export type ActionSafetyScope = "client" | "ad_account" | "campaign" | "system";

/**
 * The resolved permission state for a single (scope context, action type) pair.
 */
export type ActionPermissionState =
  | "allowed"               // permitted under current autonomy mode
  | "approval_required"     // requires human sign-off before execution
  | "guarded_auto_execute"  // eligible for auto-execution with guardrails active
  | "blocked"               // explicitly blocked or mode prevents it
  | "restricted";           // scope is in restricted mode; nothing is allowed

/**
 * Reason code explaining why a decision was reached.
 * Used for audit logs and UI explanations.
 */
export type ActionSafetyReason =
  | "campaign_override"           // campaign-level policy made the decision
  | "ad_account_policy"           // ad account-level policy made the decision
  | "client_policy"               // client-level policy made the decision
  | "system_default"              // no explicit policy found; using system default
  | "autonomy_mode_restriction"   // autonomy mode prevents this action class
  | "explicit_block"              // action is in blockedActionTypes at deciding scope
  | "explicit_allow"              // action is in allowedActionTypes at deciding scope
  | "approval_required_by_policy" // action is in approvalRequired list at deciding scope
  | "never_auto_executable"       // action type is ineligible for auto-execution globally
  | "unsupported_action_type"     // action type not recognised
  | "missing_scope"               // requested scope ID not found
  | "invalid_policy_state";       // policy record exists but is invalid/inactive

// ---------------------------------------------------------------------------
// Constraint definition
// ---------------------------------------------------------------------------

/**
 * A threshold or limit that further constrains a permitted action.
 * Examples: max budget increase %, minimum spend before pause, cooldown hours.
 */
export interface ActionConstraint {
  field:       string;                              // e.g. "max_budget_increase_pct"
  operator:    "lte" | "gte" | "eq" | "neq" | "in" | "not_in";
  value:       unknown;                             // threshold value
  description: string;                              // human-readable explanation
}

// ---------------------------------------------------------------------------
// Policy record (mirrors DB model)
// ---------------------------------------------------------------------------

/**
 * A persisted ActionSafetyPolicy row — one per (workspaceId, scope, scopeId).
 */
export interface ActionSafetyPolicyRecord {
  id:                  string;
  workspaceId:         string;
  scope:               ActionSafetyScope;
  scopeId:             string;
  autonomyMode:        AutonomyMode;
  allowedActionTypes:  ActionType[];
  blockedActionTypes:  ActionType[];
  approvalRequired:    ActionType[];
  constraints:         ActionConstraint[];
  notes:               string | null;
  isActive:            boolean;
  createdAt:           string;
  updatedAt:           string;
}

// ---------------------------------------------------------------------------
// Evaluation context and decision
// ---------------------------------------------------------------------------

/**
 * Context provided to the policy evaluator.
 * Provide the most specific scopes available; omit those that don't apply.
 */
export interface PolicyEvaluationContext {
  workspaceId:  string;
  clientId?:    string;   // maps to scope="client"
  adAccountId?: string;   // maps to scope="ad_account"
  campaignId?:  string;   // maps to scope="campaign"
  actionType:   ActionType;
  requestedBy?: string;   // userId, for audit
  metadata?:    Record<string, unknown>;
}

/**
 * The result of evaluating a single (context, actionType) pair.
 * This is the canonical decision record used by all workflow modules.
 */
export interface ActionSafetyDecision {
  actionType:              ActionType;
  permission:              ActionPermissionState;
  reason:                  ActionSafetyReason;
  sourceScope:             ActionSafetyScope;
  sourceScopeId:           string | null;
  autonomyMode:            AutonomyMode;
  constraints:             ActionConstraint[];
  blockers:                string[];       // human-readable list of blocking reasons
  requiresApproval:        boolean;
  eligibleForAutoExecution: boolean;
  decidedAt:               string;         // ISO timestamp
}

// ---------------------------------------------------------------------------
// Permission summary utilities
// ---------------------------------------------------------------------------

/**
 * Full permission breakdown for all action types at a given scope context.
 * Built by getEffectiveActionPermissions() / buildActionSafetySummary().
 */
export interface ActionSafetySummary {
  scopeContext:     PolicyEvaluationContext;
  effectiveMode:    AutonomyMode;
  policySource:     ActionSafetyScope;
  allowed:          ActionType[];
  approvalGated:    ActionType[];
  autoExecutable:   ActionType[];
  blocked:          ActionType[];
  decisions:        Record<ActionType, ActionSafetyDecision>;
  constraintCount:  number;
  resolvedAt:       string;
}

/**
 * Lightweight summary of constraints and blockers for display.
 */
export interface ConstraintSummary {
  actionType:  ActionType;
  constraints: ActionConstraint[];
  blockers:    string[];
}

// ---------------------------------------------------------------------------
// Input shape for creating / updating a policy record
// ---------------------------------------------------------------------------

export interface UpsertPolicyInput {
  workspaceId:        string;
  scope:              ActionSafetyScope;
  scopeId:            string;
  autonomyMode:       AutonomyMode;
  allowedActionTypes: ActionType[];
  blockedActionTypes: ActionType[];
  approvalRequired:   ActionType[];
  constraints:        ActionConstraint[];
  notes?:             string;
}
