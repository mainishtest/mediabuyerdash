// lib/creativelab/workflowUtils.ts
// Utility functions for the Creative Lab workflow foundation.
//
// These functions bridge the typed workflow models (types/creativeLab.ts)
// with outputs from the existing evaluation, fatigue, and performance modules.
//
// Rules:
//   - All functions are pure — no DB access, no side effects.
//   - CRM is the source of truth for ROAS/CPA (never use Meta self-reported).
//   - Priority derives from signal severity, not subjective importance.
//   - Designed for the next step: Creative Refresh Queue and brief generation.

import type {
  CreativeLabItem,
  CreativeLabPriority,
  CreativeLabStatus,
  CreativeLabSummary,
  CreativeLabFilterState,
  CreativeLabSourceType,
  CreativeLabPerformanceContext,
  CreativeLabFatigueContext,
} from "../../types/creativeLab";
import type { CreativePerformanceSnapshot } from "./types";
import type { CreativeFatigueSummary } from "../creativeFatigue/types";

// ---------------------------------------------------------------------------
// 1. buildCreativeLabItem
// Constructs a full CreativeLabItem from available context sources.
// ---------------------------------------------------------------------------

export type BuildCreativeLabItemOpts = {
  id:                      string;
  clientAccountId:         string;
  clientName:              string;
  sourceType:              CreativeLabSourceType;
  recommendationHeadline:  string;
  recommendationRationale: string;
  suggestedNextAction?:    string;
  campaignId?:             string;
  campaignName?:           string;
  adSetId?:                string;
  adSetName?:              string;
  adId?:                   string;
  adName?:                 string;
  creativeId?:             string;
  creativeName?:           string;
  snapshot?:               CreativePerformanceSnapshot;
  fatigue?:                CreativeFatigueSummary;
  /** ISO string — override for deterministic tests. */
  now?:                    string;
};

export function buildCreativeLabItem(opts: BuildCreativeLabItemOpts): CreativeLabItem {
  const now = opts.now ?? new Date().toISOString();

  const performanceContext: CreativeLabPerformanceContext | null = opts.snapshot
    ? {
        spend:            opts.snapshot.spend,
        impressions:      opts.snapshot.impressions,
        clicks:           opts.snapshot.clicks,
        avgCtr:           opts.snapshot.avgCtr,
        avgFrequency:     opts.snapshot.avgFrequency,
        campaignRoas:     opts.snapshot.campaignRoas,
        campaignCpa:      opts.snapshot.campaignCpa,
        evaluationStatus: opts.snapshot.evaluationStatus,
        thumbnailUrl:     opts.snapshot.thumbnailUrl,
        adCopy:           opts.snapshot.adCopy,
        callToAction:     opts.snapshot.callToAction,
      }
    : null;

  const fatigueContext: CreativeLabFatigueContext | null = opts.fatigue
    ? {
        fatigueStatus:           opts.fatigue.fatigueStatus,
        fatigueSignals:          opts.fatigue.fatigueSignals.map((s) => ({
          label:    s.label,
          severity: s.severity,
        })),
        recommendedAction:       opts.fatigue.refreshRecommendation?.actionType ?? null,
        actionPriority:          opts.fatigue.refreshRecommendation?.priority ?? null,
        recommendationRationale: opts.fatigue.refreshRecommendation?.rationale ?? null,
      }
    : null;

  const priority = deriveCreativeLabPriority({
    sourceType:    opts.sourceType,
    snapshot:      opts.snapshot,
    fatigueSummary: opts.fatigue,
  });

  return {
    id:              opts.id,
    clientAccountId: opts.clientAccountId,
    clientName:      opts.clientName,
    campaignId:      opts.campaignId   ?? opts.snapshot?.externalCampaignId ?? null,
    campaignName:    opts.campaignName ?? opts.snapshot?.campaignName        ?? null,
    adSetId:         opts.adSetId      ?? null,
    adSetName:       opts.adSetName    ?? null,
    adId:            opts.adId         ?? null,
    adName:          opts.adName       ?? null,
    creativeId:      opts.creativeId   ?? opts.snapshot?.externalCreativeId  ?? null,
    creativeName:    opts.creativeName ?? opts.snapshot?.creativeName         ?? null,
    performanceContext,
    fatigueContext,
    evaluationContext: null,  // attached separately via attachCreativePerformanceContext
    status:           "queued",
    priority,
    sourceType:       opts.sourceType,
    reviewState:      "not_started",
    approvalState:    "pending",
    recommendationHeadline:  opts.recommendationHeadline,
    recommendationRationale: opts.recommendationRationale,
    suggestedNextAction:     opts.suggestedNextAction ?? null,
    notes:       null,
    createdAt:   now,
    updatedAt:   now,
    activityLog: [],
  };
}

// ---------------------------------------------------------------------------
// 2. deriveCreativeLabPriority
// Maps signal severity to a priority level.
// Checks are ordered from most to least severe — first match wins.
// ---------------------------------------------------------------------------

