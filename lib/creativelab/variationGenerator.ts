// lib/creativelab/variationGenerator.ts
// Unified variation generation orchestrator.
//
// Calls the existing generation pipeline (creative-engine context builder +
// Anthropic/mock provider) for copy, and optionally the DALL-E pipeline
// for real image generation from uploaded assets.
//
// Persists results to AIGenerationJob for durability and review handoff.

import { randomUUID } from "crypto";
import { prisma } from "../db";
import { buildCreativeGenerationContext } from "../creativeGeneration/context";
import {
  generateCreativeCopyBlocks,
  generateCreativeConcepts,
} from "../creativeGeneration/concepts";
import {
  buildImagePrompt,
  generateImageWithRetry,
} from "./imageGeneration";
import { downloadAndStoreGeneratedImage } from "./storage";
import type { CreativePerformanceSnapshot } from "./types";
import type {
  CreativeVariationRequest,
  CreativeVariationSource,
  CopyVariationCandidate,
  ImageVariationCandidate,
  UnifiedVariationSet,
  CreativeVariationSummary,
} from "../../types/creativeVariation";

// ---------------------------------------------------------------------------
// Source → Snapshot converter
// ---------------------------------------------------------------------------

function sourceToSnapshot(source: CreativeVariationSource): CreativePerformanceSnapshot {
  return {
    externalCreativeId: source.sourceId,
    creativeName:       source.creativeName,
    thumbnailUrl:       source.thumbnailUrl,
    imageUrl:           source.imageUrl,
    adTitle:            null,
    adCopy:             source.sourceCopy,
    callToAction:       source.sourceCallToAction,
    externalCampaignId: "variation_gen",
    campaignName:       source.campaignName ?? "Variation Generation",
    clientAccountId:    source.clientAccountId ?? "unknown",
    clientName:         source.clientName ?? "Unknown",
    spend:              source.spend,
    impressions:        0,
    clicks:             0,
    avgCtr:             source.ctr,
    avgFrequency:       source.frequency,
    campaignRoas:       source.roas,
    campaignCpa:        source.cpa,
    evaluationStatus:   source.evaluationStatus as CreativePerformanceSnapshot["evaluationStatus"],
  };
}

// ---------------------------------------------------------------------------
// Copy generation
// ---------------------------------------------------------------------------

async function generateCopyVariations(
  source: CreativeVariationSource,
  count: number,
): Promise<CopyVariationCandidate[]> {
  const snapshot = sourceToSnapshot(source);

  const triggerType =
    source.evaluationStatus === "fatigued"     ? "fatigue" as const
    : source.evaluationStatus === "weak"       ? "underperformance" as const
    : source.evaluationStatus === "strong"     ? "opportunity" as const
    : "manual" as const;

  const context = await buildCreativeGenerationContext({
    snapshot,
    triggerType,
    roasGoal:  source.roas ? Math.max(source.roas * 1.2, 2.0) : undefined,
    cpaGoal:   source.cpa ? source.cpa * 0.8 : undefined,
  });

  const blocks = await generateCreativeCopyBlocks(context);

  return blocks.slice(0, count).map((block) => ({
    id:            block.id ?? randomUUID(),
    hook:          typeof block.hook === "object" ? block.hook.text : String(block.hook ?? ""),
    body:          block.body ?? "",
    callToAction:  block.callToAction ?? source.sourceCallToAction ?? "Shop Now",
    angle:         typeof block.angle === "object" ? block.angle.name : String(block.angle ?? ""),
    rationale:     "",
    status:        "completed" as const,
  }));
}

// ---------------------------------------------------------------------------
// Image generation
// ---------------------------------------------------------------------------

