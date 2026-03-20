// lib/creativeRefreshQueue/queue.ts
// Creative Refresh Queue — generation, prioritization, and recommendation logic.
//
// Input:  CreativePerformanceSnapshot[] from lib/creativelab/performance.ts
// Output: CreativeRefreshQueueItem[]
//
// This module consumes outputs from two existing detection modules:
//   lib/creativelab/performance.ts  → quality + conversion evaluation
//   lib/creativeFatigue/detector.ts → audience overexposure signals
//
// Architecture rules:
//   - Pure functions — no DB access, no side effects.
//   - CRM is the source of truth for ROAS/CPA.
//   - Do not duplicate detection logic — reuse detectCreativeFatigue().
//   - Priority is derived from signals, not subjective importance.
//   - Designed to feed the Creative Brief generation step (next phase).

import { detectCreativeFatigue }        from "../creativeFatigue/detector";
import type { CreativeFatigueSummary }  from "../creativeFatigue/types";
import type { CreativePerformanceSnapshot } from "../creativelab/types";
import type {
  CreativeRefreshQueueItem,
  CreativeRefreshPriority,
  CreativeRefreshQueueRecommendation,
  CreativeRefreshReason,
  CreativeRefreshSourceSignal,
  CreativeRefreshQueueSummary,
  CreativeRefreshQueueFilterState,
} from "../../types/creativeRefreshQueue";

// ---------------------------------------------------------------------------
// Thresholds — aligned with existing detection modules
// ---------------------------------------------------------------------------

const MIN_SPEND          = 50;    // below this → insufficient_data (excluded)
const SEVERE_FREQ        = 5.0;
const FATIGUE_FREQ       = 3.5;
const WATCH_FREQ         = 2.5;
const CRITICAL_CTR       = 0.5;
const WEAK_CTR           = 0.8;
const POOR_ROAS          = 1.0;
const MODERATE_ROAS      = 1.5;
const HIGH_SPEND         = 200;
const URGENT_SPEND       = 500;

// ---------------------------------------------------------------------------
// 1. buildWorkflowItemId
// Stable deterministic ID for cross-page consistency.
// ---------------------------------------------------------------------------

export function buildRefreshQueueItemId(
  clientAccountId: string,
  creativeId:      string | null | undefined,
  campaignId:      string | null | undefined,
): string {
  return `rq_${clientAccountId}_${creativeId ?? "none"}_${campaignId ?? "none"}`;
}

// ---------------------------------------------------------------------------
// 2. getCreativeRefreshReasons
// Derives a typed reason list from snapshot + fatigue summary.
// Multiple reasons can apply simultaneously.
// ---------------------------------------------------------------------------

export function getCreativeRefreshReasons(
  snapshot: CreativePerformanceSnapshot,
  fatigue:  CreativeFatigueSummary,
): CreativeRefreshReason[] {
  const reasons: CreativeRefreshReason[] = [];

  if (fatigue.fatigueStatus === "severe_fatigue") {
    reasons.push("severe_fatigue");
  }
  if (snapshot.avgFrequency !== null && snapshot.avgFrequency > FATIGUE_FREQ) {
    reasons.push("frequency_threshold");
  }
  if (snapshot.avgCtr < CRITICAL_CTR) {
    reasons.push("ctr_collapsed");
  } else if (snapshot.avgCtr < WEAK_CTR) {
    reasons.push("ctr_declining");
  }
  if (snapshot.campaignRoas !== null) {
    if (snapshot.campaignRoas < POOR_ROAS) {
      reasons.push("poor_roas");
    } else if (snapshot.campaignRoas < MODERATE_ROAS) {
      reasons.push("declining_roas");
    }
  }
  if (
    snapshot.spend >= HIGH_SPEND &&
    snapshot.avgCtr < WEAK_CTR &&
    snapshot.campaignRoas !== null &&
    snapshot.campaignRoas < POOR_ROAS
  ) {
    reasons.push("high_spend_poor_return");
    reasons.push("budget_waste_risk");
  }
  if (snapshot.evaluationStatus === "weak") {
    reasons.push("weak_evaluation");
  }
  if (fatigue.fatigueStatus === "watch") {
    reasons.push("watch_signal");
  }

  return [...new Set(reasons)]; // deduplicate
}

// ---------------------------------------------------------------------------
// 3. buildRefreshSourceSignals
// Converts fatigue signals to refresh queue source signals.
// Adds performance-layer signals not captured by the fatigue detector.
// ---------------------------------------------------------------------------

