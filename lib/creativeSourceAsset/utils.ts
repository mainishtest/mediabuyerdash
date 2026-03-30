// ── Creative Source Asset Utilities ───────────────────────────────────────────
//
// Pure functions for building metadata, summarizing assets, and validating uploads.
// No database calls — keep persistence in the API routes.

import type {
  CreativeSourceAssetRecord,
  CreativeAssetMetadata,
  CreativeAssetSummary,
  CreativeAssetLink,
  CreativeUploadError,
  CreativeSourceAssetType,
} from "../../types/creativeSourceAsset";

// ── Validation ──────────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function validateImageUpload(
  mimeType: string,
  fileSize: number,
): CreativeUploadError | null {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return {
      code: "invalid_image_type",
      message: `Unsupported image type: ${mimeType}. Allowed: JPEG, PNG, WebP, GIF.`,
    };
  }
  if (fileSize > MAX_FILE_SIZE) {
    return {
      code: "file_too_large",
      message: `File too large (${(fileSize / 1024 / 1024).toFixed(1)} MB). Maximum: 10 MB.`,
    };
  }
  return null;
}

// ── Metadata builder ────────────────────────────────────────────────────────

export function buildCreativeAssetMetadata(
  asset: CreativeSourceAssetRecord,
): CreativeAssetMetadata {
  return {
    mimeType:    asset.imageMimeType,
    width:       asset.imageWidth,
    height:      asset.imageHeight,
    fileSize:    asset.imageFileSize,
    hasImage:    !!asset.imageUrl,
    hasCopy:     !!(asset.hook || asset.bodyText),
    hasSourceAd: !!asset.sourceAdId,
  };
}

// ── Summary builder (for list views) ────────────────────────────────────────

export function summarizeCreativeSourceAsset(
  asset: CreativeSourceAssetRecord,
): CreativeAssetSummary {
  return {
    id:              asset.id,
    label:           asset.label || asset.sourceAdName || `Asset ${asset.id.slice(0, 8)}`,
    assetType:       asset.assetType,
    status:          asset.status,
    clientAccountId: asset.clientAccountId,
    thumbnailUrl:    asset.imageUrl,
    hasImage:        !!asset.imageUrl,
    hasCopy:         !!(asset.hook || asset.bodyText),
    createdAt:       asset.createdAt,
  };
}

// ── Asset link builder ──────────────────────────────────────────────────────

export function buildAssetLink(
  asset: CreativeSourceAssetRecord,
): CreativeAssetLink {
  return {
    assetId:            asset.id,
    clientAccountId:    asset.clientAccountId,
    workspaceId:        asset.workspaceId,
    sourceCampaignId:   asset.sourceCampaignId,
    sourceAdId:         asset.sourceAdId,
  };
}

// ── Asset type detection ────────────────────────────────────────────────────

export function detectAssetType(
  hasImage: boolean,
  hasCopy: boolean,
  hasSourceAd: boolean,
): CreativeSourceAssetType {
  if (hasSourceAd) return "existing_ad_source";
  if (hasImage && hasCopy) return "uploaded_image_and_copy";
  if (hasImage) return "uploaded_image";
  return "uploaded_copy";
}

// ── File name generator ─────────────────────────────────────────────────────

export function generateUploadFilename(
  clientAccountId: string,
  originalFilename: string,
): string {
  const ext = originalFilename.split(".").pop()?.toLowerCase() || "jpg";
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `${clientAccountId}_${timestamp}_${random}.${ext}`;
}
