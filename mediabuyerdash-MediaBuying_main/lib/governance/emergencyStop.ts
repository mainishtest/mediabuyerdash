// lib/governance/emergencyStop.ts
// Emergency stop management.
//
// Stops are scope-targeted records that:
//  1. Block guarded auto-execution (via guardrail #0 in eligibility.ts)
//  2. Surface as GovernanceFlag in the approval routing layer
//  3. Are always explicitly cleared — never silently expire
//
// Stop check order: global → client → action_type → campaign

import type {
  EmergencyStopState,
  EmergencyStopScope,
  SetStopInput,
  StopCheckResult,
} from "./types";

import {
  createGovernanceStop,
  clearGovernanceStop,
  getActiveStops,
  queryActiveStopsForExecution,
} from "./persist";

// ---------------------------------------------------------------------------
// Create / clear
// ---------------------------------------------------------------------------

/**
 * Set an emergency stop for a scope.
 * If a stop already exists for the same (workspaceId, scope, scopeId), a new
 * record is created alongside it — stacked stops must each be cleared explicitly.
 */
export async function setEmergencyStopState(
  input: SetStopInput
): Promise<EmergencyStopState> {
  return createGovernanceStop(input);
}

/**
 * Clear an emergency stop by ID. Marks isActive=false, records clearedAt/clearedBy.
 * Returns null if the stop was not found.
 */
export async function clearEmergencyStop(
  stopId:    string,
  clearedBy: string | null
): Promise<EmergencyStopState | null> {
  return clearGovernanceStop(stopId, clearedBy);
}

/**
 * Load all active stops for a workspace. Used by the governance UI and summary.
 */
export async function loadActiveStops(
  workspaceId: string
): Promise<EmergencyStopState[]> {
  return getActiveStops(workspaceId);
}

// ---------------------------------------------------------------------------
// Execution eligibility check (called by guardrail layer)
// ---------------------------------------------------------------------------

/**
 * Check if any active stop covers this execution context.
 * Designed to be the first check in evaluateAutoExecutionEligibility()
 * so it short-circuits before any expensive guardrail evaluation.
 *
 * Checks in order:
 *  1. global stop (halts everything)
 *  2. client-scoped stop
 *  3. action_type-scoped stop
 *  4. campaign-scoped stop (entityId maps to campaign)
 */
export async function isStopActiveForExecution(input: {
  workspaceId: string;
  clientId:    string;
  actionType:  string;
  entityId:    string;
}): Promise<StopCheckResult> {
  const stop = await queryActiveStopsForExecution(input);

  if (!stop) {
    return { stopped: false, reason: "No active emergency stop.", stopId: null };
  }

  const scopeLabel =
    stop.scope === "global"      ? "workspace-wide" :
    stop.scope === "client"      ? `client (${stop.scopeId})` :
    stop.scope === "action_type" ? `action type "${stop.scopeId}"` :
    stop.scope === "campaign"    ? `campaign (${stop.scopeId})` :
                                   stop.scope;

  return {
    stopped: true,
    reason:  `Emergency stop active for ${scopeLabel}: "${stop.reason}"`,
    stopId:  stop.id,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if any global stop is active for the workspace.
 */
export async function isGlobalStopActive(workspaceId: string): Promise<boolean> {
  const stops = await getActiveStops(workspaceId);
  return stops.some((s) => s.scope === "global");
}

/**
 * Summarise active stops into GovernanceFlag objects for the routing layer.
 */
export function stopsToGovernanceFlags(
  stops: EmergencyStopState[]
): Array<{ type: "emergency_stop"; scope: string; scopeId: string; message: string }> {
  return stops.map((s) => ({
    type:    "emergency_stop" as const,
    scope:   s.scope,
    scopeId: s.scopeId,
    message: `Emergency stop active: "${s.reason}"`,
  }));
}

export type { EmergencyStopScope };
