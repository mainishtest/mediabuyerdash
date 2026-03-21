// lib/imageVariation/context.ts
// Builds ImageVariationContext from multiple data sources.
//
// Sources:
//   - CreativePerformanceSnapshot — CTR, frequency, ROAS, CPA, spend, status
//   - queryLearningsForBrief()    — winning/losing patterns, audience insights
//   - Source asset reference      — current image URL/description
//   - Goal inputs                 — ROAS/CPA targets
//   - Fatigue signals             — from creative fatigue detection
//
// Design rules:
//   - Async — queries learning memory.
//   - Always returns a valid context even with sparse data.
//   - CRM fields flow through from snapshot unchanged.

import type { CreativePerformanceSnapshot } from "../creativelab/types";
import type {
  ImageVariationContext,
  ImageVariationIntent,
  ImageVariationConstraint,
  ImageVariationSourceAsset,
} from "./types";
import { queryLearningsForBrief } from "../learningMemory/aggregator";

// ---------------------------------------------------------------------------
// Data quality classifier
// ---------------------------------------------------------------------------

function classifyDataQuality(
  snapshot: CreativePerformanceSnapshot,
  sourceAsset: ImageVariationSourceAsset,
): "sparse" | "moderate" | "rich" {
  const hasRoas   = snapshot.campaignRoas != null;
  const hasCpa    = snapshot.campaignCpa  != null;
  const hasFreq   = snapshot.avgFrequency != null;
  const hasImage  = sourceAsset.url != null;
  const hasSpend  = snapshot.spend > 100;
  const hasCopy   = typeof snapshot.adCopy === "string" && snapshot.adCopy.length > 10;

  const signals = [hasRoas, hasCpa, hasFreq, hasImage, hasSpend, hasCopy].filter(Boolean).length;
  if (signals >= 5) return "rich";
  if (signals >= 3) return "moderate";
  return "sparse";
}

// ---------------------------------------------------------------------------
// Trigger rationale builder
// ---------------------------------------------------------------------------

function buildTriggerRationale(
  snapshot:    CreativePerformanceSnapshot,
  triggerType: ImageVariationContext["triggerType"],
): string {
  const ctrStr  = snapshot.avgCtr.toFixed(2);
  const freqStr = snapshot.avgFrequency != null
    ? `${snapshot.avgFrequency.toFixed(1)}x` : null;
  const roasStr = snapshot.campaignRoas != null
    ? `${snapshot.campaignRoas.toFixed(2)}x (CRM, 7-day)` : null;

  switch (triggerType) {
    case "fatigue":
      return [
        freqStr ? `Frequency ${freqStr} — audience is overexposed to this visual.` : "High frequency detected.",
        `CTR ${ctrStr}% — image is no longer stopping the scroll.`,
        "Visual refresh required to re-engage the audience.",
      ].join(" ");

    case "underperformance":
      return [
        `CTR ${ctrStr}% — image is not generating enough engagement.`,
        roasStr ? `Campaign ROAS ${roasStr}.` : "ROAS pending CRM reconciliation.",
        "Image needs a new visual approach to improve scroll-stop and click-through.",
      ].join(" ");

    case "opportunity":
      return [
        `CTR ${ctrStr}% — strong engagement.`,
        roasStr ? `Campaign ROAS ${roasStr} — performing well.` : "",
        "Generate image variations to extend reach and test new visual angles while preserving the winning formula.",
      ].filter(Boolean).join(" ");

    case "manual":
      return "Manual image variation request by media buyer.";
  }
}

// ---------------------------------------------------------------------------
// Intent selection — maps performance signals to variation intent
// ---------------------------------------------------------------------------

