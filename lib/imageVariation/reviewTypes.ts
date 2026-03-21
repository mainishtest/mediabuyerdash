// lib/imageVariation/reviewTypes.ts
// Pure TypeScript models for the Image Variation Review, Revision, and Approval Workflow.
//
// Design rules:
//   - No imports from lib/ — avoids circular deps.
//   - Review is separate from generation.
//   - All decisions are explicit and traceable.

import type { ImageVariationCandidate, ImageVariationIntent } from "./types";

// ---------------------------------------------------------------------------
// Review state — the lifecycle state of a candidate during review
// ---------------------------------------------------------------------------

export type ImageVariationReviewState =
  | "draft"               // generated but not yet in review
  | "needs_review"        // in the review queue
  | "revision_requested"  // reviewer wants changes
  | "approved"            // reviewer approved — ready for next step
  | "rejected"            // reviewer rejected — will not proceed
  | "archived";           // removed from active review

// ---------------------------------------------------------------------------
// Revision intent — what the reviewer wants changed
// ---------------------------------------------------------------------------

export type ImageVariationRevisionIntent =
  | "make_more_distinct"          // too similar to another candidate or source
  | "make_more_brand_aligned"     // doesn't match brand visual language
  | "strengthen_product_focus"    // product not prominent enough
  | "strengthen_offer_clarity"    // offer/value prop not clear in visual
  | "simplify_visual"            // too busy, too many elements
  | "increase_ugc_feel"          // needs more authentic/organic look
  | "change_composition"         // layout or hierarchy needs rework
  | "explore_new_direction";     // start fresh with a different concept

export const IMAGE_VARIATION_REVISION_INTENTS: Record<
  ImageVariationRevisionIntent,
  { label: string; description: string }
> = {
  make_more_distinct: {
    label:       "Make More Distinct",
    description: "This candidate is too similar to another candidate or the source creative",
  },
  make_more_brand_aligned: {
    label:       "Improve Brand Alignment",
    description: "The visual direction doesn't match the brand's established look and feel",
  },
  strengthen_product_focus: {
    label:       "Strengthen Product Focus",
    description: "The product or service isn't prominent or clear enough in the image",
  },
  strengthen_offer_clarity: {
    label:       "Strengthen Offer Clarity",
    description: "The value proposition or offer isn't visually communicated well",
  },
  simplify_visual: {
    label:       "Simplify Visual",
    description: "Too many competing elements — simplify for mobile feed clarity",
  },
  increase_ugc_feel: {
    label:       "Increase UGC Feel",
    description: "Needs a more authentic, user-generated content aesthetic",
  },
  change_composition: {
    label:       "Change Composition",
    description: "The layout, hierarchy, or eye-path needs a different approach",
  },
  explore_new_direction: {
    label:       "Explore New Direction",
    description: "Scrap this concept and try something fundamentally different",
  },
};

// ---------------------------------------------------------------------------
// Approval decision — explicit action taken by the reviewer
// ---------------------------------------------------------------------------

export type ImageVariationApprovalDecision = {
  candidateId:     string;
  decision:        "approve" | "reject" | "request_revision";
  revisionIntent?: ImageVariationRevisionIntent | null;
  note?:           string | null;
  reviewedBy?:     string | null;
  reviewedAt:      string;   // ISO string
};

// ---------------------------------------------------------------------------
// Reviewer note — attached to a specific candidate
// ---------------------------------------------------------------------------

export type ImageVariationReviewerNote = {
  candidateId: string;
  note:        string;
  author:      string | null;
  createdAt:   string;   // ISO string
};

// ---------------------------------------------------------------------------
// Review item — enriched candidate with review context
// ---------------------------------------------------------------------------

export type ImageVariationReviewItem = {
  candidate:        ImageVariationCandidate;
  reviewState:      ImageVariationReviewState;
  reviewerNote:     string | null;
  revisionIntent:   ImageVariationRevisionIntent | null;
  reviewedAt:       string | null;
  reviewedBy:       string | null;
  requestId:        string;
  sourceCreativeId: string | null;
  sourceAssetUrl:   string | null;
  variationIntent:  ImageVariationIntent;
  triggerType:      string;
  triggerRationale: string;
};

// ---------------------------------------------------------------------------
// Comparison set — grouped candidates for side-by-side review
// ---------------------------------------------------------------------------

export type ImageVariationComparisonSet = {
  requestId:        string;
  variationIntent:  ImageVariationIntent;
  intentLabel:      string;
  triggerType:      string;
  triggerRationale: string;
  sourceAssetUrl:   string | null;
  sourceCreativeId: string | null;
  clientName:       string | null;
  campaignName:     string | null;
  items:            ImageVariationReviewItem[];
  createdAt:        string;
};

// ---------------------------------------------------------------------------
// Review queue — all requests with reviewable candidates
// ---------------------------------------------------------------------------

export type ImageVariationReviewQueue = {
  comparisonSets: ImageVariationComparisonSet[];
  totalCandidates: number;
  pendingReview:   number;
  approved:        number;
  rejected:        number;
  revisionRequested: number;
};

// ---------------------------------------------------------------------------
// Review reason — why this candidate should be reviewed
// ---------------------------------------------------------------------------

export type ImageVariationReviewReason = {
  type:   "fatigue_trigger" | "performance_trigger" | "opportunity" | "manual" | "revision_follow_up";
  label:  string;
  detail: string;
};

// ---------------------------------------------------------------------------
// Approval summary — aggregate review status for a request
// ---------------------------------------------------------------------------

export type ImageVariationApprovalSummary = {
  requestId:         string;
  totalCandidates:   number;
  approved:          number;
  rejected:          number;
  needsReview:       number;
  revisionRequested: number;
  archived:          number;
  isComplete:        boolean;  // all candidates have a decision
  hasApproved:       boolean;  // at least one approved
  readyForNextStep:  boolean;  // has approved AND no pending reviews
  completedAt:       string | null;
};
