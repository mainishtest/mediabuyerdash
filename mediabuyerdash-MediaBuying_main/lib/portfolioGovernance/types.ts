// ─── Portfolio Governance — Typed Models ──────────────────────────────────────
//
// All types for the cross-account opportunity, risk, and budget governance layer.
// This layer provides decision support and governance guidance only.
// It does NOT perform automated capital reallocation.
// Pure type definitions — no business logic.

import type { PortfolioPacingStatus, PortfolioAutonomyMode } from "../portfolio/types";

// Re-export for convenience
export type { PortfolioPacingStatus, PortfolioAutonomyMode };

// ── Priority tier ─────────────────────────────────────────────────────────────

export type GovernancePriorityTier = "critical" | "high" | "medium" | "low";

// ── Opportunity categories ────────────────────────────────────────────────────

export type PortfolioOpportunityCategory =
  | "winning_experiment_expansion"   // experiment winner ready to deploy/scale
  | "account_scaling_candidate"      // strong ROAS + under-budget, eligible to scale
  | "creative_refresh_opportunity"   // fatigue or stale creative signals
  | "goal_outperformance"            // significantly exceeding goal targets
  | "strong_launch_candidate";       // creative approved, ready to launch

// ── Risk categories ───────────────────────────────────────────────────────────

export type PortfolioRiskCategory =
  | "goal_risk"               // ROAS or CPA significantly off target
  | "pacing_risk"             // severe over or under pacing
  | "fatigue_risk"            // creative fatigue or stale sync signals
  | "governance_blocker"      // emergency stop or restricted mode active
  | "approval_bottleneck"     // overdue approvals blocking action
  | "automation_restriction"  // automation constrained by policy or governance
  | "performance_decline";    // trending negative signals

// ── Action readiness ──────────────────────────────────────────────────────────

export type PortfolioActionReadiness =
  | "ready"            // All conditions met — action can proceed immediately
  | "needs_review"     // Requires operator review before action
  | "blocked"          // Active blocker prevents action
  | "waiting"          // Waiting for upstream condition to resolve
  | "low_confidence";  // Insufficient data to make a recommendation

// ── Data confidence ───────────────────────────────────────────────────────────

export type GovernanceDataConfidence = "high" | "medium" | "low";

// ── Budget recommendation ─────────────────────────────────────────────────────

export type PortfolioBudgetRecommendation =
  | "increase_candidate"  // Strong performance, under-budget — eligible for increase
  | "hold"                // On target — hold current budget
  | "monitor_closely"     // Mixed signals — monitor before acting
  | "reduce_candidate"    // Over-pacing or weak performance — consider reducing
  | "pause_candidate"     // Critical signals — consider pausing spend
  | "insufficient_data";  // Not enough data to recommend

// ── Navigation links ──────────────────────────────────────────────────────────

export type PortfolioGovernanceLinks = {
  account:           string;
  commandCenter:     string;
  experiment?:       string;
  creativeLab?:      string;
  approvalQueue?:    string;
  governanceControls?: string;
};

// ── Priority score (composite, explainable) ───────────────────────────────────

export type PortfolioPriorityScore = {
  score:     number;               // 0–100
  tier:      GovernancePriorityTier;
  components: {
    riskWeight:         number;    // 0–40: governance / goal / pacing severity
    opportunityWeight:  number;    // 0–30: upside strength
    urgencyBonus:       number;    // 0–20: time pressure, overdue actions
    confidencePenalty:  number;    // 0–10: deducted for sparse / stale data
  };
  reasons: string[];               // human-readable scoring rationale
};

// ── Upside signal ─────────────────────────────────────────────────────────────

export type PortfolioUpsideSignal = {
  type:        string;
  weight:      number;
  description: string;
};

// ── Downside signal ───────────────────────────────────────────────────────────

export type PortfolioDownsideSignal = {
  type:        string;
  weight:      number;
  description: string;
};

// ── Governance reason ─────────────────────────────────────────────────────────

export type PortfolioGovernanceReason = {
  summary: string;
  details: string[];
};

// ── Portfolio opportunity (cross-account) ─────────────────────────────────────

export type PortfolioOpportunity = {
  id:               string;
  clientId:         string;
  clientName:       string;
  category:         PortfolioOpportunityCategory;
  title:            string;
  description:      string;
  supportingReasons: string[];
  upsideSignals:    PortfolioUpsideSignal[];
  priorityScore:    PortfolioPriorityScore;
  readiness:        PortfolioActionReadiness;
  blockers:         string[];
  recommendedNextAction: string;
  links:            PortfolioGovernanceLinks;
  dataConfidence:   GovernanceDataConfidence;
  generatedAt:      string;
};

// ── Portfolio risk (cross-account) ────────────────────────────────────────────

export type PortfolioRisk = {
  id:               string;
  clientId:         string;
  clientName:       string;
  category:         PortfolioRiskCategory;
  title:            string;
  description:      string;
  supportingReasons: string[];
  downsideSignals:  PortfolioDownsideSignal[];
  priorityScore:    PortfolioPriorityScore;
  readiness:        PortfolioActionReadiness;
  blockers:         string[];
  recommendedNextAction: string;
  links:            PortfolioGovernanceLinks;
  dataConfidence:   GovernanceDataConfidence;
  generatedAt:      string;
};

// ── Budget governance item (per client) ──────────────────────────────────────

export type PortfolioBudgetGovernanceItem = {
  clientId:              string;
  clientName:            string;
  currency:              string;
  monthlyBudget:         number | null;
  currentSpend:          number;
  pacingPct:             number | null;
  pacingStatus:          PortfolioPacingStatus;
  roas:                  number | null;
  roasGoal:              number | null;
  roasVsGoalRatio:       number | null;  // actual / goal (>1 = beating goal)
  cpa:                   number | null;
  cpaGoal:               number | null;
  cpaVsGoalRatio:        number | null;  // actual / goal (<1 = beating goal)
  budgetRecommendation:  PortfolioBudgetRecommendation;
  governanceReason:      PortfolioGovernanceReason;
  readiness:             PortfolioActionReadiness;
  blockers:              string[];
  autonomyMode:          PortfolioAutonomyMode | null;
  hasEmergencyStop:      boolean;
  links:                 PortfolioGovernanceLinks;
};

// ── Governance summary (portfolio-wide) ──────────────────────────────────────

export type PortfolioGovernanceSummary = {
  generatedAt:            string;
  dateRange:              { from: string; to: string };
  totalOpportunities:     number;
  criticalOpportunities:  number;
  totalRisks:             number;
  criticalRisks:          number;
  readyOpportunities:     number;
  blockedItems:           number;
  budgetGovernanceItems:  number;
  totalClients:           number;
  accountsWithBlockers:   number;
};

// ── Full governance payload (server → client) ─────────────────────────────────

export type PortfolioGovernancePayload = {
  summary:          PortfolioGovernanceSummary;
  opportunities:    PortfolioOpportunity[];
  risks:            PortfolioRisk[];
  budgetGovernance: PortfolioBudgetGovernanceItem[];
  clients:          { id: string; name: string }[];
};

// ── Filter state (governance page) ───────────────────────────────────────────

export type GovernanceFilterState = {
  clientId:         string;
  priorityTier:     GovernancePriorityTier | "";
  opportunityCategory: PortfolioOpportunityCategory | "";
  riskCategory:     PortfolioRiskCategory | "";
  readiness:        PortfolioActionReadiness | "";
  autonomyMode:     PortfolioAutonomyMode | "";
  approvalStatus:   "has_pending" | "overdue" | "";
};
