// lib/governance/summary.ts
// Governance control summary utilities.
//
// summarizeGovernanceControls() builds the workspace-level overview used by
// the governance UI, the command center, and the AI assistant context.

import type { GovernanceControlSummary } from "./types";
import { getActiveStops, getActiveOverrides, getGovernanceCounts } from "./persist";

/**
 * Build a full governance control summary for a workspace.
 * Loads stops, overrides, and counts from DB in parallel.
 */
export async function summarizeGovernanceControls(
  workspaceId: string
): Promise<GovernanceControlSummary> {
  const [stops, overrides, counts] = await Promise.all([
    getActiveStops(workspaceId),
    getActiveOverrides(workspaceId),
    getGovernanceCounts(workspaceId),
  ]);

  const automationPaused = stops.some((s) => s.scope === "global");

  return {
    workspaceId,
    automationPaused,
    activeStopCount:     counts.activeStops,
    activeOverrideCount: counts.activeOverrides,
    pendingEscalations:  counts.pendingEscalations,
    pendingApprovals:    counts.pendingApprovals,
    deferredActions:     counts.deferredActions,
    activeStops:         stops,
    activeOverrides:     overrides,
    resolvedAt:          new Date().toISOString(),
  };
}

/**
 * Build a concise governance control summary for display in the command center
 * or AI assistant context (fewer fields, no arrays).
 */
export function buildApprovalControlSummary(
  summary: GovernanceControlSummary
): {
  status:      "all_clear" | "stops_active" | "paused";
  headline:    string;
  details:     string[];
} {
  if (summary.automationPaused) {
    return {
      status:   "paused",
      headline: "Automation is paused workspace-wide.",
      details:  [
        `${summary.activeStopCount} emergency stop(s) active.`,
        `${summary.pendingApprovals} action(s) awaiting approval.`,
        `${summary.deferredActions} action(s) deferred.`,
      ],
    };
  }

  if (summary.activeStopCount > 0 || summary.activeOverrideCount > 0) {
    return {
      status:   "stops_active",
      headline: `${summary.activeStopCount} stop(s) and ${summary.activeOverrideCount} override(s) active.`,
      details:  [
        `${summary.pendingEscalations} escalated action(s) need elevated review.`,
        `${summary.pendingApprovals} action(s) awaiting standard approval.`,
        `${summary.deferredActions} action(s) deferred.`,
      ],
    };
  }

  return {
    status:   "all_clear",
    headline: "No active stops or overrides.",
    details:  [
      `${summary.pendingApprovals} action(s) awaiting approval.`,
      summary.deferredActions > 0
        ? `${summary.deferredActions} action(s) deferred.`
        : "No deferred actions.",
    ],
  };
}
