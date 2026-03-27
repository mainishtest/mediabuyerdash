// Creative Intelligence Insight Builder
//
// Converts signal groups into performance insights and a top-level summary.
//
// Performance figures use a deterministic sample lookup keyed by pattern label.
// Replace SAMPLE_PERF entries with real joined metrics (CPA, ROAS from ad results)
// when real performance data is available — no structural changes required.

import type {
  CreativePerformanceInsight,
  CreativePatternStrength,
  CreativeIntelligenceSummary,
  CreativePatternType,
} from "../../types/creativeIntelligence";
import type { SignalGroup } from "./patterns";

// ── Human-readable labels ─────────────────────────────────────────────────────

export const PATTERN_DISPLAY: Record<string, string> = {
  // Hooks
  story_hook:          "Story Hook",
  question_hook:       "Question Hook",
  pain_hook:           "Pain Hook",
  transformation_hook: "Transformation Hook",
  urgency_hook:        "Urgency Hook",
  stat_hook:           "Stat / Data Hook",
  direct_hook:         "Direct Hook",
  // CTAs
  claim_cta:           "Claim / Unlock CTA",
  free_offer_cta:      "Free Offer CTA",
  try_cta:             "Try / Start CTA",
  shop_cta:            "Shop / Buy CTA",
  book_cta:            "Book / Schedule CTA",
  learn_cta:           "Learn / Discover CTA",
  generic_cta:         "Generic CTA",
  // Body angles
  problem_solution:    "Problem → Solution",
  emotional:           "Emotional Angle",
  transformation:      "Transformation",
  social_proof:        "Social Proof",
  urgency:             "Urgency Angle",
  direct_benefit:      "Direct Benefit",
  // Visual styles
  ugc_style:           "UGC / Authentic",
  before_after:        "Before & After",
  testimonial_style:   "Testimonial",
  lifestyle:           "Lifestyle",
  text_focused:        "Text Overlay",
  product_focused:     "Product Showcase",
  minimalist:          "Minimalist",
  general_visual:      "General Visual",
};

function display(label: string): string {
  return PATTERN_DISPLAY[label] ?? label;
}

// ── Sample performance reference ──────────────────────────────────────────────
// Ordered from best to worst CPA within each category.
// Source: archetypal direct-response benchmarks, not account-specific data.

const SAMPLE_PERF: Record<string, { cpa: number; roas: number; ctr: number }> = {
  story_hook:          { cpa: 32, roas: 2.8, ctr: 2.4 },
  question_hook:       { cpa: 38, roas: 2.4, ctr: 2.1 },
  pain_hook:           { cpa: 41, roas: 2.2, ctr: 1.9 },
  transformation_hook: { cpa: 44, roas: 2.0, ctr: 1.8 },
  urgency_hook:        { cpa: 52, roas: 1.7, ctr: 1.5 },
  stat_hook:           { cpa: 55, roas: 1.6, ctr: 1.4 },
  direct_hook:         { cpa: 62, roas: 1.4, ctr: 1.1 },

  claim_cta:           { cpa: 35, roas: 2.7, ctr: 2.3 },
  free_offer_cta:      { cpa: 37, roas: 2.5, ctr: 2.2 },
  try_cta:             { cpa: 42, roas: 2.2, ctr: 1.9 },
  shop_cta:            { cpa: 48, roas: 2.0, ctr: 1.7 },
  book_cta:            { cpa: 50, roas: 1.9, ctr: 1.6 },
  learn_cta:           { cpa: 58, roas: 1.6, ctr: 1.3 },
  generic_cta:         { cpa: 65, roas: 1.3, ctr: 1.0 },

  problem_solution:    { cpa: 36, roas: 2.6, ctr: 2.2 },
  emotional:           { cpa: 39, roas: 2.4, ctr: 2.0 },
  transformation:      { cpa: 43, roas: 2.1, ctr: 1.8 },
  social_proof:        { cpa: 46, roas: 2.0, ctr: 1.7 },
  urgency:             { cpa: 53, roas: 1.7, ctr: 1.4 },
  direct_benefit:      { cpa: 60, roas: 1.4, ctr: 1.1 },

  ugc_style:           { cpa: 31, roas: 3.0, ctr: 2.6 },
  before_after:        { cpa: 34, roas: 2.7, ctr: 2.3 },
  testimonial_style:   { cpa: 38, roas: 2.4, ctr: 2.0 },
  lifestyle:           { cpa: 44, roas: 2.1, ctr: 1.8 },
  text_focused:        { cpa: 49, roas: 1.9, ctr: 1.6 },
  product_focused:     { cpa: 54, roas: 1.7, ctr: 1.4 },
  minimalist:          { cpa: 57, roas: 1.5, ctr: 1.2 },
  general_visual:      { cpa: 63, roas: 1.3, ctr: 1.0 },
};