export function buildRefreshSourceSignals(
  snapshot: CreativePerformanceSnapshot,
  fatigue:  CreativeFatigueSummary,
): CreativeRefreshSourceSignal[] {
  const signals: CreativeRefreshSourceSignal[] = [];

  // Fatigue detector signals → surface as-is
  for (const fs of fatigue.fatigueSignals) {
    const type: CreativeRefreshSourceSignal["type"] =
      fs.reason === "high_spend_poor_performance" ? "compound"
      : fs.reason.startsWith("frequency")         ? "fatigue"
      : "performance";

    signals.push({
      type,
      label:    fs.label,
      value:    fs.value,
      severity: fs.severity,
      source:   "fatigue_detector",
    });
  }

  // Performance evaluator signal (non-duplicate from fatigue)
  if (snapshot.evaluationStatus === "weak" && fatigue.fatigueStatus === "healthy") {
    signals.push({
      type:     "performance",
      label:    `Weak evaluation: CTR ${snapshot.avgCtr.toFixed(2)}%${snapshot.campaignRoas != null ? `, ROAS ${snapshot.campaignRoas.toFixed(2)}x` : ""}`,
      value:    `${snapshot.avgCtr.toFixed(2)}%`,
      severity: "warning",
      source:   "performance_evaluator",
    });
  }

  // Spend waste signal (high spend + weak eval — not already in fatigue signals)
  if (
    snapshot.spend >= URGENT_SPEND &&
    snapshot.evaluationStatus !== "strong" &&
    !signals.some((s) => s.type === "compound")
  ) {
    signals.push({
      type:     "spend_waste",
      label:    `$${Math.round(snapshot.spend)} spent — performance below goal`,
      value:    `$${Math.round(snapshot.spend)}`,
      severity: snapshot.evaluationStatus === "weak" ? "critical" : "warning",
      source:   "derived",
    });
  }

  return signals;
}

// ---------------------------------------------------------------------------
// 4. deriveCreativeRefreshPriority
// Maps signal severity and spend context to a priority level.
// Checks run from most to least severe — first match wins.
// ---------------------------------------------------------------------------

export function deriveCreativeRefreshPriority(
  snapshot: CreativePerformanceSnapshot,
  fatigue:  CreativeFatigueSummary,
): { priority: CreativeRefreshPriority; reason: string } {

  const freq  = snapshot.avgFrequency;
  const roas  = snapshot.campaignRoas;
  const spend = snapshot.spend;
  const ctr   = snapshot.avgCtr;

  // ── Urgent ────────────────────────────────────────────────────────────────
  // Deeply overexposed audience — creative must be replaced
  if (fatigue.fatigueStatus === "severe_fatigue") {
    return {
      priority: "urgent",
      reason:   freq != null && freq > SEVERE_FREQ
        ? `Frequency ${freq.toFixed(1)}x — audience deeply overexposed`
        : "Multiple critical fatigue signals converging — immediate replacement needed",
    };
  }
  // Large budget burning with poor ROAS — financial urgency
  if (spend >= URGENT_SPEND && roas !== null && roas < POOR_ROAS) {
    return {
      priority: "urgent",
      reason:   `$${Math.round(spend)} spent with ROAS ${roas.toFixed(2)}x (CRM) — budget waste escalating`,
    };
  }
  // Severe frequency with collapsed CTR
  if (freq !== null && freq > SEVERE_FREQ && ctr < CRITICAL_CTR) {
    return {
      priority: "urgent",
      reason:   `Frequency ${freq.toFixed(1)}x and CTR ${ctr.toFixed(2)}% — creative is exhausted`,
    };
  }

  // ── High ──────────────────────────────────────────────────────────────────
  if (fatigue.fatigueStatus === "fatigued") {
    return {
      priority: "high",
      reason:   freq !== null && freq > FATIGUE_FREQ
        ? `Frequency ${freq.toFixed(1)}x — audience overexposed and performance declining`
        : "Fatigue signals above threshold — refresh needed before performance drops further",
    };
  }
  if (spend >= HIGH_SPEND && roas !== null && roas < POOR_ROAS) {
    return {
      priority: "high",
      reason:   `$${Math.round(spend)} spend with ROAS ${roas.toFixed(2)}x — spending more than earning`,
    };
  }
  if (ctr < CRITICAL_CTR && spend >= HIGH_SPEND) {
    return {
      priority: "high",
      reason:   `CTR ${ctr.toFixed(2)}% with $${Math.round(spend)} spend — engagement has collapsed`,
    };
  }

  // ── Medium ────────────────────────────────────────────────────────────────
  if (fatigue.fatigueStatus === "watch") {
    return {
      priority: "medium",
      reason:   freq !== null && freq > WATCH_FREQ
        ? `Frequency ${freq.toFixed(1)}x — approaching fatigue threshold`
        : "Early warning signals — review and prepare a refresh proactively",
    };
  }
  if (snapshot.evaluationStatus === "weak" && spend >= MIN_SPEND) {
    return {
      priority: "medium",
      reason:   `Weak evaluation: CTR ${ctr.toFixed(2)}%${roas !== null ? `, ROAS ${roas.toFixed(2)}x` : ""} — performance below goal`,
    };
  }
  if (roas !== null && roas < MODERATE_ROAS && spend >= HIGH_SPEND) {
    return {
      priority: "medium",
      reason:   `ROAS ${roas.toFixed(2)}x — below comfortable threshold with meaningful spend`,
    };
  }

  // ── Low ───────────────────────────────────────────────────────────────────
  return {
    priority: "low",
    reason:   "Minor signals detected — monitor performance and refresh if trends worsen",
  };
}

