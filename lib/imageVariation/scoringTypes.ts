// lib/imageVariation/scoringTypes.ts
// Pure TypeScript models for Image Variation Scoring, Ranking, and Publish-Prep Integration.
//
// Design rules:
//   - No imports from lib/ — avoids circular deps.
//   - Mirrors types/creativeScoring.ts patterns but for image variation candidates.
//   - Scoring is deterministic — same input always produces same output.
//   - Publish-prep linkage is explicit and traceable.

import type { ImageVariationCandidate, ImageVariationIntent } from "./types";

// ---------------------------------------------------------------------------
// Score dimensions — reuses the same 9 from creativeScoring, image-weighted
// ---------------------------------------------------------------------------

export type ImageVariationScoreDimension =
  | "source_goal_alignment"     // does the variation match the generation intent?
  | "visual_distinctiveness"    // how different is this from the source image?
  | "offer_clarity"             // how clearly does the offer come through visually?
  | "brand_fit"                 // alignment with brand visual language
  | "fatigue_separation"        // separation from the fatigued source creative
  | "format_readiness"          // all required brief fields present and complete?
  | "recommendation_fit"        // alignment with recommendation reason if applicable
  | "policy_risk"               // compliance risk (higher = safer)
  | "launch_readiness";         // overall readiness for next step

export const IMAGE_VARIATION_SCORE_DIMENSIONS: Record<
  ImageVariationScoreDimension,
  { label: string; description: string; weight: number }
> = {
  source_goal_alignment:  { label: "Goal Alignment",        description: "How well the variation matches the generation intent and trigger",    weight: 0.20 },
  visual_distinctiveness: { label: "Visual Distinctiveness", description: "How different this is from the source creative",                     weight: 0.18 },
  offer_clarity:          { label: "Offer Clarity",          description: "How clearly the offer or value proposition comes through visually",  weight: 0.15 },
  brand_fit:              { label: "Brand Fit",              description: "Alignment with brand visual language and constraints",                weight: 0.08 },
  fatigue_separation:     { label: "Fatigue Separation",     description: "Distance from fatigued source creative patterns",                    weight: 0.10 },
  format_readiness:       { label: "Format Readiness",       description: "All required brief fields present and complete",                     weight: 0.07 },
  recommendation_fit:     { label: "Recommendation Fit",     description: "Alignment with recommendation reason if triggered by one",           weight: 0.07 },
  policy_risk:            { label: "Policy Risk",            description: "Compliance signal — higher score means lower risk",                  weight: 0.08 },
  launch_readiness:       { label: "Launch Readiness",       description: "Overall readiness for publish preparation",                          weight: 0.07 },
};

// ---------------------------------------------------------------------------
// Per-dimension score
// ---------------------------------------------------------------------------

export type ImageVariationScore = {
  dimension:    ImageVariationScoreDimension;
  score:        number;    // 0–10 raw score
  weight:       number;    // 0.0–1.0
  contribution: number;    // score × weight × 10 → contributes to 0–100 total
  label:        string;
  explanation:  string;
  pass:         boolean;   // ≥ 4 threshold
};

// ---------------------------------------------------------------------------
// Scorecard — complete evaluation of one image variation candidate
// ---------------------------------------------------------------------------

export type ImageVariationScorecard = {
  candidateId:       string;
  candidateTitle:    string;
  requestId:         string;
  dimensions:        ImageVariationScore[];
  totalScore:        number;    // 0–100 weighted composite
  readiness:         ImageVariationReadiness;
  riskLevel:         ImageVariationRisk;
  explanation:       ImageVariationScoreExplanation;
  scoredAt:          string;    // ISO
};

export type ImageVariationScoreExplanation = {
  strengths: string[];
  risks:     string[];
  notes:     string[];
};

// ---------------------------------------------------------------------------
// Readiness — lifecycle gate
// ---------------------------------------------------------------------------

export type ImageVariationReadiness =
  | "not_ready"
  | "review_required"
  | "conditionally_ready"
  | "ready_for_publish_prep"
  | "blocked";

export const IMAGE_VARIATION_READINESS_LABEL: Record<ImageVariationReadiness, string> = {
  not_ready:              "Not Ready",
  review_required:        "Review Required",
  conditionally_ready:    "Conditionally Ready",
  ready_for_publish_prep: "Ready for Publish Prep",
  blocked:                "Blocked",
};

export const IMAGE_VARIATION_READINESS_COLOR: Record<ImageVariationReadiness, string> = {
  not_ready:              "text-rose-400",
  review_required:        "text-amber-400",
  conditionally_ready:    "text-sky-400",
  ready_for_publish_prep: "text-emerald-400",
  blocked:                "text-slate-400",
};

export const IMAGE_VARIATION_READINESS_BG: Record<ImageVariationReadiness, string> = {
  not_ready:              "border-rose-800/50 bg-rose-950/20",
  review_required:        "border-amber-700/50 bg-amber-950/20",
  conditionally_ready:    "border-sky-800/50 bg-sky-950/20",
  ready_for_publish_prep: "border-emerald-700/50 bg-emerald-950/20",
  blocked:                "border-slate-700/50 bg-slate-900/40",
};

// ---------------------------------------------------------------------------
// Risk level
// ---------------------------------------------------------------------------

export type ImageVariationRisk = "low" | "medium" | "high";

// ---------------------------------------------------------------------------
// Ranking — one slot in a ranked list
// ---------------------------------------------------------------------------

export type ImageVariationRanking = {
  rank:       number;   // 1 = best
  candidateId: string;
  scorecard:  ImageVariationScorecard;
  rankReason: string;
};

// ---------------------------------------------------------------------------
// Ranking summary — aggregate stats for a scored set
// ---------------------------------------------------------------------------

export type ImageVariationRankingSummary = {
  requestId:           string;
  totalCandidates:     number;
  readyForPublishPrep: number;
  conditionallyReady:  number;
  reviewRequired:      number;
  notReady:            number;
  blocked:             number;
  highRisk:            number;
  topRankedCandidateId: string | null;
  averageScore:        number;
  scoredAt:            string;
};

// ---------------------------------------------------------------------------
// Launch readiness — overall readiness for the full set
// ---------------------------------------------------------------------------

export type ImageVariationLaunchReadiness = {
  requestId:         string;
  hasReadyCandidates: boolean;
  readyCount:        number;
  blockerCount:      number;
  blockers:          string[];
  nextStep:          string;
};

// ---------------------------------------------------------------------------
// Selection decision — operator selects a candidate for publish-prep
// ---------------------------------------------------------------------------

export type ImageVariationSelectionDecision = {
  candidateId:    string;
  requestId:      string;
  decision:       "select_for_publish_prep" | "return_for_revision" | "reject" | "save_as_alternate";
  note?:          string | null;
  selectedBy?:    string | null;
  selectedAt:     string;   // ISO
};

// ---------------------------------------------------------------------------
// Publish-prep link — maps a scored candidate to publish-prep
// ---------------------------------------------------------------------------

export type ImageVariationPublishPrepLink = {
  candidateId:      string;
  requestId:        string;
  sourceCreativeId: string | null;
  campaignId:       string | null;
  clientAccountId:  string;
  readiness:        ImageVariationReadiness;
  totalScore:       number;
  linkedAt:         string;   // ISO
};

// ---------------------------------------------------------------------------
// Score reason — why a dimension scored the way it did
// ---------------------------------------------------------------------------

export type ImageVariationScoreReason = {
  dimension:   ImageVariationScoreDimension;
  direction:   "positive" | "negative" | "neutral";
  reason:      string;
};
