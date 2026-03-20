// lib/goalAwareOptimization/adEvaluation.ts
// evaluateAdsFromReconciledMetrics() — ad-level evaluation.
// Goals are inherited from the grandparent campaign via the adSet → campaign chain.

import type { Campaign, AdSet, Ad } from "../../types/media";
import type {
  GoalAwareEvaluationResult,
  GoalAwareRecommendation,
} from "../../types/goalAwareOptimization";
import type { RawPerformanceInput } from "./snapshot";
import { buildReconciledPerformanceSnapshot } from "./snapshot";
import { evaluateEntityAgainstGoals } from "./evaluate";
import { buildGoalAwareRecommendation } from "./recommend";

export interface AdOptimizationOutput {
  evaluations:     GoalAwareEvaluationResult[];
  recommendations: GoalAwareRecommendation[];
}

/**
 * Evaluates all ads present in the provided rows.
 * Each ad inherits ROAS and CPA goals from its grandparent campaign
 * (ad → adSet → campaign).
 *
 * @param rows      CRM-backed performance rows
 * @param ads       Ad definitions with adSetId references
 * @param adSets    Ad set definitions with campaignId references
 * @param campaigns Campaign definitions with goal values
 * @param dateFrom  Start of evaluation window (YYYY-MM-DD)
 * @param dateTo    End of evaluation window (YYYY-MM-DD)
 */
export function evaluateAdsFromReconciledMetrics(
  rows:      RawPerformanceInput[],
  ads:       Ad[],
  adSets:    AdSet[],
  campaigns: Campaign[],
  dateFrom:  string,
  dateTo:    string
): AdOptimizationOutput {
  if (campaigns.length === 0) return { evaluations: [], recommendations: [] };

  const clientAccountId = campaigns[0].accountId;

  const snapshots = buildReconciledPerformanceSnapshot(
    rows,
    "ad",
    clientAccountId,
    dateFrom,
    dateTo
  );

  const evaluations:     GoalAwareEvaluationResult[] = [];
  const recommendations: GoalAwareRecommendation[]   = [];

  for (const snapshot of snapshots) {
    const ad       = ads.find((a) => a.id === snapshot.adId);
    if (!ad) continue;

    const adSet    = adSets.find((as) => as.id === ad.adSetId);
    if (!adSet) continue;

    const campaign = campaigns.find((c) => c.id === adSet.campaignId);
    if (!campaign) continue;

    // Ads inherit goals from their grandparent campaign.
    const evaluation = evaluateEntityAgainstGoals(
      snapshot,
      "ad",
      ad.id,
      ad.name,
      campaign.roasGoalValue,
      campaign.cpaGoalValue
    );

    evaluations.push(evaluation);
    recommendations.push(buildGoalAwareRecommendation(evaluation, snapshot));
  }

  return { evaluations, recommendations };
}
