// Launch Draft Utilities
//
// Pure server-side functions for creating, reading, and summarising launch
// drafts. All Prisma access is confined to this module.

import { prisma } from "./db";
import type {
  LaunchDraftSource,
  LaunchDraftSummary,
  LaunchDraftWithVariants,
} from "../types/launchDraft";

// ── Read helpers ──────────────────────────────────────────────────────────────

export async function listLaunchDrafts() {
  return prisma.launchDraft.findMany({
    orderBy: { createdAt: "desc" },
    include: { variants: true },
  });
}

export async function getLaunchDraftWithVariants(
  id: string
): Promise<LaunchDraftWithVariants | null> {
  const draft = await prisma.launchDraft.findUnique({
    where: { id },
    include: { variants: { orderBy: { createdAt: "asc" } } },
  });
  if (!draft) return null;

  const summary = summarizeLaunchDraft(draft, draft.variants);
  return {
    ...draft,
    source: draft.source as LaunchDraftSource,
    status: draft.status as "draft" | "ready" | "archived",
    summary,
  };
}

// ── Write helpers ─────────────────────────────────────────────────────────────

// Creates a LaunchDraft from all approved variations belonging to a single
// GenerationRun. Returns null (no error throw) when there are no approved
// variants so callers can show a friendly UI message.
export async function createLaunchDraftFromApprovedVariations(
  generationRunId: string,
  draftNameOverride?: string
): Promise<{ draftId: string } | { error: string }> {
  const run = await prisma.generationRun.findUnique({
    where: { id: generationRunId },
    include: {
      copyVariations:  { where: { approvalStatus: "approved" } },
      imageVariations: { where: { approvalStatus: "approved" } },
    },
  });

  if (!run) return { error: `Generation run not found: ${generationRunId}` };

  const hasCopy  = run.copyVariations.length > 0;
  const hasImage = run.imageVariations.length > 0;

  if (!hasCopy && !hasImage) {
    return { error: "No approved variations found for this generation run." };
  }

  let source: LaunchDraftSource = "manual";
  if (hasCopy && hasImage) source = "generated_both";
  else if (hasCopy)        source = "generated_copy";
  else                     source = "generated_image";

  const date = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const draftName = draftNameOverride ?? `${run.adName} — Test Draft ${date}`;

  const draft = await prisma.launchDraft.create({
    data: {
      draftName,
      clientAccountId: run.clientAccountId,
      campaignId:      run.campaignId,
      adSetId:         run.adSetId,
      baseAdId:        run.adId,
      baseAdName:      run.adName,
      source,
      status: "draft",
    },
  });

  for (const v of run.copyVariations) {
    await prisma.launchDraftVariant.create({
      data: {
        launchDraftId:   draft.id,
        copyVariationId: v.id,
        variantName:     v.title,
        hook:            v.hook,
        body:            v.body,
        callToAction:    v.callToAction,
        selectedForLaunch: true,
      },
    });
  }

  for (const v of run.imageVariations) {
    await prisma.launchDraftVariant.create({
      data: {
        launchDraftId:        draft.id,
        imageVariationId:     v.id,
        variantName:          v.title,
        imageConceptTitle:    v.title,
        imageConceptSummary:  v.conceptSummary,
        selectedForLaunch:    true,
      },
    });
  }

  return { draftId: draft.id };
}

export async function addVariantToLaunchDraft(
  launchDraftId: string,
  variantData: {
    variantName:          string;
    copyVariationId?:     string;
    imageVariationId?:    string;
    hook?:                string;
    body?:                string;
    callToAction?:        string;
    imageConceptTitle?:   string;
    imageConceptSummary?: string;
  }
) {
  return prisma.launchDraftVariant.create({
    data: { launchDraftId, ...variantData, selectedForLaunch: true },
  });
}

// ── Summarise ─────────────────────────────────────────────────────────────────

export function summarizeLaunchDraft(
  draft: { id: string; draftName: string },
  variants: Array<{
    hook?:                string | null;
    body?:                string | null;
    imageConceptTitle?:   string | null;
    imageConceptSummary?: string | null;
    selectedForLaunch:    boolean;
  }>
): LaunchDraftSummary {
  const hasApprovedCopy  = variants.some((v) => v.hook || v.body);
  const hasApprovedImage = variants.some(
    (v) => v.imageConceptTitle || v.imageConceptSummary
  );
  const selectedVariants = variants.filter((v) => v.selectedForLaunch).length;

  const missingPieces: string[] = [];
  if (!hasApprovedCopy)         missingPieces.push("No copy variants");
  if (!hasApprovedImage)        missingPieces.push("No image concept variants");
  if (selectedVariants === 0)   missingPieces.push("No variants selected for launch");

  return {
    draftId:          draft.id,
    draftName:        draft.draftName,
    totalVariants:    variants.length,
    selectedVariants,
    hasApprovedCopy,
    hasApprovedImage,
    missingPieces,
    isReadyToLaunch:  selectedVariants > 0,
  };
}