export function deriveCreativeLabPriority(opts: {
  sourceType:      CreativeLabSourceType;
  snapshot?:       CreativePerformanceSnapshot;
  fatigueSummary?: CreativeFatigueSummary;
}): CreativeLabPriority {
  const { sourceType, snapshot, fatigueSummary } = opts;

  // Urgent — critical signals requiring immediate buyer action
  if (fatigueSummary?.fatigueStatus === "severe_fatigue")                          return "urgent";
  if ((snapshot?.avgFrequency  ?? 0) > 6.0)                                       return "urgent";
  if ((snapshot?.campaignRoas  ?? 1) < 0.5 && (snapshot?.spend ?? 0) > 100)       return "urgent";

  // High — significant signals that need near-term attention
  if (fatigueSummary?.fatigueStatus === "fatigued")                               return "high";
  if ((snapshot?.campaignRoas  ?? 1) < 1.0 && (snapshot?.spend ?? 0) > 50)        return "high";
  if (sourceType === "winning_creative" && (snapshot?.campaignRoas ?? 0) >= 3.0)   return "high";
  if (sourceType === "underperforming_creative" && (snapshot?.spend ?? 0) > 500)   return "high";

  // Medium — worth reviewing, not urgent
  if (fatigueSummary?.fatigueStatus === "watch")                                   return "medium";
  if (snapshot?.evaluationStatus === "weak")                                        return "medium";
  if (sourceType === "recommendation_engine")                                       return "medium";

  return "low";
}

// ---------------------------------------------------------------------------
// 3. groupCreativeLabItems
// Groups items by workflow status for queue section rendering.
// ---------------------------------------------------------------------------

export function groupCreativeLabItems(
  items: CreativeLabItem[],
): Record<CreativeLabStatus, CreativeLabItem[]> {
  const groups: Record<CreativeLabStatus, CreativeLabItem[]> = {
    draft:          [],
    queued:         [],
    in_review:      [],
    approved:       [],
    rejected:       [],
    needs_revision: [],
    blocked:        [],
    archived:       [],
  };
  for (const item of items) groups[item.status].push(item);
  return groups;
}

// ---------------------------------------------------------------------------
// 4. summarizeCreativeLab
// Computes aggregate counts for the summary stat cards.
// ---------------------------------------------------------------------------

export function summarizeCreativeLab(items: CreativeLabItem[]): CreativeLabSummary {
  let queued = 0, inReview = 0, approved = 0, needsRevision = 0,
      rejected = 0, blocked = 0, highPriority = 0, urgent = 0;

  for (const item of items) {
    if (item.status === "queued")          queued++;
    if (item.status === "in_review")       inReview++;
    if (item.status === "approved")        approved++;
    if (item.status === "needs_revision")  needsRevision++;
    if (item.status === "rejected")        rejected++;
    if (item.status === "blocked")         blocked++;
    if (item.priority === "high")          highPriority++;
    if (item.priority === "urgent")      { highPriority++; urgent++; }
  }

  return {
    total: items.length,
    queued,
    inReview,
    approved,
    needsRevision,
    rejected,
    blocked,
    highPriority,
    urgent,
  };
}

// ---------------------------------------------------------------------------
// 5. normalizeCreativeLabStatus
// Safe coercion from an arbitrary string to a known CreativeLabStatus.
// Used when loading persisted state from URL params or a future DB column.
// ---------------------------------------------------------------------------

const VALID_STATUSES = new Set<CreativeLabStatus>([
  "draft", "queued", "in_review", "approved",
  "rejected", "needs_revision", "blocked", "archived",
]);

export function normalizeCreativeLabStatus(raw: string): CreativeLabStatus {
  return VALID_STATUSES.has(raw as CreativeLabStatus)
    ? (raw as CreativeLabStatus)
    : "draft";
}

// ---------------------------------------------------------------------------
// 6. attachCreativePerformanceContext
// Merges a performance snapshot into an existing item.
// Useful when evaluation is deferred or computed after initial construction.
// ---------------------------------------------------------------------------

export function attachCreativePerformanceContext(
  item:     CreativeLabItem,
  snapshot: CreativePerformanceSnapshot,
): CreativeLabItem {
  return {
    ...item,
    performanceContext: {
      spend:            snapshot.spend,
      impressions:      snapshot.impressions,
      clicks:           snapshot.clicks,
      avgCtr:           snapshot.avgCtr,
      avgFrequency:     snapshot.avgFrequency,
      campaignRoas:     snapshot.campaignRoas,
      campaignCpa:      snapshot.campaignCpa,
      evaluationStatus: snapshot.evaluationStatus,
      thumbnailUrl:     snapshot.thumbnailUrl,
      adCopy:           snapshot.adCopy,
      callToAction:     snapshot.callToAction,
    },
    updatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// applyCreativeLabFilters
// Client-side filter helper used by CreativeLabWorkflowView.
// ---------------------------------------------------------------------------

export function applyCreativeLabFilters(
  items:   CreativeLabItem[],
  filters: CreativeLabFilterState,
): CreativeLabItem[] {
  return items.filter((item) => {
    if (filters.clientId               && item.clientAccountId !== filters.clientId)    return false;
    if (filters.status !== "all"       && item.status    !== filters.status)            return false;
    if (filters.campaignId             && item.campaignId !== filters.campaignId)       return false;
    if (filters.sourceType !== "all"   && item.sourceType !== filters.sourceType)       return false;
    if (filters.priority   !== "all"   && item.priority   !== filters.priority)         return false;
    return true;
  });
}
