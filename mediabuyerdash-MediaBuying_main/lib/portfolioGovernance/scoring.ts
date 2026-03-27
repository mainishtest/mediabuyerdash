// ─── Portfolio Governance — Priority Scoring ──────────────────────────────────
//
// Pure functions for computing and explaining governance priority scores.
// No DB calls. No UI imports.
//
// Score is a 0–100 composite:
//   riskWeight       0–40  governance/goal/pacing severity
//   opportunityWeight 0–30  upside strength
//   urgencyBonus     0–20  time pressure, overdue items
//   confidencePenalty 0–10  deducted for stale/sparse data
//
// Tier mapping:
//   75–100 → critical
//   50–74  → high
//   25–49  → medium
//   0–24   → low

import type {
  PortfolioPriorityScore,
  GovernancePriorityTier,
  PortfolioRiskCategory,
  PortfolioOpportunityCategory,
} from "./types";

// ── Tier from score ────────────────────────────────────────────────────────────

export function tierFromScore(score: number): GovernancePriorityTier {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}

// ── Risk category base weight ─────────────────────────────────────────────────

export function riskCategoryWeight(category: PortfolioRiskCategory): number {
  const WEIGHTS: Record<PortfolioRiskCategory, number> = {
    governance_blocker:     40, // emergency stop / restricted — maximum
    goal_risk:              30,
    pacing_risk:            28,
    performance_decline:    22,
    approval_bottleneck:    20,
    automation_restriction: 18,
    fatigue_risk:           14,
  };
  return WEIGHTS[category] ?? 10;
}

// ── Opportunity category base weight ─────────────────────────────────────────

export function opportunityCategoryWeight(category: PortfolioOpportunityCategory): number {
  const WEIGHTS: Record<PortfolioOpportunityCategory, number> = {
    winning_experiment_expansion: 30, // highest ROI action available
    account_scaling_candidate:    28,
    goal_outperformance:          22,
    creative_refresh_opportunity: 18,
    strong_launch_candidate:      16,
  };
  return WEIGHTS[category] ?? 10;
}

// ── Risk score input ──────────────────────────────────────────────────────────

export type RiskScoreInput = {
  category:           PortfolioRiskCategory;
  hasEmergencyStop:   boolean;
  isRestricted:       boolean;
  hasOverdueApproval: boolean;
  criticalPacing:     boolean; // pct < 60 or > 130
  hasStaleSync:       boolean;
  roasMissRatio:      number | null; // how far below goal: 1 - (actual/goal), or null
  hasGoalData:        boolean;
};

export function computeRiskPriorityScore(input: RiskScoreInput): PortfolioPriorityScore {
  const reasons: string[] = [];
  let riskWeight = riskCategoryWeight(input.category);

  // Governance multipliers
  if (input.hasEmergencyStop) {
    riskWeight = Math.min(40, riskWeight + 10);
    reasons.push("Emergency stop is active — all automation blocked");
  }
  if (input.isRestricted) {
    riskWeight = Math.min(40, riskWeight + 5);
    reasons.push("Account is in restricted automation mode");
  }

  // Urgency
  let urgencyBonus = 0;
  if (input.hasOverdueApproval) {
    urgencyBonus += 12;
    reasons.push("Approval pending >48 hours — action is overdue");
  }
  if (input.criticalPacing) {
    urgencyBonus += 8;
    reasons.push("Pacing is critically off target");
  }
  if (input.hasStaleSync) {
    urgencyBonus = Math.max(0, urgencyBonus - 2);
    reasons.push("Data sync is stale — signals may not reflect current state");
  }
  urgencyBonus = Math.min(20, urgencyBonus);

  // ROAS miss signal
  const opportunityWeight = 0; // risks have no upside weight
  if (input.roasMissRatio !== null && input.roasMissRatio > 0.3) {
    riskWeight = Math.min(40, riskWeight + 5);
    reasons.push(`ROAS is ${Math.round(input.roasMissRatio * 100)}% below goal (CRM, 7-day attribution)`);
  }

  // Confidence
  let confidencePenalty = 0;
  if (!input.hasGoalData) {
    confidencePenalty = 6;
    reasons.push("No goal data set — confidence is limited");
  }
  if (input.hasStaleSync) {
    confidencePenalty += 4;
  }
  confidencePenalty = Math.min(10, confidencePenalty);

  const score = Math.max(0, Math.min(100, riskWeight + opportunityWeight + urgencyBonus - confidencePenalty));

  return {
    score,
    tier: tierFromScore(score),
    components: { riskWeight, opportunityWeight, urgencyBonus, confidencePenalty },
    reasons,
  };
}

