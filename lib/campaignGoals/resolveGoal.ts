// lib/campaignGoals/resolveGoal.ts
// Centralized goal resolution for campaign evaluation.
//
// Resolution order (highest priority first):
//   1. Explicit MetaCampaignGoal for the campaign
//   2. ClientGoalDefaults for the client
//   3. No goal — evaluation skipped
//
// This function is the single source of truth for goal lookup.
// Used by the aggregator, alerts, and future automation rules.

// ── Types ─────────────────────────────────────────────────────────────────────

export type GoalSource = "explicit" | "client_default" | "none";

export interface ResolvedGoal {
  roasGoalType:  "high" | "low";
  roasGoalValue: number;
  cpaGoalType:   "high" | "low";
  cpaGoalValue:  number;
  goalSource:    GoalSource;
}

interface GoalRecord {
  roasGoalType:  string;
  roasGoalValue: number;
  cpaGoalType:   string;
  cpaGoalValue:  number;
}

interface ClientDefaultRecord {
  defaultRoasGoalType:  string;
  defaultRoasGoalValue: number;
  defaultCpaGoalType:   string;
  defaultCpaGoalValue:  number;
}

// ── Resolver ──────────────────────────────────────────────────────────────────

/**
 * Resolves the effective goal for a campaign.
 *
 * @param explicitGoal  - MetaCampaignGoal row, or null if none set
 * @param clientDefault - ClientGoalDefaults row, or null if none set
 * @returns ResolvedGoal with the active values and their source, or null if no goal available
 */
export function resolveGoal(
  explicitGoal:  GoalRecord | null,
  clientDefault: ClientDefaultRecord | null
): ResolvedGoal | null {
  if (explicitGoal) {
    return {
      roasGoalType:  explicitGoal.roasGoalType  as "high" | "low",
      roasGoalValue: explicitGoal.roasGoalValue,
      cpaGoalType:   explicitGoal.cpaGoalType   as "high" | "low",
      cpaGoalValue:  explicitGoal.cpaGoalValue,
      goalSource:    "explicit",
    };
  }

  if (clientDefault) {
    return {
      roasGoalType:  clientDefault.defaultRoasGoalType  as "high" | "low",
      roasGoalValue: clientDefault.defaultRoasGoalValue,
      cpaGoalType:   clientDefault.defaultCpaGoalType   as "high" | "low",
      cpaGoalValue:  clientDefault.defaultCpaGoalValue,
      goalSource:    "client_default",
    };
  }

  return null;
}
