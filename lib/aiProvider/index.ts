// AI Provider module
//
// Exports the contract interfaces and provider implementations.
// Automatically selects real (Anthropic) providers when API keys are configured,
// falling back to mock providers otherwise.

import type { AIGenerationProvider } from "../../types/aiProvider";
import type { CopyGenerationProvider, ImageVariationProvider } from "./contract";
import { mockCopyProvider, mockImageProvider } from "./mockProvider";
import { anthropicCopyProvider, anthropicImageProvider } from "./anthropicProvider";
import { getAnthropicConfig, getOpenAIConfig } from "../providerExecution/config";

export type { CopyGenerationProvider, ImageVariationProvider } from "./contract";
export { mockCopyProvider, mockImageProvider } from "./mockProvider";

/**
 * Returns the best available copy provider.
 * Uses Anthropic when ANTHROPIC_API_KEY is set, otherwise falls back to mock.
 */
export function getCopyProvider(_provider?: AIGenerationProvider): CopyGenerationProvider {
  const config = getAnthropicConfig();
  if (config.ready) {
    return anthropicCopyProvider;
  }
  return mockCopyProvider;
}

/**
 * Returns the best available image concept provider.
 * Uses Anthropic for concept generation when ANTHROPIC_API_KEY is set.
 * Note: Actual pixel generation uses DALL-E 3 via lib/creativelab/imageGeneration.ts.
 */
export function getImageProvider(_provider?: AIGenerationProvider): ImageVariationProvider {
  const config = getAnthropicConfig();
  if (config.ready) {
    return anthropicImageProvider;
  }
  return mockImageProvider;
}

/** Check if real image generation is available (OPENAI_API_KEY set). */
export function isImageGenerationConfigured(): boolean {
  return getOpenAIConfig().ready;
}

/** Check if any real AI provider is configured. */
export function isAnyProviderConfigured(): boolean {
  return getAnthropicConfig().ready || getOpenAIConfig().ready;
}
