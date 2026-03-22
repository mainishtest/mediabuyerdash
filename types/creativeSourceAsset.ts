// types/creativeSourceAsset.ts
// Typed models for creative source assets.
//
// A source asset is an uploaded image + optional copy that serves as
// the basis for variation generation in the Creative Lab.
// Backed by the UploadedCreativeImage Prisma model.

// ---------------------------------------------------------------------------
// Source asset types
// ---------------------------------------------------------------------------

export type CreativeSourceAssetType =
  | "uploaded_image"           // image only, no copy
  | "uploaded_copy"            // copy only, no image (future)
  | "uploaded_image_and_copy"  // image + source copy
  | "existing_ad_source";     // derived from a synced Meta ad

export type CreativeSourceAsset = {
  id: string;
  type: CreativeSourceAssetType;

  // Workspace / client linkage
  workspaceId: string | null;
  clientAccountId: string | null;
  clientName: string | null;

  // Image
  fileName: string | null;
  storagePath: string | null;
  mimeType: string | null;
  fileSize: number | null;

  // Copy
  sourceCopy: string | null;
  sourceCallToAction: string | null;

  // Analysis (if run)
  analysisStatus: "pending" | "completed" | "failed" | null;
  detectedStyle: string | null;
  dominantMessage: string | null;
  visualTheme: string | null;
  clarityScore: number | null;
  attentionScore: number | null;

  // Metadata
  uploadedAt: string;
  iterationCount: number;
};

// ---------------------------------------------------------------------------
// Upload request / result
// ---------------------------------------------------------------------------

export type CreativeUploadRequest = {
  file: File | null;
  sourceCopy: string;
  sourceCallToAction: string;
  clientAccountId: string;
};

export type CreativeUploadResult = {
  ok: boolean;
  assetId?: string;
  storagePath?: string;
  error?: string;
};

export type CreativeUploadError =
  | "invalid_file_type"
  | "file_too_large"
  | "missing_file"
  | "missing_client"
  | "storage_failure"
  | "db_failure";

// ---------------------------------------------------------------------------
// Asset metadata
// ---------------------------------------------------------------------------

export type CreativeAssetMetadata = {
  assetId: string;
  type: CreativeSourceAssetType;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  hasSourceCopy: boolean;
  hasImage: boolean;
  hasAnalysis: boolean;
  clientAccountId: string | null;
  clientName: string | null;
  uploadedAt: string;
};

// ---------------------------------------------------------------------------
// Asset summary (for list views)
// ---------------------------------------------------------------------------

export type CreativeAssetSummary = {
  totalAssets: number;
  withCopy: number;
  withImage: number;
  withAnalysis: number;
  byClient: Record<string, number>;
};

// ---------------------------------------------------------------------------
// Selection state (for use in CreativeWorkflow)
// ---------------------------------------------------------------------------

export type CreativeSourceSelectionState = {
  selectedAssetId: string | null;
  selectedAsset: CreativeSourceAsset | null;
};

// ---------------------------------------------------------------------------
// Preview state
// ---------------------------------------------------------------------------

export type CreativeAssetPreviewState = {
  assetId: string;
  imageUrl: string | null;
  sourceCopy: string | null;
  sourceCallToAction: string | null;
  analysisAvailable: boolean;
};
