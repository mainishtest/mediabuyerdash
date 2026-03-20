// lib/goals/resolve.ts
// Central goal resolution logic.
//
// All functions are pure — no DB calls, no side effects.
// Resolution is deterministic and testable.
//
// Priority order (per product spec):
//   1. Campaign goal  (MetaCampaignGoal)
//   2. Client goal    (ClientGoalDefaults)
//   3. System default (SYSTEM_DEFAULT_GOAL)
//
// Resolution is field-level: each metric field independently falls through
// the hierarchy. A campaign that sets only targetRoas still inherits
// targetCpa from the client level if available, then system default.
//
// GoalSource tracks the most specific level that contributed ANY non-null field.

import type { ClientGoal, CampaignGoal, ResolvedGoal, GoalSource } from "./types";
import { getSystemDefaultGoal }                                      from "./defaults";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function hasAnyField(goal: CampaignGoal | ClientGoal): boolean {
  return (
    goal.targetRoas    != null ||
    goal.targetCpa     != null ||
    goal.targetCtr     != null ||
    goal.targetCvr     != null ||
    goal.maxDailySpend != null
  );
}

function safePositive(v: number | null | undefined): number | null {
  if (v == null) return null;
  return Number.isFinite(v) && v > 0 ? v : null;
}

// ---------------------------------------------------------------------------
// getGoalSource
// Returns the GoalSource given what levels are populated.
// Pure helper — used by APIs and UI to display source without full resolution.
// ---------------------------------------------------------------------------

export function getGoalSource(
  campaign: CampaignGoal | null,
  client:   ClientGoal   | null
): GoalSource {
  if (campaign && hasAnyField(campaign)) return "campaign";
  if (client   && hasAnyField(client))   return "client";
  return "system_default";
}

// ---------------------------------------------------------------------------
// mergeGoalFields
// Core field-level merger. Each field independently falls through the hierarchy.
// ---------------------------------------------------------------------------

export function mergeGoalFields(
  campaign: CampaignGoal | null,
  client:   ClientGoal   | null
): ResolvedGoal {
  const defaults = getSystemDefaultGoal();
  const source   = getGoalSource(campaign, client);

  return {
    targetRoas:    safePositive(campaign?.targetRoas    ?? client?.targetRoas)    ?? defaults.targetRoas,
    targetCpa:     safePositive(campaign?.targetCpa     ?? client?.targetCpa)     ?? defaults.targetCpa,
    targetCtr:     safePositive(campaign?.targetCtr     ?? client?.targetCtr)     ?? defaults.targetCtr,
    targetCvr:     safePositive(campaign?.targetCvr     ?? client?.targetCvr)     ?? defaults.targetCvr,
    maxDailySpend: safePositive(campaign?.maxDailySpend ?? client?.maxDailySpend) ?? defaults.maxDailySpend,
    source,
  };
}

// ---------------------------------------------------------------------------
// resolveGoalForCampaign
// Resolves the effective goal for a campaign entity.
// ---------------------------------------------------------------------------

export function resolveGoalForCampaign(
  campaign: CampaignGoal | null,
  client:   ClientGoal   | null
): ResolvedGoal {
  return mergeGoalFields(campaign, client);
}

// ---------------------------------------------------------------------------
// resolveGoalForCreative
// Creatives inherit their goal from the campaign they belong to.
// The resolution hierarchy is identical — campaign → client → system default.
// ---------------------------------------------------------------------------

export function resolveGoalForCreative(
  campaign: CampaignGoal | null,
  client:   ClientGoal   | null
): ResolvedGoal {
  return mergeGoalFields(campaign, client);
}
