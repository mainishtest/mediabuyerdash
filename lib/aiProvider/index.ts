// AI Provider module
//
// Exports the contract interfaces and the mock provider implementations.
// Future: add getCopyProvider(providerId) and getImageProvider(providerId)
// that return the appropriate implementation based on config.

import type { AIGenerationProvider } from "../../types/aiProvider";
import type { CopyGenerationProvider, ImageVariationProvider } from "./contract";
import { mockCopyProvider, mockImageProvider } from "./mockProvider";
import { getOpenAIConfig } from "../providerExecution/config";

export type { CopyGenerationProvider, ImageVariationProvider } from "./contract";
export { mockCopyProvider, mockImageProvider } from "./mockProvider";

export function getCopyProvider(_provider: AIGenerationProvider): CopyGenerationProvider {
  return mockCopyProvider;
}

/**
 * Returns the image variation provider.
 * Uses mock provider when OpenAI is not configured.
 * Note: The real DALL-E image generation is handled separately via
 * generateConceptImageAction() which calls lib/creativelab/imageGeneration.ts.
 * The provider here generates text concepts (not actual images).
 */
export function getImageProvider(_provider: AIGenerationProvider): ImageVariationProvider {
  // Concept generation (text) still uses mock — actual image pixels
  // are generated via the DALL-E integration in creativelab/imageGeneration.ts
  return mockImageProvider;
}

/** Check if real image generation is available (OPENAI_API_KEY set). */
export function isImageGenerationConfigured(): boolean {
  return getOpenAIConfig().ready;
}
