// Mock Generation Pipeline
//
// Orchestrates the end-to-end flow: diagnosis → assembly → render → format →
// mock response → parse → approval-ready output. No real API calls.

import type { CreativeLabEntry } from "../../types/creativeDiagnosis";
import type { ProviderAdapterType } from "../../types/providerFormat";
import type { ProviderResponseType } from "../../types/providerParse";
import type {
  MockGenerationPipelineInput,
  MockGenerationPipelineResult,
  PipelineStepResult,
  PipelineExecutionStatus
} from "../../types/pipeline";
import { assembleCopyGenerationContext, assembleImageGenerationContext } from "../promptAssemblyUtils";
import { getActiveTemplate } from "../prompts/registry";
import { renderCopyPrompt, renderImagePrompt } from "../promptRenderUtils";
import {
  formatCopyPromptForOpenAI,
  formatCopyPromptForAnthropic,
  formatImagePromptForPlaceholderProvider
} from "../providerFormat";
import {
  parseOpenAICopyResponse,
  parseAnthropicCopyResponse,
  parsePlaceholderImageResponse,
  MOCK_OPENAI_COPY_RESPONSE,
  MOCK_ANTHROPIC_COPY_RESPONSE,
  MOCK_PLACEHOLDER_IMAGE_RESPONSE
} from "../providerParse";

// ── Provider mapping ─────────────────────────────────────────────────────────

function toParseProvider(provider: ProviderAdapterType): ProviderResponseType {
  const map: Record<ProviderAdapterType, ProviderResponseType> = {
    openai_text:                "openai_text_response",
    anthropic_text:             "anthropic_text_response",
    image_provider_placeholder: "image_provider_placeholder_response"
  };
  return map[provider];
}

function getMockResponse(
  provider: ProviderAdapterType,
  requestType: "copy_generation" | "image_variation_generation"
): unknown {
  if (requestType === "copy_generation") {
    if (provider === "openai_text") return MOCK_OPENAI_COPY_RESPONSE;
    if (provider === "anthropic_text") return MOCK_ANTHROPIC_COPY_RESPONSE;
  }
  if (requestType === "image_variation_generation" && provider === "image_provider_placeholder") {
    return MOCK_PLACEHOLDER_IMAGE_RESPONSE;
  }
  return null;
}

// ── Copy pipeline ────────────────────────────────────────────────────────────

