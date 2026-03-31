// ─────────────────────────────────────────────────────────────────────────────
// Variation Generation — Typed Models
// ─────────────────────────────────────────────────────────────────────────────
// These types support the unified copy + image variation generation flow.
// They describe the full lifecycle: source selection → context building →
// generation request → candidate output → persistence → review handoff.
// ─────────────────────────────────────────────────────────────────────────────

// ── Source ───────────────────────────────────────────────────────────────────

/** Where the source creative comes from. */
export type CreativeVariationSourceType =
  | "uploaded_image"
  | "uploaded_image_and_copy"
  | "uploaded_copy"
  | "existing_ad"
  | "existing_ad_with_asset";

/** Describes the source creative used as the basis for variation generation. */
export interface CreativeVariationSource {
  sourceType: CreativeVariationSourceType;

  /** CreativeSourceAsset ID (if source is an uploaded asset) */
  sourceAssetId?: string;

  /** Existing ad identifiers (if source is an existing ad) */
  sourceAdId?: string;
  sourceAdName?: string;
  sourceCampaignId?: string;
  sourceCampaignName?: string;

  /** Image data */
  imageUrl?: string;
  imageDescription?: string;

  /** Copy data */
  hook?: string;
  bodyText?: string;
  callToAction?: string;
  imageHeadline?: string;

  /** Client/account linkage */
  clientAccountId: string;
  clientName?: string;
  workspaceId?: string;
}

// ── Generation Intent ───────────────────────────────────────────────────────

/** What the user wants to generate. */
export type CreativeGenerationIntent =
  | "copy_variations"
  | "image_variations"
  | "both";

/** Full request describing what to generate and from what source. */
export interface CreativeVariationRequest {
  source: CreativeVariationSource;
  intent: CreativeGenerationIntent;

  /** AI provider preference */
  provider?: "anthropic" | "openai";

  /** Number of variations to generate (default 3) */
  variationCount?: number;

  /** Optional notes/direction for the AI */
  notes?: string;

  /** Whether to include performance context in the prompt */
  includePerformanceContext?: boolean;

  /** Whether to include learning memory insights */
  includeLearningMemory?: boolean;

  /** Whether to include fatigue signals */
  includeFatigueSignals?: boolean;
}

// ── Source Context (built before generation) ────────────────────────────────

/** Performance signals for the source creative, if available. */
export interface SourcePerformanceSignals {
  ctr?: number;
  cpa?: number;
  roas?: number;
  spend?: number;
  impressions?: number;
  frequency?: number;
  fatigueStatus?: string;
  fatigueRecommendation?: string;
  evaluationStatus?: string;
}

/** A learning insight surfaced for generation context. */
export interface SourceLearningInsight {
  category: string;
  insightText: string;
  confidence: string;
  pattern?: string;
}

/** Full context assembled before calling generation providers. */
export interface VariationSourceContext {
  source: CreativeVariationSource;
  performance?: SourcePerformanceSignals;
  learnings: SourceLearningInsight[];
  clientCopywritingPrompt?: string;
  clientImageDirections?: string;
  dataQuality: "sparse" | "moderate" | "rich";
}

// ── Candidates ──────────────────────────────────────────────────────────────

export type CreativeVariationStatus =
  | "generating"
  | "completed"
  | "failed"
  | "partial";

/** A single copy variation candidate. */
export interface CopyVariationCandidate {
  id?: string;
  title: string;
  hook: string;
  body: string;
  callToAction: string;
  angle?: string;
  rationale?: string;
}

/** A single image variation candidate. */
export interface ImageVariationCandidate {
  id?: string;
  title: string;
  conceptSummary: string;
  visualChanges: string;
  goal: string;
  textOverlay?: string;
  colorDirection?: string;
  /** URL of the generated image (after rendering) */
  generatedImageUrl?: string;
  /** Whether the image has been rendered yet */
  rendered: boolean;
}

/** Unified set of variations from a single generation run. */
export interface UnifiedVariationSet {
  requestId: string;
  /** Database GenerationRun ID (set after persistence) */
  generationRunId?: string;
  source: CreativeVariationSource;
  intent: CreativeGenerationIntent;
  status: CreativeVariationStatus;
  provider: string;

  copyVariations: CopyVariationCandidate[];
  imageVariations: ImageVariationCandidate[];

  /** Timing */
  startedAt: string;
  completedAt?: string;
  latencyMs?: number;

  /** Token usage (copy generation) */
  tokensUsed?: number;

  /** Error info if failed/partial */
  error?: CreativeVariationError;
}

// ── Errors ──────────────────────────────────────────────────────────────────

export type CreativeVariationErrorCode =
  | "missing_source"
  | "missing_source_image"
  | "provider_failure"
  | "parse_failure"
  | "partial_output"
  | "duplicate_candidates"
  | "timeout"
  | "unknown";

export interface CreativeVariationError {
  code: CreativeVariationErrorCode;
  message: string;
  retryable: boolean;
  details?: string;
}

// ── Summary & Links ─────────────────────────────────────────────────────────

/** Summary of a generation run for display in lists. */
export interface CreativeVariationSummary {
  requestId: string;
  sourceLabel: string;
  sourceType: CreativeVariationSourceType;
  intent: CreativeGenerationIntent;
  status: CreativeVariationStatus;
  copyCount: number;
  imageCount: number;
  provider: string;
  createdAt: string;
  clientAccountId: string;
  clientName?: string;
}

/** Link back to the source asset or ad. */
export interface CreativeVariationLink {
  type: "source_asset" | "existing_ad" | "generation_run" | "review";
  id: string;
  label: string;
  href: string;
}

// ── Persistence ─────────────────────────────────────────────────────────────

/** Shape for persisting a generation run and its candidates. */
export interface VariationPersistenceInput {
  clientAccountId: string;
  campaignId?: string;
  adId?: string;
  adName?: string;
  sourceAssetId?: string;
  provider: string;
  intent: CreativeGenerationIntent;
  copyVariations: CopyVariationCandidate[];
  imageVariations: ImageVariationCandidate[];
}

/** Result of persisting candidates. */
export interface VariationPersistenceResult {
  generationRunId: string;
  copyVariationIds: string[];
  imageVariationIds: string[];
}
