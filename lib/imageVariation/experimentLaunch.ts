// lib/imageVariation/experimentLaunch.ts
// Bridge from approved image variation candidates to the existing
// experiment launch system.
//
// Architecture:
//   - Reuses all existing experiment launch infrastructure
//     (builder, mapping, criteria, guardrails, readiness, DB)
//   - Adds image-variation-specific context to launch plan inputs
//   - No new Prisma models — persists to ExperimentLaunchPlanRecord
//   - No autonomous launch — all plans require human approval

import type { ImageVariationCandidate, ImageVariationContext } from "./types";
import type { ImageVariationScorecard } from "./scoringTypes";
import type {
  CreativeExperimentLaunchPlan,
  CreateExperimentLaunchPlanInput,
  CreativeExperimentReadinessState,
} from "../../types/experimentLaunch";
import {
  buildCreativeExperimentLaunchPlan,
} from "../experimentLaunch/builder";
import {
  saveExperimentLaunchPlan,
  loadExperimentLaunchPlans,
  loadExperimentLaunchPlanById,
} from "../experimentLaunch/db";
import {
  recomputePlanReadiness,
} from "../experimentLaunch/readiness";

// ---------------------------------------------------------------------------
// Types — image-variation-specific experiment launch context
// ---------------------------------------------------------------------------

export type ImageVariationExperimentLaunchPlan = CreativeExperimentLaunchPlan & {
  sourceImageVariationRequestId: string | null;
  sourceImageVariationCandidateId: string | null;
  sourceVariationIntent: string | null;
};

export type ImageVariationExperimentSummary = {
  requestId:   string;
  candidateId: string;
  planId:      string | null;
  planName:    string | null;
  readiness:   CreativeExperimentReadinessState | null;
  hasControl:  boolean;
  hasMapping:  boolean;
};

// ---------------------------------------------------------------------------
// Public: buildImageVariationExperimentLaunchPlan
// Creates a launch plan from an approved image variation candidate.
// ---------------------------------------------------------------------------

export function buildImageVariationExperimentLaunchPlan(opts: {
  candidate:  ImageVariationCandidate;
  context:    ImageVariationContext | null;
  scorecard:  ImageVariationScorecard | null;
  requestId:  string;
  controlCreativeId?:   string | null;
  controlCreativeName?: string | null;
  hypothesis?: string | null;
}): CreativeExperimentLaunchPlan {
  const { candidate, context, scorecard, requestId } = opts;

  const intentLabel = candidate.intent ?? "image_variation";
  const scoreSuffix = scorecard ? ` (score: ${scorecard.totalScore}/100)` : "";

  const id = `ivlp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const input: CreateExperimentLaunchPlanInput = {
    clientAccountId:       candidate.clientAccountId,
    name:                  `Image Test: ${candidate.title}`,
    hypothesis:            opts.hypothesis ?? buildDefaultHypothesis(candidate, context),
    objective:             `Test image variation "${candidate.title}" against control${scoreSuffix}`,

    // Source references
    variantId:             candidate.id,
    recommendationId:      context?.recommendationId ?? null,

    // Challenger fields
    challengerVariantTitle:   candidate.title,
    challengerVariantType:    "image",
    challengerBriefIntent:    intentLabel,
    challengerBriefDraftType: "image_variation",
    challengerClientName:     context?.clientName ?? null,
    challengerCampaignName:   context?.campaignName ?? null,

    // Control (if provided)
    // Mapping defaults from context
    targetCampaignId:         context?.campaignId ?? null,
    targetCampaignName:       context?.campaignName ?? null,
    externalAdAccountId:      null,
    comparisonMode:           "simultaneous",

    // Success criteria defaults (CRM source of truth)
    primaryMetric:             "roas_7d",
    secondaryMetrics:          ["cpa_7d", "ctr"],
    guardrailMetrics:          ["cpm"],
    successThreshold:          0.10,
    minSpendPerVariant:        50,
    minConversionsPerVariant:  5,
    evaluationWindowDays:      7,

    launchNotes: `Source: Image Variation Request ${requestId}\n` +
      `Intent: ${intentLabel}\n` +
      `Trigger: ${context?.triggerType ?? "unknown"}\n` +
      (context?.triggerRationale ? `Rationale: ${context.triggerRationale}` : ""),
  };

  const plan = buildCreativeExperimentLaunchPlan({ id, input });

  // If control was provided, update the control variant
  if (opts.controlCreativeId || opts.controlCreativeName) {
    plan.control.creativeId = opts.controlCreativeId ?? null;
    plan.control.creativeName = opts.controlCreativeName ?? null;
  }

  return plan;
}

// ---------------------------------------------------------------------------
// Public: saveImageVariationExperimentLaunchPlan
// Persists a plan to the DB.
// ---------------------------------------------------------------------------

export async function saveImageVariationExperimentLaunchPlan(
  plan: CreativeExperimentLaunchPlan,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await saveExperimentLaunchPlan(plan);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

// ---------------------------------------------------------------------------
// Public: loadImageVariationExperimentLaunchPlans
// Load plans for a client, filtered to image variation experiments.
// ---------------------------------------------------------------------------

export async function loadImageVariationExperimentLaunchPlans(opts?: {
  clientAccountId?: string;
  readinessState?:  CreativeExperimentReadinessState;
  limit?:           number;
}): Promise<CreativeExperimentLaunchPlan[]> {
  const plans = await loadExperimentLaunchPlans({
    clientAccountId: opts?.clientAccountId,
    readinessState:  opts?.readinessState,
    limit:           opts?.limit ?? 50,
  });

  // Filter to image variation plans
  return plans.filter((p) => p.challenger.variantType === "image");
}

// ---------------------------------------------------------------------------
// Public: loadImageVariationExperimentLaunchPlanById
// ---------------------------------------------------------------------------

export async function loadImageVariationExperimentLaunchPlanById(
  id: string,
): Promise<CreativeExperimentLaunchPlan | null> {
  return loadExperimentLaunchPlanById(id);
}

// ---------------------------------------------------------------------------
// Internal: build default hypothesis from candidate context
// ---------------------------------------------------------------------------

function buildDefaultHypothesis(
  candidate: ImageVariationCandidate,
  context:   ImageVariationContext | null,
): string {
  const intent = candidate.intent ?? "visual refresh";
  const trigger = context?.triggerType ?? "manual";

  const hypothesisMap: Record<string, string> = {
    fatigue:           `The existing creative is fatigued. A ${intent} image variation will restore engagement and improve ROAS.`,
    underperformance:  `The current image is underperforming. A ${intent} image variation will improve key metrics.`,
    opportunity:       `There is an opportunity to improve performance. Testing a ${intent} image variation against the current creative will capture incremental gains.`,
    manual:            `Testing a ${intent} image variation against the current creative to measure performance impact.`,
  };

  return hypothesisMap[trigger] ?? hypothesisMap.manual;
}
