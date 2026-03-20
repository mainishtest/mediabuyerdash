// lib/evaluation/types.ts
// Typed models for the Phase 3 evaluation and recommendation engine.
//
// Design rules:
//   - All evaluation is pure (no DB, no side effects).
//   - CRM is the source of truth for ROAS and CPA.
//   - Confidence gates recommendations — low-confidence results show "watch" intent.
//   - PerformanceEvaluation is additive: attached alongside existing healthStatus,
//     never replacing the existing CampaignHealthStatus evaluation layer.

import type { ResolvedGoal } from "../goals/types";

// ---------------------------------------------------------------------------
// PerformanceStatus
// The v1 status vocabulary for the new evaluation engine.
// ---------------------------------------------------------------------------

export type PerformanceStatus =
  | "scaling"           // beating goals — ready to increase investment
  | "stable"            // at goal — maintain and monitor
  | "watching"          // within 30% below goal — may recover without action
  | "fatigued"          // CTR or CVR severely below target — creative issue likely
  | "losing"            // >30% below goal — immediate review needed
  | "insufficient_data"; // too little spend/conversions to evaluate confidently

// ---------------------------------------------------------------------------
// RecommendationType
// Concrete action that maps from status + confidence.
// ---------------------------------------------------------------------------

export type RecommendationType =
  | "scale_budget_10_20" // increase budget 10–20%
  | "hold"               // keep budget; monitor closely
  | "reduce_budget"      // pull back spend to limit losses
  | "pause_entity"       // pause campaign/ad — losses severe + high confidence
  | "rotate_creative"    // swap creative — fatigue detected
  | "investigate_lp";    // ROAS ok but CPA over — check landing page

// ---------------------------------------------------------------------------
// ConfidenceLevel
// How reliable the evaluation signal is.
// ---------------------------------------------------------------------------

export type ConfidenceLevel = "low" | "medium" | "high";

// ---------------------------------------------------------------------------
// PerformanceDelta
// Percentage deviation from each goal (positive = above/worse for CPA).
// Null when no goal or no data for that metric.
// ---------------------------------------------------------------------------

export type PerformanceDelta = {
  roasDelta: number | null;  // (actual − goal) / goal × 100; positive = above goal (good)
  cpaDelta:  number | null;  // (actual − goal) / goal × 100; positive = above goal (bad)
  ctrDelta:  number | null;  // only when resolvedGoal.targetCtr is set
  cvrDelta:  number | null;  // only when resolvedGoal.targetCvr is set
};

// ---------------------------------------------------------------------------
// Recommendation
// Concrete next-action for a buyer.
// ---------------------------------------------------------------------------

export type Recommendation = {
  type:           RecommendationType;
  priority:       "low" | "medium" | "high";
  confidence:     ConfidenceLevel;
  reason:         string;   // 1–2 sentence human-readable rationale
  supportingData: string | null; // metric comparison string, e.g. "ROAS 3.1x vs 2.0x goal"
};

// ---------------------------------------------------------------------------
// EvaluationReason
// Individual human-readable signal that contributed to the status.
// ---------------------------------------------------------------------------

export type EvaluationReason = string;

// ---------------------------------------------------------------------------
// PerformanceEvaluation
// The full evaluation output for a campaign or creative.
// This is attached to snapshots alongside the existing healthStatus.
// ---------------------------------------------------------------------------

export type PerformanceEvaluation = {
  status:         PerformanceStatus;
  deltas:         PerformanceDelta;
  recommendation: Recommendation;
  confidence:     ConfidenceLevel;
  reasons:        EvaluationReason[];
};

// ---------------------------------------------------------------------------
// EvaluationInput
// Everything evaluatePerformance() needs — no DB access.
// ---------------------------------------------------------------------------

export type EvaluationInput = {
  spend:       number;
  impressions: number;
  clicks:      number;
  conversions: number;
  revenue:     number;

  // Derived metrics (pre-computed; null = cannot be computed, e.g. zero denominator)
  ctr:  number;         // clicks / impressions * 100; 0 when impressions = 0
  cvr:  number | null;  // conversions / clicks * 100; null when clicks = 0
  roas: number;         // revenue / spend; 0 when spend = 0
  cpa:  number | null;  // spend / conversions; null when conversions = 0

  // The resolved goal for this entity (campaign → client → system default)
  resolvedGoal: ResolvedGoal;
};
