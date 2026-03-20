// types/creativeScoring.ts
// Typed models for the Creative Draft Scoring, Ranking, and Approval Readiness layer.
//
// Design rules:
//   - Pure TypeScript — no imports from lib/ to avoid circular deps.
//   - Scoring is deterministic and heuristic — no AI API calls required.
//   - CRM is the source of truth for ROAS/CPA throughout.
//   - Designed to feed the next step: guarded publish preparation workflow.

// ---------------------------------------------------------------------------
// Score dimensions — each dimension of creative quality
// ---------------------------------------------------------------------------

export type CreativeScoreDimension =
  | "goal_alignment"      // does the draft match the generation intent and brief direction?
  | "hook_strength"       // how strong is the opening hook? (copy only)
  | "offer_clarity"       // how clearly does the offer/value come through?
  | "message_clarity"     // overall readability and message structure
  | "angle_novelty"       // how different is this from the source creative?
  | "fatigue_separation"  // how much separation from the fatigued creative?
  | "brand_fit"           // alignment with brand voice and constraints
  | "policy_risk"         // compliance signal (higher score = lower risk = better)
  | "launch_readiness";   // are all required fields present and complete?

// ---------------------------------------------------------------------------
// Per-dimension score — one row in a scorecard
// ---------------------------------------------------------------------------

export type CreativeDraftScore = {
  dimension:    CreativeScoreDimension;
  score:        number;   // 0–10 raw score
  weight:       number;   // 0.0–1.0 weighted importance for this variant type
  contribution: number;   // score × weight × 10 → contributes to 0–100 total
  label:        string;   // human-readable dimension name
  explanation:  string;   // why this score was given
  pass:         boolean;  // true if score meets minimum threshold (≥ 4)
};

// ---------------------------------------------------------------------------
// Scorecard — complete scored evaluation of one draft variant
// ---------------------------------------------------------------------------

export type CreativeDraftScorecard = {
  variantId:         string;
  variantTitle:      string;
  variantType:       "copy" | "image";
  dimensions:        CreativeDraftScore[];
  totalScore:        number;   // 0–100 weighted composite
  approvalReadiness: CreativeApprovalReadiness;
  riskLevel:         CreativeApprovalRisk;
  explanation:       CreativeScoreExplanation;
  scoredAt:          string;   // ISO timestamp
};

// ---------------------------------------------------------------------------
// Approval readiness — lifecycle gate before publish preparation
// ---------------------------------------------------------------------------

export type CreativeApprovalReadiness =
  | "not_ready"              // critical failures — do not proceed
  | "review_required"        // needs human review before any next step
  | "conditionally_ready"    // acceptable but has noted weaknesses
  | "ready_for_publish_prep"; // strong enough to enter publish preparation

// ---------------------------------------------------------------------------
// Risk level — simplified signal for policy and quality risk
// ---------------------------------------------------------------------------

export type CreativeApprovalRisk = "low" | "medium" | "high";

// ---------------------------------------------------------------------------
// Score explanation — structured strengths and risks narrative
// ---------------------------------------------------------------------------

export type CreativeScoreExplanation = {
  strengths: string[];   // what's working well
  risks:     string[];   // what could prevent approval or launch
  notes:     string[];   // contextual observations
};

// ---------------------------------------------------------------------------
// Draft ranking — one slot in a ranked list
// ---------------------------------------------------------------------------

export type CreativeDraftRanking = {
  rank:       number;   // 1 = best
  variantId:  string;
  scorecard:  CreativeDraftScorecard;
  rankReason: string;   // human-readable explanation of why this rank
};

// ---------------------------------------------------------------------------
// Review feedback — a reviewer's decision on a scored draft
// ---------------------------------------------------------------------------

export type CreativeReviewFeedback = {
  variantId:  string;
  decision:
    | "approve_for_publish_prep"
    | "needs_revision"
    | "reject"
    | "regenerate_same_brief"
    | "regenerate_new_angle";
  notes?:     string;
  reviewedAt: string;   // ISO
};

// ---------------------------------------------------------------------------
// Draft review set — the full scored + ranked output for one brief
// ---------------------------------------------------------------------------

export type CreativeDraftReviewSet = {
  briefId:  string;
  rankings: CreativeDraftRanking[];
  summary: {
    totalVariants:        number;
    readyForPublishPrep:  number;
    conditionallyReady:   number;
    reviewRequired:       number;
    notReady:             number;
    highRisk:             number;
    topRankedVariantId:   string | null;
    averageScore:         number;
  };
  scoredAt: string;
};

// ---------------------------------------------------------------------------
// Display metadata — used by UI to render dimension labels and colors
// ---------------------------------------------------------------------------

export const DIMENSION_LABEL: Record<CreativeScoreDimension, string> = {
  goal_alignment:     "Goal Alignment",
  hook_strength:      "Hook Strength",
  offer_clarity:      "Offer Clarity",
  message_clarity:    "Message Clarity",
  angle_novelty:      "Angle Novelty",
  fatigue_separation: "Fatigue Separation",
  brand_fit:          "Brand Fit",
  policy_risk:        "Policy Risk",
  launch_readiness:   "Launch Readiness",
};

export const READINESS_LABEL: Record<CreativeApprovalReadiness, string> = {
  not_ready:              "Not Ready",
  review_required:        "Review Required",
  conditionally_ready:    "Conditionally Ready",
  ready_for_publish_prep: "Ready for Publish Prep",
};

export const READINESS_COLOR: Record<CreativeApprovalReadiness, string> = {
  not_ready:              "text-rose-400",
  review_required:        "text-amber-400",
  conditionally_ready:    "text-sky-400",
  ready_for_publish_prep: "text-emerald-400",
};

export const READINESS_BG: Record<CreativeApprovalReadiness, string> = {
  not_ready:              "border-rose-800/50 bg-rose-950/20",
  review_required:        "border-amber-700/50 bg-amber-950/20",
  conditionally_ready:    "border-sky-800/50 bg-sky-950/20",
  ready_for_publish_prep: "border-emerald-700/50 bg-emerald-950/20",
};

export const RISK_LABEL: Record<CreativeApprovalRisk, string> = {
  low:    "Low Risk",
  medium: "Medium Risk",
  high:   "High Risk",
};

export const RISK_COLOR: Record<CreativeApprovalRisk, string> = {
  low:    "text-emerald-400",
  medium: "text-amber-400",
  high:   "text-rose-400",
};