// ── Opportunity score input ───────────────────────────────────────────────────

export type OpportunityScoreInput = {
  category:           PortfolioOpportunityCategory;
  hasEmergencyStop:   boolean;
  isRestricted:       boolean;
  hasOverdueApproval: boolean;
  roasOutperformRatio: number | null; // how far above goal: (actual/goal) - 1, or null
  hasGoalData:        boolean;
  hasStaleSync:       boolean;
  isUnderBudget:      boolean;
  hasExperimentWinner: boolean;
};

export function computeOpportunityPriorityScore(input: OpportunityScoreInput): PortfolioPriorityScore {
  const reasons: string[] = [];
  let opportunityWeight = opportunityCategoryWeight(input.category);

  // Upside signals
  if (input.hasExperimentWinner) {
    opportunityWeight = Math.min(30, opportunityWeight + 5);
    reasons.push("Experiment has a declared winner ready to deploy");
  }
  if (input.roasOutperformRatio !== null && input.roasOutperformRatio > 0.3) {
    opportunityWeight = Math.min(30, opportunityWeight + 4);
    reasons.push(`ROAS is ${Math.round(input.roasOutperformRatio * 100)}% above goal — strong performance signal`);
  }
  if (input.isUnderBudget) {
    reasons.push("Account is under-spending budget while hitting performance goals");
  }

  // Blockers reduce urgency (opportunity exists but can't be acted on)
  let riskWeight = 0;
  let urgencyBonus = 0;
  if (input.hasEmergencyStop) {
    riskWeight = 5;
    urgencyBonus = -5;
    reasons.push("Emergency stop is active — opportunity is blocked from execution");
  } else if (input.isRestricted) {
    riskWeight = 3;
    reasons.push("Account is restricted — review governance before acting");
  } else if (input.hasOverdueApproval) {
    urgencyBonus = 8;
    reasons.push("Approval is overdue — opportunity needs prioritized review");
  }
  urgencyBonus = Math.max(0, Math.min(20, urgencyBonus));

  // Confidence
  let confidencePenalty = 0;
  if (!input.hasGoalData) {
    confidencePenalty = 8;
    reasons.push("No goal data — opportunity confidence is lower");
  }
  if (input.hasStaleSync) {
    confidencePenalty += 4;
    reasons.push("Stale sync — underlying signals may be outdated");
  }
  confidencePenalty = Math.min(10, confidencePenalty);

  const score = Math.max(0, Math.min(100, riskWeight + opportunityWeight + urgencyBonus - confidencePenalty));

  return {
    score,
    tier: tierFromScore(score),
    components: { riskWeight, opportunityWeight, urgencyBonus, confidencePenalty },
    reasons,
  };
}

// ── Explain priority (human-readable summary) ─────────────────────────────────

export function explainPortfolioPriority(ps: PortfolioPriorityScore): string {
  const { components, tier } = ps;
  const parts: string[] = [];

  if (components.riskWeight >= 30)       parts.push("severe governance or goal risk");
  else if (components.riskWeight >= 20)  parts.push("moderate risk signal");
  else if (components.riskWeight > 0)    parts.push("low risk signal");

  if (components.opportunityWeight >= 25) parts.push("high-value upside opportunity");
  else if (components.opportunityWeight >= 15) parts.push("moderate upside opportunity");
  else if (components.opportunityWeight > 0)   parts.push("low-grade upside signal");

  if (components.urgencyBonus >= 10) parts.push("urgent — immediate attention needed");
  else if (components.urgencyBonus > 0) parts.push("time-sensitive");

  if (components.confidencePenalty >= 8) parts.push("low data confidence");
  else if (components.confidencePenalty >= 4) parts.push("partial data");

  const tierLabel =
    tier === "critical" ? "Critical priority" :
    tier === "high"     ? "High priority"     :
    tier === "medium"   ? "Medium priority"   :
                          "Low priority";

  return parts.length > 0
    ? `${tierLabel}: ${parts.join(", ")}.`
    : `${tierLabel}.`;
}

