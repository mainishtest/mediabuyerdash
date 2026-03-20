// lib/policy/defaults.ts
// System default policy and action-type classification sets.
//
// These are the safe fallbacks used when no explicit policy record exists for a scope.
// They are also the constraints that apply in "guarded_auto_execute" mode regardless
// of what individual scope policies say.
//
// NEVER modify these without understanding the full downstream impact on:
//  - recommendation engine
//  - approval workflow
//  - guarded auto-execution guardrails
//  - audit logs

import type { ActionType, AutonomyMode, ActionSafetyPolicyRecord, ActionConstraint } from "./types";

// ---------------------------------------------------------------------------
// All known action types
// ---------------------------------------------------------------------------

export const ALL_ACTION_TYPES: ActionType[] = [
  "budget_increase",
  "budget_decrease",
  "pause_entity",
  "unpause_entity",
  "publish_creative",
  "duplicate_winner",
  "launch_experiment",
  "apply_schedule_change",
  "refresh_creative_candidate",
  "send_to_creative_lab",
];

// ---------------------------------------------------------------------------
// Auto-execution eligibility
// ---------------------------------------------------------------------------

/**
 * Action types that are ELIGIBLE for guarded auto-execution when the scope's
 * autonomy mode is "guarded_auto_execute".
 *
 * These are lower-risk, reversible, or queue-only actions.
 * Budget/pause/unpause operations are covered by the existing AutoExecution
 * guardrail layer (eligibility.ts); policy layer adds the governance gate.
 */
export const AUTO_EXECUTE_ELIGIBLE: Set<ActionType> = new Set([
  "budget_decrease",           // lower spend — conservative direction
  "pause_entity",              // pause covered by 24h cooldown + spend floor
  "refresh_creative_candidate", // queues a candidate; human still approves the creative
  "send_to_creative_lab",      // queues for creative iteration; no live publish
]);

/**
 * Action types that NEVER auto-execute regardless of autonomy mode.
 * These always require explicit human approval.
 */
export const NEVER_AUTO_EXECUTE: Set<ActionType> = new Set([
  "budget_increase",      // increasing spend is irreversible in billing cycle
  "unpause_entity",       // re-enabling spend; higher risk than pausing
  "publish_creative",     // live Meta write; creative must be human-reviewed
  "duplicate_winner",     // clones structure + spend; requires intentional review
  "launch_experiment",    // starts a controlled test with real spend
  "apply_schedule_change", // dayparting changes affect 24h delivery windows
]);

// ---------------------------------------------------------------------------
// System default policy
// ---------------------------------------------------------------------------

/**
 * The system default policy applied when no explicit DB record exists for a scope.
 * It is the most conservative safe fallback:
 *  - Mode: approval_required — nothing executes without a human
 *  - High-risk actions (publish_creative, launch_experiment) are explicitly blocked
 *    so they surface in UI as "blocked" rather than "approval_required"
 *  - All other action types default to approval_required via the mode
 */
export const SYSTEM_DEFAULT_AUTONOMY_MODE: AutonomyMode = "approval_required";

export const SYSTEM_DEFAULT_BLOCKED: ActionType[] = [
  "publish_creative",   // never auto in system default; must be explicitly unlocked
  "launch_experiment",  // same — gate behind explicit client-level allow
];

export const SYSTEM_DEFAULT_APPROVAL_REQUIRED: ActionType[] = [
  "budget_increase",
  "budget_decrease",
  "pause_entity",
  "unpause_entity",
  "duplicate_winner",
  "apply_schedule_change",
  "refresh_creative_candidate",
  "send_to_creative_lab",
];

/**
 * Built system-default policy record shape (no DB write — used purely in evaluation).
 */
