// Anthropic Provider Execution
//
// Calls Anthropic Messages API. Uses fetch to avoid SDK dependency.

import type { AnthropicCopyPayload } from "../../types/providerFormat";
import type { ProviderExecutionResult } from "../../types/providerExecution";
import { getAnthropicConfig } from "./config";

const ANTHROPIC_VERSION = "2023-06-01";

export async function executeAnthropicCopyRequest(
  payload: AnthropicCopyPayload
): Promise<ProviderExecutionResult> {
  const start = Date.now();
  const config = getAnthropicConfig();

  if (!config.ready || !config.apiKey) {
    return {
      provider:     "anthropic_text",
      requestType:  "copy_generation",
      status:       "failed",
      rawResponse:  null,
      metadata:     {},
      warnings:     [],
      errors:       [config.message]
    };
  }

  const model = config.model ?? payload.model ?? "claude-3-5-haiku-20241022";

  try {
    const res = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method:  "POST",
        headers: {
          "Content-Type":      "application/json",
          "x-api-key":         config.apiKey,
          "anthropic-version": ANTHROPIC_VERSION
        },
        body: JSON.stringify({
          model:      model,
          max_tokens: payload.max_tokens ?? 2048,
          system:     payload.system,
          messages:   payload.messages
        })
      }
    );

    const latencyMs = Date.now() - start;

    if (res.status === 429 || res.status === 529) {
      const retryAfter = res.headers.get("retry-after");
      return {
        provider:     "anthropic_text",
        requestType:  "copy_generation",
        status:       "rate_limited",
        rawResponse:  null,
        metadata:     {
          rateLimit: { retryAfter: retryAfter ? parseInt(retryAfter, 10) : undefined },
          latencyMs
        },
        warnings:     [],
        errors:       [res.status === 529 ? "Anthropic API is temporarily overloaded. Try again shortly." : "Rate limited. Try again later."]
      };
    }

    const data = await res.json();

    if (!res.ok) {
      const errMsg = data?.error?.message ?? data?.message ?? `HTTP ${res.status}`;
      return {
        provider:     "anthropic_text",
        requestType:  "copy_generation",
        status:       "failed",
        rawResponse:  data,
        metadata:     { latencyMs },
        warnings:     [],
        errors:       [errMsg]
      };
    }

    return {
      provider:     "anthropic_text",
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
      provider:     "anthropic_text",
      requestType:  "copy_generation",
      status:       "failed",
      rawResponse:  null,
      metadata:     { latencyMs: Date.now() - start },
      warnings:     [],
      errors:       [msg]
    };
  }
}
