// lib/creativeFatigue/detector.ts
// Creative fatigue detection engine.
//
// Input:  CreativePerformanceSnapshot[] (from lib/creativelab/performance.ts)
// Output: CreativeFatigueSummary[]
//
// Detection uses only the signals available in the 14-day insight window:
//   - Frequency: proxy for audience overexposure
//   - CTR: engagement health (delivery-side)
//   - Campaign ROAS/CPA: conversion health (CRM-verified)
//   - Spend level: determines whether compound signals are meaningful
//
// No historical trend comparison is performed in v1 — single-window analysis
// only. Multi-window trending requires storing historical snapshots.

import type { CreativePerformanceSnapshot } from "../creativelab/types";
import type {
  CreativeFatigueSignal,
  CreativeFatigueStatus,
  CreativeFatigueSummary,
  CreativeHealthCounts,
  CreativeRefreshRecommendation,
} from "./types";

// ---------------------------------------------------------------------------
// Detection thresholds (aligned with lib/creativelab/performance.ts constants)
// ---------------------------------------------------------------------------

const MIN_SPEND            = 50;    // < this → insufficient_data
const SEVERE_FREQ          = 5.0;   // deeply overexposed
const FATIGUE_FREQ         = 3.5;   // audience fatigued (matches FATIGUE_FREQ in performance.ts)
const WATCH_FREQ           = 2.5;   // proactive watch
const CRITICAL_LOW_CTR_PCT = 0.5;   // engagement collapsed
const WEAK_CTR_PCT         = 0.8;   // weak hook (matches WEAK_CTR_PCT in performance.ts)
const POOR_ROAS            = 1.0;   // spending more than earning
const MODERATE_ROAS        = 1.5;   // below comfortable threshold
const HIGH_SPEND           = 200;   // meaningful spend for compound signals

// ---------------------------------------------------------------------------
// Step 1: Collect individual fatigue signals
// ---------------------------------------------------------------------------

function collectSignals(
  s: CreativePerformanceSnapshot
): CreativeFatigueSignal[] {
  const signals: CreativeFatigueSignal[] = [];

  // — Frequency signals ——————————————————————————————————————————————————————
  if (s.avgFrequency !== null) {
    if (s.avgFrequency > SEVERE_FREQ) {
      signals.push({
        reason:   "frequency_very_high",
        label:    `Frequency ${s.avgFrequency.toFixed(1)}x — audience deeply overexposed`,
        value:    `${s.avgFrequency.toFixed(1)}x`,
        severity: "critical",
      });
    } else if (s.avgFrequency > FATIGUE_FREQ) {
      signals.push({
        reason:   "frequency_high",
        label:    `Frequency ${s.avgFrequency.toFixed(1)}x — audience overexposed`,
        value:    `${s.avgFrequency.toFixed(1)}x`,
        // Critical when CTR is also weak — double-down signal
        severity: s.avgCtr < WEAK_CTR_PCT ? "critical" : "warning",
      });
    }
  }

  // — CTR signals ————————————————————————————————————————————————————————————
  if (s.avgCtr < CRITICAL_LOW_CTR_PCT) {
    signals.push({
      reason:   "ctr_critically_low",
      label:    `CTR ${s.avgCtr.toFixed(2)}% — engagement has collapsed`,
      value:    `${s.avgCtr.toFixed(2)}%`,
      severity: "critical",
    });
  } else if (s.avgCtr < WEAK_CTR_PCT) {
    signals.push({
      reason:   "ctr_declining",
      label:    `CTR ${s.avgCtr.toFixed(2)}% — below ${WEAK_CTR_PCT}% effective threshold`,
      value:    `${s.avgCtr.toFixed(2)}%`,
      severity: "warning",
    });
  }

  // — ROAS signals ———————————————————————————————————————————————————————————
  if (s.campaignRoas !== null) {
    // Determine if other critical signals exist before assigning ROAS severity
    const alreadyCritical = signals.some((sg) => sg.severity === "critical");

    if (s.campaignRoas < POOR_ROAS) {
      signals.push({
        reason:   "roas_below_threshold",
        label:    `Campaign ROAS ${s.campaignRoas.toFixed(2)}x — spending more than earning`,
        value:    `${s.campaignRoas.toFixed(2)}x`,
        severity: alreadyCritical ? "critical" : "warning",
      });
    } else if (s.campaignRoas < MODERATE_ROAS) {
      signals.push({
        reason:   "roas_declining",
        label:    `Campaign ROAS ${s.campaignRoas.toFixed(2)}x — below comfortable threshold`,
        value:    `${s.campaignRoas.toFixed(2)}x`,
        severity: "warning",
      });
    }
  }

  // — Compound: high spend + weak CTR + poor ROAS ————————————————————————————
  // Only add if all three are present (avoids noise on low-data creatives)
  if (
    s.spend >= HIGH_SPEND &&
    s.avgCtr < WEAK_CTR_PCT &&
    s.campaignRoas !== null &&
    s.campaignRoas < POOR_ROAS
  ) {
    signals.push({
      reason:   "high_spend_poor_performance",
      label:    `$${Math.round(s.spend)} spent with weak engagement and poor return`,
      value:    `$${Math.round(s.spend)}`,
      severity: "critical",
    });
  }

  return signals;
}

