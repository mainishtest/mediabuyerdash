// ── Creative Source Asset Types ───────────────────────────────────────────────
//
// Types for user-uploaded creative source assets used in the Creative Lab
// generation pipeline. Kept separate from creativeDiagnosis and aiProvider types.

// ── Source asset type enum ──────────────────────────────────────────────────

export type CreativeSourceAssetType =
  | "uploaded_image"
  | "uploaded_copy"
  | "uploaded_image_and_copy"
  | "existing_ad_source";

// ── Asset status ────────────────────────────────────────────────────────────

export type CreativeSourceAssetStatus = "draft" | "active" | "archived";

// ── Core asset record ───────────────────────────────────────────────────────

export interface CreativeSourceAssetRecord {
  id:              string;
  clientAccountId: string;
  workspaceId:     string | null;
  assetType:       CreativeSourceAssetType;
  status:          CreativeSourceAssetStatus;
  label:           string | null;
  // Image
  imageUrl:        string | null;
  imageMimeType:   string | null;
  imageWidth:      number | null;
  imageHeight:     number | null;
  imageFileSize:   number | null;
  // Copy
  hook:            string | null;
  bodyText:        string | null;
  callToAction:    string | null;
  imageHeadline:   string | null;
  // Source reference
  sourceAdId:         string | null;
  sourceAdName:       string | null;
  sourceCampaignId:   string | null;
  sourceCampaignName: string | null;
  // Notes
  notes:           string | null;
  // Timestamps
  createdAt:       Date;
  updatedAt:       Date;
}

// ── Upload request ──────────────────────────────────────────────────────────

export interface CreativeUploadRequest {
  clientAccountId: string;
  workspaceId?:    string;
  assetType:       CreativeSourceAssetType;
  label?:          string;
  // Image (either file upload or URL)
  imageUrl?:       string;
  imageFile?:      File;
  // Copy fields
  hook?:           string;
  bodyText?:       string;
  callToAction?:   string;
  imageHeadline?:  string;
  // Source reference
  sourceAdId?:     string;
  sourceAdName?:   string;
  sourceCampaignId?:   string;
  sourceCampaignName?: string;
  // Notes
  notes?:          string;
}

// ── Upload result ───────────────────────────────────────────────────────────

export interface CreativeUploadResult {
  ok:      boolean;
  asset?:  CreativeSourceAssetRecord;
  error?:  string;
}

// ── Upload error codes ──────────────────────────────────────────────────────

export type CreativeUploadErrorCode =
  | "invalid_image_type"
  | "file_too_large"
  | "upload_failed"
  | "missing_client"
  | "storage_error"
  | "validation_error";

export interface CreativeUploadError {
  code:    CreativeUploadErrorCode;
  message: string;
}

// ── Asset metadata ──────────────────────────────────────────────────────────

export interface CreativeAssetMetadata {
  mimeType:   string | null;
  width:      number | null;
  height:     number | null;
  fileSize:   number | null;
  hasImage:   boolean;
  hasCopy:    boolean;
  hasSourceAd: boolean;
}

// ── Asset link (how it connects to workspace/client) ────────────────────────

export interface CreativeAssetLink {
  assetId:         string;
  clientAccountId: string;
  workspaceId:     string | null;
  sourceCampaignId:   string | null;
  sourceAdId:         string | null;
}

// ── Asset summary (for list views) ──────────────────────────────────────────

export interface CreativeAssetSummary {
  id:              string;
  label:           string;
  assetType:       CreativeSourceAssetType;
  status:          CreativeSourceAssetStatus;
  clientAccountId: string;
  thumbnailUrl:    string | null;
  hasImage:        boolean;
  hasCopy:         boolean;
  createdAt:       Date;
}

// ── Preview state (for UI) ──────────────────────────────────────────────────

export interface CreativeAssetPreviewState {
  imagePreviewUrl: string | null;
  hookPreview:     string | null;
  bodyPreview:     string | null;
  ctaPreview:      string | null;
  isLoading:       boolean;
  error:           string | null;
}

// ── Selection state (for Creative Lab integration) ──────────────────────────

export interface CreativeSourceSelectionState {
  selectedAssetId:  string | null;
  selectedAsset:    CreativeSourceAssetRecord | null;
  isSelecting:      boolean;
}
