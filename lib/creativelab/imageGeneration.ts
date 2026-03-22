// lib/creativelab/imageGeneration.ts
//
// Real image generation using OpenAI DALL-E 3.
// Generates ad creative variations from concept descriptions.
// Uses fetch (no SDK dependency) — same pattern as lib/providerExecution/openai.ts.

import { getOpenAIConfig } from "../providerExecution/config";

// ── Types ───────────────────────────────────────────────────────────────────

export interface ImageGenerationRequest {
  prompt:     string;
  size?:      "1024x1024" | "1024x1792" | "1792x1024";
  quality?:   "standard" | "hd";
  style?:     "vivid" | "natural";
}

export interface ImageGenerationResult {
  status:    "completed" | "failed" | "rate_limited" | "not_configured";
  imageUrl:  string | null;      // temporary OpenAI URL (expires ~1h)
  prompt:    string;             // the actual prompt sent (DALL-E 3 may revise)
  error:     string | null;
  latencyMs: number;
}

// ── Cost control constants ──────────────────────────────────────────────────

/** Max images per single generation request (prevents runaway costs). */
export const MAX_IMAGES_PER_REQUEST = 4;

/** Max images per concept (retry budget). */
export const MAX_RETRIES = 2;

// ── Prompt builder ──────────────────────────────────────────────────────────

/**
 * Builds a DALL-E 3 prompt from concept metadata and source image analysis.
 * Focuses on direct-response ad creative principles.
 */
export function buildImagePrompt(concept: {
  title:           string;
  conceptSummary:  string;
  visualChanges:   string;
  goal:            string;
}, sourceAnalysis?: {
  detectedStyle?:    string | null;
  dominantMessage?:  string | null;
  visualTheme?:      string | null;
} | null): string {
  const stylePart = sourceAnalysis?.detectedStyle
    ? `The original image style is "${sourceAnalysis.detectedStyle}".`
    : "";
  const themePart = sourceAnalysis?.visualTheme
    ? `Visual theme: ${sourceAnalysis.visualTheme}.`
    : "";
  const messagePart = sourceAnalysis?.dominantMessage
    ? `The main message to convey: "${sourceAnalysis.dominantMessage}".`
    : "";

  return [
    "Create a professional Facebook ad creative image.",
    `Concept: "${concept.title}" — ${concept.conceptSummary}`,
    `Visual direction: ${concept.visualChanges}`,
    `Goal: ${concept.goal}`,
    stylePart,
    themePart,
    messagePart,
    "Requirements: Clean, mobile-optimized, single focal point, readable on small screens.",
    "No text overlays — the image should work without any text burned in.",
    "Professional product/lifestyle photography style suitable for paid social ads.",
  ].filter(Boolean).join(" ");
}

// ── OpenAI DALL-E 3 API call ────────────────────────────────────────────────

/**
 * Calls the OpenAI Images API to generate a single image.
 * Returns the temporary URL (valid ~1 hour) — caller must download and persist.
 */
export async function generateImage(
  request: ImageGenerationRequest
): Promise<ImageGenerationResult> {
  const start = Date.now();
  const config = getOpenAIConfig();

  if (!config.ready || !config.apiKey) {
    return {
      status:    "not_configured",
      imageUrl:  null,
      prompt:    request.prompt,
      error:     config.message,
      latencyMs: Date.now() - start,
    };
  }

  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model:   "dall-e-3",
        prompt:  request.prompt,
        n:       1,
        size:    request.size    ?? "1024x1024",
        quality: request.quality ?? "standard",
        style:   request.style   ?? "natural",
        response_format: "url",
      }),
    });

    const latencyMs = Date.now() - start;

    if (res.status === 429) {
      return {
        status:    "rate_limited",
        imageUrl:  null,
        prompt:    request.prompt,
        error:     "Rate limited by OpenAI. Try again in a few seconds.",
        latencyMs,
      };
    }

    const data = await res.json();

    if (!res.ok) {
      const errMsg = data?.error?.message ?? `HTTP ${res.status}`;
      return {
        status:    "failed",
        imageUrl:  null,
        prompt:    request.prompt,
        error:     errMsg,
        latencyMs,
      };
    }

    const imageUrl = data?.data?.[0]?.url ?? null;
    const revisedPrompt = data?.data?.[0]?.revised_prompt ?? request.prompt;

    if (!imageUrl) {
      return {
        status:    "failed",
        imageUrl:  null,
        prompt:    revisedPrompt,
        error:     "No image URL in response",
        latencyMs,
      };
    }

    return {
      status:    "completed",
      imageUrl,
      prompt:    revisedPrompt,
      error:     null,
      latencyMs,
    };
  } catch (err) {
    return {
      status:    "failed",
      imageUrl:  null,
      prompt:    request.prompt,
      error:     err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - start,
    };
  }
}

// ── Retry wrapper ───────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Generate an image with automatic retry on transient failures.
 */
export async function generateImageWithRetry(
  request: ImageGenerationRequest,
  maxRetries = MAX_RETRIES
): Promise<ImageGenerationResult> {
  let lastResult: ImageGenerationResult | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await generateImage(request);

    if (result.status === "completed" || result.status === "not_configured") {
      return result;
    }

    lastResult = result;

    // Retry on rate limit or transient failure
    if (attempt < maxRetries) {
      const backoff = result.status === "rate_limited" ? 5000 : 2000 * Math.pow(2, attempt);
      console.warn(`[Image generation] Retry ${attempt + 1}/${maxRetries} in ${backoff}ms: ${result.error}`);
      await sleep(backoff);
    }
  }

  return lastResult!;
}
