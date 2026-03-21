// lib/imageVariation/engine.ts
// Core orchestrator for image variation generation.
//
// Functions:
//   buildImageVariationRequest()          — assemble request from inputs
//   generateImageVariationCandidates()    — run generation end-to-end
//   normalizeImageVariationCandidates()   — validate, dedup, link candidates
//   summarizeImageVariationGeneration()   — aggregate summary for UI
//
// Architecture:
//   - Context assembly → prompt building → provider execution → normalization
//   - Persists request + candidates to ImageVariationRequest table
//   - Safe fallbacks at every stage — never throws, always returns a result

import { prisma } from "../db";
import type { CreativePerformanceSnapshot } from "../creativelab/types";
import type {
  ImageVariationContext,
  ImageVariationCandidate,
  ImageVariationCandidateSet,
  ImageVariationGenerationSummary,
  ImageVariationIntent,
  ImageVariationConstraint,
  ImageVariationRequest,
} from "./types";
import { IMAGE_VARIATION_INTENTS } from "./types";
import { buildImageVariationContext } from "./context";
import { buildImageVariationPrompt }  from "./prompts";
import { resolveImageVariationProvider } from "./providers";

// ---------------------------------------------------------------------------
// Public: buildImageVariationRequest
// ---------------------------------------------------------------------------

export function buildImageVariationRequest(opts: {
  clientAccountId:  string;
  campaignId?:      string | null;
  creativeId?:      string | null;
  intent:           ImageVariationIntent;
  triggerType:      "fatigue" | "underperformance" | "opportunity" | "manual";
  candidateCount?:  number;
  constraints?:     ImageVariationConstraint[];
  sourceAssetUrl?:  string | null;
  recommendationId?: string | null;
}): ImageVariationRequest {
  return {
    clientAccountId:  opts.clientAccountId,
    campaignId:       opts.campaignId   ?? null,
    creativeId:       opts.creativeId   ?? null,
    intent:           opts.intent,
    triggerType:      opts.triggerType,
    candidateCount:   opts.candidateCount ?? 3,
    constraints:      opts.constraints   ?? [],
    sourceAssetUrl:   opts.sourceAssetUrl ?? null,
    recommendationId: opts.recommendationId ?? null,
  };
}

// ---------------------------------------------------------------------------
// Public: generateImageVariationCandidates
// Main entry point — runs the full generation pipeline.
// ---------------------------------------------------------------------------

export type ImageVariationEngineResult = {
  ok:        true;
  requestId: string;
  candidates: ImageVariationCandidate[];
  summary:    ImageVariationGenerationSummary;
} | {
  ok:        false;
  error:     string;
  retryable: boolean;
};

