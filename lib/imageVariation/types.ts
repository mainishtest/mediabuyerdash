// lib/imageVariation/types.ts
// Pure TypeScript models for the AI Image Variation Generation Engine.
//
// Design rules:
//   - No imports from lib/ — avoids circular deps.
//   - Image variation is separate from text creative generation.
//   - CRM is the source of truth for ROAS/CPA throughout.

// ---------------------------------------------------------------------------
// Variation intent — why this image variation is being generated
// ---------------------------------------------------------------------------

export type ImageVariationIntent =
  | "refresh_visual_hook"       // scroll-stop power has decayed
  | "refresh_offer_framing"     // reframe how the offer is visually communicated
  | "refresh_composition"       // change layout, hierarchy, or visual flow
  | "refresh_color_direction"   // shift palette for contrast or brand alignment
  | "refresh_product_focus"     // change product shot angle, context, or emphasis
  | "refresh_lifestyle_angle"   // shift lifestyle imagery or aspirational context
  | "refresh_ugc_style"         // move toward user-generated content aesthetic
  | "full_visual_reset";        // complete image concept replacement

export const IMAGE_VARIATION_INTENTS: Record<
  ImageVariationIntent,
  { label: string; description: string }
> = {
  refresh_visual_hook: {
    label:       "Refresh Visual Hook",
    description: "Scroll-stop power has decayed — redesign the image to earn attention on a fatigued feed",
  },
  refresh_offer_framing: {
    label:       "Refresh Offer Framing",
    description: "Reframe how the offer is visually communicated without changing the offer itself",
  },
  refresh_composition: {
    label:       "Refresh Composition",
    description: "Change layout, visual hierarchy, or eye-path to improve engagement",
  },
  refresh_color_direction: {
    label:       "Refresh Color Direction",
    description: "Shift color palette for better contrast, brand alignment, or feed standout",
  },
  refresh_product_focus: {
    label:       "Refresh Product Focus",
    description: "Change product shot angle, context, or emphasis to highlight different value",
  },
  refresh_lifestyle_angle: {
    label:       "Refresh Lifestyle Angle",
    description: "Shift lifestyle imagery to a new aspirational context or use case",
  },
  refresh_ugc_style: {
    label:       "Refresh UGC Style",
    description: "Move toward user-generated content aesthetic for authenticity and trust",
  },
  full_visual_reset: {
    label:       "Full Visual Reset",
    description: "Complete image concept replacement — new direction, new visual language",
  },
};

// ---------------------------------------------------------------------------
// Source asset — the image being varied
// ---------------------------------------------------------------------------

export type ImageVariationSourceAsset = {
  url:          string | null;  // thumbnail or uploaded image URL
  fileName:     string | null;
  description:  string | null;  // human-readable description of the current image
  dimensions:   { width: number; height: number } | null;
};

// ---------------------------------------------------------------------------
// Constraint — guardrail applied to image generation
// ---------------------------------------------------------------------------

export type ImageVariationConstraint = {
  type:   "brand_color" | "format" | "placement" | "compliance" | "style" | "custom";
  value:  string;
  reason: string;
};

// ---------------------------------------------------------------------------
// Context — multi-source context assembled before generation
// ---------------------------------------------------------------------------

export type ImageVariationContext = {
  // Identity
  clientAccountId: string;
  clientName:      string;
  campaignId:      string | null;
  campaignName:    string | null;
  creativeId:      string | null;
  creativeName:    string | null;

  // Source asset
  sourceAsset:     ImageVariationSourceAsset;

  // Performance signals (CRM-verified where applicable)
  currentCtr:       number;
  currentFrequency: number | null;
  currentRoas:      number | null;   // CRM-verified — 7-day attribution
  currentCpa:       number | null;   // CRM-verified — 7-day attribution
  currentSpend:     number;
  evaluationStatus: string;
  fatigueStatus:    string | null;

  // Goal context
  roasGoal:        number | null;
  cpaGoal:         number | null;
  primaryGoalType: string | null;

  // Learning memory
  winningPatterns:    string[];
  losingPatterns:     string[];
  audienceInsights:   string[];
  experimentInsights: string[];

  // Current creative content
  currentCopy:     string | null;
  currentHeadline: string | null;
  currentCta:      string | null;

  // Offer and audience context
  offerSummary:    string | null;
  audienceSummary: string | null;

  // Constraints
  constraints:     ImageVariationConstraint[];

  // Trigger information
  triggerType:      "fatigue" | "underperformance" | "opportunity" | "manual";
  triggerRationale: string;
  recommendationId: string | null;  // links to source recommendation if applicable

  // Intent
  intent:          ImageVariationIntent;

  // Data quality
  builtAt:     string;    // ISO string
  dataQuality: "sparse" | "moderate" | "rich";
};

