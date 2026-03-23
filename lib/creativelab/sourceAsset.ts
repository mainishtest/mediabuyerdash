// lib/creativelab/sourceAsset.ts
// Utility functions for creative source assets.
//
// Converts UploadedCreativeImage DB records into CreativeSourceAsset
// typed objects, and provides helpers for the upload + selection flow.

import { prisma } from "../db";
import type {
  CreativeSourceAsset,
  CreativeSourceAssetType,
  CreativeAssetMetadata,
  CreativeAssetSummary,
} from "../../types/creativeSourceAsset";

// ---------------------------------------------------------------------------
// Load source assets
// ---------------------------------------------------------------------------

export async function loadSourceAssets(
  workspaceId: string | null,
): Promise<CreativeSourceAsset[]> {
  let images;
  try {
    images = await prisma.uploadedCreativeImage.findMany({
      where:   workspaceId ? { workspaceId } : undefined,
      include: {
        analysis:   true,
        _count:     { select: { iterations: true } },
        clientAccount: { select: { name: true } },
      },
      orderBy: { uploadedAt: "desc" },
    });
  } catch (err) {
    // Fallback: query without sourceCopy/sourceCallToAction if columns don't exist yet
    console.warn("[sourceAsset] findMany failed, retrying with select:", err instanceof Error ? err.message : err);
    images = await prisma.uploadedCreativeImage.findMany({
      where:   workspaceId ? { workspaceId } : undefined,
      select: {
        id: true, workspaceId: true, clientAccountId: true,
        fileName: true, mimeType: true, fileSize: true,
        storagePath: true, uploadedAt: true, createdAt: true, updatedAt: true,
        analysis: true,
        _count: { select: { iterations: true } },
        clientAccount: { select: { name: true } },
      },
      orderBy: { uploadedAt: "desc" },
    });
  }

  return images.map((img) => {
    const hasCopy  = !!(img as Record<string, unknown>).sourceCopy;
    const hasImage = !!img.storagePath;

    let type: CreativeSourceAssetType = "uploaded_image";
    if (hasCopy && hasImage) type = "uploaded_image_and_copy";
    else if (hasCopy)        type = "uploaded_copy";

    return {
      id:   img.id,
      type,

      workspaceId:     img.workspaceId,
      clientAccountId: img.clientAccountId,
      clientName:      img.clientAccount?.name ?? null,

      fileName:    img.fileName,
      storagePath: img.storagePath,
      mimeType:    img.mimeType,
      fileSize:    img.fileSize,

      sourceCopy:         (img as Record<string, unknown>).sourceCopy as string | null ?? null,
      sourceCallToAction: (img as Record<string, unknown>).sourceCallToAction as string | null ?? null,

      analysisStatus: img.analysis?.analysisStatus as CreativeSourceAsset["analysisStatus"] ?? null,
      detectedStyle:   img.analysis?.detectedStyle ?? null,
      dominantMessage: img.analysis?.dominantMessage ?? null,
      visualTheme:     img.analysis?.visualTheme ?? null,
      clarityScore:    img.analysis?.clarityScore ?? null,
      attentionScore:  img.analysis?.attentionScore ?? null,

      uploadedAt:     img.uploadedAt.toISOString(),
      iterationCount: img._count.iterations,
    };
  });
}

export async function loadSourceAssetById(
  id: string,
): Promise<CreativeSourceAsset | null> {
  const img = await prisma.uploadedCreativeImage.findUnique({
    where:   { id },
    include: {
      analysis: true,
      _count:   { select: { iterations: true } },
      clientAccount: { select: { name: true } },
    },
  });

  if (!img) return null;

  const hasCopy  = !!(img as Record<string, unknown>).sourceCopy;
  const hasImage = !!img.storagePath;

  let type: CreativeSourceAssetType = "uploaded_image";
  if (hasCopy && hasImage) type = "uploaded_image_and_copy";
  else if (hasCopy)        type = "uploaded_copy";

  return {
    id:   img.id,
    type,
    workspaceId:     img.workspaceId,
    clientAccountId: img.clientAccountId,
    clientName:      img.clientAccount?.name ?? null,
    fileName:        img.fileName,
    storagePath:     img.storagePath,
    mimeType:        img.mimeType,
    fileSize:        img.fileSize,
    sourceCopy:         (img as Record<string, unknown>).sourceCopy as string | null ?? null,
    sourceCallToAction: (img as Record<string, unknown>).sourceCallToAction as string | null ?? null,
    analysisStatus: img.analysis?.analysisStatus as CreativeSourceAsset["analysisStatus"] ?? null,
    detectedStyle:   img.analysis?.detectedStyle ?? null,
    dominantMessage: img.analysis?.dominantMessage ?? null,
    visualTheme:     img.analysis?.visualTheme ?? null,
    clarityScore:    img.analysis?.clarityScore ?? null,
    attentionScore:  img.analysis?.attentionScore ?? null,
    uploadedAt:     img.uploadedAt.toISOString(),
    iterationCount: img._count.iterations,
  };
}

// ---------------------------------------------------------------------------
// Metadata + summary
// ---------------------------------------------------------------------------

export function buildAssetMetadata(asset: CreativeSourceAsset): CreativeAssetMetadata {
  return {
    assetId:         asset.id,
    type:            asset.type,
    fileName:        asset.fileName,
    mimeType:        asset.mimeType,
    fileSize:        asset.fileSize,
    hasSourceCopy:   asset.sourceCopy != null && asset.sourceCopy.length > 0,
    hasImage:        asset.storagePath != null,
    hasAnalysis:     asset.analysisStatus === "completed",
    clientAccountId: asset.clientAccountId,
    clientName:      asset.clientName,
    uploadedAt:      asset.uploadedAt,
  };
}

export function summarizeSourceAssets(assets: CreativeSourceAsset[]): CreativeAssetSummary {
  const byClient: Record<string, number> = {};

  let withCopy     = 0;
  let withImage    = 0;
  let withAnalysis = 0;

  for (const a of assets) {
    if (a.sourceCopy)                    withCopy++;
    if (a.storagePath)                   withImage++;
    if (a.analysisStatus === "completed") withAnalysis++;

    const name = a.clientName ?? "Unassigned";
    byClient[name] = (byClient[name] ?? 0) + 1;
  }

  return {
    totalAssets: assets.length,
    withCopy,
    withImage,
    withAnalysis,
    byClient,
  };
}

// ---------------------------------------------------------------------------
// Convert source asset to creative-engine snapshot format
// ---------------------------------------------------------------------------

export function sourceAssetToSnapshot(asset: CreativeSourceAsset) {
  return {
    externalCreativeId: asset.id,
    externalCampaignId: "uploaded",
    clientAccountId:    asset.clientAccountId ?? "unknown",
    clientName:         asset.clientName ?? "Unknown",
    campaignName:       "Uploaded Creative",
    creativeName:       asset.fileName ?? "Uploaded Asset",
    spend:              0,
    impressions:        0,
    clicks:             0,
    avgCtr:             0,
    avgFrequency:       null,
    campaignRoas:       null,
    campaignCpa:        null,
    adCopy:             asset.sourceCopy,
    callToAction:       asset.sourceCallToAction,
    thumbnailUrl:       asset.storagePath,
    imageUrl:           asset.storagePath,
    evaluationStatus:   "insufficient_data" as const,
  };
}
