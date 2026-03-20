// lib/creativeGeneration/context.ts
// Builds CreativeGenerationContext from multiple data sources.
//
// Sources pulled:
//   - CreativePerformanceSnapshot   — CTR, frequency, ROAS, CPA, spend, status
//   - queryLearningsForBrief()       — winning/losing patterns, audience/experiment insights
//   - Explicit goal inputs           — roasGoal, cpaGoal, primaryGoalType
//
// Design rules:
//   - Async — queries learning memory, everything else is synchronous.
//   - Always returns a valid context even with sparse data or no learnings.
//   - CRM fields (currentRoas, currentCpa) flow through from snapshot unchanged.
//   - No side effects beyond DB reads via learningMemory.
//   - The context object is the single input to all generation utility functions.

import type { CreativeGenerationContext, PlatformConstraint } from "../../types/creativeGeneration";
import type { CreativePerformanceSnapshot }                   from "../creativelab/types";
import { queryLearningsForBrief }                             from "../learningMemory/aggregator";

// ---------------------------------------------------------------------------
// Meta platform constraints (stable — update when Meta changes limits)
// ---------------------------------------------------------------------------

export const META_PLATFORM_CONSTRAINTS: PlatformConstraint[] = [
  {
    field:    "primary_text",
    maxChars: 125,
    maxWords: null,
    note:     "Truncated after ~125 chars on mobile feed; full text shown on click",
  },
  {
    field:    "headline",
    maxChars: 40,
    maxWords: null,
    note:     "Critical for scroll-stop; shown below image in link ads",
  },
  {
    field:    "description",
    maxChars: 30,
    maxWords: null,
    note:     "Optional — shown in some placements only",
  },
  {
    field:    "call_to_action",
    maxChars: null,
    maxWords: 5,
    note:     "Meta button label — selected from predefined list",
  },
];

// ---------------------------------------------------------------------------
// Data quality classifier
// ---------------------------------------------------------------------------

function classifyDataQuality(
  snapshot: CreativePerformanceSnapshot,
): "sparse" | "moderate" | "rich" {
  const hasRoas    = snapshot.campaignRoas != null;
  const hasCpa     = snapshot.campaignCpa  != null;
  const hasFreq    = snapshot.avgFrequency != null;
  const hasAdCopy  = typeof snapshot.adCopy === "string" && snapshot.adCopy.length > 10;
  const hasSpend   = snapshot.spend > 100;

  const signals = [hasRoas, hasCpa, hasFreq, hasAdCopy, hasSpend].filter(Boolean).length;
  if (signals >= 4) return "rich";
  if (signals >= 2) return "moderate";
  return "sparse";
}

// ---------------------------------------------------------------------------
// Trigger rationale builder
// ---------------------------------------------------------------------------

function buildTriggerRationale(
  snapshot:    CreativePerformanceSnapshot,
  triggerType: CreativeGenerationContext["triggerType"],
): string {
  const ctrStr  = snapshot.avgCtr.toFixed(2);
  const freqStr = snapshot.avgFrequency != null
    ? `${snapshot.avgFrequency.toFixed(1)}x` : null;
  const roasStr = snapshot.campaignRoas != null
    ? `${snapshot.campaignRoas.toFixed(2)}x (CRM, 7-day)` : null;

  switch (triggerType) {
    case "fatigue":
      return [
        freqStr ? `Frequency ${freqStr} — audience is overexposed.` : "High frequency detected.",
        `CTR ${ctrStr}% — engagement declining.`,
        "Creative refresh required to prevent further performance deterioration.",
      ].join(" ");

    case "underperformance":
      return [
        `CTR ${ctrStr}% — below 0.8% scroll-stop threshold.`,
        roasStr ? `Campaign ROAS ${roasStr}.` : "ROAS pending CRM reconciliation.",
        "Creative is not resonating — hook or angle needs replacement.",
      ].join(" ");

    case "opportunity":
      return [
        `CTR ${ctrStr}% — strong engagement detected.`,
        roasStr ? `Campaign ROAS ${roasStr} — above goal.` : "",
        "Winning pattern identified — generate variants to extend reach and scale spend.",
      ].filter(Boolean).join(" ");

    case "manual":
      return "Manual generation triggered by buyer.";
  }
}

// ---------------------------------------------------------------------------
// Main: buildCreativeGenerationContext
// ---------------------------------------------------------------------------

