// lib/autoExecution/eligibility.ts
// Guardrail evaluation for guarded auto-execution.
//
// Each guardrail is a named check that must pass for execution to proceed.
// All checks are evaluated up-front and stored in the log for auditability.
// If any guardrail fails, the decision is "block" (or "skip" for non-critical).

import type { AutoExecutionSettingsRow, GuardrailResult, AutoExecutionDecision } from "./types";

// Minimal shape of an action row needed for guardrail evaluation
type ActionRow = {
  id:              string;
  clientAccountId: string;
  actionType:      string;
  status:          string;
  entityId:        string;
  entityName:      string;
};
import { countTodayExecutions, getLastExecutionForEntity } from "./persist";
import { isStopActiveForExecution }                        from "../governance/emergencyStop";

// ---------------------------------------------------------------------------
// Eligible action types for v1 auto-execution
// ---------------------------------------------------------------------------

const AUTO_ELIGIBLE_TYPES = new Set(["run_sync", "pause_campaign"]);

// After pausing a campaign, wait at least this many hours before allowing a
// re-execution on the same entity. Prevents flapping.
const PAUSE_COOLDOWN_HOURS = 24;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface EligibilityResult {
  eligible:       boolean;
  decision:       AutoExecutionDecision;
  decisionReason: string;
  guardrails:     GuardrailResult[];
}

/**
 * Evaluates all guardrails for a proposed action against its settings.
 * Returns an EligibilityResult with all guardrail outcomes and a final decision.
 *
 * Guardrails (evaluated in order):
 *  0. governance_stop       — no active emergency stop covers this action/scope
 *  1. action_type_eligible  — only run_sync and pause_campaign are auto-eligible
 *  2. client_enabled        — auto-execution is enabled for this client
 *  3. action_type_allowed   — the specific action type is permitted in settings
 *  4. action_approved       — the proposed action has "approved" status
 *  5. not_already_executed  — action has not already been executed
 *  6. daily_cap             — today's execution count is below maxDailyExecutions
 *  7. cooldown              — entity has not been acted on recently
 */
export async function evaluateAutoExecutionEligibility(
  action:   ActionRow,
  settings: AutoExecutionSettingsRow
): Promise<EligibilityResult> {
  const guardrails: GuardrailResult[] = [];

  // 0. Governance emergency stop — checked first; short-circuits all further evaluation
  const workspaceId = settings.workspaceId;
  if (workspaceId) {
    const stopCheck = await isStopActiveForExecution({
      workspaceId,
      clientId:   action.clientAccountId,
      actionType: action.actionType,
      entityId:   action.entityId,
    });

    guardrails.push({
      name:   "governance_stop",
      passed: !stopCheck.stopped,
      reason: stopCheck.stopped
        ? stopCheck.reason
        : "No active emergency stop for this action.",
    });

    if (stopCheck.stopped) {
      return block(guardrails, stopCheck.reason);
    }
  } else {
    guardrails.push({
      name:   "governance_stop",
      passed: true,
      reason: "Workspace ID not set — skipping governance stop check.",
    });
  }

  // 1. Action type eligible
  const typeEligible = AUTO_ELIGIBLE_TYPES.has(action.actionType);
  guardrails.push({
    name:   "action_type_eligible",
    passed: typeEligible,
    reason: typeEligible
      ? `Action type "${action.actionType}" is eligible for auto-execution.`
      : `Action type "${action.actionType}" is not eligible for auto-execution in v1 (only run_sync and pause_campaign).`,
  });

  if (!typeEligible) {
    return block(guardrails, `Action type "${action.actionType}" cannot be auto-executed.`);
  }

  // 2. Client enabled
  const clientEnabled = settings.enabled;
  guardrails.push({
    name:   "client_enabled",
    passed: clientEnabled,
    reason: clientEnabled
      ? "Auto-execution is enabled for this client."
      : "Auto-execution is disabled for this client. Enable it in Settings → Auto-Execution.",
  });

  if (!clientEnabled) {
    return block(guardrails, "Auto-execution is disabled for this client.");
  }

  // 3. Action type allowed
  const typeAllowed =
    action.actionType === "run_sync"
      ? settings.allowRunSync
      : action.actionType === "pause_campaign"
      ? settings.allowPauseCampaign
      : false;

  guardrails.push({
    name:   "action_type_allowed",
    passed: typeAllowed,
    reason: typeAllowed
      ? `"${action.actionType}" is permitted in auto-execution settings.`
      : `"${action.actionType}" is not permitted in auto-execution settings for this client.`,
  });

  if (!typeAllowed) {
    return block(guardrails, `"${action.actionType}" is not permitted for this client.`);
  }

  // 4. Action has approved status
  const isApproved = action.status === "approved";
  guardrails.push({
    name:   "action_approved",
    passed: isApproved,
    reason: isApproved
      ? "Action has been approved."
      : `Action status is "${action.status}" — only approved actions can be auto-executed.`,
  });

  if (!isApproved) {
    return skip(guardrails, `Action status is "${action.status}", not approved.`);
  }

  // 5. Not already executed
  const alreadyDone = action.status === "executed";
  guardrails.push({
    name:   "not_already_executed",
    passed: !alreadyDone,
    reason: alreadyDone
      ? "Action has already been executed."
      : "Action has not been executed yet.",
  });

  if (alreadyDone) {
    return skip(guardrails, "Action has already been executed.");
  }

  // 6. Daily cap
  const todayCount = await countTodayExecutions(action.clientAccountId);
  const underCap   = todayCount < settings.maxDailyExecutions;
  guardrails.push({
    name:   "daily_cap",
    passed: underCap,
    reason: underCap
      ? `${todayCount}/${settings.maxDailyExecutions} executions used today.`
      : `Daily cap reached: ${todayCount}/${settings.maxDailyExecutions} executions used today.`,
  });

  if (!underCap) {
    return block(guardrails, `Daily execution cap of ${settings.maxDailyExecutions} reached.`);
  }

  // 7. Cooldown — prevent re-executing on the same entity too frequently
  const lastExecution = await getLastExecutionForEntity(action.entityId, action.actionType);
  let onCooldown = false;
  if (lastExecution && lastExecution.status === "success") {
    const hoursSinceLastRun =
      (Date.now() - lastExecution.executedAt.getTime()) / (1000 * 60 * 60);
    onCooldown = hoursSinceLastRun < PAUSE_COOLDOWN_HOURS;
  }

  guardrails.push({
    name:   "cooldown",
    passed: !onCooldown,
    reason: onCooldown
      ? `Entity was acted on recently (within ${PAUSE_COOLDOWN_HOURS}h). Skipping to prevent rapid re-execution.`
      : "Entity is not in cooldown — safe to execute.",
  });

  if (onCooldown) {
    return skip(guardrails, `Entity "${action.entityName}" is in cooldown.`);
  }

  // All guardrails passed
  return {
    eligible:       true,
    decision:       "execute",
    decisionReason: "All guardrails passed.",
    guardrails,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function block(
  guardrails: GuardrailResult[],
  reason:     string
): EligibilityResult {
  return { eligible: false, decision: "block", decisionReason: reason, guardrails };
}

function skip(
  guardrails: GuardrailResult[],
  reason:     string
): EligibilityResult {
  return { eligible: false, decision: "skip", decisionReason: reason, guardrails };
}
