// Generation Persistence
//
// Persists generation runs, prompts, provider payloads, variations, and
// approval decisions. Kept separate from pipeline and provider execution.

import { prisma } from "./db";
import type { CreativeLabEntry } from "../types/creativeDiagnosis";
import type { MockGenerationPipelineResult } from "../types/pipeline";

export interface PersistedGenerationRun {
  runId:           string;
  copyVariations:  Array<{ id: string; title: string; hook: string; body: string; callToAction: string; approvalStatus: string }>;
  imageVariations: Array<{ id: string; title: string; conceptSummary: string; visualChanges: string; goal: string; approvalStatus: string }>;
}

export async function persistGenerationRun(
  result: MockGenerationPipelineResult,
  entry: CreativeLabEntry,
  mode: "mock" | "real"
): Promise<PersistedGenerationRun | null> {
  // Persist all runs for audit trail, including failed

  const now = new Date();
  const completedAt = result.status === "completed" || result.status === "partial" ? now : null;

  const run = await prisma.generationRun.create({
    data: {
      clientAccountId: null,
      campaignId:      entry.input.campaignId,
      adSetId:         null,
      adId:            entry.input.adId,
      adName:          entry.input.adName,
      requestType:     result.requestType,
      provider:        result.provider,
      mode,
      status:          result.status,
      completedAt
    }
  });

  if (result.trace.renderedPrompt && result.trace.assembledContext) {
    await prisma.generationPromptSnapshot.create({
      data: {
        generationRunId:    run.id,
        templateType:       result.requestType,
        templateVersion:   "1.0.0",
        renderedPrompt:    result.trace.renderedPrompt,
        contextSnapshotJson: JSON.stringify(result.trace.assembledContext)
      }
    });
  }

  if (result.trace.formattedPayload) {
    await prisma.generationProviderRequest.create({
      data: {
        generationRunId:   run.id,
        provider:          result.provider,
        requestPayloadJson: JSON.stringify(result.trace.formattedPayload)
      }
    });
  }

  const hasProviderResponse = result.trace.rawMockResponse != null || result.trace.formattedPayload != null;
  if (hasProviderResponse) {
    const execStatus = result.errors.length > 0 ? "failed" : "completed";
    await prisma.generationProviderResponse.create({
      data: {
        generationRunId:     run.id,
        provider:           result.provider,
        responsePayloadJson: result.trace.rawMockResponse != null
          ? JSON.stringify(result.trace.rawMockResponse)
          : "{}",
        executionStatus:    execStatus,
        errorMessage:       result.errors[0] ?? null
      }
    });
  }

  const copyVariations: PersistedGenerationRun["copyVariations"] = [];
  if (result.copyOutput?.length) {
    for (const v of result.copyOutput) {
      const created = await prisma.generatedCopyVariation.create({
        data: {
          generationRunId: run.id,
          title:           v.title,
          hook:            v.hook,
          body:            v.body,
          callToAction:    v.callToAction,
          approvalStatus:  "draft"
        }
      });
      copyVariations.push({
        id:             created.id,
        title:          created.title,
        hook:           created.hook,
        body:           created.body,
        callToAction:   created.callToAction,
        approvalStatus: created.approvalStatus
      });
    }
  }

  const imageVariations: PersistedGenerationRun["imageVariations"] = [];
  if (result.imageOutput?.length) {
    for (const v of result.imageOutput) {
      const created = await prisma.generatedImageVariation.create({
        data: {
          generationRunId: run.id,
          title:           v.title,
          conceptSummary:  v.conceptSummary,
          visualChanges:   v.visualChanges,
          goal:            v.goal,
          approvalStatus:  "draft"
        }
      });
      imageVariations.push({
        id:             created.id,
        title:          created.title,
        conceptSummary: created.conceptSummary,
        visualChanges:  created.visualChanges,
        goal:           created.goal,
        approvalStatus: created.approvalStatus
      });
    }
  }

  return {
    runId:          run.id,
    copyVariations,
    imageVariations
  };
}

export async function setGenerationApproval(
  runId: string,
  variationId: string,
  variationType: "copy" | "image",
  decision: "approved" | "rejected"
) {
  const now = new Date();
  if (variationType === "copy") {
    await prisma.generatedCopyVariation.updateMany({
      where: { id: variationId, generationRunId: runId },
      data: {
        approvalStatus: decision,
        updatedAt:      now
      }
    });
  } else {
    await prisma.generatedImageVariation.updateMany({
      where: { id: variationId, generationRunId: runId },
      data: {
        approvalStatus: decision,
        updatedAt:      now
      }
    });
  }
  await prisma.generationApprovalDecision.create({
    data: {
      generationRunId: runId,
      variationType,
      variationId,
      decision,
      decidedAt: now
    }
  });
}

export async function setSelectedVariant(
  runId: string,
  variationId: string,
  variationType: "copy" | "image"
) {
  await prisma.selectedCreativeVariant.upsert({
    where: {
      generationRunId_variationType: { generationRunId: runId, variationType }
    },
    update: { variationId, selectedAt: new Date() },
    create: {
      generationRunId: runId,
      variationType,
      variationId
    }
  });
}
