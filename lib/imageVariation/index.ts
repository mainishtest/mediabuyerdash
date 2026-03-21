// lib/imageVariation/index.ts
// Public API for the AI Image Variation Generation Engine.

// Types
export type {
  ImageVariationIntent,
  ImageVariationContext,
  ImageVariationCandidate,
  ImageVariationCandidateSet,
  ImageVariationConstraint,
  ImageVariationGenerationSummary,
  ImageVariationPrompt,
  ImageVariationProviderType,
  ImageVariationProviderResult,
  ImageVariationRequest,
  ImageVariationSourceAsset,
} from "./types";

export { IMAGE_VARIATION_INTENTS } from "./types";

// Context
export { buildImageVariationContext, selectVariationIntent, buildImageContextSummary } from "./context";

// Prompts
export { buildImageVariationPrompt } from "./prompts";

// Providers
export type { ImageVariationProvider } from "./providers";
export { BriefOnlyProvider, DalleProvider, MockProvider, resolveImageVariationProvider } from "./providers";

// Engine
export {
  buildImageVariationRequest,
  generateImageVariationCandidates,
  normalizeImageVariationCandidates,
  summarizeImageVariationGeneration,
  getImageVariationHistory,
  getImageVariationRequestById,
} from "./engine";
export type { ImageVariationEngineResult } from "./engine";

// Review types
export type {
  ImageVariationReviewState,
  ImageVariationRevisionIntent,
  ImageVariationApprovalDecision,
  ImageVariationReviewerNote,
  ImageVariationReviewItem,
  ImageVariationComparisonSet,
  ImageVariationReviewQueue,
  ImageVariationReviewReason,
  ImageVariationApprovalSummary,
} from "./reviewTypes";

export { IMAGE_VARIATION_REVISION_INTENTS } from "./reviewTypes";

// Review workflow
export {
  buildImageVariationReviewQueue,
  buildImageVariationComparisonSet,
  approveImageVariationCandidate,
  rejectImageVariationCandidate,
  requestImageVariationRevision,
  archiveImageVariationCandidate,
  summarizeImageVariationReview,
} from "./review";

// Scoring types
export type {
  ImageVariationScoreDimension,
  ImageVariationScore,
  ImageVariationScorecard,
  ImageVariationScoreExplanation,
  ImageVariationReadiness,
  ImageVariationRisk,
  ImageVariationRanking,
  ImageVariationRankingSummary,
  ImageVariationLaunchReadiness,
  ImageVariationSelectionDecision,
  ImageVariationPublishPrepLink,
  ImageVariationScoreReason,
} from "./scoringTypes";

export {
  IMAGE_VARIATION_SCORE_DIMENSIONS,
  IMAGE_VARIATION_READINESS_LABEL,
  IMAGE_VARIATION_READINESS_COLOR,
  IMAGE_VARIATION_READINESS_BG,
} from "./scoringTypes";

// Scoring workflow
export {
  scoreImageVariation,
  buildImageVariationScorecard,
  rankImageVariationCandidates,
  computeImageVariationReadiness,
  summarizeImageVariationRanking,
  buildImageVariationPublishPrepLink,
  computeLaunchReadiness,
} from "./scoring";

// Experiment launch bridge
export type {
  ImageVariationExperimentLaunchPlan,
  ImageVariationExperimentSummary,
} from "./experimentLaunch";

export {
  buildImageVariationExperimentLaunchPlan,
  saveImageVariationExperimentLaunchPlan,
  loadImageVariationExperimentLaunchPlans,
  loadImageVariationExperimentLaunchPlanById,
} from "./experimentLaunch";

// Results ingestion types
export type {
  ImageVariationTestResult,
  ImageVariationTestOutcome,
  ImageVariationMetricSnapshot,
  ImageVariationTestComparison,
  ImageVariationEvaluationWindow,
  ImageVariationOutcomeConfidence,
  ImageVariationOutcomeReason,
  ImageVariationResultSummary,
  ImageVariationLifecycleResultLink,
  ImageVariationTrackingState,
} from "./resultsTypes";

export {
  IMAGE_VARIATION_OUTCOME_LABEL,
  IMAGE_VARIATION_OUTCOME_COLOR,
  IMAGE_VARIATION_OUTCOME_BG,
  IMAGE_VARIATION_TRACKING_LABEL,
} from "./resultsTypes";

// Results ingestion
export {
  ingestImageVariationResults,
  summarizeImageVariationResults,
  buildImageVariationLifecycleLink,
} from "./results";
