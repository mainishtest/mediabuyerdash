// lib/creativeFatigue/types.ts
// Typed models for creative fatigue detection and refresh recommendations.
//
// These types are intentionally separate from CreativeEvaluationStatus
// (lib/creativelab/types.ts) which tracks overall quality.
// Fatigue status specifically tracks audience overexposure and declining
// signal patterns — a creative can be "strong" in quality but "watch" in
// fatigue if frequency is building.

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/**
 * How fatigued is this creative with its current audience?
 * Ordered from least to most severe.
 */
export type CreativeFatigueStatus =
  | "healthy"           // no fatigue signals — delivering well
  | "watch"             // early warning signals; proactive review recommended
  | "fatigued"          // audience overexposed; performance declining
  | "severe_fatigue"    // multiple critical signals; replacement urgent
  | "insufficient_data"; // < $50 spend — not enough signal to evaluate

// ---------------------------------------------------------------------------
// Signal reasons
// ---------------------------------------------------------------------------

/**
 * The specific reason a fatigue signal was raised.
 * Multiple reasons can apply simultaneously.
 */
export type CreativeFatigueReason =
  | "frequency_very_high"        // frequency > 5.0x — deeply overexposed
  | "frequency_high"             // frequency > 3.5x — audience fatigued
  | "ctr_critically_low"         // CTR < 0.5% — engagement has collapsed
  | "ctr_declining"              // CTR < 0.8% — weak hook signal
  | "roas_below_threshold"       // campaign ROAS < 1.0x — spending more than earning
  | "roas_declining"             // campaign ROAS < 1.5x — below comfortable threshold
  | "high_spend_poor_performance"; // spend > $200 + weak CTR + poor ROAS (compound)

// ---------------------------------------------------------------------------
// Refresh action types
// ---------------------------------------------------------------------------

/**
 * Recommended action to address a fatigued creative.
 */
export type CreativeRefreshActionType =
  | "review_creative"               // manual review; early warning
  | "generate_new_copy_variations"  // same visual, new message angle
  | "generate_new_image_variations" // new visual hook, same message structure
  | "generate_full_creative_refresh" // complete replacement — new hook + new visual
  | "pause_creative_candidate";     // pause this creative while preparing replacement

// ---------------------------------------------------------------------------
// Signal
// ---------------------------------------------------------------------------

/** One fatigue signal detected for a creative. */
export interface CreativeFatigueSignal {
  reason:   CreativeFatigueReason;
  label:    string;     // human-readable: e.g. "Frequency 4.8x — audience overexposed"
  value:    string;     // raw value for table display: e.g. "4.8x"
  severity: "warning" | "critical";
}

// ---------------------------------------------------------------------------
// Recommendation
// ---------------------------------------------------------------------------

/** The recommended action to take for a fatigued or watched creative. */
export interface CreativeRefreshRecommendation {
  actionType: CreativeRefreshActionType;
  priority:   "low" | "medium" | "high";
  headline:   string;   // short: "Generate new image variations"
  rationale:  string;   // why this recommendation was selected
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

/**
 * Fatigue assessment for one (creative, campaign) pair.
 * Extends CreativePerformanceSnapshot with fatigue-specific fields
 * so callers only need to pass CreativeFatigueSummary[] to the UI.
 */
export interface CreativeFatigueSummary {
  // Identity
  externalCreativeId: string;
  creativeName:       string | null;
  thumbnailUrl:       string | null;
  adCopy:             string | null;
  callToAction:       string | null;

  // Campaign context
  externalCampaignId: string;
  campaignName:       string;
  clientAccountId:    string;
  clientName:         string;

  // Performance metrics (14-day window, ad-level)
  spend:        number;
  impressions:  number;
  clicks:       number;
  avgCtr:       number;       // (clicks / impressions) * 100, as %
  avgFrequency: number | null;

  // CRM-verified campaign metrics
  campaignRoas: number | null;
  campaignCpa:  number | null;

  // Fatigue assessment
  fatigueStatus:         CreativeFatigueStatus;
  fatigueSignals:        CreativeFatigueSignal[];
  refreshRecommendation: CreativeRefreshRecommendation | null;
}

// ---------------------------------------------------------------------------
// Aggregate counts
// ---------------------------------------------------------------------------

/** Counts of creatives by fatigue status — used for summary cards. */
export interface CreativeHealthCounts {
  healthy:           number;
  watch:             number;
  fatigued:          number;
  severe_fatigue:    number;
  insufficient_data: number;
  total:             number;
}