// ---------------------------------------------------------------------------
// 5. buildCreativeRefreshRecommendation
// Builds the queue-specific recommendation (richer than fatigue module's).
// ---------------------------------------------------------------------------

export function buildCreativeRefreshRecommendation(
  snapshot: CreativePerformanceSnapshot,
  fatigue:  CreativeFatigueSummary,
  priority: CreativeRefreshPriority,
): CreativeRefreshQueueRecommendation {

  const freq  = snapshot.avgFrequency;
  const roas  = snapshot.campaignRoas;
  const ctr   = snapshot.avgCtr;
  const spend = snapshot.spend;

  // Derive confidence from data completeness
  const confidence: "low" | "medium" | "high" =
    spend >= HIGH_SPEND && roas !== null ? "high"
    : spend >= MIN_SPEND && roas !== null ? "medium"
    : "low";

  // severe_fatigue → full brief
  if (fatigue.fatigueStatus === "severe_fatigue") {
    return {
      actionType: "generate_full_refresh_brief",
      priority,
      headline:   "Generate full creative refresh brief",
      rationale:  freq != null && freq > SEVERE_FREQ
        ? `Frequency ${freq.toFixed(1)}x — audience is deeply overexposed. A complete creative replacement is needed: new hook, new visual, new copy angle. Brief the refresh in full before any generation.`
        : "Multiple critical fatigue signals are converging. The audience is exhausted with this creative. Generate a full refresh brief covering hook, visual, and copy replacement.",
      confidence,
    };
  }

  // Burning budget → pause candidate
  if (spend >= URGENT_SPEND && roas !== null && roas < POOR_ROAS) {
    return {
      actionType: "pause_creative_candidate",
      priority,
      headline:   "Pause and prepare replacement",
      rationale:  `$${Math.round(spend)} spent with ROAS ${roas.toFixed(2)}x (CRM-verified). This creative is consuming significant budget without return. Pause it and queue a full refresh brief to replace it.`,
      confidence,
    };
  }

  // fatigued + weak CTR → visual is the problem, image variations first
  if (
    fatigue.fatigueStatus === "fatigued" &&
    freq !== null &&
    freq > FATIGUE_FREQ &&
    ctr < WEAK_CTR
  ) {
    return {
      actionType: "generate_new_image_variations",
      priority,
      headline:   "Generate 3 new image variation briefs",
      rationale:  `Frequency ${freq.toFixed(1)}x with CTR ${ctr.toFixed(2)}% — the audience has seen this visual too many times. New image hooks can re-engage while the copy structure is preserved.`,
      confidence,
    };
  }

  // fatigued + OK CTR → copy angle wearing thin
  if (fatigue.fatigueStatus === "fatigued" && freq !== null && freq > FATIGUE_FREQ) {
    return {
      actionType: "generate_new_copy_variations",
      priority,
      headline:   "Generate 3 new copy variations",
      rationale:  `Frequency ${freq.toFixed(1)}x — the audience is overexposed. CTR ${ctr.toFixed(2)}% is still holding, so the visual is working. Fresh copy angles can extend this creative's runway before a full replacement is needed.`,
      confidence,
    };
  }

  // High spend + poor ROAS (without severe fatigue)
  if (spend >= HIGH_SPEND && roas !== null && roas < POOR_ROAS) {
    return {
      actionType: "generate_full_refresh_brief",
      priority,
      headline:   "Generate full creative refresh brief",
      rationale:  `$${Math.round(spend)} spend with ROAS ${roas.toFixed(2)}x and CTR ${ctr.toFixed(2)}%. Both hook and conversion performance are failing. Brief a complete creative replacement.`,
      confidence,
    };
  }

  // watch + weak CTR → copy variations to test new angles
  if (fatigue.fatigueStatus === "watch" && ctr < WEAK_CTR) {
    return {
      actionType: "generate_new_copy_variations",
      priority,
      headline:   "Generate 3 new copy variations",
      rationale:  `CTR ${ctr.toFixed(2)}% with frequency ${freq != null ? `${freq.toFixed(1)}x` : "data pending"} — early fatigue signals and weak engagement. Test new copy angles before the decline accelerates.`,
      confidence,
    };
  }

  // watch → proactive review
  if (fatigue.fatigueStatus === "watch") {
    return {
      actionType: "review_creative",
      priority,
      headline:   "Review creative performance",
      rationale:  freq !== null && freq > WATCH_FREQ
        ? `Frequency ${freq.toFixed(1)}x — approaching the fatigue threshold at ${FATIGUE_FREQ}x. Review now and prepare a variant so you are ready when fatigue hits.`
        : "Early warning signals detected. Review this creative and plan a refresh if trends continue.",
      confidence,
    };
  }

  // weak evaluation with limited spend
  if (snapshot.evaluationStatus === "weak") {
    return {
      actionType: "generate_new_copy_variations",
      priority,
      headline:   "Generate 3 new copy variations",
      rationale:  `CTR ${ctr.toFixed(2)}%${roas !== null ? ` and ROAS ${roas.toFixed(2)}x` : ""} — the hook is not resonating. Test 3 new copy angles to identify a stronger message before investing more spend.`,
      confidence,
    };
  }

  // Fallback
  return {
    actionType: "monitor_only",
    priority:   "low",
    headline:   "Monitor only",
    rationale:  "Performance is within acceptable range. No creative action is required at this time.",
    confidence: "low",
  };
}