async function generateImageVariations(
  source: CreativeVariationSource,
  count: number,
): Promise<ImageVariationCandidate[]> {
  const snapshot = sourceToSnapshot(source);

  const triggerType =
    source.evaluationStatus === "fatigued" ? "fatigue" as const : "manual" as const;

  const context = await buildCreativeGenerationContext({
    snapshot,
    triggerType,
  });

  // Generate concepts (which include image briefs)
  let concepts = await generateCreativeConcepts(context);

  // If concepts came back without image briefs (e.g. the AI only returned
  // copy variants for the full_refresh_package), fall back to generating
  // image_brief_variations directly and wrapping them as concepts.
  const hasAnyImageBrief = concepts.some((c) => c.imageBrief != null);
  if (concepts.length === 0 || !hasAnyImageBrief) {
    const { generateCreativeVariants } = await import("../creativeGeneration/concepts");
    const imageVariants = await generateCreativeVariants(context, "image_brief_variations");
    if (imageVariants.length > 0) {
      concepts = imageVariants.map((v) => ({
        id:                   v.id,
        title:                v.title,
        angle:                { id: v.id, name: v.angle ?? "Direct", type: "outcome" as const, rationale: "", performanceSignal: "" },
        copyBlock:            { id: v.id, hook: { id: v.id, text: "", type: "outcome_led" as const, angle: "", wordCount: 0, charCount: 0 }, body: "", callToAction: "", angle: { id: v.id, name: "", type: "outcome" as const, rationale: "", performanceSignal: "" }, wordCount: 0, platformReady: true },
        imageBrief:           {
          conceptSummary:      v.conceptSummary      ?? "",
          visualChanges:       v.visualChanges        ?? "",
          goal:                v.goal                 ?? "",
          directResponseAngle: v.directResponseAngle  ?? "",
        },
        performanceRationale: v.performanceRationale ?? "",
        triggerLink:          "",
        estimatedScore:       50,
      }));
    }
  }

  const candidates: ImageVariationCandidate[] = [];

  for (const concept of concepts.slice(0, count)) {
    const imageBrief = concept.imageBrief;
    if (!imageBrief) continue;

    const candidate: ImageVariationCandidate = {
      id:                   randomUUID(),
      title:                concept.title ?? "Image Variation",
      conceptSummary:       imageBrief.conceptSummary ?? "",
      visualChanges:        imageBrief.visualChanges ? [imageBrief.visualChanges] : [],
      goal:                 imageBrief.goal ?? "",
      directResponseAngle:  imageBrief.directResponseAngle ?? "",
      generatedImagePath:   null,
      generationPrompt:     null,
      status:               "completed",
      generationError:      null,
    };

    // Only attempt DALL-E generation for uploaded assets that have a real image
    if (source.type === "uploaded_asset" && source.imageUrl) {
      try {
        const prompt = buildImagePrompt(
          {
            title:          concept.title,
            conceptSummary: imageBrief.conceptSummary,
            visualChanges:  imageBrief.visualChanges,
            goal:           imageBrief.goal,
          },
          // Pass source analysis context if available
          undefined,
        );

        candidate.generationPrompt = prompt;

        const result = await generateImageWithRetry({ prompt });

        if (result.status === "completed" && result.imageUrl) {
          const stored = await downloadAndStoreGeneratedImage(
            candidate.id,
            result.imageUrl,
          );
          candidate.generatedImagePath = stored.storagePath;
        } else {
          candidate.generationError = result.error ?? "Image generation failed";
          candidate.status = "failed";
        }
      } catch (err) {
        candidate.generationError = err instanceof Error ? err.message : "Image generation error";
        candidate.status = "failed";
      }
    }

    candidates.push(candidate);
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// Persistence — stores to AIGenerationJob
// ---------------------------------------------------------------------------

async function persistVariationSet(
  set: UnifiedVariationSet,
): Promise<string> {
  const job = await prisma.aIGenerationJob.create({
    data: {
      entityType:       set.source.type === "uploaded_asset" ? "uploaded_asset" : "ad",
      entityId:         set.source.sourceId,
      requestType:      set.intent === "copy_only" ? "copy" : set.intent === "image_only" ? "image" : "copy",
      provider:         set.provider,
      status:           set.status === "completed" ? "completed" : "failed",
      startedAt:        new Date(),
      completedAt:      new Date(),
      errorMessage:     set.error,
      responseSnapshot: JSON.stringify({
        intent:          set.intent,
        copyVariations:  set.copyVariations,
        imageVariations: set.imageVariations,
        source: {
          sourceId:        set.source.sourceId,
          type:            set.source.type,
          clientAccountId: set.source.clientAccountId,
          creativeName:    set.source.creativeName,
        },
      }),
    },
  });

  return job.id;
}

// ---------------------------------------------------------------------------
// Public API: unified generation
// ---------------------------------------------------------------------------

export async function generateUnifiedVariationSet(
  request: CreativeVariationRequest,
): Promise<UnifiedVariationSet> {
  const startMs = Date.now();
  const setId   = randomUUID();

  const copyCount  = request.copyCount ?? 3;
  const imageCount = request.imageCount ?? 3;

  let copyVariations:  CopyVariationCandidate[]  = [];
  let imageVariations: ImageVariationCandidate[] = [];
  let error: string | null = null;
  let provider = "anthropic";

  try {
    // Copy generation
    if (request.intent === "copy_only" || request.intent === "copy_and_image") {
      copyVariations = await generateCopyVariations(request.source, copyCount);
    }

    // Image generation
    if (request.intent === "image_only" || request.intent === "copy_and_image") {
      imageVariations = await generateImageVariations(request.source, imageCount);
      if (imageVariations.some((v) => v.generatedImagePath)) {
        provider = "anthropic+openai_dalle3";
      }
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "Generation failed";
  }

  const hasAnyResult = copyVariations.length > 0 || imageVariations.length > 0;
  const allFailed    = !hasAnyResult && error != null;

  const set: UnifiedVariationSet = {
    id:              setId,
    source:          request.source,
    intent:          request.intent,
    copyVariations,
    imageVariations,
    status:          allFailed ? "failed" : "completed",
    provider,
    generatedAt:     new Date().toISOString(),
    error,
  };

  // Persist to DB
  try {
    const jobId = await persistVariationSet(set);
    set.id = jobId; // use the DB job ID as the set ID
  } catch (persistErr) {
    console.error("[variationGenerator] persistence failed:", persistErr);
    // Don't fail the whole request — variants are still returned to the UI
  }

  return set;
}

// ---------------------------------------------------------------------------
// Summary builder
// ---------------------------------------------------------------------------

export function summarizeVariationGeneration(
  set: UnifiedVariationSet,
  durationMs: number,
): CreativeVariationSummary {
  return {
    totalCopy:     set.copyVariations.length,
    totalImage:    set.imageVariations.length,
    completedCopy: set.copyVariations.filter((v) => v.status === "completed").length,
    completedImage: set.imageVariations.filter((v) => v.status === "completed").length,
    failedCopy:    set.copyVariations.filter((v) => v.status === "failed").length,
    failedImage:   set.imageVariations.filter((v) => v.status === "failed").length,
    provider:      set.provider,
    durationMs,
  };
}
