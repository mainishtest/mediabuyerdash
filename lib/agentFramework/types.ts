// Agent Framework — Core Types
//
// Shared type contracts for the multi-agent media buying operator.
// All agents (Launch, Optimization, Audit, etc.) share these abstractions.

// ── Agent identity ──────────────────────────────────────────────────────────

export type AgentType =
  | "launch"
  | "optimization"
  | "audit"
  | "creative_selection"
  | "testing"
  | "reporting";

export type AgentPermission = "read" | "recommend" | "draft" | "execute";

export type RiskMode = "conservative" | "balanced" | "aggressive";

// ── Confidence ──────────────────────────────────────────────────────────────

export interface ConfidenceScore {
  level: "high" | "medium" | "low";
  reasoning: string;
  dataPoints: number;
  lookbackDays: number;
}

// ── Recommendations ─────────────────────────────────────────────────────────

export type RecommendationCategory =
  | "budget_increase"
  | "budget_decrease"
  | "creative_swap"
  | "creative_fatigue"
  | "pause_underperformer"
  | "audience_adjustment"
  | "naming_issue"
  | "missing_goal"
  | "missing_pixel"
  | "targeting_overlap"
  | "zero_conversions"
  | "spend_imbalance"
  | "pacing_anomaly"
  | "configuration_issue"
  | "general";

export interface AgentRecommendation {
  id: string;
  agentType: AgentType;
  category: RecommendationCategory;
  title: string;
  description: string;
  confidence: ConfidenceScore;
  assumptions: string[];
  supportingData: Record<string, unknown>;
  suggestedAction: string;
  impact: "high" | "medium" | "low";
  requiresApproval: boolean;
}

// ── Job lifecycle ───────────────────────────────────────────────────────────

export type AgentJobStatus =
  | "pending"
  | "collecting_data"
  | "analyzing"
  | "generating_recommendations"
  | "awaiting_review"
  | "approved"
  | "executing"
  | "completed"
  | "failed"
  | "cancelled";

export interface AgentJobStep {
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  description: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface AgentJob {
  id: string;
  agentType: AgentType;
  status: AgentJobStatus;
  riskMode: RiskMode;
  trigger: "user_prompt" | "scheduled" | "rule_triggered";
  prompt: string | null;
  parameters: Record<string, unknown>;

  // Output
  recommendations: AgentRecommendation[];
  draft: Record<string, unknown> | null;
  summary: string | null;

  // Reasoning trail
  dataSourcesUsed: string[];
  stepsCompleted: AgentJobStep[];
  warnings: string[];
  errors: string[];

  // Trust
  approvalRequired: boolean;
  approvedAt: string | null;

  // Metadata
  durationMs: number | null;
  createdAt: string;
  completedAt: string | null;
}

// ── Preflight ───────────────────────────────────────────────────────────────

export interface PreflightCheck {
  name: string;
  status: "pass" | "warn" | "fail";
  message: string;
  blocking: boolean;
}

// ── Playbook ────────────────────────────────────────────────────────────────

export interface AgentPlaybook {
  namingConvention: {
    campaign: string; // e.g. "{brand} — {type} — {date}"
    adSet: string;
    ad: string;
  };
  budgetMinimums: Record<string, number>; // by campaign type
  defaultExclusions: string[];
  defaultRiskMode: RiskMode;
  budgetCaps: { daily: number; lifetime: number | null };
}

// ── Account snapshot ────────────────────────────────────────────────────────

export interface AccountPerformanceSnapshot {
  adAccountId: string;
  lookbackDays: number;
  totalSpend: number;
  avgDailySpend: number;
  crmRoas: number;
  crmCpa: number;
  crmRevenue: number;
  crmConversions: number;
  activeCampaignCount: number;
  dataPoints: number;
}

// ── Audit ───────────────────────────────────────────────────────────────────

export type AuditCheckSeverity = "critical" | "warning" | "info";

export type AuditCategory =
  | "structure"
  | "spend_efficiency"
  | "configuration"
  | "creative_health";

export interface AuditCheck {
  name: string;
  category: AuditCategory;
  status: "pass" | "warn" | "fail";
  severity: AuditCheckSeverity;
  message: string;
  details: Record<string, unknown>;
  penaltyPoints: number;
}

export interface AccountHealthScore {
  overall: number; // 0–100
  breakdown: Record<AuditCategory, { score: number; maxScore: number }>;
}

export interface AuditResult {
  checks: AuditCheck[];
  healthScore: AccountHealthScore;
  summary: string;
}

// ── Optimization ────────────────────────────────────────────────────────────

export interface BudgetPacingResult {
  campaignId: string;
  campaignName: string;
  dailyBudget: number;
  actualDailySpend: number;
  pacingRatio: number; // actualDailySpend / dailyBudget
  status: "underpacing" | "on_track" | "overpacing";
}

export interface FatigueSignal {
  adId: string;
  adName: string;
  campaignName: string;
  frequency: number;
  ctrTrend: number[]; // last N days CTR
  isFatigued: boolean;
  reason: string;
}

export interface CampaignMetricsSummary {
  campaignId: string;
  externalCampaignId: string;
  campaignName: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  frequency: number;
  crmRoas: number;
  crmCpa: number;
  dailyBudget: number | null;
}

export interface OptimizationAnalysis {
  adAccountId: string;
  campaigns: CampaignMetricsSummary[];
  budgetPacing: BudgetPacingResult[];
  fatigueSignals: FatigueSignal[];
  ruleTriggered: number;
  totalRecommendations: number;
}
