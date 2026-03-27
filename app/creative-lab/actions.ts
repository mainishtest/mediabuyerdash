"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../../lib/db";
import { getCopyProvider, getImageProvider } from "../../lib/aiProvider";
import { runRealGenerationPipeline } from "../../lib/pipeline";
import {
  persistGenerationRun,
  setGenerationApproval,
  setSelectedVariant
} from "../../lib/generationPersistence";
import {
  getOpenAIConfig,
  getAnthropicConfig,
} from "../../lib/providerExecution";
import type { CreativeLabEntry } from "../../types/creativeDiagnosis";
import type { CreativeApprovalStatus } from "../../types/aiProvider";
import type { MockGenerationPipelineResult } from "../../types/pipeline";

// ── Copy generation ──────────────────────────────────────────────────────────

export async function generateCopyVariationsAction(entry: CreativeLabEntry) {
  const { input, diagnosis } = entry;
  const provider = getCopyProvider("anthropic");

  const request = {
    adId:              input.adId,
    adName:            input.adName,
    campaignId:        input.campaignId,
    campaignName:      input.campaignName,
    performanceSummary: {
      actualCpa:      input.actualCpa,
      actualRoas:     input.actualRoas,
      cpaGoalValue:   input.cpaGoalValue,
      roasGoalValue:  input.roasGoalValue,
      spend:          input.spend,
      conversions:    input.conversions
    },
    diagnosisResult:   diagnosis,
    existingCopy:     input.copy,
    requestedCount:   3
  };

  let response: Awaited<ReturnType<typeof provider.generateCopyVariations>>;
  try {
    response = await provider.generateCopyVariations(request);
  } catch (err) {
    throw new Error(`Copy generation failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const job = await prisma.aIGenerationJob.create({
    data: {
      entityType:       "ad",
      entityId:         input.adId,
      requestType:      "copy",
      provider:         response.provider,
      status:           response.status,
      startedAt:        new Date(response.createdAt),
      completedAt:      response.status === "completed" ? new Date() : null,
      errorMessage:     response.errorMessage ?? null,
      responseSnapshot: JSON.stringify(response.generatedVariations)
    }
  });

  revalidatePath("/creative-lab");
  return {
    jobId:   job.id,
    job,
    response
  };
}

// ── Image variation generation ────────────────────────────────────────────────

export async function generateImageVariationsAction(entry: CreativeLabEntry) {
  const { input, diagnosis } = entry;
  const provider = getImageProvider("openai");

  const request = {
    adId:              input.adId,
    adName:            input.adName,
    campaignId:        input.campaignId,
    campaignName:      input.campaignName,
    performanceSummary: {
      actualCpa:      input.actualCpa,
      actualRoas:     input.actualRoas,
      cpaGoalValue:   input.cpaGoalValue,
      roasGoalValue:  input.roasGoalValue,
      spend:          input.spend,
      conversions:    input.conversions
    },
    diagnosisResult:   diagnosis,
    existingImage:    input.image,
    requestedCount:    3
  };

  let response: Awaited<ReturnType<typeof provider.generateImageVariations>>;
  try {
    response = await provider.generateImageVariations(request);
  } catch (err) {
    throw new Error(`Image generation failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const job = await prisma.aIGenerationJob.create({
    data: {
      entityType:       "ad",
      entityId:         input.adId,
      requestType:      "image",
      provider:         response.provider,
      status:           response.status,
      startedAt:        new Date(response.createdAt),
      completedAt:      response.status === "completed" ? new Date() : null,
      errorMessage:     response.errorMessage ?? null,
      responseSnapshot: JSON.stringify(response.generatedConcepts)
    }
  });

  revalidatePath("/creative-lab");
  return {
    jobId:   job.id,
    job,
    response
  };
}

// ── Approval ──────────────────────────────────────────────────────────────────

export async function setApprovalAction(
  jobId:       string,
  variationId:  string,
  entityType:   "copy" | "image",
  adId:         string,
  status:       CreativeApprovalStatus
) {
  const now = new Date();

  await prisma.creativeApproval.upsert({
    where: {
      jobId_variationId: { jobId, variationId }
    },
    update: {
      status,
      approvedAt: status === "approved" ? now : null,
      rejectedAt: status === "rejected" ? now : null,
      updatedAt:  now
    },
    create: {
      jobId,
      variationId,
      entityType,
      adId,
      status,
      approvedAt: status === "approved" ? now : null,
      rejectedAt: status === "rejected" ? now : null
    }
  });

  revalidatePath("/creative-lab");
}

// ── Real generation pipeline ──────────────────────────────────────────────────

export async function runRealPipelineAction(
  entry: CreativeLabEntry,
  requestType: "copy_generation" | "image_variation_generation",
  provider: "openai_text" | "anthropic_text" | "image_provider_placeholder"
): Promise<MockGenerationPipelineResult> {
  try {
    return await runRealGenerationPipeline({ entry, requestType, provider });
  } catch (err) {
    throw new Error(`Pipeline failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ── Generation persistence & audit trail ─────────────────────────────────────

export async function persistGenerationRunAction(
  result: MockGenerationPipelineResult,
  entry: CreativeLabEntry,
  mode: "mock" | "real"
) {
  const persisted = await persistGenerationRun(result, entry, mode);
  if (persisted) revalidatePath("/creative-lab");
  if (persisted) revalidatePath("/creative-history");
  return persisted;
}

export async function setGenerationApprovalAction(
  runId: string,
  variationId: string,
  variationType: "copy" | "image",
  decision: "approved" | "rejected"
) {
  await setGenerationApproval(runId, variationId, variationType, decision);
  revalidatePath("/creative-lab");
  revalidatePath("/creative-history");
}

export async function setSelectedVariantAction(
  runId: string,
  variationId: string,
  variationType: "copy" | "image"
) {
  await setSelectedVariant(runId, variationId, variationType);
  revalidatePath("/creative-lab");
  revalidatePath("/creative-history");
}

// ── Provider config status ────────────────────────────────────────────────────

export async function getProviderConfigStatusAction() {
  const openai = getOpenAIConfig();
  const anthropic = getAnthropicConfig();
  return {
    openai:    { ready: openai.ready, message: openai.message },
    anthropic: { ready: anthropic.ready, message: anthropic.message },
    image:     {
      ready:   openai.ready,
      message: openai.ready
        ? "Image concepts powered by OpenAI"
        : "OPENAI_API_KEY is not set. Add it to .env.local for AI image concept generation."
    },
  };
}
