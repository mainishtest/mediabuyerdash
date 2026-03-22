// AI Prompt / Input Assembly Utilities
//
// Pure functions that gather existing app data (diagnosis, goals, creative,
// performance) and produce structured context objects ready for future AI
// provider requests. Kept separate from provider contracts and diagnosis logic.

import type { CreativeLabEntry } from "../types/creativeDiagnosis";
import type {
  CopyGenerationContext,
  ImageGenerationContext,
  PerformanceContext,
  CampaignGoalContext,
  CreativeContext,
  DiagnosisContext,
  PromptAssemblyResult,
  ReadinessCheckResult
} from "../types/promptAssembly";

// ── Shared builders ───────────────────────────────────────────────────────────

function buildPerformanceContext(entry: CreativeLabEntry): PerformanceContext {
  const { input, diagnosis } = entry;
  const revenue = input.actualRoas > 0 ? input.spend * input.actualRoas : 0;

  let trendSummary: string | null = null;
  if (diagnosis.cpaOverGoalPct > 0 || diagnosis.roasBelowGoalPct > 0) {
    const parts: string[] = [];
    if (diagnosis.cpaOverGoalPct > 0) parts.push(`CPA ${diagnosis.cpaOverGoalPct}% over goal`);
    if (diagnosis.roasBelowGoalPct > 0) parts.push(`ROAS ${diagnosis.roasBelowGoalPct}% below goal`);
    trendSummary = parts.join(", ");
  }

  return {
    actualCpa:         input.actualCpa,
    actualRoas:        input.actualRoas,
    spend:             input.spend,
    conversions:       input.conversions,
    revenue,
    trendSummary,
    evaluationStatus:  diagnosis.performanceStatus
  };
}

function buildCampaignGoalContext(entry: CreativeLabEntry): CampaignGoalContext {
  const { input } = entry;
  return {
    roasGoalType:  input.roasGoalType,
    roasGoalValue: input.roasGoalValue,
    cpaGoalType:   input.cpaGoalType,
    cpaGoalValue:  input.cpaGoalValue
  };
}

function buildCreativeContext(entry: CreativeLabEntry): CreativeContext {
  const { input } = entry;
  return {
    adName:              input.adName,
    currentHook:         input.copy.hook,
    currentBody:         input.copy.body,
    currentCallToAction: input.copy.callToAction,
    imageHeadline:       input.image.imageHeadline,
    imageStyle:          input.image.imageStyle,
    dominantMessage:     input.image.dominantMessage,
    visualTheme:         input.image.visualTheme
  };
}

function buildDiagnosisContext(entry: CreativeLabEntry): DiagnosisContext {
  const { diagnosis } = entry;
  return {
    causeType:             diagnosis.causeType,
    confidence:            diagnosis.confidence,
    shortReason:           diagnosis.shortReason,
    recommendationSummary: diagnosis.recommendationSummary
  };
}

// ── Readiness checks ──────────────────────────────────────────────────────────

export function checkCopyReadiness(entry: CreativeLabEntry): ReadinessCheckResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  const { input, diagnosis } = entry;

  // For dynamic product ads, hook/body may contain placeholder text — that's OK
  const isDynamicAd = input.copy.hook?.includes("Dynamic product ad")
    || input.copy.body?.includes("Dynamic product ad");

  if (!isDynamicAd) {
    if (!input.copy.hook?.trim()) missing.push("hook");
    if (!input.copy.body?.trim()) missing.push("body");
  }
  if (!input.copy.callToAction?.trim()) missing.push("callToAction");

  if (input.cpaGoalValue <= 0 && input.roasGoalValue <= 0) {
    warnings.push("No campaign goals set — generation may lack direction");
  }

  if (input.spend < 50) {
    warnings.push("Low spend — diagnosis may be unreliable");
  }

  if (isDynamicAd) {
    warnings.push("Dynamic product ad — copy varies by product catalog. Generation will use performance context instead of source copy.");
  } else if (diagnosis.causeType === "unclear" || diagnosis.causeType === "other") {
    warnings.push("Diagnosis is unclear — copy generation may be less targeted");
  }

  const ready = missing.length === 0;
  return { ready, missingFields: missing, warnings };
}

export function checkImageReadiness(entry: CreativeLabEntry): ReadinessCheckResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  const { input, diagnosis } = entry;

  if (!input.image.imageHeadline?.trim()) missing.push("imageHeadline");
  if (!input.image.imageStyle?.trim() || input.image.imageStyle === "unknown") missing.push("imageStyle");
  if (!input.image.dominantMessage?.trim()) missing.push("dominantMessage");
  if (!input.image.visualTheme?.trim() || input.image.visualTheme === "unknown") missing.push("visualTheme");

  if (input.cpaGoalValue <= 0 && input.roasGoalValue <= 0) {
    warnings.push("No campaign goals set — generation may lack direction");
  }

  if (input.spend < 50) {
    warnings.push("Low spend — diagnosis may be unreliable");
  }

  // Don't show confusing "unclear" warnings when it's just a synced ad without image analysis
  if (input.image.visualTheme === "product-photo" || input.image.visualTheme === "synced") {
    // Image analysis hasn't been run yet — that's expected for synced ads
  } else if (diagnosis.causeType === "unclear" || diagnosis.causeType === "other") {
    warnings.push("Diagnosis is unclear — image generation may be less targeted");
  }

  const ready = missing.length === 0;
  return { ready, missingFields: missing, warnings };
}

// ── Assembly functions ───────────────────────────────────────────────────────

export function assembleCopyGenerationContext(
  entry: CreativeLabEntry
): PromptAssemblyResult<CopyGenerationContext> {
  const readiness = checkCopyReadiness(entry);

  const context: CopyGenerationContext = {
    adId:        entry.input.adId,
    adName:      entry.input.adName,
    campaignId:  entry.input.campaignId,
    campaignName: entry.input.campaignName,
    performance: buildPerformanceContext(entry),
    goals:       buildCampaignGoalContext(entry),
    creative:    buildCreativeContext(entry),
    diagnosis:   buildDiagnosisContext(entry)
  };

  return {
    context,
    sourceIds: {
      adId:      entry.input.adId,
      campaignId: entry.input.campaignId
    },
    ready:         readiness.ready,
    missingFields: readiness.missingFields,
    warnings:      readiness.warnings
  };
}

export function assembleImageGenerationContext(
  entry: CreativeLabEntry
): PromptAssemblyResult<ImageGenerationContext> {
  const readiness = checkImageReadiness(entry);

  const context: ImageGenerationContext = {
    adId:        entry.input.adId,
    adName:      entry.input.adName,
    campaignId:  entry.input.campaignId,
    campaignName: entry.input.campaignName,
    performance: buildPerformanceContext(entry),
    goals:       buildCampaignGoalContext(entry),
    creative:    buildCreativeContext(entry),
    diagnosis:   buildDiagnosisContext(entry)
  };

  return {
    context,
    sourceIds: {
      adId:      entry.input.adId,
      campaignId: entry.input.campaignId
    },
    ready:         readiness.ready,
    missingFields: readiness.missingFields,
    warnings:      readiness.warnings
  };
}
