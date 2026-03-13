// OpenAI Provider Execution
//
// Calls OpenAI Chat Completions API. Uses fetch to avoid SDK dependency.

import type { OpenAICopyPayload } from "../../types/providerFormat";
import type {
  ProviderExecutionResult,
  ProviderExecutionStatus
} from "../../types/providerExecution";
import { getOpenAIConfig } from "./config";

export async function executeOpenAICopyRequest(
  payload: OpenAICopyPayload
): Promise<ProviderExecutionResult> {
  const start = Date.now();
  const config = getOpenAIConfig();

  if (!config.ready || !config.apiKey) {
    return {
      provider:     "openai_text",
      requestType:  "copy_generation",
      status:       "failed",
      rawResponse:  null,
      metadata:     {},
      warnings:     [],
      errors:       [config.message]
    };
  }

  const model = config.model ?? payload.model ?? "gpt-4o-mini";

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model:          model,
        messages:       payload.messages,
        temperature:    payload.temperature ?? 0.7,
        response_format: { type: "json_object" }
      })
    });

    const latencyMs = Date.now() - start;

    if (res.status === 429) {
      const retryAfter = res.headers.get("retry-after");
      return {
        provider:     "openai_text",
        requestType:  "copy_generation",
        status:       "rate_limited",
        rawResponse:  null,
        metadata:     {
          rateLimit: { retryAfter: retryAfter ? parseInt(retryAfter, 10) : undefined },
          latencyMs
        },
        warnings:     [],
        errors:       ["Rate limited. Try again later."]
      };
    }

    const data = await res.json();

    if (!res.ok) {
      const errMsg = data?.error?.message ?? data?.message ?? `HTTP ${res.status}`;
      return {
        provider:     "openai_text",
        requestType:  "copy_generation",
        status:       "failed",
        rawResponse:  data,
        metadata:     { latencyMs },
        warnings:     [],
        errors:       [errMsg]
      };
    }

    return {
      provider:     "openai_text",
      requestType:  "copy_generation",
      status:       "completed",
      rawResponse:  data,
      metadata:     {
        model:       data?.model,
        usage:       data?.usage,
        latencyMs
      },
      warnings:     [],
      errors:       []
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      provider:     "openai_text",
      requestType:  "copy_generation",
      status:       "failed",
      rawResponse:  null,
      metadata:     { latencyMs: Date.now() - start },
      warnings:     [],
      errors:       [msg]
    };
  }
}