function strength(cpa: number): CreativePatternStrength {
  if (cpa <= 40) return "strong";
  if (cpa <= 54) return "moderate";
  return "weak";
}

// ── Build functions ───────────────────────────────────────────────────────────

export function buildInsightsFromGroups(groups: SignalGroup[]): CreativePerformanceInsight[] {
  return groups.map((g) => {
    const perf = SAMPLE_PERF[g.patternLabel] ?? { cpa: 60, roas: 1.4, ctr: 1.2 };
    const str  = strength(perf.cpa);
    const label = display(g.patternLabel);
    const qualifier =
      str === "strong"   ? "outperforms average" :
      str === "moderate" ? "performs near average" :
                           "underperforms average";
    return {
      id:           `${g.patternType}:${g.patternLabel}`,
      patternType:  g.patternType,
      patternLabel: g.patternLabel,
      entityLevel:  "all" as const,
      sampleCount:  g.count,
      averageCPA:   perf.cpa,
      averageROAS:  perf.roas,
      averageCTR:   perf.ctr,
      conversions:  g.count * Math.round(perf.roas * 2),
      strength:     str,
      summary:      `${label} ${qualifier} — CPA $${perf.cpa}, ROAS ${perf.roas}x.`,
    };
  });
}

export function buildCreativeIntelligenceSummary(
  insights: CreativePerformanceInsight[]
): CreativeIntelligenceSummary {
  const byType = (type: CreativePatternType) =>
    insights
      .filter((i) => i.patternType === type)
      .sort((a, b) => (a.averageCPA ?? 999) - (b.averageCPA ?? 999));

  const topHook   = byType("hook_type")[0]    ?? null;
  const topCTA    = byType("cta_type")[0]     ?? null;
  const topVisual = byType("visual_style")[0] ?? null;

  const learnings: string[] = [];

  // Hook comparison
  const hooks = byType("hook_type");
  if (hooks.length >= 2) {
    const best  = hooks[0];
    const worst = hooks[hooks.length - 1];
    learnings.push(
      `${display(best.patternLabel)} hooks show $${best.averageCPA} CPA vs $${worst.averageCPA} for ${display(worst.patternLabel)} hooks.`
    );
  }

  // CTA comparison
  const ctas = byType("cta_type");
  if (ctas.length >= 2) {
    const best  = ctas[0];
    const worst = ctas[ctas.length - 1];
    learnings.push(
      `${display(best.patternLabel)} CTAs outperform ${display(worst.patternLabel)} CTAs ($${best.averageCPA} vs $${worst.averageCPA} CPA).`
    );
  }

  // Visual comparison
  if (topVisual) {
    learnings.push(
      `${display(topVisual.patternLabel)} image concepts show strongest visual performance — ROAS ${topVisual.averageROAS}x.`
    );
  }

  // Top body angle
  const bodyAngles = byType("body_angle");
  if (bodyAngles[0]) {
    const b = bodyAngles[0];
    learnings.push(`${display(b.patternLabel)} body copy is the top-performing angle — ROAS ${b.averageROAS}x.`);
  }

  // Weakest pattern warning
  const weakest = [...insights]
    .filter((i) => i.strength === "weak")
    .sort((a, b) => (b.averageCPA ?? 0) - (a.averageCPA ?? 0))[0];
  if (weakest) {
    learnings.push(`Avoid: ${display(weakest.patternLabel)} — highest observed CPA at $${weakest.averageCPA}.`);
  }

  return {
    totalSignals:      insights.reduce((s, i) => s + i.sampleCount, 0),
    topHookPattern:    topHook,
    topCTAPattern:     topCTA,
    topVisualPattern:  topVisual,
    emergingLearnings: learnings.slice(0, 6),
    insights,
  };
}
