// lib/governance/routing.ts
// Approval routing layer.
//
// buildApprovalRoute() is the single entry point used by all modules that need
// to know how to route a proposed action:
//   - approval workflow (which queue does this go in?)
//   - guarded execution (can this auto-execute right now?)
//   - governance UI (what does the operator need to do?)
//   - assistant suggestions (should this be proposed or blocked?)
//
// Resolution order:
//  1. Active emergency stops → "blocked"
//  2. Active pause/require-approval overrides → "standard_review" (at minimum)
//  3. Policy evaluation (evaluateActionSafetyPolicy)
//  4. If policy = blocked → "blocked"
//  5. If escalation override active on action → "elevated_review"
//  6. If policy = guarded_auto_execute AND no stops/overrides → "auto_approve"
//  7. Otherwise → "standard_review"

import type {
  ApprovalRoute,
  ApprovalRouteType,
  ApprovalRequirement,
  GovernanceFlag,
  GovernanceContext,
} from "./types";

import {
  getActiveStops,
  getActiveOverrides,
  getActiveOverrideForAction,
} from "./persist";

import {
  stopsToGovernanceFlags,
} from "./emergencyStop";

import {
  overridesToGovernanceFlags,
} from "./overrides";

import {
  evaluateActionSafetyPolicy,
} from "../policy/evaluate";

import type { PolicyEvaluationContext, ActionType } from "../policy/types";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the approval route for a specific action in a given governance context.
 * This is the canonical entry point for routing decisions.
 */
