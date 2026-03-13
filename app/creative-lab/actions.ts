"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../../lib/db";
import { getCopyProvider, getImageProvider } from "../../lib/aiProvider";
import type { CreativeLabEntry } from "../../types/creativeDiagnosis";
import type { CreativeApprovalStatus } from "../../types/aiProvider";

// ── Copy generation ──────────────────────────────────────────────────────────

export async function generateCopyVariationsAction(entry: CreativeLabEntry) {
  const { input, diagnosis } = entry;
  const provider = getCopyProvider("mock");

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

  const response = await provider.generateCopyVariations(request);

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
  const provider = getImageProvider("mock");

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

  const response = await provider.generateImageVariations(request);

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
