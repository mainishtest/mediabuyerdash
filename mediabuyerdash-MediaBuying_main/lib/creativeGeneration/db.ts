// lib/creativeGeneration/db.ts
// Persistence for AI creative generation jobs and their output variants.
//
// Architecture:
//   - Each generation run creates one CreativeGenerationJobRecord.
//   - Generated variants are persisted to the existing CreativeDraftVariantRecord
//     table (same table as brief-level variants), tagged with generationJobId.
//   - The brief's existing review workflow (PATCH /api/creative-lab/briefs/[id])
//     handles variant review without any changes needed here.

import { prisma }                        from "../db";
import type {
  CreativeGenerationJob,
  CreativeGenerationMode,
  CreativeGenerationOutput,
}                                        from "../../types/creativeGeneration";
import type { CreativeDraftVariant }     from "../../types/creativeBrief";

// ---------------------------------------------------------------------------
// Create a generation job record at start of run (status: running)
// ---------------------------------------------------------------------------

export async function createGenerationJob(opts: {
  id:      string;
  briefId: string;
  mode:    CreativeGenerationMode;
}): Promise<void> {
  await prisma.creativeGenerationJobRecord.create({
    data: {
      id:      opts.id,
      briefId: opts.briefId,
      mode:    opts.mode,
      status:  "running",
    },
  }).catch(() => {
    // Non-fatal — generation continues even if job record write fails
  });
}

// ---------------------------------------------------------------------------
// Complete a generation job: update record + persist variants to brief
// ---------------------------------------------------------------------------

export async function completeGenerationJob(
  output: CreativeGenerationOutput,
  briefId: string,
): Promise<void> {
  const variantRows = output.variants.map((v: CreativeDraftVariant) =>
    prisma.creativeDraftVariantRecord.create({
      data: {
        id:              v.id,
        briefId,
        variantType:     v.variantType,
        title:           v.title,
        generationJobId: output.jobId,
        contentJson: JSON.stringify({
          hook:                v.hook,
          body:                v.body,
          callToAction:        v.callToAction,
          conceptSummary:      v.conceptSummary,
          visualChanges:       v.visualChanges,
          goal:                v.goal,
          directResponseAngle: v.directResponseAngle,
          // Provenance metadata stored in JSON so UI can show AI badge
          source:              "ai",
          provider:            output.provider,
          jobId:               output.jobId,
        }),
      },
    })
  );

  await prisma.$transaction([
    prisma.creativeGenerationJobRecord.update({
      where: { id: output.jobId },
      data:  {
        status:       "completed",
        variantCount: output.variants.length,
        tokensUsed:   output.tokensUsed  ?? undefined,
        latencyMs:    output.latencyMs   ?? undefined,
        completedAt:  new Date(),
      },
    }),
    ...variantRows,
  ]).catch(() => {
    // Best-effort — caller gets variants from output even if DB write fails
  });
}

// ---------------------------------------------------------------------------
// Fail a generation job record
// ---------------------------------------------------------------------------

export async function failGenerationJob(
  jobId:    string,
  errorMsg: string,
): Promise<void> {
  await prisma.creativeGenerationJobRecord.update({
    where: { id: jobId },
    data:  {
      status:       "failed",
      errorMessage: errorMsg.slice(0, 500),
      completedAt:  new Date(),
    },
  }).catch(() => { /* non-fatal */ });
}

// ---------------------------------------------------------------------------
// Load generation job history for a brief
// ---------------------------------------------------------------------------

export async function loadGenerationJobs(briefId: string): Promise<CreativeGenerationJob[]> {
  const rows = await prisma.creativeGenerationJobRecord.findMany({
    where:   { briefId },
    orderBy: { createdAt: "desc" },
    take:    20,
  });

  return rows.map((r) => ({
    id:           r.id,
    briefId:      r.briefId,
    mode:         r.mode as CreativeGenerationMode,
    provider:     r.provider,
    status:       r.status as CreativeGenerationJob["status"],
    variantCount: r.variantCount,
    tokensUsed:   r.tokensUsed,
    latencyMs:    r.latencyMs,
    errorMessage: r.errorMessage,
    createdAt:    r.createdAt.toISOString(),
    completedAt:  r.completedAt?.toISOString() ?? null,
  }));
}