// ── Display helpers ────────────────────────────────────────────────────────────

export function governancePriorityBadgeClass(tier: GovernancePriorityTier): string {
  if (tier === "critical") return "border-rose-800/50 bg-rose-950/60 text-rose-300";
  if (tier === "high")     return "border-amber-800/50 bg-amber-950/60 text-amber-300";
  if (tier === "medium")   return "border-sky-800/50 bg-sky-950/60 text-sky-300";
  return "border-slate-700 bg-slate-800 text-slate-400";
}

export function readinessLabel(r: string): string {
  const MAP: Record<string, string> = {
    ready:          "Ready",
    needs_review:   "Needs Review",
    blocked:        "Blocked",
    waiting:        "Waiting",
    low_confidence: "Low Confidence",
  };
  return MAP[r] ?? r.replace(/_/g, " ");
}

export function readinessBadgeClass(r: string): string {
  if (r === "ready")          return "border-emerald-800/50 bg-emerald-950/60 text-emerald-300";
  if (r === "needs_review")   return "border-amber-800/50 bg-amber-950/60 text-amber-300";
  if (r === "blocked")        return "border-rose-800/50 bg-rose-950/60 text-rose-300";
  if (r === "waiting")        return "border-sky-800/50 bg-sky-950/60 text-sky-300";
  if (r === "low_confidence") return "border-slate-600 bg-slate-800/60 text-slate-400";
  return "border-slate-700 bg-slate-800 text-slate-400";
}

export function opportunityCategoryLabel(c: string): string {
  const MAP: Record<string, string> = {
    winning_experiment_expansion: "Experiment Expansion",
    account_scaling_candidate:    "Scaling Candidate",
    creative_refresh_opportunity: "Creative Refresh",
    goal_outperformance:          "Goal Outperformance",
    strong_launch_candidate:      "Launch Ready",
  };
  return MAP[c] ?? c.replace(/_/g, " ");
}

export function riskCategoryLabel(c: string): string {
  const MAP: Record<string, string> = {
    goal_risk:              "Goal Risk",
    pacing_risk:            "Pacing Risk",
    fatigue_risk:           "Fatigue Risk",
    governance_blocker:     "Governance Blocker",
    approval_bottleneck:    "Approval Bottleneck",
    automation_restriction: "Automation Restricted",
    performance_decline:    "Performance Decline",
  };
  return MAP[c] ?? c.replace(/_/g, " ");
}

export function budgetRecommendationLabel(r: string): string {
  const MAP: Record<string, string> = {
    increase_candidate: "Increase Candidate",
    hold:               "Hold",
    monitor_closely:    "Monitor Closely",
    reduce_candidate:   "Reduce Candidate",
    pause_candidate:    "Pause Candidate",
    insufficient_data:  "Insufficient Data",
  };
  return MAP[r] ?? r.replace(/_/g, " ");
}

export function budgetRecommendationBadgeClass(r: string): string {
  if (r === "increase_candidate") return "border-emerald-800/50 bg-emerald-950/60 text-emerald-300";
  if (r === "hold")               return "border-sky-800/50 bg-sky-950/60 text-sky-300";
  if (r === "monitor_closely")    return "border-amber-800/50 bg-amber-950/60 text-amber-300";
  if (r === "reduce_candidate")   return "border-orange-800/50 bg-orange-950/60 text-orange-300";
  if (r === "pause_candidate")    return "border-rose-800/50 bg-rose-950/60 text-rose-300";
  return "border-slate-700 bg-slate-800 text-slate-400";
}
