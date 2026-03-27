// lib/policy/evaluate.ts
// Core policy evaluation engine.
//
// Public API:
//   evaluateActionSafetyPolicy(context)  — async; loads policies from DB, returns decision
//   resolveAutonomyModeForScope(context) — async; returns effective AutonomyMode for context
//   buildActionSafetyDecision(...)       — pure; computes decision from loaded policy records
//   computePermissionState(...)          — pure; resolves permission for one action type
//
// Design:
//   Pure functions receive already-loaded policy records → testable without DB.
//   The async entry points load from DB then delegate to pure functions.
//   Blocking is additive: any scope can block; most specific scope provides mode/permission.
//   Resolution order: campaign > ad_account > client > system

import type {
  ActionType,
  ActionSafetyScope,
  ActionPermissionState,
  ActionSafetyReason,
  ActionSafetyDecision,
  ActionSafetyPolicyRecord,
  ActionConstraint,
  PolicyEvaluationContext,
  AutonomyMode,
} from "./types";

import {
  NEVER_AUTO_EXECUTE,
  AUTO_EXECUTE_ELIGIBLE,
  buildSystemDefaultPolicy,
} from "./defaults";

import { loadPoliciesForContext } from "./persist";

// ---------------------------------------------------------------------------
// Public async entry points
// ---------------------------------------------------------------------------

/**
 * Evaluate the action safety policy for a given context.
 * Loads all relevant scope policies from DB and computes the final decision.
 *
 * This is the single entry point used by:
 *  - recommendation engine (can we surface this?)
 *  - assistant action suggestions
 *  - approval workflow (is approval required?)
 *  - guarded auto-execution (is auto-execution eligible?)
 *  - publish preparation (is publish permitted?)
 *  - outcome action recommendations
 */
export async function evaluateActionSafetyPolicy(
  context: PolicyEvaluationContext
): Promise<ActionSafetyDecision> {
  const policies = await loadPoliciesForContext(context);
  return buildActionSafetyDecision(context, policies);
}

/**
 * Resolve the effective autonomy mode for a scope context without evaluating
 * a specific action type. Useful for displaying scope-level mode in the UI.
 */
export async function resolveAutonomyModeForScope(
  context: Omit<PolicyEvaluationContext, "actionType">
): Promise<{ mode: AutonomyMode; sourceScope: ActionSafetyScope; sourceScopeId: string | null }> {
  // Use a placeholder action type — mode resolution does not depend on it
  const fullCtx: PolicyEvaluationContext = { ...context, actionType: "pause_entity" };
  const policies = await loadPoliciesForContext(fullCtx);
  const ordered  = orderPoliciesBySpecificity(policies, fullCtx);

  if (ordered.length === 0) {
    const def = buildSystemDefaultPolicy(context.workspaceId);
    return { mode: def.autonomyMode, sourceScope: "system", sourceScopeId: null };
  }

  // Most specific active policy provides the mode
  const source = ordered[0];
  return {
    mode:          source.autonomyMode,
    sourceScope:   source.scope,
    sourceScopeId: source.scopeId,
  };
}

// ---------------------------------------------------------------------------
// Pure evaluation — accepts pre-loaded policy records
// ---------------------------------------------------------------------------

/**
 * Compute the ActionSafetyDecision from a set of loaded policy records.
 * All arguments are in-memory; no DB access. Safe to unit test.
 */
export function buildActionSafetyDecision(
  context: PolicyEvaluationContext,
  policies: ActionSafetyPolicyRecord[]
): ActionSafetyDecision {
  const { actionType, workspaceId } = context;
  const systemDefault = buildSystemDefaultPolicy(workspaceId);

  // Build the ordered chain: campaign → ad_account → client → system
  const ordered = orderPoliciesBySpecificity(policies, context);
  const chain   = [...ordered, systemDefault];

  // ── Pass 1: collect all blockers across all scopes ─────────────────────
  const blockers: string[] = [];
  for (const policy of chain) {
    if (!policy.isActive) continue;
    if (policy.blockedActionTypes.includes(actionType)) {
      blockers.push(
        `Blocked at ${policy.scope} level` +
        (policy.scopeId !== "system" ? ` (${policy.scopeId})` : "") +
        (policy.notes ? `: ${policy.notes}` : "")
      );
    }
    // Restricted mode blocks everything
    if (policy.autonomyMode === "restricted") {
      blockers.push(`Scope ${policy.scope} is in Restricted mode — all actions blocked.`);
    }
    // recommend_only and prepare_only block execution actions
    if (
      policy.autonomyMode === "recommend_only" &&
      !["send_to_creative_lab", "refresh_creative_candidate"].includes(actionType)
    ) {
      blockers.push(`Scope ${policy.scope} is in Recommend Only mode — actions cannot be proposed or executed.`);
    }
  }

  if (blockers.length > 0) {
    // Find the most specific blocking scope for the reason code
    const blockingPolicy = chain.find(
      (p) =>
        p.isActive &&
        (p.blockedActionTypes.includes(actionType) ||
          p.autonomyMode === "restricted" ||
          p.autonomyMode === "recommend_only")
    )!;

    return makeDecision({
      actionType,
      permission:              "blocked",
      reason:                  reasonForScope(blockingPolicy.scope, true),
      sourceScope:             blockingPolicy.scope,
      sourceScopeId:           blockingPolicy.scopeId === "system" ? null : blockingPolicy.scopeId,
      autonomyMode:            blockingPolicy.autonomyMode,
      constraints:             [],
      blockers,
      requiresApproval:        false,
      eligibleForAutoExecution: false,
    });
  }

  // ── Pass 2: use most specific active policy for permission resolution ───
  const decidingPolicy = chain.find((p) => p.isActive) ?? systemDefault;

  const permission = computePermissionState(
    actionType,
    decidingPolicy.autonomyMode,
    decidingPolicy.allowedActionTypes,
    decidingPolicy.approvalRequired,
  );

  // Collect constraints from all scope levels (additive)
  const allConstraints: ActionConstraint[] = chain.flatMap((p) => p.isActive ? p.constraints : []);

  return makeDecision({
    actionType,
    permission,
    reason:                  reasonForScope(decidingPolicy.scope, false),
    sourceScope:             decidingPolicy.scope,
    sourceScopeId:           decidingPolicy.scopeId === "system" ? null : decidingPolicy.scopeId,
    autonomyMode:            decidingPolicy.autonomyMode,
    constraints:             allConstraints,
    blockers:                [],
    requiresApproval:        permission === "approval_required",
    eligibleForAutoExecution: permission === "guarded_auto_execute",
  });
}

