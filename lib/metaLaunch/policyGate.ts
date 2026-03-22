// lib/metaLaunch/policyGate.ts
// Governance stop + safety policy checks before Meta launch execution.
// Reuses existing GovernanceStop and ActionSafetyPolicy models.

import { prisma } from "../db";
import type { PolicyGateResult, PolicyGateCheck } from "./types";

/**
 * Evaluate all governance and safety policy gates before a launch can proceed.
 *
 * Checks:
 *   1. No active GovernanceStop for the client or globally
 *   2. ActionSafetyPolicy allows execution (not restricted or recommend_only)
 *   3. No active GovernanceStop for the specific campaign (if provided)
 */
export async function evaluatePolicyGate(opts: {
  clientAccountId:           string;
  workspaceId?:              string | null;
  targetCampaignExternalId?: string | null;
  externalAdAccountId?:      string | null;
}): Promise<PolicyGateResult> {
  const checks: PolicyGateCheck[] = [];
  const blockers: string[] = [];

  // 1. Check for active governance stops
  const stopScopes = [
    { scope: "global", scopeId: "global" },
    { scope: "client", scopeId: opts.clientAccountId },
  ];
  if (opts.externalAdAccountId) {
    stopScopes.push({ scope: "ad_account", scopeId: opts.externalAdAccountId });
  }
  if (opts.targetCampaignExternalId) {
    stopScopes.push({ scope: "campaign", scopeId: opts.targetCampaignExternalId });
  }
  // Also check action_type stops for "launch" actions
  stopScopes.push({ scope: "action_type", scopeId: "launch" });

  const activeStops = await prisma.governanceStop.findMany({
    where: {
      isActive: true,
      OR: stopScopes.map((s) => ({ scope: s.scope, scopeId: s.scopeId })),
      // Exclude expired stops
      AND: [
        {
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
      ],
    },
    select: { scope: true, scopeId: true, reason: true },
  });

  const noStops = activeStops.length === 0;
  checks.push({
    key:     "no_governance_stops",
    label:   "No Governance Stops",
    passed:  noStops,
    message: noStops
      ? "No active governance stops found."
      : `${activeStops.length} active stop(s): ${activeStops.map((s) => `${s.scope}/${s.scopeId}: ${s.reason}`).join("; ")}`,
  });
  if (!noStops) {
    blockers.push(...activeStops.map((s) => `Governance stop (${s.scope}): ${s.reason}`));
  }

  // 2. Check ActionSafetyPolicy
  const policyScopes = [opts.clientAccountId];
  if (opts.externalAdAccountId) policyScopes.push(opts.externalAdAccountId);
  if (opts.targetCampaignExternalId) policyScopes.push(opts.targetCampaignExternalId);

  const policies = await prisma.actionSafetyPolicy.findMany({
    where: {
      scopeId: { in: policyScopes },
      ...(opts.workspaceId ? { workspaceId: opts.workspaceId } : {}),
    },
    select: { scope: true, scopeId: true, autonomyMode: true },
  });

  // Check if any policy blocks execution
  const blockingModes = ["restricted", "recommend_only"];
  const blockingPolicies = policies.filter((p) => blockingModes.includes(p.autonomyMode));

  const policyAllows = blockingPolicies.length === 0;
  checks.push({
    key:     "safety_policy_allows",
    label:   "Safety Policy Allows Launch",
    passed:  policyAllows,
    message: policyAllows
      ? policies.length === 0
        ? "No restrictive safety policies found (default allows launch)."
        : `${policies.length} policy(s) checked — all allow launch.`
      : `${blockingPolicies.length} policy(s) block launch: ${blockingPolicies.map((p) => `${p.scope}/${p.scopeId} is ${p.autonomyMode}`).join("; ")}`,
  });
  if (!policyAllows) {
    blockers.push(...blockingPolicies.map((p) => `Safety policy (${p.scope}): autonomy mode is "${p.autonomyMode}"`));
  }

  // 3. Check for active automation overrides that pause the scope
  const pauseOverrides = await prisma.automationOverride.findMany({
    where: {
      isActive: true,
      overrideType: { in: ["pause_scope", "require_approval_all"] },
      OR: [
        { scope: "global", scopeId: "global" },
        { scope: "client", scopeId: opts.clientAccountId },
        ...(opts.externalAdAccountId
          ? [{ scope: "ad_account" as const, scopeId: opts.externalAdAccountId }]
          : []),
      ],
      AND: [
        {
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
      ],
    },
    select: { overrideType: true, scope: true, scopeId: true, reason: true },
  });

  const noPauses = pauseOverrides.length === 0;
  checks.push({
    key:     "no_automation_pauses",
    label:   "No Automation Pauses",
    passed:  noPauses,
    message: noPauses
      ? "No active automation pauses."
      : `${pauseOverrides.length} pause(s) active: ${pauseOverrides.map((o) => `${o.overrideType} on ${o.scope}: ${o.reason ?? "no reason"}`).join("; ")}`,
  });
  if (!noPauses) {
    blockers.push(...pauseOverrides.map((o) => `Automation override (${o.overrideType}): ${o.reason ?? "scope paused"}`));
  }

  return {
    allowed: blockers.length === 0,
    checks,
    blockers,
  };
}
