// ─── Learning Memory — Aggregator ────────────────────────────────────────────
//
// Merges all four source extractors into a unified, filterable memory interface.
// This is the primary public API for consuming learning data across the app.
//
// Integration points:
//   Creative Lab briefs:      queryLearningsForBrief()
//   Executive reporting:      buildLearningInsightSummary()
//   Experiment planning:      queryLearningMemory({ category: "experiment_pattern" })
//   Optimization engine:      queryLearningMemory({ category: "poor_performer_pattern" })

import {
  extractExperimentLearnings,
  extractCampaignPerformanceLearnings,
  extractPublishLearnings,
  extractAutomationLearnings,
  extractImageVariationLearnings,
} from "./extractor";
import {
  extractLearningPatterns,
  buildLearningInsightSummary,
  confidenceScore,
} from "./patterns";
import type {
  LearningMemoryEntry,
  LearningQuery,
  LearningSummary,
  LearningSurfaceContext,
  LearningCategory,
} from "./types";

// ── Deduplication helper ──────────────────────────────────────────────────────

function deduplicate(entries: LearningMemoryEntry[]): LearningMemoryEntry[] {
  const seen = new Set<string>();
  return entries.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
}

// ── Main query ────────────────────────────────────────────────────────────────

export async function queryLearningMemory(query: LearningQuery): Promise<LearningMemoryEntry[]> {
  const { clientId, campaignId, dateFrom, dateTo, sourceType, category, confidence, usableForBriefs, limit = 200 } = query;

  // Run all extractors in parallel; each respects client/date filters
  const extractorFilters = { clientId, dateFrom, dateTo, limit };

  const [expLearnings, perfLearnings, pubLearnings, autoLearnings, imgVarLearnings] = await Promise.all([
    sourceType && sourceType !== "experiment_outcome"       ? [] : extractExperimentLearnings(extractorFilters),
    sourceType && sourceType !== "creative_outcome"         ? [] : extractCampaignPerformanceLearnings(extractorFilters),
    sourceType && sourceType !== "publish_outcome"          ? [] : extractPublishLearnings(extractorFilters),
    sourceType && sourceType !== "recommendation_outcome"   ? [] : extractAutomationLearnings(extractorFilters),
    sourceType && sourceType !== "image_variation_outcome"  ? [] : extractImageVariationLearnings(extractorFilters),
  ]);

  let entries = deduplicate([...expLearnings, ...perfLearnings, ...pubLearnings, ...autoLearnings, ...imgVarLearnings]);

  // Apply remaining filters
  if (category)        entries = entries.filter((e) => e.category        === category);
  if (confidence)      entries = entries.filter((e) => e.confidence      === confidence);
  if (campaignId)      entries = entries.filter((e) => e.campaignId      === campaignId);
  if (usableForBriefs) entries = entries.filter((e) => e.usableForBriefs === true);

  // Sort: confidence desc → createdAt desc
  entries.sort((a, b) => {
    const cd = confidenceScore(b.confidence) - confidenceScore(a.confidence);
    if (cd !== 0) return cd;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return entries.slice(0, limit);
}

// ── Summary builder (pure) ────────────────────────────────────────────────────

export function buildLearningSummary(
  entries: LearningMemoryEntry[],
  allClients: { id: string; name: string }[]
): LearningSummary {
  const bySource   = {} as Record<string, number>;
  const byCategory = {} as Record<string, number>;
  const byConf     = {} as Record<string, number>;
  const clientCount: Record<string, number> = {};

  for (const e of entries) {
    bySource[e.sourceType]   = (bySource[e.sourceType]   ?? 0) + 1;
    byCategory[e.category]   = (byCategory[e.category]   ?? 0) + 1;
    byConf[e.confidence]     = (byConf[e.confidence]     ?? 0) + 1;
    clientCount[e.clientId]  = (clientCount[e.clientId]  ?? 0) + 1;
  }

  const clientMap = Object.fromEntries(allClients.map((c) => [c.id, c.name]));
  const clientsWithLearnings = Object.entries(clientCount)
    .map(([id, count]) => ({ id, name: clientMap[id] ?? "Unknown", count }))
    .sort((a, b) => b.count - a.count);

  const topPatterns = extractLearningPatterns(entries).slice(0, 5);
  const high = entries.filter((e) => e.confidence === "high");

  return {
    totalEntries:         entries.length,
    highConfidenceCount:  high.length,
    experimentCount:      bySource["experiment_outcome"] ?? 0,
    creativeCount:        (bySource["creative_outcome"] ?? 0) + (bySource["publish_outcome"] ?? 0),
    usableForBriefsCount: entries.filter((e) => e.usableForBriefs).length,
    topPatterns,
    topInsight:           entries.length > 0 ? buildLearningInsightSummary(entries.slice(0, 20)) : null,
    clientsWithLearnings,
    isSparse:             entries.length < 5,
  };
}

// ── Client-scoped helper ──────────────────────────────────────────────────────

export async function summarizeClientLearnings(
  clientId: string,
  dateFrom?: string,
  dateTo?:   string
): Promise<LearningMemoryEntry[]> {
  return queryLearningMemory({ clientId, dateFrom, dateTo, limit: 50 });
}

// ── Brief integration ─────────────────────────────────────────────────────────

/**
 * Returns learnings relevant to a creative brief generation context.
 * Call this from brief builders to enrich prompt context with memory.
 *
 * @example
 *   const learnings = await queryLearningsForBrief({ workflowType: "creative_brief", clientId, intent: "refresh_hook" });
 *   // Pass learnings[].insightText into the generation prompt
 */
export async function queryLearningsForBrief(
  context: LearningSurfaceContext
): Promise<LearningMemoryEntry[]> {
  const { clientId, campaignId, intent } = context;

  const all = await queryLearningMemory({
    clientId,
    campaignId,
    usableForBriefs: true,
    limit: 20,
  });

  // Prefer entries whose pattern matches the intent
  const intentMatch = all.filter((e) => e.pattern === intent);
  const others      = all.filter((e) => e.pattern !== intent);

  return [...intentMatch, ...others].slice(0, 5);
}

// ── Category group helper ─────────────────────────────────────────────────────

export function groupByCategory(
  entries: LearningMemoryEntry[]
): Array<{ category: LearningCategory; entries: LearningMemoryEntry[] }> {
  const groups: Record<string, LearningMemoryEntry[]> = {};
  for (const e of entries) {
    if (!groups[e.category]) groups[e.category] = [];
    groups[e.category].push(e);
  }
  // Sort by entry count desc
  return Object.entries(groups)
    .sort(([, a], [, b]) => b.length - a.length)
    .map(([category, es]) => ({ category: category as LearningCategory, entries: es }));
}

// ── Re-export for consumers ───────────────────────────────────────────────────

export { buildLearningInsightSummary } from "./patterns";
export type {
  LearningMemoryEntry,
  LearningSummary,
  LearningPattern,
  LearningQuery,
  LearningSurfaceContext,
} from "./types";
