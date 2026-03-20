// lib/policy/permissions.ts
// Utility functions for building permission summaries across all action types.
//
// These are used by the UI and by workflow modules that need to know the full
// permission state for a scope without evaluating one action at a time.

import type {
  ActionType,
  ActionSafetyDecision,
  ActionSafetyPolicyRecord,
  ActionSafetySummary,
  ConstraintSummary,
  PolicyEvaluationContext,
} from "./types";

import { ALL_ACTION_TYPES } from "./defaults";
import { buildActionSafetyDecision } from "./evaluate";
import { loadPoliciesForContext } from "./persist";

// ---------------------------------------------------------------------------
// Full permission summary (async — loads from DB)
// ---------------------------------------------------------------------------

/**
 * Build a complete ActionSafetySummary for a scope context.
 * Evaluates all known action types and groups them by permission state.
 *
 * Used by:
 *  - /automation/policies UI
 *  - assistant context loading
 *  - approval workflow scope checks
 */
export async function buildActionSafetySummary(
  context: Omit<PolicyEvaluationContext, "actionType">
): Promise<ActionSafetySummary> {
  const policies = await loadPoliciesForContext({ ...context, actionType: "pause_entity" });
  return buildActionSafetySummaryFromPolicies(context, policies);
}

/**
 * Pure version — accepts pre-loaded policy records.
 * Call this when you've already loaded policies (avoids N+1 DB queries).
 */
export function buildActionSafetySummaryFromPolicies(
  context:  Omit<PolicyEvaluationContext, "actionType">,
  policies: ActionSafetyPolicyRecord[]
): ActionSafetySummary {
  const decisions: Record<string, ActionSafetyDecision> = {};

  for (const actionType of ALL_ACTION_TYPES) {
    const ctx: PolicyEvaluationContext = { ...context, actionType };
    decisions[actionType] = buildActionSafetyDecision(ctx, policies);
  }

  const allowed:        ActionType[] = [];
  const approvalGated:  ActionType[] = [];
  const autoExecutable: ActionType[] = [];
  const blocked:        ActionType[] = [];

  for (const actionType of ALL_ACTION_TYPES) {
    const d = decisions[actionType];
    if (d.permission === "guarded_auto_execute") {
      autoExecutable.push(actionType);
    } else if (d.permission === "approval_required") {
      approvalGated.push(actionType);
    } else if (d.permission === "allowed") {
      allowed.push(actionType);
    } else {
      // blocked | restricted
      blocked.push(actionType);
    }
  }

  // Effective mode = the mode of the most specific active policy
  const firstDecision = decisions[ALL_ACTION_TYPES[0]];

  return {
    scopeContext:    { ...context, actionType: "pause_entity" },
    effectiveMode:   firstDecision.autonomyMode,
    policySource:    firstDecision.sourceScope,
    allowed,
    approvalGated,
    autoExecutable,
    blocked,
    decisions:       decisions as Record<ActionType, ActionSafetyDecision>,
    constraintCount: Object.values(decisions).reduce(
      (sum, d) => sum + d.constraints.length,
      0
    ),
    resolvedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Effective permission lookup (async)
// ---------------------------------------------------------------------------

/**
 * Return the effective permission state for a specific (context, actionType) pair.
 * This is a thin wrapper around evaluateActionSafetyPolicy for callers that only
 * need one action type checked at a time.
 */
export async function getEffectiveActionPermissions(
  context: PolicyEvaluationContext
): Promise<ActionSafetyDecision> {
  const policies = await loadPoliciesForContext(context);
  return buildActionSafetyDecision(context, policies);
}

// ---------------------------------------------------------------------------
// Constraint helpers
// ---------------------------------------------------------------------------

/**
 * Summarise constraints and blockers for a specific action type in a context.
 * Useful for showing inline constraint explanations in the UI or assistant.
 */
export async function summarizeActionConstraints(
  context: PolicyEvaluationContext
): Promise<ConstraintSummary> {
  const policies = await loadPoliciesForContext(context);
  const decision = buildActionSafetyDecision(context, policies);

  return {
    actionType:  context.actionType,
    constraints: decision.constraints,
    blockers:    decision.blockers,
  };
}

/**
 * Pure helper — check if an action is permitted (not blocked and not restricted)
 * in a pre-computed summary. Used for fast inline checks.
 */
export function isActionPermitted(
  summary:    ActionSafetySummary,
  actionType: ActionType
): boolean {
  const d = summary.decisions[actionType];
  return d.permission === "allowed" ||
         d.permission === "approval_required" ||
         d.permission === "guarded_auto_execute";
}

/**
 * Pure helper — check if an action requires approval in a pre-computed summary.
 */
export function requiresApproval(
  summary:    ActionSafetySummary,
  actionType: ActionType
): boolean {
  return summary.decisions[actionType].requiresApproval;
}

/**
 * Pure helper — check if an action is eligible for auto-execution.
 */
export function isAutoExecutable(
  summary:    ActionSafetySummary,
  actionType: ActionType
): boolean {
  return summary.decisions[actionType].eligibleForAutoExecution;
}
