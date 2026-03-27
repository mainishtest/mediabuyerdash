// Image Provider Placeholder Execution
//
// Returns mock response. Real image generation not yet implemented.
// Architecture supports adding a real provider later.

import type { ImageProviderPayload } from "../../types/providerFormat";
import type { ProviderExecutionResult } from "../../types/providerExecution";
import { MOCK_PLACEHOLDER_IMAGE_RESPONSE } from "../providerParse";

export async function executeImageProviderPlaceholderRequest(
  _payload: ImageProviderPayload
): Promise<ProviderExecutionResult> {
  return {
    provider:     "image_provider_placeholder",
    requestType:  "image_variation_generation",
    status:       "completed",
    rawResponse:  MOCK_PLACEHOLDER_IMAGE_RESPONSE,
    metadata:     {},
    warnings:     ["Image provider is a placeholder. Mock response returned."],
    errors:       []
  };
}
