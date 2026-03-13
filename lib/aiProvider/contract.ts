// AI Provider Contract
//
// Abstract interfaces for copy and image variation generation.
// Implementations (mock, OpenAI, Anthropic, etc.) live in separate files.
// The UI and server actions depend only on these contracts.

import type {
  CopyGenerationRequest,
  CopyGenerationResponse,
  ImageVariationRequest,
  ImageVariationResponse
} from "../../types/aiProvider";

export interface CopyGenerationProvider {
  readonly providerId: string;
  generateCopyVariations(request: CopyGenerationRequest): Promise<CopyGenerationResponse>;
}

export interface ImageVariationProvider {
  readonly providerId: string;
  generateImageVariations(request: ImageVariationRequest): Promise<ImageVariationResponse>;
}
