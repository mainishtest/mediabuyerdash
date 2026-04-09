// Video Ad Generator — Provider Abstraction Layer
//
// Wraps AI provider calls behind a uniform interface so the pipeline
// can route to Anthropic, OpenAI, or future providers without changing
// the strategy/render code.
//
// Currently only Anthropic is implemented. Add providers as needed.

import { callAnthropicJson, VideoAdGenError } from "./anthropic";
import type { AIProviderSlug } from "./types";
import { PROVIDER_REGISTRY } from "./types";

// ── Uniform call interface ─────────────────────────────────────────────

export interface ProviderCallArgs {
  system:     string;
  user:       string;
  maxTokens?: number;
  model?:     string;
  provider?:  AIProviderSlug;
}

/**
 * Route a JSON-generating LLM call to the appropriate provider.
 * Falls back to Anthropic if no provider is specified.
 */
export async function callProviderJson<T>(args: ProviderCallArgs): Promise<T> {
  const provider = args.provider ?? getDefaultTextProvider();

  switch (provider) {
    case "anthropic":
      return callAnthropicJson<T>({
        system:    args.system,
        user:      args.user,
        maxTokens: args.maxTokens,
        model:     args.model ?? PROVIDER_REGISTRY.anthropic.defaultModel,
      });

    case "openai":
      return callOpenAIJson<T>(args);

    case "google":
      // Gemini text generation — stub for now
      throw new VideoAdGenError("Google text generation not yet implemented");

    default:
      throw new VideoAdGenError(`Unknown text provider: ${provider}`);
  }
}

// ── Provider availability ──────────────────────────────────────────────

/** Check if an API key is configured for a given provider */
export function isProviderAvailable(slug: AIProviderSlug): boolean {
  const config = PROVIDER_REGISTRY[slug];
  if (!config) return false;
  const key = process.env[config.apiKeyEnvVar]?.trim();
  return Boolean(key && key.length > 0);
}

/** Get list of all providers with their availability status */
export function getAvailableProviders(): Array<{
  slug: AIProviderSlug;
  displayName: string;
  isAvailable: boolean;
  capabilities: string[];
}> {
  return (Object.keys(PROVIDER_REGISTRY) as AIProviderSlug[]).map((slug) => {
    const config = PROVIDER_REGISTRY[slug];
    return {
      slug,
      displayName: config.displayName,
      isAvailable: isProviderAvailable(slug),
      capabilities: config.capabilities,
    };
  });
}

/** Return the first available text-capable provider (prefers Anthropic) */
export function getDefaultTextProvider(): AIProviderSlug {
  const preferred: AIProviderSlug[] = ["anthropic", "openai", "google"];
  for (const slug of preferred) {
    if (isProviderAvailable(slug) && PROVIDER_REGISTRY[slug].capabilities.includes("text_generation")) {
      return slug;
    }
  }
  throw new VideoAdGenError(
    "No text generation provider configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_AI_API_KEY in .env.local"
  );
}

/** Return the first available video-capable provider */
export function getDefaultVideoProvider(): AIProviderSlug {
  const preferred: AIProviderSlug[] = ["google"];
  for (const slug of preferred) {
    if (isProviderAvailable(slug) && PROVIDER_REGISTRY[slug].capabilities.includes("video_generation")) {
      return slug;
    }
  }
  throw new VideoAdGenError(
    "No video generation provider configured. Set GOOGLE_AI_API_KEY in .env.local"
  );
}

/** Return the first available image-capable provider */
export function getDefaultImageProvider(): AIProviderSlug {
  const preferred: AIProviderSlug[] = ["openai", "stability"];
  for (const slug of preferred) {
    if (isProviderAvailable(slug) && PROVIDER_REGISTRY[slug].capabilities.includes("image_generation")) {
      return slug;
    }
  }
  throw new VideoAdGenError(
    "No image generation provider configured. Set OPENAI_API_KEY or STABILITY_API_KEY in .env.local"
  );
}

// ── OpenAI caller (mirrors anthropic.ts pattern) ──────────────────────

async function callOpenAIJson<T>(args: ProviderCallArgs): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new VideoAdGenError("OPENAI_API_KEY is not set");
  }

  const model = args.model ?? PROVIDER_REGISTRY.openai.defaultModel;

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens:      args.maxTokens ?? 2048,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: args.system },
          { role: "user",   content: args.user },
        ],
      }),
    });
  } catch (err) {
    throw new VideoAdGenError("Network error calling OpenAI", err);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "<unreadable>");
    throw new VideoAdGenError(`OpenAI ${res.status}: ${text.slice(0, 500)}`);
  }

  const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const text = json.choices?.[0]?.message?.content;
  if (!text) {
    throw new VideoAdGenError("OpenAI returned no content");
  }

  // Same JSON extraction logic as anthropic.ts
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  const firstBrace = cleaned.search(/[{\[]/);
  const lastClose  = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  const jsonSlice  = firstBrace >= 0 && lastClose > firstBrace
    ? cleaned.slice(firstBrace, lastClose + 1)
    : cleaned;

  try {
    return JSON.parse(jsonSlice) as T;
  } catch (err) {
    throw new VideoAdGenError(
      `Failed to parse OpenAI JSON: ${(err as Error).message}. Raw: ${text.slice(0, 300)}`
    );
  }
}
