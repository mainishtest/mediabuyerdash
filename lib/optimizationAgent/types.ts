// Optimization Agent — Types

import type { RiskMode, CampaignMetricsSummary, BudgetPacingResult, FatigueSignal } from "../agentFramework/types";

export interface OptimizationJobInput {
  adAccountId: string;
  riskMode: RiskMode;
  focusArea?: "budget" | "creative" | "audience" | "all";
}

export interface OptimizationAnalysis {
  adAccountId: string;
  campaigns: CampaignMetricsSummary[];
  budgetPacing: BudgetPacingResult[];
  fatigueSignals: FatigueSignal[];
  ruleTriggered: number;
  totalRecommendations: number;
}
