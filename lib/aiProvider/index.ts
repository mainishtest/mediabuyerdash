// AI Provider module
//
// Exports the contract interfaces and provider implementations.
// Routes to real providers when API keys are configured, falls back to mock.

import type { AIGenerationProvider } from "../../types/aiProvider";
import type { CopyGenerationProvider, ImageVariationProvider } from "./contract";
import { mockCopyProvider, mockImageProvider } from "./mockProvider";
import { openaiImageProvider } from "./openaiImageProvider";
import { getOpenAIConfig } from "../providerExecution/config";

export type { CopyGenerationProvider, ImageVariationProvider } from "./contract";
export { mockCopyProvider, mockImageProvider } from "./mockProvider";

export function getCopyProvider(_provider: AIGenerationProvider): CopyGenerationProvider {
  return mockCopyProvider;
}

export function getImageProvider(provider: AIGenerationProvider): ImageVariationProvider {
  // Use OpenAI for image concepts when key is available
  if (provider === "openai" || provider === "image_provider_placeholder") {
    const config = getOpenAIConfig();
    if (config.ready) return openaiImageProvider;
  }
  return mockImageProvider;
}