export async function generateImageVariationCandidates(
  request:  ImageVariationRequest,
  snapshot: CreativePerformanceSnapshot,
): Promise<ImageVariationEngineResult> {
  const startedAt = Date.now();

  // 1. Build context
  let context: ImageVariationContext;
  try {
    context = await buildImageVariationContext({
      snapshot,
      triggerType:      request.triggerType,
      intent:           request.intent,
      constraints:      request.constraints,
      sourceAsset:      { url: request.sourceAssetUrl },
      recommendationId: request.recommendationId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Context build failed: ${msg}`, retryable: false };
  }

  // 2. Build prompt
  const prompt = buildImageVariationPrompt(context, request.candidateCount);

  // 3. Create DB record (pending)
  let dbRecordId: string;
  try {
    const record = await prisma.imageVariationRequest.create({
      data: {
        clientAccountId: request.clientAccountId,
        campaignId:      request.campaignId,
        creativeId:      request.creativeId,
        sourceAssetUrl:  request.sourceAssetUrl,
        variationIntent: request.intent,
        triggerType:     request.triggerType,
        triggerRationale: context.triggerRationale,
        provider:        "pending",
        status:          "generating",
        promptJson:      JSON.stringify(prompt),
        contextJson:     JSON.stringify(context),
      },
    });
    dbRecordId = record.id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Database error: ${msg}`, retryable: false };
  }

  // 4. Resolve provider and generate
  const provider = resolveImageVariationProvider();
  const providerResult = await provider.generateVariations(
    context, prompt, request.candidateCount,
  );

  if (!providerResult.ok) {
    // Update DB with failure
    await prisma.imageVariationRequest.update({
      where: { id: dbRecordId },
      data: {
        status:       "failed",
        provider:     provider.name,
        errorMessage: providerResult.error,
        completedAt:  new Date(),
      },
    }).catch(() => null);

    return {
      ok:        false,
      error:     providerResult.error,
      retryable: providerResult.retryable,
    };
  }

  // 5. Normalize and deduplicate
  const candidates = normalizeImageVariationCandidates(
    providerResult.candidates,
    context,
  );

  // 6. Build summary
  const summary = summarizeImageVariationGeneration(
    dbRecordId,
    candidates,
    context,
    provider.name,
    providerResult.latencyMs,
  );

  // 7. Update DB with results
  const status = candidates.length >= request.candidateCount ? "completed"
    : candidates.length > 0 ? "partial"
    : "failed";

  await prisma.imageVariationRequest.update({
    where: { id: dbRecordId },
    data: {
      status,
      provider:       provider.name,
      candidateCount: candidates.length,
      candidatesJson: JSON.stringify(candidates),
      summaryJson:    JSON.stringify(summary),
      tokensUsed:     providerResult.tokensUsed,
      latencyMs:      providerResult.latencyMs,
      completedAt:    new Date(),
    },
  }).catch(() => null);

  return {
    ok:        true,
    requestId: dbRecordId,
    candidates,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Public: normalizeImageVariationCandidates
// Validates, deduplicates, and links candidates back to source.
// ---------------------------------------------------------------------------

export function normalizeImageVariationCandidates(
  candidates: ImageVariationCandidate[],
  context:    ImageVariationContext,
): ImageVariationCandidate[] {
  const seen = new Set<string>();
  const normalized: ImageVariationCandidate[] = [];

  for (const c of candidates) {
    // Skip empty concepts
    if (!c.conceptSummary || c.conceptSummary.length < 10) continue;

    // Deduplicate by concept summary (first 80 chars)
    const deduKey = c.conceptSummary.slice(0, 80).toLowerCase().trim();
    if (seen.has(deduKey)) continue;
    seen.add(deduKey);

    // Ensure linkage
    normalized.push({
      ...c,
      sourceCreativeId: c.sourceCreativeId ?? context.creativeId,
      sourceAssetUrl:   c.sourceAssetUrl   ?? context.sourceAsset.url,
      campaignId:       c.campaignId       ?? context.campaignId,
      clientAccountId:  c.clientAccountId  || context.clientAccountId,
      intent:           c.intent           || context.intent,
    });
  }

  return normalized;
}

// ---------------------------------------------------------------------------
// Public: summarizeImageVariationGeneration
// ---------------------------------------------------------------------------

export function summarizeImageVariationGeneration(
  requestId:     string,
  candidates:    ImageVariationCandidate[],
  context:       ImageVariationContext,
  provider:      string,
  latencyMs:     number | null,
): ImageVariationGenerationSummary {
  const intentInfo = IMAGE_VARIATION_INTENTS[context.intent];
  const warnings: string[] = [];

  if (candidates.length === 0) {
    warnings.push("No candidates generated — check provider configuration.");
  }

  if (context.dataQuality === "sparse") {
    warnings.push("Sparse performance data — concepts are broadly framed.");
  }

  if (!context.sourceAsset.url) {
    warnings.push("No source image available — concepts generated from context only.");
  }

  // Check for near-duplicate titles
  const titles = candidates.map((c) => c.title.toLowerCase());
  const uniqueTitles = new Set(titles);
  if (uniqueTitles.size < titles.length) {
    warnings.push("Some candidates have similar titles — review for visual distinctness.");
  }

  return {
    requestId,
    clientName:       context.clientName,
    intent:           context.intent,
    intentLabel:      intentInfo.label,
    candidateCount:   candidates.length,
    provider,
    triggerType:      context.triggerType,
    triggerRationale: context.triggerRationale,
    dataQuality:      context.dataQuality,
    generatedAt:      new Date().toISOString(),
    latencyMs,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Public: getImageVariationHistory
// Loads past requests for a client or creative.
// ---------------------------------------------------------------------------

export async function getImageVariationHistory(opts: {
  clientAccountId?: string;
  creativeId?:      string;
  limit?:           number;
}): Promise<Array<{
  id:              string;
  variationIntent: string;
  triggerType:     string;
  status:          string;
  candidateCount:  number;
  provider:        string;
  createdAt:       Date;
}>> {
  const where: Record<string, unknown> = {};
  if (opts.clientAccountId) where.clientAccountId = opts.clientAccountId;
  if (opts.creativeId)      where.creativeId      = opts.creativeId;

  return prisma.imageVariationRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take:    opts.limit ?? 10,
    select: {
      id:              true,
      variationIntent: true,
      triggerType:     true,
      status:          true,
      candidateCount:  true,
      provider:        true,
      createdAt:       true,
    },
  });
}

// ---------------------------------------------------------------------------
// Public: getImageVariationRequestById
// ---------------------------------------------------------------------------

export async function getImageVariationRequestById(
  id: string,
): Promise<{
  id:              string;
  variationIntent: string;
  triggerType:     string;
  triggerRationale: string;
  status:          string;
  candidateCount:  number;
  provider:        string;
  candidates:      ImageVariationCandidate[];
  summary:         ImageVariationGenerationSummary | null;
  context:         ImageVariationContext | null;
  createdAt:       Date;
} | null> {
  const record = await prisma.imageVariationRequest.findUnique({
    where: { id },
  });

  if (!record) return null;

  let candidates: ImageVariationCandidate[] = [];
  let summary: ImageVariationGenerationSummary | null = null;
  let context: ImageVariationContext | null = null;

  try { candidates = JSON.parse(record.candidatesJson) as ImageVariationCandidate[]; } catch { /* empty */ }
  try { summary = JSON.parse(record.summaryJson) as ImageVariationGenerationSummary; } catch { /* empty */ }
  try { context = JSON.parse(record.contextJson) as ImageVariationContext; } catch { /* empty */ }

  return {
    id:               record.id,
    variationIntent:  record.variationIntent,
    triggerType:      record.triggerType,
    triggerRationale: record.triggerRationale,
    status:           record.status,
    candidateCount:   record.candidateCount,
    provider:         record.provider,
    candidates,
    summary,
    context,
    createdAt:        record.createdAt,
  };
}