// ---------------------------------------------------------------------------
// Step 2: Derive fatigue status from signal severity counts
// ---------------------------------------------------------------------------

function deriveStatus(
  s:       CreativePerformanceSnapshot,
  signals: CreativeFatigueSignal[]
): CreativeFatigueStatus {
  if (s.spend < MIN_SPEND) return "insufficient_data";

  const criticalCount   = signals.filter((sg) => sg.severity === "critical").length;
  const hasFreqVeryHigh = signals.some((sg) => sg.reason === "frequency_very_high");
  const hasFreqHigh     = signals.some((sg) => sg.reason === "frequency_high");
  const hasCriticalCtr  = signals.some((sg) => sg.reason === "ctr_critically_low");

  // Severe: deeply overexposed OR 2+ critical signals converging
  if (hasFreqVeryHigh || criticalCount >= 2) return "severe_fatigue";

  // Fatigued: frequency threshold crossed, OR CTR collapsed + poor ROAS together
  if (hasFreqHigh) return "fatigued";
  if (hasCriticalCtr && signals.some((sg) => sg.reason === "roas_below_threshold")) {
    return "fatigued";
  }

  // Watch: frequency building past proactive threshold, OR early warning combos
  if (s.avgFrequency !== null && s.avgFrequency > WATCH_FREQ) return "watch";
  if (hasCriticalCtr) return "watch";
  if (
    signals.some((sg) => sg.reason === "ctr_declining") &&
    signals.some((sg) => sg.reason === "roas_below_threshold")
  ) {
    return "watch";
  }
  if (signals.length > 0) return "watch";

  return "healthy";
}

// ---------------------------------------------------------------------------
// Step 3: Build refresh recommendation
// ---------------------------------------------------------------------------

function buildRecommendation(
  status:  CreativeFatigueStatus,
  signals: CreativeFatigueSignal[],
  s:       CreativePerformanceSnapshot
): CreativeRefreshRecommendation | null {
  if (status === "healthy" || status === "insufficient_data") return null;

  const hasFreqVeryHigh = signals.some((sg) => sg.reason === "frequency_very_high");
  const hasFreqHigh     = signals.some((sg) => sg.reason === "frequency_high");
  const hasWeakCtr      = signals.some(
    (sg) => sg.reason === "ctr_declining" || sg.reason === "ctr_critically_low"
  );
  const hasPoorRoas     = signals.some((sg) => sg.reason === "roas_below_threshold");
  const hasHighSpend    = signals.some((sg) => sg.reason === "high_spend_poor_performance");

  // ── severe_fatigue → full replacement, always highest priority ─────────────
  if (status === "severe_fatigue") {
    return {
      actionType: "generate_full_creative_refresh",
      priority:   "high",
      headline:   "Generate full creative refresh",
      rationale:  hasFreqVeryHigh
        ? `Frequency ${s.avgFrequency?.toFixed(1)}x — audience is deeply overexposed. Replace this creative entirely with a new concept, hook, and visual.`
        : "Multiple critical fatigue signals are converging. A complete creative replacement is needed — new hook angle, new visual, new copy.",
    };
  }

  // ── fatigued ────────────────────────────────────────────────────────────────
  if (status === "fatigued") {
    // High spend + poor ROAS → creative is burning budget; pause it
    if (hasHighSpend && hasPoorRoas) {
      return {
        actionType: "pause_creative_candidate",
        priority:   "high",
        headline:   "Pause and replace creative",
        rationale:  `$${Math.round(s.spend)} spent with CTR ${s.avgCtr.toFixed(2)}% and ROAS ${(s.campaignRoas ?? 0).toFixed(2)}x. This creative is consuming budget without return. Pause it while a replacement is developed.`,
      };
    }

    // Freq + weak CTR → visual hook is tired; image variations first
    if (hasFreqHigh && hasWeakCtr && !hasPoorRoas) {
      return {
        actionType: "generate_new_image_variations",
        priority:   "high",
        headline:   "Generate new image variations",
        rationale:  `Frequency ${s.avgFrequency?.toFixed(1)}x with CTR ${s.avgCtr.toFixed(2)}% — the audience has seen this visual too many times and engagement is declining. Fresh image variations with a new scene or hook frame can re-engage.`,
      };
    }

    // Freq + OK CTR → copy angle is wearing thin; copy variations first
    if (hasFreqHigh && !hasWeakCtr) {
      return {
        actionType: "generate_new_copy_variations",
        priority:   "medium",
        headline:   "Generate new copy variations",
        rationale:  `Frequency ${s.avgFrequency?.toFixed(1)}x — CTR is holding at ${s.avgCtr.toFixed(2)}% but the audience is overexposed. New copy angles can extend this creative&apos;s life before a full replacement is needed.`,
      };
    }

    // Weak CTR + poor ROAS (no frequency data) → full rethink
    if (hasWeakCtr && hasPoorRoas) {
      return {
        actionType: "generate_full_creative_refresh",
        priority:   "high",
        headline:   "Generate full creative refresh",
        rationale:  `CTR ${s.avgCtr.toFixed(2)}% and ROAS ${(s.campaignRoas ?? 0).toFixed(2)}x — both hook engagement and conversion are failing. A complete creative rethink is recommended.`,
      };
    }

    // Fatigued fallback
    return {
      actionType: "review_creative",
      priority:   "medium",
      headline:   "Review creative performance",
      rationale:  "Performance signals indicate fatigue. Review delivery data and prepare a replacement before performance declines further.",
    };
  }

  // ── watch → proactive review ────────────────────────────────────────────────
  return {
    actionType: "review_creative",
    priority:   "low",
    headline:   "Review creative performance",
    rationale:
      s.avgFrequency !== null && s.avgFrequency > WATCH_FREQ
        ? `Frequency ${s.avgFrequency.toFixed(1)}x — approaching the fatigue threshold. Monitor closely and prepare a fresh variant now to avoid a performance drop.`
        : "Early warning signals detected. Monitor this creative and begin planning a refresh if trends continue.",
  };
}

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/**
 * Runs all three detection steps (collect → derive → recommend) for one
 * CreativePerformanceSnapshot and returns a CreativeFatigueSummary.
 */