export async function buildApprovalRoute(
  actionId:   string,
  actionType: string,
  context:    GovernanceContext
): Promise<ApprovalRoute> {
  const now = new Date().toISOString();

  // 1. Load active stops and overrides in parallel
  const [activeStops, activeOverrides, actionOverride] = await Promise.all([
    getActiveStops(context.workspaceId),
    getActiveOverrides(context.workspaceId),
    actionId ? getActiveOverrideForAction(actionId) : Promise.resolve(null),
  ]);

  // 2. Build governance flags
  const stopFlags     = stopsToGovernanceFlags(activeStops);
  const overrideFlags = overridesToGovernanceFlags(activeOverrides);
  const allFlags: GovernanceFlag[] = [...stopFlags, ...overrideFlags];

  // 3. Check for global or scoped stops that apply to this action
  const relevantStop = activeStops.find(
    (s) =>
      s.scope === "global" ||
      (s.scope === "client"      && s.scopeId === context.clientId) ||
      (s.scope === "ad_account"  && s.scopeId === context.adAccountId) ||
      (s.scope === "campaign"    && s.scopeId === context.campaignId) ||
      (s.scope === "action_type" && s.scopeId === actionType)
  );

  if (relevantStop) {
    return {
      actionId,
      actionType,
      routeType:        "blocked",
      requiresApproval: false,
      canAutoApprove:   false,
      escalationNeeded: false,
      blockedReason:    `Emergency stop active: "${relevantStop.reason}"`,
      governanceFlags:  allFlags,
      suggestedAction:  "Clear the emergency stop before approving this action.",
      routedAt:         now,
    };
  }

  // 4. Evaluate policy decision
  const policyCtx: PolicyEvaluationContext = {
    workspaceId:  context.workspaceId,
    clientId:     context.clientId,
    adAccountId:  context.adAccountId,
    campaignId:   context.campaignId,
    actionType:   actionType as ActionType,
  };

  let policyDecision;
  try {
    policyDecision = await evaluateActionSafetyPolicy(policyCtx);
  } catch {
    // If policy evaluation fails, default to requiring approval
    return {
      actionId,
      actionType,
      routeType:        "standard_review",
      requiresApproval: true,
      canAutoApprove:   false,
      escalationNeeded: false,
      blockedReason:    null,
      governanceFlags:  [...allFlags, {
        type:    "policy_block",
        scope:   "system",
        scopeId: "system",
        message: "Policy evaluation failed — defaulting to approval required.",
      }],
      suggestedAction:  "Review and approve manually.",
      routedAt:         now,
    };
  }

  // 5. Policy blocks this action
  if (policyDecision.permission === "blocked" || policyDecision.permission === "restricted") {
    return {
      actionId,
      actionType,
      routeType:        "blocked",
      requiresApproval: false,
      canAutoApprove:   false,
      escalationNeeded: false,
      blockedReason:    policyDecision.blockers[0] ?? "Action blocked by policy.",
      governanceFlags:  [...allFlags, {
        type:    "policy_block",
        scope:   policyDecision.sourceScope,
        scopeId: policyDecision.sourceScopeId ?? "system",
        message: policyDecision.blockers[0] ?? "Blocked by policy.",
      }],
      suggestedAction:  "Review the action safety policy to unblock this action type.",
      routedAt:         now,
    };
  }

  // 6. Check if scope has a pause or require_approval_all override
  const scopePaused = activeOverrides.some(
    (o) =>
      (o.overrideType === "pause_scope" || o.overrideType === "require_approval_all") &&
      (
        o.scope === "global" ||
        (o.scope === "client"      && o.scopeId === context.clientId) ||
        (o.scope === "ad_account"  && o.scopeId === context.adAccountId) ||
        (o.scope === "campaign"    && o.scopeId === context.campaignId) ||
        (o.scope === "action_type" && o.scopeId === actionType)
      )
  );

  // 7. Action-specific escalation override
  const isEscalated = actionOverride?.overrideType === "require_approval_all";
  if (isEscalated) {
    allFlags.push({
      type:    "escalation_pending",
      scope:   "action",
      scopeId: actionId,
      message: `Escalated for elevated review: "${actionOverride!.reason}"`,
    });
  }

  // 8. Action is deferred
  const isDeferred = actionOverride?.overrideType === "defer_action";
  if (isDeferred) {
    allFlags.push({
      type:    "deferred",
      scope:   "action",
      scopeId: actionId,
      message: `Action is deferred: "${actionOverride!.reason}"`,
    });

    return {
      actionId,
      actionType,
      routeType:        "standard_review",
      requiresApproval: true,
      canAutoApprove:   false,
      escalationNeeded: false,
      blockedReason:    null,
      governanceFlags:  allFlags,
      suggestedAction:  "Action is deferred. Approve, reject, or escalate to change its status.",
      routedAt:         now,
    };
  }

  // 9. Determine final route type
  let routeType: ApprovalRouteType;

  if (isEscalated) {
    routeType = "elevated_review";
  } else if (scopePaused) {
    routeType = "standard_review";
  } else if (policyDecision.permission === "guarded_auto_execute") {
    routeType = "auto_approve";
  } else {
    routeType = "standard_review";
  }

  const requiresApproval = routeType !== "auto_approve";
  const canAutoApprove   = routeType === "auto_approve";
  const suggestedAction  = buildSuggestedAction(routeType, policyDecision.permission);

  return {
    actionId,
    actionType,
    routeType,
    requiresApproval,
    canAutoApprove,
    escalationNeeded: routeType === "elevated_review",
    blockedReason:    null,
    governanceFlags:  allFlags,
    suggestedAction,
    routedAt:         now,
  };
}

/**
 * Lighter-weight evaluation that only determines if approval is required
 * and what the route type is — without the full routing detail.
 */
export async function evaluateApprovalRequirement(
  actionType: string,
  context:    GovernanceContext
): Promise<ApprovalRequirement> {
  const route = await buildApprovalRoute("", actionType, context);

  return {
    required:        route.requiresApproval,
    reason:          route.blockedReason ?? route.suggestedAction,
    routeType:       route.routeType,
    governanceFlags: route.governanceFlags,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSuggestedAction(
  routeType:  ApprovalRouteType,
  permission: string
): string {
  if (routeType === "auto_approve")    return "Eligible for guarded auto-execution. No manual action needed.";
  if (routeType === "elevated_review") return "Escalated — requires elevated review before approval.";
  if (routeType === "blocked")         return "Blocked — cannot be approved. Check policy or clear emergency stop.";
  if (permission === "approval_required") return "Approve or reject in the automation queue.";
  return "Review and approve or reject this action.";
}
