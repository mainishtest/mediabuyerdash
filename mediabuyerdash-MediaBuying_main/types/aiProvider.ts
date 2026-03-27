// AI Provider Contract Types
//
// Typed models for future LLM and image-generation integrations.
// Kept separate from types/creativeDiagnosis.ts so provider contracts can
// evolve independently of diagnosis/recommendation logic.

import type {
  CreativeDiagnosisResult,
  CopyVariation,
  ImageVariationConcept,
  AdCopyFields,
  AdImageMetadata
} from "./creativeDiagnosis";

// ── Provider identifiers ──────────────────────────────────────────────────────

export type AIGenerationProvider =
  | "mock"
  | "openai"
  | "anthropic"
  | "image_provider_placeholder";

// ── Generation status ──────────────────────────────────────────────────────────

export type AIGenerationStatus =
  | "idle"
  | "queued"
  | "running"
  | "completed"
  | "failed";

// ── Copy generation contract ────────────────────────────────────────────────────

export interface CopyGenerationRequest {
  adId:              string;
  adName:            string;
  campaignId:        string;
  campaignName:      string;
  performanceSummary: {
    actualCpa:      number;
    actualRoas:     number;
    cpaGoalValue:   number;
    roasGoalValue:  number;
    spend:          number;
    conversions:    number;
  };
  diagnosisResult:   CreativeDiagnosisResult;
  existingCopy:      AdCopyFields;
  requestedCount:    number;
}

export interface CopyGenerationResponse {
  provider:           AIGenerationProvider;
  requestId:           string;
  generatedVariations: CopyVariation[];
  status:              AIGenerationStatus;
  createdAt:           string;   // ISO datetime
  errorMessage?:       string;
}

// ── Image variation contract ───────────────────────────────────────────────────

export interface ImageVariationRequest {
  adId:              string;
  adName:            string;
  campaignId:        string;
  campaignName:       string;
  performanceSummary: {
    actualCpa:      number;
    actualRoas:     number;
    cpaGoalValue:   number;
    roasGoalValue:  number;
    spend:          number;
    conversions:    number;
  };
  diagnosisResult:   CreativeDiagnosisResult;
  existingImage:     AdImageMetadata;
  requestedCount:    number;
}

export interface ImageVariationResponse {
  provider:              AIGenerationProvider;
  requestId:             string;
  generatedConcepts:     ImageVariationConcept[];
  status:                AIGenerationStatus;
  createdAt:             string;
  errorMessage?:         string;
}

// ── Job tracking ──────────────────────────────────────────────────────────────

export type AIGenerationRequestType = "copy" | "image";

export interface AIGenerationJob {
  id:           string;
  entityType:   "ad";
  entityId:     string;   // adId
  requestType:  AIGenerationRequestType;
  provider:     AIGenerationProvider;
  status:       AIGenerationStatus;
  startedAt:    string | null;
  completedAt:  string | null;
  errorMessage: string | null;
}

// ── Approval workflow ──────────────────────────────────────────────────────────

export type CreativeApprovalStatus = "draft" | "approved" | "rejected";

export interface ApprovedCreativeChange {
  variationId:  string;
  entityType:   "copy" | "image";
  adId:         string;
  jobId:        string;
  status:       CreativeApprovalStatus;
  approvedAt:   string | null;   // ISO datetime
  rejectedAt:   string | null;
}

// Copy variation that has been approved for use.
export interface ApprovedCopyVariation extends CopyVariation {
  approvalStatus: CreativeApprovalStatus;
  approvedAt:     string | null;
  rejectedAt:     string | null;
}

// ── UI / page data shapes ─────────────────────────────────────────────────────

export interface JobWithVariations {
  id:          string;
  requestType: "copy" | "image";
  provider:    string;
  status:      string;
  createdAt:   Date;
  variations:  CopyVariation[] | ImageVariationConcept[];
}

export type ApprovalMap = Record<string, CreativeApprovalStatus>;