// ---------------------------------------------------------------------------
// 6. buildCreativeRefreshQueueItem
// Constructs a single queue item from a snapshot + fatigue summary pair.
// ---------------------------------------------------------------------------

export function buildCreativeRefreshQueueItem(
  snapshot: CreativePerformanceSnapshot,
  fatigue:  CreativeFatigueSummary,
  now?:     string,
): CreativeRefreshQueueItem {
  const id        = buildRefreshQueueItemId(
    snapshot.clientAccountId,
    snapshot.externalCreativeId,
    snapshot.externalCampaignId,
  );
  const { priority, reason: priorityReason } = deriveCreativeRefreshPriority(snapshot, fatigue);
  const reasons        = getCreativeRefreshReasons(snapshot, fatigue);
  const sourceSignals  = buildRefreshSourceSignals(snapshot, fatigue);
  const recommendation = buildCreativeRefreshRecommendation(snapshot, fatigue, priority);

  return {
    id,
    clientAccountId: snapshot.clientAccountId,
    clientName:      snapshot.clientName,
    campaignId:      snapshot.externalCampaignId,
    campaignName:    snapshot.campaignName,
    creativeId:      snapshot.externalCreativeId,
    creativeName:    snapshot.creativeName,
    thumbnailUrl:    snapshot.thumbnailUrl,
    adCopy:          snapshot.adCopy,
    callToAction:    snapshot.callToAction,

    fatigueStatus:    fatigue.fatigueStatus,
    evaluationStatus: snapshot.evaluationStatus,
    sourceSignals,

    priority,
    priorityReason,
    reasons,
    recommendation,

    spend:        snapshot.spend,
    impressions:  snapshot.impressions,
    clicks:       snapshot.clicks,
    avgCtr:       snapshot.avgCtr,
    avgFrequency: snapshot.avgFrequency,
    campaignRoas: snapshot.campaignRoas,
    campaignCpa:  snapshot.campaignCpa,

    createdAt: now ?? new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// 7. buildCreativeRefreshQueue
// Builds the full sorted queue from a performance snapshot array.
//
// Exclusion rules:
//   - evaluationStatus === "insufficient_data" AND spend < MIN_SPEND → excluded
//   - fatigueStatus === "healthy" AND evaluationStatus === "strong" → excluded
//     (strong + healthy → scale candidate, not refresh)
//   - fatigueStatus === "healthy" AND evaluationStatus === "average" → monitor_only
//     (included at low priority for completeness when spend is meaningful)
// ---------------------------------------------------------------------------

export function buildCreativeRefreshQueue(
  snapshots: CreativePerformanceSnapshot[],
  opts?: { includeMonitorOnly?: boolean },
): CreativeRefreshQueueItem[] {
  const includeMonitorOnly = opts?.includeMonitorOnly ?? true;
  const now = new Date().toISOString();

  const items: CreativeRefreshQueueItem[] = [];

  for (const snapshot of snapshots) {
    // Skip below minimum spend — insufficient signal
    if (snapshot.spend < MIN_SPEND) continue;

    const fatigue = detectCreativeFatigue(snapshot);

    // Skip strong performers unless they have watch-level fatigue
    if (
      snapshot.evaluationStatus === "strong" &&
      fatigue.fatigueStatus === "healthy"
    ) {
      continue;
    }

    // Skip pure "average + healthy" with low spend if monitor_only excluded
    if (
      snapshot.evaluationStatus === "average" &&
      fatigue.fatigueStatus === "healthy" &&
      snapshot.spend < HIGH_SPEND
    ) {
      if (!includeMonitorOnly) continue;
    }

    const item = buildCreativeRefreshQueueItem(snapshot, fatigue, now);

    // If monitor_only and caller asked to exclude, skip
    if (!includeMonitorOnly && item.recommendation.actionType === "monitor_only") {
      continue;
    }

    items.push(item);
  }

  // Sort: urgent → high → medium → low, then by spend desc within tier
  const priorityOrder: Record<CreativeRefreshPriority, number> = {
    urgent: 0, high: 1, medium: 2, low: 3,
  };

  return items.sort((a, b) => {
    const tierDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    return tierDiff !== 0 ? tierDiff : b.spend - a.spend;
  });
}

// ---------------------------------------------------------------------------
// 8. summarizeCreativeRefreshQueue
// Aggregate counts for summary stat cards.
// ---------------------------------------------------------------------------

export function summarizeCreativeRefreshQueue(
  items: CreativeRefreshQueueItem[],
): CreativeRefreshQueueSummary {
  let urgent = 0, high = 0, medium = 0, low = 0, monitorOnly = 0;
  let needsCopyVariations = 0, needsImageVariations = 0,
      needsFullBrief = 0, needsPause = 0;

  for (const item of items) {
    switch (item.priority) {
      case "urgent": urgent++; break;
      case "high":   high++;   break;
      case "medium": medium++; break;
      case "low":    low++;    break;
    }
    const a = item.recommendation.actionType;
    if (a === "monitor_only")                  monitorOnly++;
    if (a === "generate_new_copy_variations")  needsCopyVariations++;
    if (a === "generate_new_image_variations") needsImageVariations++;
    if (a === "generate_full_refresh_brief")   needsFullBrief++;
    if (a === "pause_creative_candidate")      needsPause++;
  }

  return {
    total: items.length,
    urgent,
    high,
    medium,
    low,
    monitorOnly,
    needsCopyVariations,
    needsImageVariations,
    needsFullBrief,
    needsPause,
  };
}

// ---------------------------------------------------------------------------
// 9. applyCreativeRefreshQueueFilters
// Client-side filter — used by RefreshQueueView.
// ---------------------------------------------------------------------------

export function applyCreativeRefreshQueueFilters(
  items:   CreativeRefreshQueueItem[],
  filters: CreativeRefreshQueueFilterState,
): CreativeRefreshQueueItem[] {
  return items.filter((item) => {
    if (filters.clientId     && item.clientAccountId !== filters.clientId)             return false;
    if (filters.priority !== "all"    && item.priority !== filters.priority)            return false;
    if (filters.fatigueStatus && filters.fatigueStatus !== "all" && item.fatigueStatus !== filters.fatigueStatus) return false;
    if (filters.actionType !== "all"  && item.recommendation.actionType !== filters.actionType) return false;
    if (filters.campaignId            && item.campaignId !== filters.campaignId)        return false;
    if (filters.confidence !== "all"  && item.recommendation.confidence !== filters.confidence) return false;
    return true;
  });
}