export function selectVariationIntent(
  snapshot:    CreativePerformanceSnapshot,
  triggerType: ImageVariationContext["triggerType"],
  explicitIntent?: ImageVariationIntent,
): ImageVariationIntent {
  if (explicitIntent) return explicitIntent;

  // Fatigue-driven selection
  if (triggerType === "fatigue") {
    if (snapshot.avgFrequency != null && snapshot.avgFrequency > 5.0) {
      return "full_visual_reset";
    }
    return "refresh_visual_hook";
  }

  // Underperformance-driven
  if (triggerType === "underperformance") {
    if (snapshot.avgCtr < 0.5) return "refresh_composition";
    return "refresh_offer_framing";
  }

  // Opportunity-driven — preserve, iterate
  if (triggerType === "opportunity") {
    return "refresh_product_focus";
  }

  return "refresh_visual_hook";
}

// ---------------------------------------------------------------------------
// Main: buildImageVariationContext
// ---------------------------------------------------------------------------

export async function buildImageVariationContext(opts: {
  snapshot:          CreativePerformanceSnapshot;
  triggerType:       ImageVariationContext["triggerType"];
  intent?:           ImageVariationIntent;
  sourceAsset?:      Partial<ImageVariationSourceAsset>;
  constraints?:      ImageVariationConstraint[];
  roasGoal?:         number | null;
  cpaGoal?:          number | null;
  primaryGoalType?:  string | null;
  offerSummary?:     string | null;
  audienceSummary?:  string | null;
  recommendationId?: string | null;
}): Promise<ImageVariationContext> {
  const {
    snapshot, triggerType, constraints, roasGoal, cpaGoal,
    primaryGoalType, offerSummary, audienceSummary, recommendationId,
  } = opts;

  const sourceAsset: ImageVariationSourceAsset = {
    url:         opts.sourceAsset?.url         ?? snapshot.thumbnailUrl ?? null,
    fileName:    opts.sourceAsset?.fileName    ?? null,
    description: opts.sourceAsset?.description ?? null,
    dimensions:  opts.sourceAsset?.dimensions  ?? null,
  };

  const intent = selectVariationIntent(snapshot, triggerType, opts.intent);

  // Query learning memory — non-blocking; falls back to empty
  const intentMap: Record<ImageVariationContext["triggerType"], string> = {
    opportunity:      "preserve_winner_pattern",
    fatigue:          "refresh_hook",
    underperformance: "refresh_angle",
    manual:           "full_reset",
  };

  const learnings = await queryLearningsForBrief({
    workflowType: "creative_brief",
    clientId:     snapshot.clientAccountId,
    campaignId:   snapshot.externalCampaignId ?? undefined,
    intent:       intentMap[triggerType],
  }).catch(() => []);

  const winningPatterns:    string[] = [];
  const losingPatterns:     string[] = [];
  const audienceInsights:   string[] = [];
  const experimentInsights: string[] = [];

  for (const l of learnings) {
    const text = l.insightText;
    if (["winning_hook", "winning_angle", "winning_offer_framing"].includes(l.category)) {
      winningPatterns.push(text);
    } else if (["poor_performer_pattern", "fatigue_pattern"].includes(l.category)) {
      losingPatterns.push(text);
    } else if (l.category === "audience_message_fit") {
      audienceInsights.push(text);
    } else if (l.category === "experiment_pattern") {
      experimentInsights.push(text);
    }
  }

  const fatigueStatus =
    snapshot.evaluationStatus === "fatigued" ? "high_frequency" : null;

  return {
    clientAccountId: snapshot.clientAccountId,
    clientName:      snapshot.clientName,
    campaignId:      snapshot.externalCampaignId ?? null,
    campaignName:    snapshot.campaignName,
    creativeId:      snapshot.externalCreativeId ?? null,
    creativeName:    snapshot.creativeName,

    sourceAsset,

    currentCtr:       snapshot.avgCtr,
    currentFrequency: snapshot.avgFrequency ?? null,
    currentRoas:      snapshot.campaignRoas ?? null,
    currentCpa:       snapshot.campaignCpa  ?? null,
    currentSpend:     snapshot.spend,
    evaluationStatus: snapshot.evaluationStatus,
    fatigueStatus,

    roasGoal:        roasGoal        ?? null,
    cpaGoal:         cpaGoal         ?? null,
    primaryGoalType: primaryGoalType ?? null,

    winningPatterns,
    losingPatterns,
    audienceInsights,
    experimentInsights,

    currentCopy:     snapshot.adCopy      ?? null,
    currentHeadline: snapshot.creativeName ?? null,
    currentCta:      snapshot.callToAction ?? null,

    offerSummary:    offerSummary    ?? null,
    audienceSummary: audienceSummary ?? null,

    constraints: constraints ?? [],

    triggerType,
    triggerRationale: buildTriggerRationale(snapshot, triggerType),
    recommendationId: recommendationId ?? null,

    intent,

    builtAt:     new Date().toISOString(),
    dataQuality: classifyDataQuality(snapshot, sourceAsset),
  };
}

