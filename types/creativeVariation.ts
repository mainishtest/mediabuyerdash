// types/creativeVariation.ts
// Typed models for the unified variation generation flow.
//
// Covers copy variations, image variations, and combined generation
// from either uploaded source assets or existing synced ads.

// ---------------------------------------------------------------------------
// Source
// ---------------------------------------------------------------------------

export type CreativeVariationSourceType =
  | "uploaded_asset"    // UploadedCreativeImage
  | "synced_ad";        // MetaSyncedCreative via CreativeOverviewItem

export type CreativeVariationSource = {
  type: CreativeVariationSourceType;
  sourceId: string;                   // asset ID or overview item ID
  clientAccountId: string | null;
  clientName: string | null;

  // Copy context (from source)
  sourceCopy: string | null;
  sourceCallToAction: string | null;

  // Image context (from source)
  imageUrl: string | null;
  thumbnailUrl: string | null;

  // Performance context (null for uploaded assets)
  spend: number;
  ctr: number;
  roas: number | null;
  cpa: number | null;
  frequency: number | null;
  evaluationStatus: string;

  // Names
  creativeName: string | null;
  campaignName: string | null;
};

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

export type CreativeGenerationIntent =
  | "copy_only"
  | "image_only"
  | "copy_and_image";

export type CreativeVariationRequest = {
  source: CreativeVariationSource;
  intent: CreativeGenerationIntent;
  /** Number of copy variations to generate (default 3) */
  copyCount?: number;
  /** Number of image variations to generate (default 3) */
  imageCount?: number;
};

// ---------------------------------------------------------------------------
// Candidates
// ---------------------------------------------------------------------------

export type CreativeVariationStatus =
  | "generating"
  | "completed"
  | "failed"
  | "pending_review";

export type CopyVariationCandidate = {
  id: string;
  hook: string;
  body: string;
  callToAction: string;
  angle: string;
  rationale: string;
  status: CreativeVariationStatus;
};

export type ImageVariationCandidate = {
  id: string;
  title: string;
  conceptSummary: string;
  visualChanges: string[];
  goal: string;
  directResponseAngle: string;
  /** Local path if DALL-E generation succeeded */
  generatedImagePath: string | null;
  /** Prompt used for generation */
  generationPrompt: string | null;
  status: CreativeVariationStatus;
  generationError: string | null;
};

// ---------------------------------------------------------------------------
// Unified set
// ---------------------------------------------------------------------------

export type UnifiedVariationSet = {
  id: string;
  source: CreativeVariationSource;
  intent: CreativeGenerationIntent;
  copyVariations: CopyVariationCandidate[];
  imageVariations: ImageVariationCandidate[];
  status: CreativeVariationStatus;
  provider: string;
  generatedAt: string;
  error: string | null;
};

// ---------------------------------------------------------------------------
// Summary (for UI)
// ---------------------------------------------------------------------------

export type CreativeVariationSummary = {
  totalCopy: number;
  totalImage: number;
  completedCopy: number;
  completedImage: number;
  failedCopy: number;
  failedImage: number;
  provider: string;
  durationMs: number;
};

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export type CreativeVariationError =
  | "missing_source"
  | "missing_copy_for_copy_generation"
  | "missing_image_for_image_generation"
  | "provider_not_configured"
  | "provider_failure"
  | "partial_failure"
  | "persistence_failure";

// ---------------------------------------------------------------------------
// Link (ties candidates back to source for future launch)
// ---------------------------------------------------------------------------

export type CreativeVariationLink = {
  variationSetId: string;
  sourceId: string;
  sourceType: CreativeVariationSourceType;
  clientAccountId: string | null;
  jobId: string;   // AIGenerationJob.id for persistence
};
