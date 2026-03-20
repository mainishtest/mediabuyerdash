// lib/goalAwareOptimization/adSetEvaluation.ts
// evaluateAdSetsFromReconciledMetrics() — ad-set-level evaluation.
// Goals are inherited from the parent campaign.

import type { Campaign, AdSet } from "../../types/media";
import type {
  GoalAwareEvaluationResult,
  GoalAwareRecommendation,
} from "../../types/goalAwareOptimization";
import type { RawPerformanceInput } from "./snapshot";
import { buildReconciledPerformanceSnapshot } from "./snapshot";
import { evaluateEntityAgainstGoals } from "./evaluate";
import { buildGoalAwareRecommendation } from "./recommend";

export interface AdSetOptimizationOutput {
  evaluations:     GoalAwareEvaluationResult[];
  recommendations: GoalAwareRecommendation[];
}

/**
 * Evaluates all ad sets present in the provided rows.
 * Each ad set inherits ROAS and CPA goals from its parent campaign.
 *
 * @param rows      CRM-backed performance rows
 * @param adSets    Ad set definitions with campaignId references
 * @param campaigns Campaign definitions with goal values
 * @param dateFrom  Start of evaluation window (YYYY-MM-DD)
 * @param dateTo    End of evaluation window (YYYY-MM-DD)
 */
export function evaluateAdSetsFromReconciledMetrics(
  rows:      RawPerformanceInput[],
  adSets:    AdSet[],
  campaigns: Campaign[],
  dateFrom:  string,
  dateTo:    string
): AdSetOptimizationOutput {
  if (campaigns.length === 0) return { evaluations: [], recommendations: [] };

  const clientAccountId = campaigns[0].accountId;

  const snapshots = buildReconciledPerformanceSnapshot(
    rows,
    "adset",
    clientAccountId,
    dateFrom,
    dateTo
  );

  const evaluations:     GoalAwareEvaluationResult[] = [];
  const recommendations: GoalAwareRecommendation[]   = [];

  for (const snapshot of snapshots) {
    const adSet    = adSets.find((a) => a.id === snapshot.adSetId);
    if (!adSet) continue;

    const campaign = campaigns.find((c) => c.id === adSet.campaignId);
    if (!campaign) continue;

    // Ad sets inherit goals from their parent campaign.
    const evaluation = evaluateEntityAgainstGoals(
      snapshot,
      "adset",
      adSet.id,
      adSet.name,
      campaign.roasGoalValue,
      campaign.cpaGoalValue
    );

    evaluations.push(evaluation);
    recommendations.push(buildGoalAwareRecommendation(evaluation, snapshot));
  }

  return { evaluations, recommendations };
}