// ---------------------------------------------------------------------------
// buildContextSummaryForPrompt
// Human-readable context block injected into image variation prompts.
// ---------------------------------------------------------------------------

export function buildImageContextSummary(ctx: ImageVariationContext): string {
  const lines: string[] = [
    `CLIENT: ${ctx.clientName}`,
    ctx.campaignName ? `CAMPAIGN: ${ctx.campaignName}` : null,
    ctx.creativeName ? `CREATIVE: ${ctx.creativeName}` : null,
    "",
    "PERFORMANCE SIGNALS (CRM-verified where applicable):",
    `- CTR: ${ctx.currentCtr.toFixed(2)}%`,
    ctx.currentFrequency != null
      ? `- Frequency: ${ctx.currentFrequency.toFixed(1)}x ${ctx.currentFrequency > 3.5 ? "(high — audience fatigued)" : ""}`
      : "- Frequency: not available",
    ctx.currentRoas != null
      ? `- ROAS: ${ctx.currentRoas.toFixed(2)}x (CRM, 7-day attribution)`
      : "- ROAS: pending CRM reconciliation",
    ctx.currentCpa != null
      ? `- CPA: $${ctx.currentCpa.toFixed(2)} (CRM-verified)`
      : null,
    `- Spend: $${Math.round(ctx.currentSpend)}`,
    `- Status: ${ctx.evaluationStatus}`,
    "",
    `TRIGGER: ${ctx.triggerType.toUpperCase()} — ${ctx.triggerRationale}`,
  ].filter((l): l is string => l !== null);

  if (ctx.sourceAsset.description) {
    lines.push("", `CURRENT IMAGE: ${ctx.sourceAsset.description}`);
  } else if (ctx.sourceAsset.url) {
    lines.push("", "CURRENT IMAGE: Image reference available (no description provided)");
  } else {
    lines.push("", "CURRENT IMAGE: No source image available — generate from context only");
  }

  if (ctx.offerSummary) {
    lines.push("", `OFFER: ${ctx.offerSummary}`);
  }
  if (ctx.audienceSummary) {
    lines.push("", `AUDIENCE: ${ctx.audienceSummary}`);
  }

  if (ctx.winningPatterns.length > 0) {
    lines.push("", "WINNING VISUAL PATTERNS (apply these):");
    ctx.winningPatterns.slice(0, 3).forEach((p) => lines.push(`- ${p}`));
  }

  if (ctx.losingPatterns.length > 0) {
    lines.push("", "LOSING PATTERNS TO AVOID:");
    ctx.losingPatterns.slice(0, 3).forEach((p) => lines.push(`- ${p}`));
  }

  if (ctx.constraints.length > 0) {
    lines.push("", "CONSTRAINTS:");
    ctx.constraints.forEach((c) => lines.push(`- [${c.type}] ${c.value} (${c.reason})`));
  }

  if (ctx.dataQuality === "sparse") {
    lines.push(
      "",
      "DATA NOTE: Limited performance history available. Generate broadly applicable visual concepts.",
    );
  }

  return lines.join("\n");
}
