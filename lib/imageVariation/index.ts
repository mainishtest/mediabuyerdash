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
