// ─────────────────────────────────────────────────────────────────────────────
// Variation Persistence
// ─────────────────────────────────────────────────────────────────────────────
// Saves variation generation results to the database using the existing
// GenerationRun, GeneratedCopyVariation, and GeneratedImageVariation models.
// This maintains full audit trail and compatibility with the review workflow.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "../db";
import type {
  VariationPersistenceInput,
  VariationPersistenceResult,
  CopyVariationCandidate,
  ImageVariationCandidate,
  UnifiedVariationSet,
  CreativeVariationSummary,
} from "../../types/variationGeneration";

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Persist a complete generation run with all copy and image candidates.
 * Creates a GenerationRun record and related variation records.
 */
export async function persistVariationCandidates(
  input: VariationPersistenceInput
): Promise<VariationPersistenceResult> {
  const run = await prisma.generationRun.create({
    data: {
      clientAccountId: input.clientAccountId,
      campaignId: input.campaignId || "variation_gen",
      adId: input.adId || "source_asset",
      adName: input.adName || "Source Asset Variation",
      requestType: input.intent === "both" ? "unified" : input.intent,
      provider: input.provider,
      mode: "real",
      status: "completed",
      completedAt: new Date(),
    },
  });

  const copyVariationIds: string[] = [];
  const imageVariationIds: string[] = [];

  // Persist copy variations
  if (input.copyVariations.length > 0) {
    for (const cv of input.copyVariations) {
      const record = await prisma.generatedCopyVariation.create({
        data: {
          generationRunId: run.id,
          title: cv.title,
          hook: cv.hook,
          body: cv.body,
          callToAction: cv.callToAction,
          approvalStatus: "draft",
        },
      });
      copyVariationIds.push(record.id);
    }
  }

  // Persist image variations
  if (input.imageVariations.length > 0) {
    for (const iv of input.imageVariations) {
      const record = await prisma.generatedImageVariation.create({
        data: {
          generationRunId: run.id,
          title: iv.title,
          conceptSummary: iv.conceptSummary,
          visualChanges: iv.visualChanges,
          goal: iv.goal,
          approvalStatus: "draft",
        },
      });
      imageVariationIds.push(record.id);
    }
  }

  return {
    generationRunId: run.id,
    copyVariationIds,
    imageVariationIds,
  };
}

/**
 * Summarize a generation result for display in lists and summaries.
 */
export function summarizeVariationGeneration(
  result: UnifiedVariationSet
): CreativeVariationSummary {
  const sourceLabel =
    result.source.sourceAdName ||
    result.source.hook?.slice(0, 40) ||
    result.source.imageUrl?.split("/").pop() ||
    "Uploaded asset";

  return {
    requestId: result.requestId,
    sourceLabel,
    sourceType: result.source.sourceType,
    intent: result.intent,
    status: result.status,
    copyCount: result.copyVariations.length,
    imageCount: result.imageVariations.length,
    provider: result.provider,
    createdAt: result.startedAt,
    clientAccountId: result.source.clientAccountId,
    clientName: result.source.clientName,
  };
}