export function detectCreativeFatigue(
  snapshot: CreativePerformanceSnapshot
): CreativeFatigueSummary {
  const signals = snapshot.spend >= MIN_SPEND ? collectSignals(snapshot) : [];
  const status  = deriveStatus(snapshot, signals);
  const recommendation = buildRecommendation(status, signals, snapshot);

  return {
    externalCreativeId: snapshot.externalCreativeId,
    creativeName:       snapshot.creativeName,
    thumbnailUrl:       snapshot.thumbnailUrl,
    adCopy:             snapshot.adCopy,
    callToAction:       snapshot.callToAction,

    externalCampaignId: snapshot.externalCampaignId,
    campaignName:       snapshot.campaignName,
    clientAccountId:    snapshot.clientAccountId,
    clientName:         snapshot.clientName,

    spend:        snapshot.spend,
    impressions:  snapshot.impressions,
    clicks:       snapshot.clicks,
    avgCtr:       snapshot.avgCtr,
    avgFrequency: snapshot.avgFrequency,
    campaignRoas: snapshot.campaignRoas,
    campaignCpa:  snapshot.campaignCpa,

    fatigueStatus:         status,
    fatigueSignals:        signals,
    refreshRecommendation: recommendation,
  };
}

/**
 * Runs fatigue detection on an entire array of performance snapshots.
 * Results are sorted: most severe first, then by spend descending within each tier.
 */
export function buildCreativeFatigueReport(
  snapshots: CreativePerformanceSnapshot[]
): CreativeFatigueSummary[] {
  const statusRank: Record<CreativeFatigueStatus, number> = {
    severe_fatigue:    4,
    fatigued:          3,
    watch:             2,
    healthy:           1,
    insufficient_data: 0,
  };

  return snapshots
    .map(detectCreativeFatigue)
    .sort((a, b) => {
      const rankDiff = statusRank[b.fatigueStatus] - statusRank[a.fatigueStatus];
      return rankDiff !== 0 ? rankDiff : b.spend - a.spend;
    });
}

/**
 * Aggregates fatigue status counts across all summaries for summary cards.
 */
export function getOverallHealthCounts(
  summaries: CreativeFatigueSummary[]
): CreativeHealthCounts {
  const counts: CreativeHealthCounts = {
    healthy:           0,
    watch:             0,
    fatigued:          0,
    severe_fatigue:    0,
    insufficient_data: 0,
    total:             summaries.length,
  };
  for (const s of summaries) {
    counts[s.fatigueStatus]++;
  }
  return counts;
}

/**
 * Groups health counts by client — useful for per-client summaries.
 */
export function summarizeCreativeHealthByClient(
  summaries: CreativeFatigueSummary[]
): Map<string, CreativeHealthCounts & { clientName: string }> {
  const byClient = new Map<string, CreativeHealthCounts & { clientName: string }>();

  for (const s of summaries) {
    if (!byClient.has(s.clientAccountId)) {
      byClient.set(s.clientAccountId, {
        clientName:        s.clientName,
        healthy:           0,
        watch:             0,
        fatigued:          0,
        severe_fatigue:    0,
        insufficient_data: 0,
        total:             0,
      });
    }
    const c = byClient.get(s.clientAccountId)!;
    c[s.fatigueStatus]++;
    c.total++;
  }

  return byClient;
}

// Re-export type for callers that only import from this module
export type { CreativeHealthCounts };
