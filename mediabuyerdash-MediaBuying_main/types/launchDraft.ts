// Launch Draft Types
//
// Models for packaging approved creative variations into launch-ready test drafts.
// Kept separate from generation and approval types so the publishing layer can
// evolve here independently without touching the audit trail.

// ── Enumerations ─────────────────────────────────────────────────────────────

// lifecycle state of a draft
export type LaunchDraftStatus = "draft" | "ready" | "archived";

// what material the draft was assembled from
export type LaunchDraftSource =
  | "generated_copy"   // approved copy variations only
  | "generated_image"  // approved image concepts only
  | "generated_both"   // both copy and image concepts
  | "manual";          // assembled by hand

// ── Core models ───────────────────────────────────────────────────────────────

export interface LaunchDraft {
  id:               string;
  draftName:        string;
  clientAccountId?: string | null;
  campaignId:       string;
  adSetId?:         string | null;
  baseAdId:         string;
  baseAdName:       string;
  objectiveMetric?: string | null;
  source:           LaunchDraftSource;
  status:           LaunchDraftStatus;
  createdAt:        Date;
  updatedAt:        Date;
}

// A single creative variant inside a draft.
// Content is denormalized at creation time for self-contained previews.
// Original variation IDs are stored for audit trail traceability.
export interface LaunchDraftVariant {
  id:                   string;
  launchDraftId:        string;
  // Source IDs for traceability back to the generation audit trail
  copyVariationId?:     string | null;
  imageVariationId?:    string | null;
  variantName:          string;
  // Copy content (denormalized from GeneratedCopyVariation)
  hook?:                string | null;
  body?:                string | null;
  callToAction?:        string | null;
  // Image concept content (denormalized from GeneratedImageVariation)
  imageConceptTitle?:   string | null;
  imageConceptSummary?: string | null;
  selectedForLaunch:    boolean;
  createdAt:            Date;
}

// ── Summary ───────────────────────────────────────────────────────────────────

export interface LaunchDraftSummary {
  draftId:          string;
  draftName:        string;
  totalVariants:    number;
  selectedVariants: number;
  hasApprovedCopy:  boolean;
  hasApprovedImage: boolean;
  missingPieces:    string[];
  isReadyToLaunch:  boolean;
}

// ── Aggregated view ────────────────────────────────────────────────────────────

export interface LaunchDraftWithVariants extends LaunchDraft {
  variants: LaunchDraftVariant[];
  summary:  LaunchDraftSummary;
}
