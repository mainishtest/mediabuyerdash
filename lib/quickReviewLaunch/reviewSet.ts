// ─────────────────────────────────────────────────────────────────────────────
// Quick Review — Build Review Set from Generation Run
// ─────────────────────────────────────────────────────────────────────────────
// Assembles copy and image candidates from a GenerationRun into a review-ready
// set. This is the first step in the simplified review-and-launch flow.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "../db";
import type {
  CreativeReviewSet,
  CreativeReviewCandidate,
} from "../../types/quickReviewLaunch";

/**
 * Build a review set from a generation run ID.
 * Loads the run with all its copy and image variations.
 */
export async function buildCreativeReviewSet(
  generationRunId: string
): Promise<CreativeReviewSet | null> {
  const run = await prisma.generationRun.findUnique({
    where: { id: generationRunId },
    include: {
      copyVariations: true,
      imageVariations: true,
    },
  });

  if (!run) return null;

  const copyCandidates: CreativeReviewCandidate[] = run.copyVariations.map(
    (cv) => ({
      id: cv.id,
      generationRunId: run.id,
      variationType: "copy" as const,
      title: cv.title,
      hook: cv.hook,
      body: cv.body,
      callToAction: cv.callToAction,
      approvalStatus: cv.approvalStatus as "draft" | "approved" | "rejected",
    })
  );

  const imageCandidates: CreativeReviewCandidate[] = run.imageVariations.map(
    (iv) => ({
      id: iv.id,
      generationRunId: run.id,
      variationType: "image" as const,
      title: iv.title,
      conceptSummary: iv.conceptSummary,
      visualChanges: iv.visualChanges,
      goal: iv.goal,
      approvalStatus: iv.approvalStatus as "draft" | "approved" | "rejected",
    })
  );

  return {
    generationRunId: run.id,
    clientAccountId: run.clientAccountId || "",
    sourceAdId: run.adId || undefined,
    sourceAdName: run.adName || undefined,
    copyCandidates,
    imageCandidates,
  };
}

/**
 * Approve or reject a specific candidate in the database.
 */
export async function approveCreativeCandidate(
  generationRunId: string,
  variationType: "copy" | "image",
  variationId: string,
  decision: "approved" | "rejected",
  notes?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    // Update the variation's approval status
    if (variationType === "copy") {
      await prisma.generatedCopyVariation.update({
        where: { id: variationId },
        data: { approvalStatus: decision },
      });
    } else {
      await prisma.generatedImageVariation.update({
        where: { id: variationId },
        data: { approvalStatus: decision },
      });
    }

    // Record the approval decision
    await prisma.generationApprovalDecision.create({
      data: {
        generationRunId,
        variationType,
        variationId,
        decision,
        notes: notes || null,
        decidedAt: new Date(),
      },
    });

    // Mark as selected variant (for "approved" only)
    if (decision === "approved") {
      // Upsert — there can be only one selected per variationType per run
      const existing = await prisma.selectedCreativeVariant.findUnique({
        where: {
          generationRunId_variationType: {
            generationRunId,
            variationType,
          },
        },
      });

      if (existing) {
        await prisma.selectedCreativeVariant.update({
          where: { id: existing.id },
          data: { variationId, selectedAt: new Date() },
        });
      } else {
        await prisma.selectedCreativeVariant.create({
          data: {
            generationRunId,
            variationType,
            variationId,
            selectedAt: new Date(),
          },
        });
      }
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Approval failed",
    };
  }
}
