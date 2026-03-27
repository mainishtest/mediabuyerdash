// lib/campaignPerformance/evaluator.ts
// Wraps the shared evaluateEntity() to produce a CampaignHealthStatus.
// The extra statuses (no_goal, stale, no_data) are handled in the aggregator
// before this function is called — this function only runs when a goal exists
// and spend data is present.

import { evaluateEntity } from "../evaluationUtils";
import type { CampaignHealthStatus, CampaignHealthCounts, CampaignPerformanceSnapshot } from "./types";

// ── Per-campaign evaluation ────────────────────────────────────────────────────

export interface EvaluateCampaignInput {
  evaluatedRoas: number;
  evaluatedCpa:  number;
  roasGoalValue: number;
  roasGoalType:  "high" | "low";
  cpaGoalValue:  number;
  cpaGoalType:   "high" | "low";
}

export interface EvaluateCampaignResult {
  healthStatus:  CampaignHealthStatus;
  meetsRoasGoal: boolean;
  meetsCpaGoal:  boolean;
  shortReason:   string;
}

/**
 * Evaluate a campaign that has a goal and spend data.
 * Delegates to the shared evaluateEntity() so goal logic stays centralised.
 * Callers are responsible for the no_goal / stale / no_data guards.
 */
export function evaluateCampaignAgainstGoals(
  input: EvaluateCampaignInput
): EvaluateCampaignResult {
  const result = evaluateEntity({
    entityId:      "_campaign_eval",
    entityName:    "_campaign_eval",
    actualRoas:    input.evaluatedRoas,
    actualCpa:     input.evaluatedCpa,
    roasGoalType:  input.roasGoalType,
    roasGoalValue: input.roasGoalValue,
    cpaGoalType:   input.cpaGoalType,
    cpaGoalValue:  input.cpaGoalValue,
  });

  return {
    // EvaluationStatus is a subset of CampaignHealthStatus — safe cast
    healthStatus:  result.status as CampaignHealthStatus,
    meetsRoasGoal: result.meetsRoasGoal,
    meetsCpaGoal:  result.meetsCpaGoal,
    shortReason:   result.shortReason,
  };
}

// ── Aggregate counts ───────────────────────────────────────────────────────────

export function countCampaignsByHealthStatus(
  snapshots: CampaignPerformanceSnapshot[]
): CampaignHealthCounts {
  const counts: CampaignHealthCounts = {
    strong: 0, on_target: 0, watch: 0, below_goal: 0,
    no_goal: 0, stale: 0, no_data: 0, total: snapshots.length,
  };
  for (const s of snapshots) {
    counts[s.healthStatus]++;
  }
  return counts;
}