export function buildSystemDefaultPolicy(workspaceId: string): ActionSafetyPolicyRecord {
  return {
    id:                  "system_default",
    workspaceId,
    scope:               "system",
    scopeId:             "system",
    autonomyMode:        SYSTEM_DEFAULT_AUTONOMY_MODE,
    allowedActionTypes:  [],
    blockedActionTypes:  SYSTEM_DEFAULT_BLOCKED,
    approvalRequired:    SYSTEM_DEFAULT_APPROVAL_REQUIRED,
    constraints:         [],
    notes:               "System default — applies when no explicit policy exists for the scope.",
    isActive:            true,
    createdAt:           new Date().toISOString(),
    updatedAt:           new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Default constraints applied globally to guarded auto-execution
// These are in addition to the existing AutoExecutionSettings guardrails.
// ---------------------------------------------------------------------------

export const DEFAULT_BUDGET_DECREASE_CONSTRAINTS: ActionConstraint[] = [
  {
    field:       "max_decrease_pct",
    operator:    "lte",
    value:       30,
    description: "Budget decrease must not exceed 30% in a single action.",
  },
  {
    field:       "min_spend_before_action",
    operator:    "gte",
    value:       200,
    description: "Campaign must have spent at least $200 before budget can be decreased.",
  },
];

export const DEFAULT_PAUSE_CONSTRAINTS: ActionConstraint[] = [
  {
    field:       "cooldown_hours",
    operator:    "gte",
    value:       24,
    description: "At least 24 hours must pass between pause actions on the same entity.",
  },
  {
    field:       "min_spend_before_pause",
    operator:    "gte",
    value:       200,
    description: "Campaign must have spent at least $200 before it can be auto-paused.",
  },
];

// ---------------------------------------------------------------------------
// Autonomy mode ordering (lower index = more restrictive)
// Used to determine which mode is more restrictive when resolving conflicts.
// ---------------------------------------------------------------------------

export const AUTONOMY_MODE_ORDER: AutonomyMode[] = [
  "restricted",
  "recommend_only",
  "prepare_only",
  "approval_required",
  "guarded_auto_execute",
];

/**
 * Returns true if modeA is more restrictive than modeB.
 */
export function isMoreRestrictive(modeA: AutonomyMode, modeB: AutonomyMode): boolean {
  return AUTONOMY_MODE_ORDER.indexOf(modeA) < AUTONOMY_MODE_ORDER.indexOf(modeB);
}

// ---------------------------------------------------------------------------
// Human-readable labels
// ---------------------------------------------------------------------------

export const AUTONOMY_MODE_LABELS: Record<AutonomyMode, string> = {
  restricted:           "Restricted",
  recommend_only:       "Recommend Only",
  prepare_only:         "Prepare Only",
  approval_required:    "Approval Required",
  guarded_auto_execute: "Guarded Auto-Execute",
};

export const AUTONOMY_MODE_DESCRIPTIONS: Record<AutonomyMode, string> = {
  restricted:
    "No automated activity. All actions are blocked. Manual-only operation.",
  recommend_only:
    "System surfaces recommendations in the UI. No proposals or executions.",
  prepare_only:
    "System may draft and prepare actions but cannot formally propose them for approval.",
  approval_required:
    "System proposes actions. A human must approve each one before any execution occurs.",
  guarded_auto_execute:
    "Eligible low-risk actions may execute automatically under guardrails. High-risk actions still require approval.",
};

export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  budget_increase:           "Budget Increase",
  budget_decrease:           "Budget Decrease",
  pause_entity:              "Pause Campaign / Ad Set",
  unpause_entity:            "Unpause Campaign / Ad Set",
  publish_creative:          "Publish Creative",
  duplicate_winner:          "Duplicate Winner",
  launch_experiment:         "Launch Experiment",
  apply_schedule_change:     "Apply Schedule Change",
  refresh_creative_candidate: "Refresh Creative Candidate",
  send_to_creative_lab:      "Send to Creative Lab",
};

export const ACTION_TYPE_RISK: Record<ActionType, "high" | "medium" | "low"> = {
  budget_increase:           "high",
  budget_decrease:           "medium",
  pause_entity:              "medium",
  unpause_entity:            "high",
  publish_creative:          "high",
  duplicate_winner:          "high",
  launch_experiment:         "high",
  apply_schedule_change:     "medium",
  refresh_creative_candidate: "low",
  send_to_creative_lab:      "low",
};