export function runMockCopyGenerationPipeline(
  input: MockGenerationPipelineInput
): MockGenerationPipelineResult {
  const { entry, provider } = input;
  const stepResults: PipelineStepResult[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const trace: MockGenerationPipelineResult["trace"] = {};

  // 1. diagnosis (already in entry)
  stepResults.push({
    step:   "diagnosis",
    status: "ok",
    output: entry.diagnosis
  });
  trace.diagnosis = entry.diagnosis;

  // 2. input_assembly
  const assembly = assembleCopyGenerationContext(entry);
  if (!assembly.ready && assembly.missingFields.length > 0) {
    warnings.push(`Assembly missing fields: ${assembly.missingFields.join(", ")}`);
  }
  stepResults.push({
    step:   "input_assembly",
    status: "ok",
    output: assembly
  });
  trace.assembledContext = assembly.context;

  // 3. prompt_render
  const copyTemplate = getActiveTemplate("copy_generation");
  if (!copyTemplate || copyTemplate.version.templateType !== "copy_generation") {
    errors.push("No active copy template");
    return {
      requestType:  "copy_generation",
      provider,
      status:       "failed",
      stepResults,
      warnings,
      errors,
      trace
    };
  }
  const renderResult = renderCopyPrompt(copyTemplate, assembly.context);
  stepResults.push({
    step:   "prompt_render",
    status: "ok",
    output: renderResult
  });
  trace.renderedPrompt = renderResult.fullPrompt;

  // 4. provider_format
  let formatResult;
  if (provider === "openai_text") {
    formatResult = formatCopyPromptForOpenAI(renderResult, assembly.context);
  } else if (provider === "anthropic_text") {
    formatResult = formatCopyPromptForAnthropic(renderResult, assembly.context);
  } else {
    errors.push(`Provider ${provider} does not support copy generation`);
    return {
      requestType:  "copy_generation",
      provider,
      status:       "failed",
      stepResults,
      warnings,
      errors,
      trace
    };
  }
  stepResults.push({
    step:   "provider_format",
    status: formatResult.readiness ? "ok" : "ok",
    output: formatResult
  });
  trace.formattedPayload = formatResult.payload;

  // 5. mock_provider_response
  const mockResponse = getMockResponse(provider, "copy_generation");
  if (!mockResponse) {
    errors.push("No mock response for provider");
    return {
      requestType:  "copy_generation",
      provider,
      status:       "failed",
      stepResults,
      warnings,
      errors,
      trace
    };
  }
  stepResults.push({
    step:   "mock_provider_response",
    status: "ok",
    output: mockResponse
  });
  trace.rawMockResponse = mockResponse;

  // 6. response_parse
  const parseProvider = toParseProvider(provider);
  const parseResult =
    parseProvider === "openai_text_response"
      ? parseOpenAICopyResponse(mockResponse)
      : parseAnthropicCopyResponse(mockResponse);
  stepResults.push({
    step:   "response_parse",
    status: parseResult.readiness ? "ok" : "failed",
    output: parseResult,
    error:  parseResult.errors.length > 0 ? parseResult.errors.join("; ") : undefined
  });
  trace.parsedOutput = parseResult.copyResult?.variations;
  if (parseResult.warnings.length) warnings.push(...parseResult.warnings);
  if (parseResult.errors.length) errors.push(...parseResult.errors);

  // 7. approval_ready_output
  const copyOutput = parseResult.copyResult?.variations ?? [];
  stepResults.push({
    step:   "approval_ready_output",
    status: copyOutput.length > 0 ? "ok" : "failed",
    output: copyOutput
  });

  const status: PipelineExecutionStatus =
    errors.length > 0 ? (copyOutput.length > 0 ? "partial" : "failed") : "completed";

  return {
    requestType:  "copy_generation",
    provider,
    status,
    stepResults,
    copyOutput,
    warnings,
    errors,
    trace
  };
}

// ── Image pipeline ────────────────────────────────────────────────────────────

export function runMockImageGenerationPipeline(
  input: MockGenerationPipelineInput
): MockGenerationPipelineResult {
  const { entry, provider } = input;
  const stepResults: PipelineStepResult[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const trace: MockGenerationPipelineResult["trace"] = {};

  // 1. diagnosis
  stepResults.push({
    step:   "diagnosis",
    status: "ok",
    output: entry.diagnosis
  });
  trace.diagnosis = entry.diagnosis;

  // 2. input_assembly
  const assembly = assembleImageGenerationContext(entry);
  if (!assembly.ready && assembly.missingFields.length > 0) {
    warnings.push(`Assembly missing fields: ${assembly.missingFields.join(", ")}`);
  }
  stepResults.push({
    step:   "input_assembly",
    status: "ok",
    output: assembly
  });
  trace.assembledContext = assembly.context;

  // 3. prompt_render
  const imageTemplate = getActiveTemplate("image_variation_generation");
  if (!imageTemplate || imageTemplate.version.templateType !== "image_variation_generation") {
    errors.push("No active image template");
    return {
      requestType:  "image_variation_generation",
      provider,
      status:       "failed",
      stepResults,
      warnings,
      errors,
      trace
    };
  }
  const renderResult = renderImagePrompt(imageTemplate, assembly.context);
  stepResults.push({
    step:   "prompt_render",
    status: "ok",
    output: renderResult
  });
  trace.renderedPrompt = renderResult.fullPrompt;

  // 4. provider_format
  if (provider !== "image_provider_placeholder") {
    errors.push(`Provider ${provider} does not support image variation generation`);
    return {
      requestType:  "image_variation_generation",
      provider,
      status:       "failed",
      stepResults,
      warnings,
      errors,
      trace
    };
  }
  const formatResult = formatImagePromptForPlaceholderProvider(renderResult, assembly.context);
  stepResults.push({
    step:   "provider_format",
    status: "ok",
    output: formatResult
  });
  trace.formattedPayload = formatResult.payload;

  // 5. mock_provider_response
  const mockResponse = getMockResponse(provider, "image_variation_generation");
  if (!mockResponse) {
    errors.push("No mock response for provider");
    return {
      requestType:  "image_variation_generation",
      provider,
      status:       "failed",
      stepResults,
      warnings,
      errors,
      trace
    };
  }
  stepResults.push({
    step:   "mock_provider_response",
    status: "ok",
    output: mockResponse
  });
  trace.rawMockResponse = mockResponse;

  // 6. response_parse
  const parseResult = parsePlaceholderImageResponse(mockResponse);
  stepResults.push({
    step:   "response_parse",
    status: parseResult.readiness ? "ok" : "failed",
    output: parseResult,
    error:  parseResult.errors.length > 0 ? parseResult.errors.join("; ") : undefined
  });
  trace.parsedOutput = parseResult.imageResult?.concepts;
  if (parseResult.warnings.length) warnings.push(...parseResult.warnings);
  if (parseResult.errors.length) errors.push(...parseResult.errors);

  // 7. approval_ready_output
  const imageOutput = parseResult.imageResult?.concepts ?? [];
  stepResults.push({
    step:   "approval_ready_output",
    status: imageOutput.length > 0 ? "ok" : "failed",
    output: imageOutput
  });

  const status: PipelineExecutionStatus =
    errors.length > 0 ? (imageOutput.length > 0 ? "partial" : "failed") : "completed";

  return {
    requestType:  "image_variation_generation",
    provider,
    status,
    stepResults,
    imageOutput,
    warnings,
    errors,
    trace
  };
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

export function runMockGenerationPipeline(
  input: MockGenerationPipelineInput
): MockGenerationPipelineResult {
  if (input.requestType === "copy_generation") {
    return runMockCopyGenerationPipeline(input);
  }
  return runMockImageGenerationPipeline(input);
}
