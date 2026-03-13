// Real Generation Pipeline
//
// Async pipeline that executes real provider APIs at step 5.
// Reuses assembly, render, format, and parse from existing layers.

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
  parsePlaceholderImageResponse
} from "../providerParse";
import { executeProviderRequest, isProviderReady } from "../providerExecution";

function toParseProvider(provider: ProviderAdapterType): ProviderResponseType {
  const map: Record<ProviderAdapterType, ProviderResponseType> = {
    openai_text:                "openai_text_response",
    anthropic_text:             "anthropic_text_response",
    image_provider_placeholder: "image_provider_placeholder_response"
  };
  return map[provider];
}

// ── Copy pipeline ────────────────────────────────────────────────────────────

export async function runRealCopyGenerationPipeline(
  input: MockGenerationPipelineInput
): Promise<MockGenerationPipelineResult> {
  const { entry, provider } = input;
  const stepResults: PipelineStepResult[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const trace: MockGenerationPipelineResult["trace"] = {};

  stepResults.push({ step: "diagnosis", status: "ok", output: entry.diagnosis });
  trace.diagnosis = entry.diagnosis;

  const assembly = assembleCopyGenerationContext(entry);
  if (!assembly.ready && assembly.missingFields.length > 0) {
    warnings.push(`Assembly missing fields: ${assembly.missingFields.join(", ")}`);
  }
  stepResults.push({ step: "input_assembly", status: "ok", output: assembly });
  trace.assembledContext = assembly.context;

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
  stepResults.push({ step: "prompt_render", status: "ok", output: renderResult });
  trace.renderedPrompt = renderResult.fullPrompt;

  if (provider === "openai_text" || provider === "anthropic_text") {
    if (!isProviderReady(provider)) {
      errors.push(`Provider ${provider} is not configured. Check environment variables.`);
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
  }

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
  stepResults.push({ step: "provider_format", status: "ok", output: formatResult });
  trace.formattedPayload = formatResult.payload;

  const execResult = await executeProviderRequest({
    provider,
    requestType: "copy_generation",
    payload: formatResult.payload
  });

  const execStepStatus = execResult.status === "completed" ? "ok" : "failed";
  stepResults.push({
    step:   "mock_provider_response",
    status: execStepStatus,
    output: execResult.rawResponse,
    error:  execResult.errors.length > 0 ? execResult.errors.join("; ") : undefined
  });
  trace.rawMockResponse = execResult.rawResponse;
  if (execResult.warnings.length) warnings.push(...execResult.warnings);
  if (execResult.errors.length) errors.push(...execResult.errors);

  if (execResult.status !== "completed" || !execResult.rawResponse) {
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

  const parseProvider = toParseProvider(provider);
  const parseResult =
    parseProvider === "openai_text_response"
      ? parseOpenAICopyResponse(execResult.rawResponse)
      : parseAnthropicCopyResponse(execResult.rawResponse);
  stepResults.push({
    step:   "response_parse",
    status: parseResult.readiness ? "ok" : "failed",
    output: parseResult,
    error:  parseResult.errors.length > 0 ? parseResult.errors.join("; ") : undefined
  });
  trace.parsedOutput = parseResult.copyResult?.variations;
  if (parseResult.warnings.length) warnings.push(...parseResult.warnings);
  if (parseResult.errors.length) errors.push(...parseResult.errors);

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

export async function runRealImageGenerationPipeline(
  input: MockGenerationPipelineInput
): Promise<MockGenerationPipelineResult> {
  const { entry, provider } = input;
  const stepResults: PipelineStepResult[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const trace: MockGenerationPipelineResult["trace"] = {};

  stepResults.push({ step: "diagnosis", status: "ok", output: entry.diagnosis });
  trace.diagnosis = entry.diagnosis;

  const assembly = assembleImageGenerationContext(entry);
  if (!assembly.ready && assembly.missingFields.length > 0) {
    warnings.push(`Assembly missing fields: ${assembly.missingFields.join(", ")}`);
  }
  stepResults.push({ step: "input_assembly", status: "ok", output: assembly });
  trace.assembledContext = assembly.context;

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
  stepResults.push({ step: "prompt_render", status: "ok", output: renderResult });
  trace.renderedPrompt = renderResult.fullPrompt;

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
  stepResults.push({ step: "provider_format", status: "ok", output: formatResult });
  trace.formattedPayload = formatResult.payload;

  const execResult = await executeProviderRequest({
    provider,
    requestType: "image_variation_generation",
    payload: formatResult.payload
  });

  stepResults.push({
    step:   "mock_provider_response",
    status: execResult.status === "completed" ? "ok" : "failed",
    output: execResult.rawResponse,
    error:  execResult.errors.length > 0 ? execResult.errors.join("; ") : undefined
  });
  trace.rawMockResponse = execResult.rawResponse;
  if (execResult.warnings.length) warnings.push(...execResult.warnings);
  if (execResult.errors.length) errors.push(...execResult.errors);

  if (execResult.status !== "completed" || !execResult.rawResponse) {
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

  const parseResult = parsePlaceholderImageResponse(execResult.rawResponse);
  stepResults.push({
    step:   "response_parse",
    status: parseResult.readiness ? "ok" : "failed",
    output: parseResult,
    error:  parseResult.errors.length > 0 ? parseResult.errors.join("; ") : undefined
  });
  trace.parsedOutput = parseResult.imageResult?.concepts;
  if (parseResult.warnings.length) warnings.push(...parseResult.warnings);
  if (parseResult.errors.length) errors.push(...parseResult.errors);

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

export async function runRealGenerationPipeline(
  input: MockGenerationPipelineInput
): Promise<MockGenerationPipelineResult> {
  if (input.requestType === "copy_generation") {
    return runRealCopyGenerationPipeline(input);
  }
  return runRealImageGenerationPipeline(input);
}