/**
 * Compute the ActionPermissionState for a single action type given a policy's settings.
 * Pure function — no DB access, no async.
 *
 * Resolution order within a policy:
 *  1. restricted mode → blocked
 *  2. recommend_only / prepare_only mode → blocked for execution actions
 *  3. action in approvalRequired → approval_required
 *  4. action in allowedActionTypes + mode allows auto → guarded_auto_execute or allowed
 *  5. default based on mode
 */
export function computePermissionState(
  actionType:         ActionType,
  autonomyMode:       AutonomyMode,
  allowedActionTypes: ActionType[],
  approvalRequired:   ActionType[],
): ActionPermissionState {
  // Restricted: nothing allowed
  if (autonomyMode === "restricted") return "restricted";

  // recommend_only / prepare_only: block execution-class actions
  if (autonomyMode === "recommend_only" || autonomyMode === "prepare_only") {
    // These modes only allow low-risk queuing actions in UI
    const softAllowed: ActionType[] = ["send_to_creative_lab", "refresh_creative_candidate"];
    if (!softAllowed.includes(actionType)) return "blocked";
    // Even soft-allowed ones still need approval in these modes
    return "approval_required";
  }

  // Explicit approval-required list takes precedence over allow list
  if (approvalRequired.includes(actionType)) return "approval_required";

  // Explicitly allowed
  if (allowedActionTypes.includes(actionType)) {
    // Can it be auto-executed?
    if (
      autonomyMode === "guarded_auto_execute" &&
      AUTO_EXECUTE_ELIGIBLE.has(actionType) &&
      !NEVER_AUTO_EXECUTE.has(actionType)
    ) {
      return "guarded_auto_execute";
    }
    return "allowed";
  }

  // Default by mode for action types not explicitly listed
  if (autonomyMode === "approval_required") {
    return "approval_required";
  }

  if (autonomyMode === "guarded_auto_execute") {
    // Auto-eligible types default to guarded execution; others need approval
    if (AUTO_EXECUTE_ELIGIBLE.has(actionType) && !NEVER_AUTO_EXECUTE.has(actionType)) {
      return "guarded_auto_execute";
    }
    return "approval_required";
  }

  // Fallback
  return "approval_required";
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Order loaded policy records by specificity: campaign > ad_account > client.
 * System default is NOT included here — callers append it explicitly.
 */
function orderPoliciesBySpecificity(
  policies:  ActionSafetyPolicyRecord[],
  context:   PolicyEvaluationContext,
): ActionSafetyPolicyRecord[] {
  const SCOPE_ORDER: ActionSafetyScope[] = ["campaign", "ad_account", "client"];

  return SCOPE_ORDER.flatMap((scope) => {
    const scopeId = scopeIdFromContext(scope, context);
    if (!scopeId) return [];
    return policies.filter(
      (p) => p.scope === scope && p.scopeId === scopeId && p.isActive
    );
  });
}

function scopeIdFromContext(
  scope:   ActionSafetyScope,
  context: PolicyEvaluationContext,
): string | undefined {
  if (scope === "campaign")   return context.campaignId;
  if (scope === "ad_account") return context.adAccountId;
  if (scope === "client")     return context.clientId;
  return undefined;
}

function reasonForScope(
  scope:      ActionSafetyScope,
  isBlocking: boolean,
): ActionSafetyReason {
  if (isBlocking) {
    if (scope === "campaign")   return "campaign_override";
    if (scope === "ad_account") return "ad_account_policy";
    if (scope === "client")     return "client_policy";
    return "autonomy_mode_restriction";
  }
  if (scope === "campaign")   return "campaign_override";
  if (scope === "ad_account") return "ad_account_policy";
  if (scope === "client")     return "client_policy";
  return "system_default";
}

function makeDecision(fields: Omit<ActionSafetyDecision, "decidedAt">): ActionSafetyDecision {
  return { ...fields, decidedAt: new Date().toISOString() };
}
