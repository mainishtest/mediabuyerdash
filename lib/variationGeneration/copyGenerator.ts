// ─────────────────────────────────────────────────────────────────────────────
// Copy Variation Generator
// ─────────────────────────────────────────────────────────────────────────────
// Generates copy variations using the same Anthropic/OpenAI providers already
// wired up in the quick-generate route. This module builds the prompt from
// the source context and calls the appropriate provider.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  VariationSourceContext,
  CopyVariationCandidate,
  CreativeVariationError,
} from "../../types/variationGeneration";

interface CopyGenerationResult {
  ok: boolean;
  variations: CopyVariationCandidate[];
  provider: string;
  tokensUsed?: number;
  error?: CreativeVariationError;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate copy variations from a fully-assembled source context.
 * Calls the internal quick-generate API to reuse existing provider logic.
 */
export async function generateCopyVariationsFromSource(
  ctx: VariationSourceContext,
  options: {
    provider?: "anthropic" | "openai";
    variationCount?: number;
    notes?: string;
    baseUrl?: string;
  } = {}
): Promise<CopyGenerationResult> {
  const {
    provider = "anthropic",
    variationCount = 3,
    notes,
    baseUrl = "",
  } = options;

  const { source } = ctx;

  // Validate: need at least some copy to vary on
  if (!source.hook && !source.bodyText && !source.callToAction) {
    return {
      ok: false,
      variations: [],
      provider,
      error: {
        code: "missing_source",
        message: "No source copy provided. Upload copy or select an ad with existing copy.",
        retryable: false,
      },
    };
  }

  try {
    // Build enriched notes with context
    const enrichedNotes = buildEnrichedNotes(ctx, notes);

    // Call the existing quick-generate API route
    const response = await fetch(`${baseUrl}/api/creative-lab/quick-generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hook: source.hook || "",
        bodyText: source.bodyText || "",
        cta: source.callToAction || "",
        imageHeadline: source.imageHeadline || "",
        clientAccountId: source.clientAccountId,
        clientName: source.clientName || "",
        campaignName: source.sourceCampaignName || "",
        provider,
        notes: enrichedNotes,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.variations) {
      return {
        ok: false,
        variations: [],
        provider,
        error: {
          code: "provider_failure",
          message: data.error || "Copy generation failed",
          retryable: true,
          details: data.rawAiResponse,
        },
      };
    }

    // Map API response to candidates
    const variations: CopyVariationCandidate[] = (data.variations as Array<{
      title?: string;
      hook?: string;
      body?: string;
      callToAction?: string;
      angle?: string;
    }>)
      .slice(0, variationCount)
      .map((v, i) => ({
        title: v.title || `Variation ${i + 1}`,
        hook: v.hook || "",
        body: v.body || "",
        callToAction: v.callToAction || source.callToAction || "",
        angle: v.angle,
      }));

    return {
      ok: true,
      variations,
      provider: data.provider || provider,
      tokensUsed: data.tokensUsed,
    };
  } catch (err) {
    return {
      ok: false,
      variations: [],
      provider,
      error: {
        code: "provider_failure",
        message: err instanceof Error ? err.message : "Copy generation failed",
        retryable: true,
      },
    };
  }
}

// ── Prompt enrichment ───────────────────────────────────────────────────────

function buildEnrichedNotes(
  ctx: VariationSourceContext,
  userNotes?: string
): string {
  const parts: string[] = [];

  // User-provided notes first
  if (userNotes) parts.push(userNotes);

  // Performance context
  if (ctx.performance) {
    const perf = ctx.performance;
    const perfParts: string[] = [];
    if (perf.ctr !== undefined) perfParts.push(`CTR: ${perf.ctr.toFixed(2)}%`);
    if (perf.roas !== undefined) perfParts.push(`ROAS: ${perf.roas.toFixed(2)}x`);
    if (perf.cpa !== undefined) perfParts.push(`CPA: $${perf.cpa.toFixed(2)}`);
    if (perf.frequency !== undefined) perfParts.push(`Frequency: ${perf.frequency.toFixed(1)}x`);
    if (perfParts.length > 0) {
      parts.push(`Current performance: ${perfParts.join(", ")}`);
    }
    if (perf.fatigueStatus && perf.fatigueStatus !== "healthy") {
      parts.push(`Fatigue status: ${perf.fatigueStatus}. This creative needs fresh angles.`);
    }
  }

  // Learning insights
  if (ctx.learnings.length > 0) {
    const topLearnings = ctx.learnings
      .slice(0, 5)
      .map((l) => `- ${l.insightText}`)
      .join("\n");
    parts.push(`Proven learnings to apply:\n${topLearnings}`);
  }

  // Client-specific copywriting prompt (already handled by the quick-generate route
  // via client lookup, but we note it here if present)
  if (ctx.clientCopywritingPrompt) {
    parts.push(`Additional client guidelines already loaded.`);
  }

  return parts.join("\n\n");
}
