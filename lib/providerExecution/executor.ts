// Provider Execution Dispatcher
//
// Routes execution requests to the appropriate provider module.

import type {
  OpenAICopyPayload,
  AnthropicCopyPayload,
  ImageProviderPayload,
  ProviderAdapterType
} from "../../types/providerFormat";
import type { ProviderExecutionInput, ProviderExecutionResult } from "../../types/providerExecution";
import { executeOpenAICopyRequest } from "./openai";
import { executeAnthropicCopyRequest } from "./anthropic";
import { executeImageProviderPlaceholderRequest } from "./imagePlaceholder";

export async function executeProviderRequest(
  input: ProviderExecutionInput
): Promise<ProviderExecutionResult> {
  const { provider, requestType, payload } = input;

  if (requestType === "copy_generation") {
    if (provider === "openai_text") {
      return executeOpenAICopyRequest(payload as OpenAICopyPayload);
    }
    if (provider === "anthropic_text") {
      return executeAnthropicCopyRequest(payload as AnthropicCopyPayload);
    }
  }

  if (requestType === "image_variation_generation" && provider === "image_provider_placeholder") {
    return executeImageProviderPlaceholderRequest(payload as ImageProviderPayload);
  }

  return {
    provider,
    requestType,
    status:       "failed",
    rawResponse:  null,
    metadata:     {},
    warnings:     [],
    errors:       [`Unsupported provider/request combination: ${provider} + ${requestType}`]
  };
}

// Re-export for convenience
export { executeOpenAICopyRequest } from "./openai";
export { executeAnthropicCopyRequest } from "./anthropic";
export { executeImageProviderPlaceholderRequest } from "./imagePlaceholder";
