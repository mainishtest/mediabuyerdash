// Agent Framework — Constants
//
// Default playbook, risk mode multipliers, and agent capability declarations.

import type { AgentPlaybook, AgentType, AgentPermission, RiskMode } from "./types";

// ── Default playbook ────────────────────────────────────────────────────────

export const DEFAULT_PLAYBOOK: AgentPlaybook = {
  namingConvention: {
    campaign: "{brand} — {type} — {date}",
    adSet: "{brand} — {audience}",
    ad: "{brand} — {creative} — Ad {index}",
  },
  budgetMinimums: {
    prospecting: 20,
    retargeting: 10,
    lookalike: 15,
    broad: 20,
    custom: 10,
  },
  defaultExclusions: ["past_purchasers_30d"],
  defaultRiskMode: "balanced",
  budgetCaps: { daily: 500, lifetime: null },
};

// ── Risk mode multipliers ───────────────────────────────────────────────────

export const RISK_MULTIPLIERS: Record<RiskMode, {
  budgetMultiplier: number;
  creativeCount: number;
  includeUntested: boolean;
  audienceBreadth: "narrow" | "mixed" | "broad";
  forcePaused: boolean;
}> = {
  conservative: {
    budgetMultiplier: 0.5,
    creativeCount: 2,
    includeUntested: false,
    audienceBreadth: "narrow",
    forcePaused: true,
  },
  balanced: {
    budgetMultiplier: 1.0,
    creativeCount: 3,
    includeUntested: false,
    audienceBreadth: "mixed",
    forcePaused: true,
  },
  aggressive: {
    budgetMultiplier: 1.5,
    creativeCount: 5,
    includeUntested: true,
    audienceBreadth: "broad",
    forcePaused: false,
  },
};

// ── Agent capability declarations ───────────────────────────────────────────

export const AGENT_CAPABILITIES: Record<AgentType, {
  label: string;
  description: string;
  maxPermission: AgentPermission;
  dataSources: string[];
  requiresApproval: boolean;
}> = {
  launch: {
    label: "Launch Agent",
    description: "Creates campaign drafts from natural language with intelligent defaults",
    maxPermission: "execute",
    dataSources: [
      "MetaSyncedInsight",
      "ReconciliationResult",
      "CreativeAsset",
      "CampaignLaunch",
      "CampaignGoal",
      "MetaSyncedCampaign",
      "MetaSyncedAd",
      "MetaSyncedCreative",
    ],
    requiresApproval: true,
  },
  optimization: {
    label: "Optimization Agent",
    description: "Analyzes active campaigns and recommends performance improvements",
    maxPermission: "recommend",
    dataSources: [
      "MetaSyncedInsight",
      "MetaSyncedCampaign",
      "MetaSyncedAdSet",
      "MetaSyncedAd",
      "ReconciliationResult",
      "CampaignGoal",
      "MetaSyncedCreative",
    ],
    requiresApproval: false,
  },
  audit: {
    label: "Audit Agent",
    description: "Reviews account health and identifies structural issues",
    maxPermission: "recommend",
    dataSources: [
      "MetaSyncedCampaign",
      "MetaSyncedAdSet",
      "MetaSyncedAd",
      "MetaSyncedInsight",
      "CampaignGoal",
      "CampaignLaunch",
      "ReconciliationResult",
    ],
    requiresApproval: false,
  },
  creative_selection: {
    label: "Creative Selection Agent",
    description: "Ranks and recommends creatives based on performance data",
    maxPermission: "recommend",
    dataSources: ["CreativeAsset", "MetaSyncedInsight", "MetaSyncedCreative", "ReconciliationResult"],
    requiresApproval: false,
  },
  testing: {
    label: "Testing Agent",
    description: "Designs A/B test structures and recommends test parameters",
    maxPermission: "draft",
    dataSources: ["MetaSyncedInsight", "CampaignLaunch", "CreativeAsset", "CampaignGoal"],
    requiresApproval: true,
  },
  reporting: {
    label: "Reporting Agent",
    description: "Generates natural language performance summaries",
    maxPermission: "read",
    dataSources: ["MetaSyncedInsight", "ReconciliationResult", "CampaignGoal"],
    requiresApproval: false,
  },
};

// ── Confidence thresholds ───────────────────────────────────────────────────

export function deriveConfidenceLevel(dataPoints: number, lookbackDays: number): "high" | "medium" | "low" {
  if (dataPoints >= 7 && lookbackDays >= 7) return "high";
  if (dataPoints >= 3 && lookbackDays >= 3) return "medium";
  return "low";
}

// ── Health score weights ────────────────────────────────────────────────────

export const HEALTH_SCORE_WEIGHTS = {
  structure: 30,
  spend_efficiency: 30,
  configuration: 20,
  creative_health: 20,
} as const;

// ── Fatigue thresholds ──────────────────────────────────────────────────────

export const FATIGUE_THRESHOLDS = {
  frequencyWarn: 3.0,
  frequencyCritical: 4.5,
  ctrDeclinePercent: 20, // 20% decline over lookback
  minSpendForEval: 50,   // minimum spend to evaluate fatigue
} as const;

// ── Spend check thresholds ──────────────────────────────────────────────────

export const SPEND_THRESHOLDS = {
  zeroConversionMinSpend: 50,
  imbalancePercent: 60,        // one campaign > 60% of total
  underpacingRatio: 0.5,       // spending < 50% of budget
  overpacingRatio: 1.2,        // spending > 120% of budget
} as const;
