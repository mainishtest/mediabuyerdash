// ─────────────────────────────────────────────────────────────────────────────
// Unified Variation Generator
// ─────────────────────────────────────────────────────────────────────────────
// Orchestrates the full variation generation flow:
//   1. Build source context (performance, learnings, client directions)
//   2. Run copy generation (if requested)
//   3. Run image concept generation (if requested)
//   4. Persist candidates to the database
//   5. Return unified result set
//
// Copy and image generation run in parallel when intent is "both".
// ─────────────────────────────────────────────────────────────────────────────

import { buildVariationSourceContext } from "./sourceContext";
import { generateCopyVariationsFromSource } from "./copyGenerator";
import { generateImageVariationsFromSource } from "./imageGenerator";
import { persistVariationCandidates } from "./persistence";
import type {
  CreativeVariationRequest,
  UnifiedVariationSet,
  CopyVariationCandidate,
  ImageVariationCandidate,
  CreativeVariationStatus,
  CreativeVariationError,
} from "../../types/variationGeneration";

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Run the complete unified variation generation flow.
 * This is the single entry point called by the API route.
 */
export async function generateUnifiedVariationSet(
  request: CreativeVariationRequest,
  options: { baseUrl?: string } = {}
): Promise<UnifiedVariationSet> {
  const startedAt = new Date().toISOString();
  const requestId = `var_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const { baseUrl = "" } = options;

  // Step 1: Build source context
  const ctx = await buildVariationSourceContext(request.source, {
    includePerformance: request.includePerformanceContext ?? true,
    includeLearnings: request.includeLearningMemory ?? true,
    includeFatigue: request.includeFatigueSignals ?? true,
  });

  // Step 2: Run generation based on intent
  let copyVariations: CopyVariationCandidate[] = [];
  let imageVariations: ImageVariationCandidate[] = [];
  let status: CreativeVariationStatus = "generating";
  let error: CreativeVariationError | undefined;
  let tokensUsed: number | undefined;
  let provider: string = request.provider || "anthropic";

  const genOptions = {
    provider: request.provider,
    variationCount: request.variationCount ?? 3,
    notes: request.notes,
    baseUrl,
  };

  if (request.intent === "copy_variations") {
    const copyResult = await generateCopyVariationsFromSource(ctx, genOptions);
    copyVariations = copyResult.variations;
    provider = copyResult.provider;
    tokensUsed = copyResult.tokensUsed;

    if (!copyResult.ok) {
      status = "failed";
      error = copyResult.error;
    } else {
      status = "completed";
    }
  } else if (request.intent === "image_variations") {
    const imageResult = await generateImageVariationsFromSource(ctx, genOptions);
    imageVariations = imageResult.variations;
    provider = imageResult.provider;

    if (!imageResult.ok) {
      status = "failed";
      error = imageResult.error;
    } else {
      status = "completed";
    }
  } else {
    // "both" — run copy and image generation in parallel
    const [copyResult, imageResult] = await Promise.all([
      generateCopyVariationsFromSource(ctx, genOptions),
      generateImageVariationsFromSource(ctx, genOptions),
    ]);

    copyVariations = copyResult.variations;
    imageVariations = imageResult.variations;
    provider = copyResult.provider || imageResult.provider;
    tokensUsed = copyResult.tokensUsed;

    if (!copyResult.ok && !imageResult.ok) {
      status = "failed";
      error = copyResult.error || imageResult.error;
    } else if (!copyResult.ok || !imageResult.ok) {
      status = "partial";
      error = {
        code: "partial_output",
        message: `${!copyResult.ok ? "Copy" : "Image"} generation failed. ${
          !copyResult.ok ? copyResult.error?.message : imageResult.error?.message
        }`,
        retryable: true,
      };
    } else {
      status = "completed";
    }
  }

  const completedAt = new Date().toISOString();
  const latencyMs =
    new Date(completedAt).getTime() - new Date(startedAt).getTime();

  // Step 3: Persist candidates (only if we have results)
  let generationRunId: string | undefined;
  if (copyVariations.length > 0 || imageVariations.length > 0) {
    try {
      const persistResult = await persistVariationCandidates({
        clientAccountId: request.source.clientAccountId,
        campaignId: request.source.sourceCampaignId,
        adId: request.source.sourceAdId,
        adName: request.source.sourceAdName,
        sourceAssetId: request.source.sourceAssetId,
        provider,
        intent: request.intent,
        copyVariations,
        imageVariations,
      });

      generationRunId = persistResult.generationRunId;

      // Attach IDs back to candidates
      copyVariations = copyVariations.map((cv, i) => ({
        ...cv,
        id: persistResult.copyVariationIds[i],
      }));
      imageVariations = imageVariations.map((iv, i) => ({
        ...iv,
        id: persistResult.imageVariationIds[i],
      }));
    } catch (persistError) {
      // Persistence failure should not block the user from seeing results
      console.error("Variation persistence failed:", persistError);
    }
  }

  return {
    requestId,
    generationRunId,
    source: request.source,
    intent: request.intent,
    status,
    provider,
    copyVariations,
    imageVariations,
    startedAt,
    completedAt,
    latencyMs,
    tokensUsed,
    error,
  };
}
