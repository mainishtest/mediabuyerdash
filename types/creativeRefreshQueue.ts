// types/creativeRefreshQueue.ts
// Typed models for the Creative Refresh Queue.
//
// The refresh queue consumes outputs from two existing modules:
//   - lib/creativeFatigue  → audience overexposure signals
//   - lib/creativelab      → quality and conversion evaluation
//
// It merges both into a prioritised, reviewable work list without
// duplicating any detection or evaluation logic.
//
// Design rules:
//   - Pure TypeScript — no imports from lib/ to avoid circular deps.
//   - lib/creativeRefreshQueue/queue.ts bridges these types with module outputs.
//   - CRM is the source of truth for ROAS/CPA — always noted where relevant.

// ---------------------------------------------------------------------------
// Priority — how urgently this creative needs refresh attention
// ---------------------------------------------------------------------------

export type CreativeRefreshPriority = "low" | "medium" | "high" | "urgent";

// ---------------------------------------------------------------------------
// Action types — what the buyer should do next
// ---------------------------------------------------------------------------

/**
 * The recommended creative action for this queue item.
 * Extends the fatigue module's action types with queue-specific additions.
 *
 * generate_full_refresh_brief  → produce a structured brief doc (not auto-generation)
 * monitor_only                 → no action needed; watch for signal changes
 */
export type CreativeRefreshActionType =
  | "review_creative"               // manual review — early warning, buyer judgement needed
  | "generate_new_copy_variations"  // same visual, new message angle
  | "generate_new_image_variations" // new visual hook, same message structure
  | "generate_full_refresh_brief"   // structured brief for a complete creative replacement
  | "pause_creative_candidate"      // pause while replacement is prepared
  | "monitor_only";                 // no action now; re-evaluate on next sync

// ---------------------------------------------------------------------------
// Source signal — what triggered this item's inclusion in the queue
// ---------------------------------------------------------------------------

/**
 * One contributing signal that places a creative in the refresh queue.
 * Multiple signals can contribute to the same item.
 */
export type CreativeRefreshSourceSignal = {
  type:        "fatigue" | "performance" | "compound" | "spend_waste";
  label:       string;    // human-readable: "Frequency 4.8x — audience overexposed"
  value:       string;    // raw metric value: "4.8x"
  severity:    "warning" | "critical";
  source:      "fatigue_detector" | "performance_evaluator" | "derived";
};

// ---------------------------------------------------------------------------
// Reason — why this item is in the queue (summary level)
// ---------------------------------------------------------------------------

/**
 * Top-level reason this creative was added to the refresh queue.
 * Used for filter options and the priority rationale display.
 */
export type CreativeRefreshReason =
  | "severe_fatigue"              // audience deeply overexposed
  | "frequency_threshold"         // frequency crossed the fatigue boundary
  | "ctr_collapsed"               // CTR below critical threshold
  | "ctr_declining"               // CTR below effective threshold
  | "poor_roas"                   // ROAS below 1x (losing money)
  | "declining_roas"              // ROAS below comfortable threshold
  | "high_spend_poor_return"      // compound: high spend + weak CTR + poor ROAS
  | "weak_evaluation"             // performance evaluator flagged weak
  | "watch_signal"                // early warning signals from fatigue detector
  | "budget_waste_risk";          // creative continuing to spend without return

// ---------------------------------------------------------------------------
// Recommendation
// ---------------------------------------------------------------------------

/**
 * The recommended next action for this queue item.
 * Richer than the fatigue module's CreativeRefreshRecommendation —
 * adds a confidence level and queue-specific action types.
 */
export type CreativeRefreshQueueRecommendation = {
  actionType:  CreativeRefreshActionType;
  priority:    CreativeRefreshPriority;
  headline:    string;
  rationale:   string;
  confidence:  "low" | "medium" | "high";
};

// ---------------------------------------------------------------------------
// Main entity — CreativeRefreshQueueItem
// ---------------------------------------------------------------------------

/**
 * One creative in the refresh queue.
 * Built by merging a CreativePerformanceSnapshot with a CreativeFatigueSummary.
 */
export type CreativeRefreshQueueItem = {
  // Stable deterministic ID: rq_{clientAccountId}_{creativeId}_{campaignId}
  id: string;

  // Identity
  clientAccountId: string;
  clientName:      string;
  campaignId:      string;
  campaignName:    string;
  creativeId:      string | null;
  creativeName:    string | null;
  thumbnailUrl:    string | null;
  adCopy:          string | null;
  callToAction:    string | null;

  // Signal inputs (from existing modules)
  fatigueStatus:    string | null;  // CreativeFatigueStatus | null
  evaluationStatus: string;         // CreativeEvaluationStatus
  sourceSignals:    CreativeRefreshSourceSignal[];

  // Derived outputs
  priority:       CreativeRefreshPriority;
  priorityReason: string;           // one-line explanation of why this priority
  reasons:        CreativeRefreshReason[];
  recommendation: CreativeRefreshQueueRecommendation;

  // Performance snapshot (14-day window)
  spend:        number;
  impressions:  number;
  clicks:       number;
  avgCtr:       number;
  avgFrequency: number | null;
  campaignRoas: number | null;  // CRM-verified
  campaignCpa:  number | null;  // CRM-verified

  // Metadata
  createdAt: string;  // ISO string
};

// ---------------------------------------------------------------------------
// Summary — aggregate counts for stat cards
// ---------------------------------------------------------------------------

export type CreativeRefreshQueueSummary = {
  total:       number;
  urgent:      number;
  high:        number;
  medium:      number;
  low:         number;
  monitorOnly: number;
  // By action type
  needsCopyVariations:  number;
  needsImageVariations: number;
  needsFullBrief:       number;
  needsPause:           number;
};

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

export type CreativeRefreshQueueFilterState = {
  clientId:       string;
  priority:       CreativeRefreshPriority | "all";
  fatigueStatus:  string;  // CreativeFatigueStatus | "all"
  actionType:     CreativeRefreshActionType | "all";
  campaignId:     string;
  confidence:     "low" | "medium" | "high" | "all";
};