// ---------------------------------------------------------------------------
// Prompt — the assembled prompt sent to the provider
// ---------------------------------------------------------------------------

export type ImageVariationPrompt = {
  system:       string;
  user:         string;
  intent:       ImageVariationIntent;
  constraints:  ImageVariationConstraint[];
  contextHash:  string;  // deterministic hash for dedup
};

// ---------------------------------------------------------------------------
// Candidate — a single generated image variation
// ---------------------------------------------------------------------------

export type ImageVariationCandidate = {
  id:                   string;
  title:                string;
  intent:               ImageVariationIntent;

  // Brief fields (always present)
  conceptSummary:       string;
  visualChanges:        string;
  goal:                 string;
  directResponseAngle:  string;

  // Provider output (present when real image provider generates)
  imageUrl:             string | null;
  providerRequestId:    string | null;

  // Linkage
  sourceCreativeId:     string | null;
  sourceAssetUrl:       string | null;
  campaignId:           string | null;
  clientAccountId:      string;

  // Rationale
  rationale:            string;
  performanceSignal:    string;

  // Status
  status:               "generated" | "saved" | "sent_to_review";

  // Review fields (populated after "sent_to_review")
  reviewState?:         "needs_review" | "approved" | "rejected" | "revision_requested" | "archived";
  reviewerNote?:        string | null;
  revisionIntent?:      string | null;
  reviewedAt?:          string | null;    // ISO string
  reviewedBy?:          string | null;
};

// ---------------------------------------------------------------------------
// Candidate set — a batch of candidates from one generation run
// ---------------------------------------------------------------------------

export type ImageVariationCandidateSet = {
  requestId:   string;
  intent:      ImageVariationIntent;
  candidates:  ImageVariationCandidate[];
  provider:    string;
  generatedAt: string;   // ISO string
};

// ---------------------------------------------------------------------------
// Generation summary — aggregate stats for the UI
// ---------------------------------------------------------------------------

export type ImageVariationGenerationSummary = {
  requestId:          string;
  clientName:         string;
  intent:             ImageVariationIntent;
  intentLabel:        string;
  candidateCount:     number;
  provider:           string;
  triggerType:        string;
  triggerRationale:   string;
  dataQuality:        string;
  generatedAt:        string;   // ISO string
  latencyMs:          number | null;
  warnings:           string[];
};

// ---------------------------------------------------------------------------
// Provider — abstraction for image generation backends
// ---------------------------------------------------------------------------

export type ImageVariationProviderType =
  | "brief_only"     // generates structured briefs only (always available)
  | "dalle"          // OpenAI DALL-E
  | "stability"      // Stability AI
  | "mock";          // structured mock output

export type ImageVariationProviderResult = {
  ok:      true;
  candidates: ImageVariationCandidate[];
  provider:   ImageVariationProviderType;
  tokensUsed: number | null;
  latencyMs:  number;
} | {
  ok:      false;
  error:   string;
  retryable: boolean;
};

// ---------------------------------------------------------------------------
// Request — the full request object for a generation run
// ---------------------------------------------------------------------------

export type ImageVariationRequest = {
  clientAccountId: string;
  campaignId:      string | null;
  creativeId:      string | null;
  intent:          ImageVariationIntent;
  triggerType:     "fatigue" | "underperformance" | "opportunity" | "manual";
  candidateCount:  number;   // how many to generate (default: 3)
  constraints:     ImageVariationConstraint[];
  sourceAssetUrl:  string | null;
  recommendationId: string | null;
};
