// ─────────────────────────────────────────────────────────────────────────────
// Image Variation Generator
// ─────────────────────────────────────────────────────────────────────────────
// Generates image variation concepts and optionally renders them using the
// existing Flux Pro / DALL-E providers wired up in the quick-generate images
// API routes. This module:
//   1. Calls the concept generation API (Anthropic/OpenAI) to get 3 concepts
//   2. Optionally renders each concept into an actual image via Flux/DALL-E
// ─────────────────────────────────────────────────────────────────────────────

import type {
  VariationSourceContext,
  ImageVariationCandidate,
  CreativeVariationError,
} from "../../types/variationGeneration";

interface ImageGenerationResult {
  ok: boolean;
  variations: ImageVariationCandidate[];
  provider: string;
  error?: CreativeVariationError;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate image variation concepts from a fully-assembled source context.
 * Calls the existing quick-generate/images API to reuse provider logic.
 *
 * Returns concepts that can later be individually rendered via renderImageConcept().
 */
export async function generateImageVariationsFromSource(
  ctx: VariationSourceContext,
  options: {
    provider?: "anthropic" | "openai";
    variationCount?: number;
    notes?: string;
    baseUrl?: string;
  } = {}
): Promise<ImageGenerationResult> {
  const {
    provider = "anthropic",
    variationCount = 3,
    notes,
    baseUrl = "",
  } = options;

  const { source } = ctx;

  // Validate: need an image to vary on
  if (!source.imageUrl) {
    return {
      ok: false,
      variations: [],
      provider,
      error: {
        code: "missing_source_image",
        message: "No source image provided. Upload an image or select an ad with an image.",
        retryable: false,
      },
    };
  }

  try {
    // Build enriched description with context
    const imageDescription = buildImageDescription(ctx, notes);

    // Call the existing image concept generation API
    const response = await fetch(`${baseUrl}/api/creative-lab/quick-generate/images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentImageDescription: imageDescription,
        productName: source.clientName || "Product",
        adCopy: [source.hook, source.bodyText].filter(Boolean).join(" — "),
        clientAccountId: source.clientAccountId,
        clientName: source.clientName || "",
        notes: notes || "",
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.concepts) {
      return {
        ok: false,
        variations: [],
        provider,
        error: {
          code: "provider_failure",
          message: data.error || "Image concept generation failed",
          retryable: true,
        },
      };
    }

    // Map API response to candidates
    const variations: ImageVariationCandidate[] = (data.concepts as Array<{
      title?: string;
      concept?: string;
      whyItWorks?: string;
      textOverlay?: string;
      colorDirection?: string;
    }>)
      .slice(0, variationCount)
      .map((c, i) => ({
        title: c.title || `Concept ${i + 1}`,
        conceptSummary: c.concept || "",
        visualChanges: c.whyItWorks || "",
        goal: "Improve engagement through visual differentiation",
        textOverlay: c.textOverlay,
        colorDirection: c.colorDirection,
        rendered: false,
      }));

    return {
      ok: true,
      variations,
      provider: data.provider || provider,
    };
  } catch (err) {
    return {
      ok: false,
      variations: [],
      provider,
      error: {
        code: "provider_failure",
        message: err instanceof Error ? err.message : "Image concept generation failed",
        retryable: true,
      },
    };
  }
}

/**
 * Render a single image concept into an actual image using Flux Pro / DALL-E.
 * Called individually per concept (since rendering is expensive).
 */
export async function renderImageConcept(
  concept: ImageVariationCandidate,
  source: {
    imageUrl?: string;
    clientAccountId: string;
    clientName?: string;
  },
  options: { baseUrl?: string } = {}
): Promise<{
  ok: boolean;
  imageUrl?: string;
  error?: CreativeVariationError;
}> {
  const { baseUrl = "" } = options;

  try {
    const response = await fetch(
      `${baseUrl}/api/creative-lab/quick-generate/images/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concept: concept.conceptSummary,
          title: concept.title,
          textOverlay: concept.textOverlay || "",
          colorDirection: concept.colorDirection || "",
          productName: source.clientName || "Product",
          productImageUrl: source.imageUrl || "",
          clientAccountId: source.clientAccountId,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok || !data.imageUrl) {
      return {
        ok: false,
        error: {
          code: "provider_failure",
          message: data.error || "Image rendering failed",
          retryable: true,
        },
      };
    }

    return { ok: true, imageUrl: data.imageUrl };
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "provider_failure",
        message: err instanceof Error ? err.message : "Image rendering failed",
        retryable: true,
      },
    };
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildImageDescription(
  ctx: VariationSourceContext,
  userNotes?: string
): string {
  const parts: string[] = [];

  if (ctx.source.imageDescription) {
    parts.push(ctx.source.imageDescription);
  } else {
    parts.push("Current ad image for direct-response advertising.");
  }

  if (ctx.performance?.fatigueStatus && ctx.performance.fatigueStatus !== "healthy") {
    parts.push(
      `This creative shows ${ctx.performance.fatigueStatus} — the visual needs fresh differentiation.`
    );
  }

  if (ctx.clientImageDirections) {
    parts.push(`Brand image guidelines: ${ctx.clientImageDirections}`);
  }

  if (userNotes) parts.push(userNotes);

  return parts.join(" ");
}
