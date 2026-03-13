// Provider Formatting Adapters
//
// Converts internal rendered prompts and assembled context into provider-specific
// request payload shapes. No API calls. Pure functions only.

import type { PromptRenderResult } from "../../types/promptTemplate";
import type {
  CopyGenerationContext,
  ImageGenerationContext
} from "../../types/promptAssembly";
import type {
  ProviderAdapterType,
  ProviderRequestType,
  ProviderFormatInput,
  ProviderFormatResult,
  ProviderPayloadPreview,
  ImageProviderPayload,
  OpenAICopyPayload,
  AnthropicCopyPayload
} from "../../types/providerFormat";

// ── Validation helpers ─────────────────────────────────────────────────────────

const COPY_PROVIDERS: ProviderAdapterType[] = ["openai_text", "anthropic_text"];
const IMAGE_PROVIDERS: ProviderAdapterType[] = ["image_provider_placeholder"];

function validateFormatInput(input: ProviderFormatInput): {
  missing: string[];
  warnings: string[];
} {
  const missing: string[] = [];
  const warnings: string[] = [];

  if (!input.renderResult?.fullPrompt?.trim()) {
    missing.push("rendered prompt");
  }

  if (!input.context) {
    missing.push("assembled context");
  }

  if (input.requestType === "copy_generation") {
    if (!COPY_PROVIDERS.includes(input.providerTarget)) {
      warnings.push(`Provider ${input.providerTarget} is not supported for copy generation`);
    }
  } else if (input.requestType === "image_variation_generation") {
    if (!IMAGE_PROVIDERS.includes(input.providerTarget)) {
      warnings.push(`Provider ${input.providerTarget} is not supported for image variation generation`);
    }
  }

  if (input.renderResult?.missingFields?.length) {
    warnings.push(`Render had missing fields: ${input.renderResult.missingFields.join(", ")}`);
  }

  return { missing, warnings };
}

// ── OpenAI copy adapter ───────────────────────────────────────────────────────

export function formatCopyPromptForOpenAI(
  renderResult: PromptRenderResult,
  context: CopyGenerationContext
): ProviderFormatResult {
  const input: ProviderFormatInput = {
    renderResult,
    context,
    providerTarget: "openai_text",
    requestType: "copy_generation"
  };
  const { missing, warnings } = validateFormatInput(input);

  const systemContent = renderResult.renderedSections.systemInstructions ?? "";
  const userContent = [
    renderResult.renderedSections.taskInstructions,
    renderResult.renderedSections.outputRequirements,
    renderResult.renderedSections.constraints,
    renderResult.renderedSections.directResponsePrinciples,
    renderResult.renderedSections.storySellingGuidance,
    renderResult.renderedSections.ctaGuidance
  ]
    .filter(Boolean)
    .join("\n\n");

  const payload: OpenAICopyPayload = {
    model:       "gpt-4o",
    messages:    [
      { role: "system", content: systemContent },
      { role: "user", content: userContent }
    ],
    temperature: 0.7
  };

  return {
    provider:      "openai_text",
    requestType:    "copy_generation",
    payload,
    warnings,
    readiness:      missing.length === 0,
    missingFields: missing
  };
}

// ── Anthropic copy adapter ──────────────────────────────────────────────────

export function formatCopyPromptForAnthropic(
  renderResult: PromptRenderResult,
  context: CopyGenerationContext
): ProviderFormatResult {
  const input: ProviderFormatInput = {
    renderResult,
    context,
    providerTarget: "anthropic_text",
    requestType: "copy_generation"
  };
  const { missing, warnings } = validateFormatInput(input);

  const systemContent = [
    renderResult.renderedSections.systemInstructions,
    renderResult.renderedSections.directResponsePrinciples,
    renderResult.renderedSections.storySellingGuidance,
    renderResult.renderedSections.ctaGuidance
  ]
    .filter(Boolean)
    .join("\n\n");

  const userContent = [
    renderResult.renderedSections.taskInstructions,
    renderResult.renderedSections.outputRequirements,
    renderResult.renderedSections.constraints
  ]
    .filter(Boolean)
    .join("\n\n");

  const payload: AnthropicCopyPayload = {
    model:      "claude-3-5-sonnet-20241022",
    system:     systemContent,
    messages:   [{ role: "user", content: userContent }],
    max_tokens: 2048
  };

  return {
    provider:      "anthropic_text",
    requestType:    "copy_generation",
    payload,
    warnings,
    readiness:     missing.length === 0,
    missingFields: missing
  };
}

// ── Image placeholder adapter ─────────────────────────────────────────────────

export function formatImagePromptForPlaceholderProvider(
  renderResult: PromptRenderResult,
  context: ImageGenerationContext
): ProviderFormatResult {
  const input: ProviderFormatInput = {
    renderResult,
    context,
    providerTarget: "image_provider_placeholder",
    requestType: "image_variation_generation"
  };
  const { missing, warnings } = validateFormatInput(input);

  const styleGuidance = [
    renderResult.renderedSections.attentionGrabbingPrinciples,
    renderResult.renderedSections.visualHierarchyGuidance,
    renderResult.renderedSections.actionDrivingGuidance
  ]
    .filter(Boolean)
    .join("\n\n");

  const payload: ImageProviderPayload = {
    prompt:         renderResult.fullPrompt,
    styleGuidance,
    variationCount: 3,
    metadata:       {
      adId:       context.adId,
      campaignId: context.campaignId,
      requestType: "image_variation_generation"
    }
  };

  return {
    provider:      "image_provider_placeholder",
    requestType:    "image_variation_generation",
    payload,
    warnings,
    readiness:     missing.length === 0,
    missingFields: missing
  };
}

// ── Preview helper ─────────────────────────────────────────────────────────────

export function toPayloadPreview(
  result: ProviderFormatResult,
  internalPrompt: string
): ProviderPayloadPreview {
  return {
    provider:       result.provider,
    requestType:    result.requestType,
    internalPrompt,
    payloadJson:    JSON.stringify(result.payload, null, 2),
    readiness:      result.readiness,
    warnings:       result.warnings,
    missingFields:  result.missingFields
  };
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

export function formatForProvider(
  renderResult: PromptRenderResult,
  context: CopyGenerationContext | ImageGenerationContext,
  provider: ProviderAdapterType,
  requestType: ProviderRequestType
): ProviderFormatResult | null {
  if (requestType === "copy_generation") {
    if (provider === "openai_text") {
      return formatCopyPromptForOpenAI(renderResult, context as CopyGenerationContext);
    }
    if (provider === "anthropic_text") {
      return formatCopyPromptForAnthropic(renderResult, context as CopyGenerationContext);
    }
  }
  if (requestType === "image_variation_generation" && provider === "image_provider_placeholder") {
    return formatImagePromptForPlaceholderProvider(renderResult, context as ImageGenerationContext);
  }
  return null;
}
