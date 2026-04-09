// Optimization Agent — Analyzer
//
// Analyzes an ad account's active campaigns using the existing rule engine,
// budget pacing, and fatigue detection from the agent framework data layer.

import {
  getActiveCampaignMetrics,
  getBudgetPacing,
  getFrequencyData,
  getCampaignDailyTrends,
} from "../agentFramework/dataAccess";
import { evaluateRuleSet } from "../rules/ruleEngine";
import { sampleOptimizationRules } from "../rules/sampleRules";
import type { RuleEvaluationContext, RuleMetricSnapshot, RecentDayMetrics } from "../../types/optimizationRules";
import type { OptimizationAnalysis, OptimizationJobInput } from "./types";

export async function analyzeActiveAccount(
  input: OptimizationJobInput
): Promise<OptimizationAnalysis> {
  const { adAccountId } = input;

  // Fetch all data in parallel
  const [campaigns, pacing, fatigue] = await Promise.all([
    getActiveCampaignMetrics(adAccountId, 7),
    getBudgetPacing(adAccountId, 7),
    getFrequencyData(adAccountId, 7),
  ]);

  // Build rule evaluation contexts for each campaign
  const contexts: RuleEvaluationContext[] = [];

  for (const campaign of campaigns) {
    // Fetch daily trends for lookback evaluation
    const dailyTrends = await getCampaignDailyTrends(campaign.externalCampaignId, 7);

    const metrics: RuleMetricSnapshot = {
      cpa: campaign.crmCpa,
      roas: campaign.crmRoas,
      spend: campaign.spend,
      frequency: campaign.frequency,
      ctr: campaign.ctr,
      conversions: 0, // would need CRM join per campaign
    };

    const recentDailyMetrics: RecentDayMetrics[] = dailyTrends.map((d) => ({
      date: d.date,
      cpa: 0, // daily CPA requires daily CRM data
      roas: 0,
      spend: d.spend,
      frequency: d.frequency,
      ctr: d.ctr,
      conversions: 0,
    }));

    contexts.push({
      entityId: campaign.externalCampaignId,
      entityName: campaign.campaignName,
      entityLevel: "campaign",
      metrics,
      goals: {
        // Default goals — in production these come from CampaignGoal table
        cpaGoalValue: 30,
        cpaGoalType: "low",
        roasGoalValue: 2.0,
        roasGoalType: "high",
      },
      recentDailyMetrics,
    });
  }

  // Run rule engine
  const ruleOutput = evaluateRuleSet(sampleOptimizationRules, contexts);

  return {
    adAccountId,
    campaigns,
    budgetPacing: pacing,
    fatigueSignals: fatigue,
    ruleTriggered: ruleOutput.results.filter((r) => r.triggered).length,
    totalRecommendations: ruleOutput.recommendations.length,
  };
}
