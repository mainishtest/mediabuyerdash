// Mock AI Provider
//
// Implements CopyGenerationProvider and ImageVariationProvider using
// the existing deterministic generators. No real LLM or image API calls.
// Used for development and as the default provider until real integrations exist.

import type {
  CopyGenerationRequest,
  CopyGenerationResponse,
  ImageVariationRequest,
  ImageVariationResponse,
  AIGenerationProvider
} from "../../types/aiProvider";
import type { CopyGenerationProvider, ImageVariationProvider } from "./contract";
import { generateCopyVariations } from "../copyVariationGenerator";
import { generateImageVariations } from "../imageVariationGenerator";

const PROVIDER: AIGenerationProvider = "mock";

function requestToDiagnosisInput(req: CopyGenerationRequest) {
  return {
    adId:         req.adId,
    adName:       req.adName,
    campaignId:   req.campaignId,
    campaignName: req.campaignName,
    actualCpa:    req.performanceSummary.actualCpa,
    actualRoas:   req.performanceSummary.actualRoas,
    spend:        req.performanceSummary.spend,
    conversions:  req.performanceSummary.conversions,
    cpaGoalValue: req.performanceSummary.cpaGoalValue,
    cpaGoalType:  req.diagnosisResult.causeType === "copy" ? "low" as const : "low" as const,
    roasGoalValue: req.performanceSummary.roasGoalValue,
    roasGoalType:  "high" as const,
    copy:         req.existingCopy,
    image:        {
      imageHeadline:   "",
      imageStyle:      "",
      dominantMessage: "",
      visualTheme:     ""
    }
  };
}

function imageRequestToDiagnosisInput(req: ImageVariationRequest) {
  return {
    adId:         req.adId,
    adName:       req.adName,
    campaignId:   req.campaignId,
    campaignName: req.campaignName,
    actualCpa:    req.performanceSummary.actualCpa,
    actualRoas:   req.performanceSummary.actualRoas,
    spend:        req.performanceSummary.spend,
    conversions:  req.performanceSummary.conversions,
    cpaGoalValue: req.performanceSummary.cpaGoalValue,
    cpaGoalType:  "low" as const,
    roasGoalValue: req.performanceSummary.roasGoalValue,
    roasGoalType:  "high" as const,
    copy:         { hook: "", body: "", callToAction: "" },
    image:        req.existingImage
  };
}

function genRequestId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export const mockCopyProvider: CopyGenerationProvider = {
  providerId: PROVIDER,

  async generateCopyVariations(request: CopyGenerationRequest): Promise<CopyGenerationResponse> {
    const input = requestToDiagnosisInput(request);
    const variations = generateCopyVariations(input).slice(0, request.requestedCount);
    const requestId = genRequestId("copy");

    return {
      provider:           PROVIDER,
      requestId,
      generatedVariations: variations,
      status:             "completed",
      createdAt:          new Date().toISOString()
    };
  }
};

export const mockImageProvider: ImageVariationProvider = {
  providerId: PROVIDER,

  async generateImageVariations(request: ImageVariationRequest): Promise<ImageVariationResponse> {
    const input = imageRequestToDiagnosisInput(request);
    const concepts = generateImageVariations(input).slice(0, request.requestedCount);
    const requestId = genRequestId("img");

    return {
      provider:          PROVIDER,
      requestId,
      generatedConcepts:  concepts,
      status:            "completed",
      createdAt:         new Date().toISOString()
    };
  }
};