export async function buildCreativeGenerationContext(opts: {
  snapshot:        CreativePerformanceSnapshot;
  triggerType:     CreativeGenerationContext["triggerType"];
  roasGoal?:       number | null;
  cpaGoal?:        number | null;
  primaryGoalType?: string | null;
}): Promise<CreativeGenerationContext> {
  const { snapshot, triggerType, roasGoal, cpaGoal, primaryGoalType } = opts;

  // Map trigger to intent for learning memory query
  const intentMap: Record<CreativeGenerationContext["triggerType"], string> = {
    opportunity:      "preserve_winner_pattern",
    fatigue:          "refresh_hook",
    underperformance: "refresh_angle",
    manual:           "full_reset",
  };

  // Query learning memory — non-blocking; gracefully falls back to empty
  const learnings = await queryLearningsForBrief({
    workflowType: "creative_brief",
    clientId:     snapshot.clientAccountId,
    campaignId:   snapshot.externalCampaignId ?? undefined,
    intent:       intentMap[triggerType],
  }).catch(() => []);

  // Categorise learning entries
  const winningPatterns:    string[] = [];
  const losingPatterns:     string[] = [];
  const audienceInsights:   string[] = [];
  const experimentInsights: string[] = [];

  for (const l of learnings) {
    const text = l.insightText;
    if (
      l.category === "winning_hook"            ||
      l.category === "winning_angle"           ||
      l.category === "winning_offer_framing"
    ) {
      winningPatterns.push(text);
    } else if (
      l.category === "poor_performer_pattern"  ||
      l.category === "fatigue_pattern"
    ) {
      losingPatterns.push(text);
    } else if (l.category === "audience_message_fit") {
      audienceInsights.push(text);
    } else if (l.category === "experiment_pattern") {
      experimentInsights.push(text);
    }
  }

  // fatigueStatus derived from evaluationStatus (snapshot has no separate field)
  const fatigueStatus =
    snapshot.evaluationStatus === "fatigued" ? "high_frequency" : null;

  return {
    // Identity
    clientAccountId: snapshot.clientAccountId,
    clientName:      snapshot.clientName,
    campaignId:      snapshot.externalCampaignId ?? null,
    campaignName:    snapshot.campaignName,
    creativeId:      snapshot.externalCreativeId ?? null,
    creativeName:    snapshot.creativeName,

    // Performance signals (CRM-verified where applicable)
    currentCtr:       snapshot.avgCtr,
    currentFrequency: snapshot.avgFrequency ?? null,
    currentRoas:      snapshot.campaignRoas ?? null,
    currentCpa:       snapshot.campaignCpa  ?? null,
    currentSpend:     snapshot.spend,
    evaluationStatus: snapshot.evaluationStatus,
    fatigueStatus,

    // Goal context
    roasGoal:        roasGoal        ?? null,
    cpaGoal:         cpaGoal         ?? null,
    primaryGoalType: primaryGoalType ?? null,

    // Learning memory
    winningPatterns,
    losingPatterns,
    audienceInsights,
    experimentInsights,

    // Current creative content
    currentCopy:     snapshot.adCopy      ?? null,
    currentHeadline: snapshot.creativeName ?? null,
    currentCta:      snapshot.callToAction ?? null,
    hasThumbnail:    snapshot.thumbnailUrl != null,

    // Platform constraints
    platformConstraints: META_PLATFORM_CONSTRAINTS,

    // Trigger
    triggerType,
    triggerRationale: buildTriggerRationale(snapshot, triggerType),

    // Metadata
    builtAt:     new Date().toISOString(),
    dataQuality: classifyDataQuality(snapshot),
  };
}

// ---------------------------------------------------------------------------
// buildContextSummaryForPrompt
// Human-readable context block injected into generation prompts.
// ---------------------------------------------------------------------------

export function buildContextSummaryForPrompt(ctx: CreativeGenerationContext): string {
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
    ctx.currentCpa  != null
      ? `- CPA: $${ctx.currentCpa.toFixed(2)} (CRM-verified)`
      : null,
    `- Spend: $${Math.round(ctx.currentSpend)}`,
    `- Status: ${ctx.evaluationStatus}`,
    "",
    `TRIGGER: ${ctx.triggerType.toUpperCase()} — ${ctx.triggerRationale}`,
  ].filter((l): l is string => l !== null);

  if (ctx.winningPatterns.length > 0) {
    lines.push("", "WINNING PATTERNS FROM LEARNING MEMORY (apply these):");
    ctx.winningPatterns.slice(0, 3).forEach((p) => lines.push(`- ${p}`));
  }

  if (ctx.losingPatterns.length > 0) {
    lines.push("", "LOSING PATTERNS TO AVOID:");
    ctx.losingPatterns.slice(0, 3).forEach((p) => lines.push(`- ${p}`));
  }

  if (ctx.audienceInsights.length > 0) {
    lines.push("", "AUDIENCE INSIGHTS:");
    ctx.audienceInsights.slice(0, 2).forEach((a) => lines.push(`- ${a}`));
  }

  if (ctx.currentCopy) {
    lines.push(
      "",
      `CURRENT COPY (being refreshed): "${ctx.currentCopy.slice(0, 200)}${ctx.currentCopy.length > 200 ? "…" : ""}"`,
    );
  }

  if (ctx.dataQuality === "sparse") {
    lines.push(
      "",
      "DATA NOTE: Limited performance history available. Generate broadly applicable concepts rather than highly data-specific ones.",
    );
  }

  return lines.join("\n");
}
