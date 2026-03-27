// lib/goalAwareOptimization/campaignEvaluation.ts
// evaluateCampaignsFromReconciledMetrics() — builds campaign-level
// ReconciledPerformanceSnapshots and evaluates each against its own goals.

import type { Campaign } from "../../types/media";
import type {
  GoalAwareEvaluationResult,
  GoalAwareRecommendation,
} from "../../types/goalAwareOptimization";
import type { RawPerformanceInput } from "./snapshot";
import { buildReconciledPerformanceSnapshot } from "./snapshot";
import { evaluateEntityAgainstGoals } from "./evaluate";
import { buildGoalAwareRecommendation } from "./recommend";

export interface CampaignOptimizationOutput {
  evaluations:     GoalAwareEvaluationResult[];
  recommendations: GoalAwareRecommendation[];
}

/**
 * Evaluates all campaigns present in the provided rows against their
 * configured ROAS and CPA goals.
 *
 * @param rows      CRM-backed performance rows (from reconciliation engine or sample data)
 * @param campaigns Campaign definitions with roasGoalValue and cpaGoalValue
 * @param dateFrom  Start of evaluation window (YYYY-MM-DD)
 * @param dateTo    End of evaluation window (YYYY-MM-DD)
 */
export function evaluateCampaignsFromReconciledMetrics(
  rows:      RawPerformanceInput[],
  campaigns: Campaign[],
  dateFrom:  string,
  dateTo:    string
): CampaignOptimizationOutput {
  if (campaigns.length === 0) return { evaluations: [], recommendations: [] };

  // All campaigns are assumed to belong to the same client account (v1).
  const clientAccountId = campaigns[0].accountId;

  const snapshots = buildReconciledPerformanceSnapshot(
    rows,
    "campaign",
    clientAccountId,
    dateFrom,
    dateTo
  );

  const evaluations:     GoalAwareEvaluationResult[] = [];
  const recommendations: GoalAwareRecommendation[]   = [];

  for (const snapshot of snapshots) {
    const campaign = campaigns.find((c) => c.id === snapshot.campaignId);
    if (!campaign) continue;

    const evaluation = evaluateEntityAgainstGoals(
      snapshot,
      "campaign",
      campaign.id,
      campaign.name,
      campaign.roasGoalValue,
      campaign.cpaGoalValue
    );

    evaluations.push(evaluation);
    recommendations.push(buildGoalAwareRecommendation(evaluation, snapshot));
  }

  return { evaluations, recommendations };
}
