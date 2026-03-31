// ─────────────────────────────────────────────────────────────────────────────
// Source Context Builder
// ─────────────────────────────────────────────────────────────────────────────
// Assembles all context needed for variation generation:
//   - Source creative (image + copy from asset or existing ad)
//   - Performance signals (CTR, CPA, ROAS, frequency, fatigue)
//   - Learning memory insights (winning patterns, fatigue patterns)
//   - Client-specific generation directions
//
// This layer is intentionally separated from the generation providers so that
// any provider (Anthropic, OpenAI, mock) can consume the same context object.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "../db";
import { queryLearningMemory } from "../learningMemory/aggregator";
import type {
  CreativeVariationSource,
  VariationSourceContext,
  SourcePerformanceSignals,
  SourceLearningInsight,
} from "../../types/variationGeneration";

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Build the full context object from a variation source.
 * This is the single entry point called before any generation provider runs.
 */
export async function buildVariationSourceContext(
  source: CreativeVariationSource,
  options: {
    includePerformance?: boolean;
    includeLearnings?: boolean;
    includeFatigue?: boolean;
  } = {}
): Promise<VariationSourceContext> {
  const {
    includePerformance = true,
    includeLearnings = true,
    includeFatigue = true,
  } = options;

  // Load client directions in parallel with performance + learning data
  const [clientData, performance, learnings] = await Promise.all([
    loadClientDirections(source.clientAccountId),
    includePerformance || includeFatigue
      ? loadPerformanceSignals(source)
      : Promise.resolve(undefined),
    includeLearnings
      ? loadLearningInsights(source.clientAccountId, source.sourceCampaignId)
      : Promise.resolve([]),
  ]);

  // Determine data quality
  const dataQuality = assessDataQuality(performance, learnings);

  return {
    source,
    performance: performance ?? undefined,
    learnings,
    clientCopywritingPrompt: clientData?.copywritingPrompt ?? undefined,
    clientImageDirections: clientData?.imageDirections ?? undefined,
    dataQuality,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function loadClientDirections(
  clientAccountId: string
): Promise<{ copywritingPrompt?: string; imageDirections?: string } | null> {
  try {
    const client = await prisma.clientAccount.findUnique({
      where: { id: clientAccountId },
      select: {
        copywritingPrompt: true,
        imagePromptDirections: true,
      },
    });
    if (!client) return null;
    return {
      copywritingPrompt: client.copywritingPrompt ?? undefined,
      imageDirections: client.imagePromptDirections ?? undefined,
    };
  } catch {
    return null;
  }
}

async function loadPerformanceSignals(
  source: CreativeVariationSource
): Promise<SourcePerformanceSignals | null> {
  if (!source.sourceAdId) return null;

  try {
    // Load from MetaSyncedInsight using the ad's external ID
    const insight = await prisma.metaSyncedInsight.findFirst({
      where: { externalAdId: source.sourceAdId },
      orderBy: { updatedAt: "desc" },
      select: {
        ctr: true,
        cpm: true,
        spend: true,
        impressions: true,
        frequency: true,
      },
    });

    if (!insight) return null;

    // Derive fatigue signals from frequency
    let fatigueStatus: string | undefined;
    let fatigueRecommendation: string | undefined;
    const freq = insight.frequency ? Number(insight.frequency) : 0;

    if (freq > 5.0) {
      fatigueStatus = "severe_fatigue";
      fatigueRecommendation = "generate_full_creative_refresh";
    } else if (freq > 3.5) {
      fatigueStatus = "fatigued";
      fatigueRecommendation = "generate_new_variations";
    } else if (freq > 2.5) {
      fatigueStatus = "watch";
      fatigueRecommendation = "review_creative";
    } else {
      fatigueStatus = "healthy";
    }

    return {
      ctr: insight.ctr ? Number(insight.ctr) : undefined,
      spend: insight.spend ? Number(insight.spend) : undefined,
      impressions: insight.impressions ? Number(insight.impressions) : undefined,
      frequency: freq || undefined,
      fatigueStatus,
      fatigueRecommendation,
    };
  } catch {
    return null;
  }
}

async function loadLearningInsights(
  clientId: string,
  campaignId?: string
): Promise<SourceLearningInsight[]> {
  try {
    const entries = await queryLearningMemory({
      clientId,
      campaignId: campaignId ?? undefined,
      usableForBriefs: true,
      limit: 10,
    });

    return entries.map((entry) => ({
      category: entry.category,
      insightText: entry.insightText,
      confidence: entry.confidence,
      pattern: entry.pattern ?? undefined,
    }));
  } catch {
    return [];
  }
}

function assessDataQuality(
  performance: SourcePerformanceSignals | null | undefined,
  learnings: SourceLearningInsight[]
): "sparse" | "moderate" | "rich" {
  let score = 0;

  if (performance) {
    if (performance.ctr !== undefined) score++;
    if (performance.roas !== undefined) score++;
    if (performance.spend !== undefined && performance.spend > 50) score++;
    if (performance.frequency !== undefined) score++;
  }

  if (learnings.length >= 5) score += 2;
  else if (learnings.length >= 2) score += 1;

  if (score >= 4) return "rich";
  if (score >= 2) return "moderate";
  return "sparse";
}
