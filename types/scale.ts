// ─── Scale Workflow — Typed Models ────────────────────────────────────────────
//
// Models for the performance-based campaign scaling workflow.
// Scale actions require 3-day strong performance and guardrail validation.
// Routes into the governance approval system before execution.

// ── Scale readiness (detection output) ──────────────────────────────────────

export type ScaleReadinessState =
  | "ready"            // all conditions met, eligible for scaling
  | "needs_review"     // some conditions met, operator should review
  | "not_ready"        // performance does not support scaling
  | "blocked"          // governance or emergency stop prevents scaling
  | "insufficient_data"; // not enough data to evaluate

// ── Scale strategy ──────────────────────────────────────────────────────────

export type ScaleStrategy =
  | "increase_budget"    // increase daily/lifetime budget by percentage
  | "duplicate_adset";   // duplicate winning ad sets with same targeting + creative

// ── Scale guardrail ─────────────────────────────────────────────────────────

export type GuardrailStatus = "pass" | "fail" | "warn" | "skip";

export type ScaleGuardrail = {
  name:        string;
  description: string;
  status:      GuardrailStatus;
  actual:      string;       // e.g. "2.4x"
  threshold:   string;       // e.g. "≥ 2.0x"
  metric?:     string;       // "roas" | "cpa" | "spend" | etc.
};

// ── Scale recommendation (what the system suggests) ─────────────────────────

export type ScaleConfidence = "high" | "medium" | "low";

export type ScaleRecommendation = {
  strategy:           ScaleStrategy;
  suggestedIncreasePct: number;     // e.g. 15 means +15%
  currentDailySpend:  number;
  projectedDailySpend: number;
  confidence:         ScaleConfidence;
  reasoning:          string;       // human-readable explanation
  guardrails:         ScaleGuardrail[];
  readiness:          ScaleReadinessState;
  blockers:           string[];
  warnings:           string[];
};

// ── Scale approval state ────────────────────────────────────────────────────

export type ScaleApprovalStatus =
  | "draft"            // user is configuring the plan
  | "pending_approval" // submitted to governance queue
  | "approved"         // approved for execution
  | "rejected"         // rejected by reviewer
  | "executed"         // budget change applied
  | "failed";          // execution failed

export type ScaleApprovalState = {
  status:          ScaleApprovalStatus;
  submittedAt:     string | null;
  reviewedAt:      string | null;
  reviewedBy:      string | null;
  rejectionReason: string | null;
  executedAt:      string | null;
  executionResult: string | null;
};

// ── Scale plan (the full user-configured plan) ──────────────────────────────

export type ScalePlan = {
  id:                  string;
  clientAccountId:     string;
  clientName:          string;
  campaignId:          string;
  externalCampaignId:  string;
  campaignName:        string;

  // What to do
  strategy:            ScaleStrategy;
  increasePct:         number;         // user-confirmed increase %
  currentDailySpend:   number;
  projectedDailySpend: number;

  // Performance context (last 3 days)
  avgRoas3d:           number;
  avgCpa3d:            number | null;
  avgSpend3d:          number;
  roasGoal:            number | null;
  cpaGoal:             number | null;

  // Validation
  recommendation:      ScaleRecommendation;
  approval:            ScaleApprovalState;

  // Metadata
  createdAt:           string;
  createdBy:           string | null;
};

// ── Scale modal props ───────────────────────────────────────────────────────

export type ScaleModalProps = {
  isOpen:              boolean;
  onClose:             () => void;
  clientAccountId:     string;
  clientName:          string;
  campaignId:          string;
  externalCampaignId:  string;
  campaignName:        string;
};

// ── Guardrail thresholds (configurable) ─────────────────────────────────────

export const SCALE_GUARDRAILS = {
  /** Minimum 3-day average ROAS to be eligible */
  MIN_ROAS_3D:             1.5,
  /** Maximum 3-day average CPA as ratio of goal (e.g. 1.1 = 110% of goal) */
  MAX_CPA_RATIO:           1.1,
  /** Minimum spend ($) over 3 days to have confidence */
  MIN_SPEND_3D:            150,
  /** Minimum conversions over 3 days */
  MIN_CONVERSIONS_3D:      5,
  /** Maximum single budget increase % */
  MAX_INCREASE_PCT:        30,
  /** Default suggested increase % for high-confidence cases */
  DEFAULT_INCREASE_HIGH:   20,
  /** Default suggested increase % for medium-confidence cases */
  DEFAULT_INCREASE_MEDIUM: 10,
  /** ROAS must be at least this ratio above goal for "ready" */
  ROAS_GOAL_FLOOR_RATIO:   1.1,
  /** Days of data required for evaluation */
  LOOKBACK_DAYS:           3,
} as const;
