// AI Provider module
//
// Exports the contract interfaces and the mock provider implementations.
// Future: add getCopyProvider(providerId) and getImageProvider(providerId)
// that return the appropriate implementation based on config.

import type { AIGenerationProvider } from "../../types/aiProvider";
import type { CopyGenerationProvider, ImageVariationProvider } from "./contract";
import { mockCopyProvider, mockImageProvider } from "./mockProvider";

export type { CopyGenerationProvider, ImageVariationProvider } from "./contract";
export { mockCopyProvider, mockImageProvider } from "./mockProvider";

export function getCopyProvider(_provider: AIGenerationProvider): CopyGenerationProvider {
  return mockCopyProvider;
}

export function getImageProvider(_provider: AIGenerationProvider): ImageVariationProvider {
  return mockImageProvider;
}
