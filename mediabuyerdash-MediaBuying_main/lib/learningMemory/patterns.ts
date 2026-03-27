// ─── Learning Memory — Pattern Analysis ──────────────────────────────────────
//
// Pure functions — no DB calls. Groups entries into recurring patterns,
// scores confidence, and builds text summaries for integration points.

import type {
  LearningMemoryEntry,
  LearningPattern,
  LearningConfidence,
  LearningCategory,
} from "./types";

// ── Confidence scoring ────────────────────────────────────────────────────────

export function confidenceScore(c: LearningConfidence): number {
  return c === "high" ? 3 : c === "medium" ? 2 : 1;
}

export function avgConfidence(entries: LearningMemoryEntry[]): LearningConfidence {
  if (entries.length === 0) return "low";
  const avg = entries.reduce((s, e) => s + confidenceScore(e.confidence), 0) / entries.length;
  if (avg >= 2.5) return "high";
  if (avg >= 1.5) return "medium";
  return "low";
}

// ── Category labels ───────────────────────────────────────────────────────────

export const CATEGORY_LABEL: Record<LearningCategory, string> = {
  winning_hook:          "Winning Hook",
  winning_angle:         "Winning Angle",
  winning_offer_framing: "Winning Offer Framing",
  fatigue_pattern:       "Fatigue Pattern",
  poor_performer_pattern: "Poor Performer Pattern",
  audience_message_fit:  "Audience-Message Fit",
  launch_condition:      "Launch Condition",
  refresh_pattern:       "Refresh Pattern",
  experiment_pattern:    "Experiment Pattern",
};

export const SOURCE_LABEL: Record<string, string> = {
  creative_outcome:       "Campaign Performance",
  experiment_outcome:     "Experiment",
  fatigue_outcome:        "Fatigue Signal",
  recommendation_outcome: "Automation",
  publish_outcome:        "Creative Launch",
};

export const CONFIDENCE_BADGE: Record<LearningConfidence, string> = {
  high:   "border-emerald-800/50 bg-emerald-950/60 text-emerald-300",
  medium: "border-sky-800/50 bg-sky-950/60 text-sky-300",
  low:    "border-slate-700 bg-slate-800 text-slate-400",
};

export const SOURCE_BADGE: Record<string, string> = {
  experiment_outcome:     "border-violet-800/50 bg-violet-950/60 text-violet-300",
  creative_outcome:       "border-emerald-800/50 bg-emerald-950/60 text-emerald-300",
  publish_outcome:        "border-sky-800/50 bg-sky-950/60 text-sky-300",
  recommendation_outcome: "border-amber-800/50 bg-amber-950/60 text-amber-300",
  fatigue_outcome:        "border-rose-800/50 bg-rose-950/60 text-rose-300",
};

export const CATEGORY_ACCENT: Record<LearningCategory, string> = {
  winning_hook:           "text-emerald-300",
  winning_angle:          "text-emerald-300",
  winning_offer_framing:  "text-emerald-300",
  fatigue_pattern:        "text-rose-300",
  poor_performer_pattern: "text-rose-300",
  audience_message_fit:   "text-sky-300",
  launch_condition:       "text-sky-300",
  refresh_pattern:        "text-amber-300",
  experiment_pattern:     "text-violet-300",
};

// ── Pattern extraction ────────────────────────────────────────────────────────

export function extractLearningPatterns(entries: LearningMemoryEntry[]): LearningPattern[] {
  // Group by (category, pattern)
  const groups: Record<string, LearningMemoryEntry[]> = {};

  for (const e of entries) {
    const key = `${e.category}:${e.pattern ?? "general"}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  }

  const patterns: LearningPattern[] = Object.entries(groups)
    .filter(([, es]) => es.length >= 1)
    .map(([key, es]): LearningPattern => {
      const [category, patternLabel] = key.split(":") as [LearningCategory, string];
      const sorted = [...es].sort(
        (a, b) => confidenceScore(b.confidence) - confidenceScore(a.confidence)
      );
      return {
        patternLabel,
        category,
        occurrences:    es.length,
        confidence:     avgConfidence(es),
        exampleInsight: sorted[0].insightText,
        clientNames:    [...new Set(es.map((e) => e.clientName))],
        sourceTypes:    [...new Set(es.map((e) => e.sourceType))],
      };
    })
    .sort((a, b) => {
      // Sort by: confidence desc, occurrences desc
      const cd = confidenceScore(b.confidence) - confidenceScore(a.confidence);
      if (cd !== 0) return cd;
      return b.occurrences - a.occurrences;
    });

  return patterns;
}

// ── Insight summary for integration points ────────────────────────────────────

/**
 * Builds a concise 1-2 sentence digest of the top learnings for use in
 * executive reports, creative brief generation prompts, or other surfaces.
 */
export function buildLearningInsightSummary(entries: LearningMemoryEntry[]): string {
  if (entries.length === 0) return "No learnings available for this period.";

  const high   = entries.filter((e) => e.confidence === "high");
  const wins   = entries.filter((e) => ["winning_hook", "winning_angle", "winning_offer_framing"].includes(e.category));
  const issues = entries.filter((e) => ["poor_performer_pattern", "fatigue_pattern"].includes(e.category));

  const parts: string[] = [];

  if (high.length > 0) {
    parts.push(`${high.length} high-confidence learning${high.length !== 1 ? "s" : ""} captured`);
  }

  if (wins.length > 0) {
    const clients = [...new Set(wins.map((e) => e.clientName))];
    parts.push(`${wins.length} winning pattern${wins.length !== 1 ? "s" : ""} identified across ${clients.length > 1 ? `${clients.length} clients` : clients[0]}`);
  }

  if (issues.length > 0) {
    parts.push(`${issues.length} underperformance or fatigue signal${issues.length !== 1 ? "s" : ""} noted`);
  }

  if (parts.length === 0) return `${entries.length} learning${entries.length !== 1 ? "s" : ""} captured this period.`;

  return parts.join("; ") + ".";
}

// ── Category grouping (pure) ──────────────────────────────────────────────────

export function groupByCategory(
  entries: LearningMemoryEntry[]
): Array<{ category: LearningCategory; entries: LearningMemoryEntry[] }> {
  const groups: Record<string, LearningMemoryEntry[]> = {};
  for (const e of entries) {
    if (!groups[e.category]) groups[e.category] = [];
    groups[e.category].push(e);
  }
  return Object.entries(groups)
    .sort(([, a], [, b]) => b.length - a.length)
    .map(([category, es]) => ({ category: category as LearningCategory, entries: es }));
}

/**
 * Filters entries relevant to creative brief generation for a given context.
 * Used by the brief builder to enrich prompt context with memory.
 */
export function filterForBriefContext(
  entries: LearningMemoryEntry[],
  opts: { clientId?: string; intent?: string; category?: LearningCategory }
): LearningMemoryEntry[] {
  return entries
    .filter((e) => e.usableForBriefs)
    .filter((e) => !opts.clientId || e.clientId === opts.clientId)
    .filter((e) => !opts.category || e.category === opts.category)
    .filter((e) => !opts.intent  || e.pattern === opts.intent)
    .sort((a, b) => confidenceScore(b.confidence) - confidenceScore(a.confidence))
    .slice(0, 5);
}
