// lib/creativePerformance/types.ts
// Typed models for the creative performance layer.

import type { ResolvedGoal, GoalSource } from "../goals/types";
import type { PerformanceEvaluation }    from "../evaluation/types";
//
// Design rules:
//   - One CreativePerformanceRow per ad (externalAdId) within a date window.
//   - CRM is the source of truth for ROAS and CPA — Meta conversions/revenue
//     are never used for evaluation.
//   - Derived metrics never contain NaN or Infinity — null is used for
//     undefined cases (zero denominator), 0 for mathematically valid zeros.
//   - Attribution window: 7 days post-click.

// ---------------------------------------------------------------------------
// CreativePerformanceRow
// One row = one ad / creative aggregated over the query date range.
// ---------------------------------------------------------------------------

export type CreativePerformanceRow = {
  // ── Identity ──────────────────────────────────────────────────────────────
  adId:            string;   // externalAdId
  adName:          string;
  adSetId:         string;   // externalAdSetId
  adSetName:       string;
  campaignId:      string;   // externalCampaignId
  campaignName:    string;
  clientAccountId: string;
  clientName:      string;
  adAccountId:     string;   // externalAdAccountId
  timezone:        string;   // ad account timezone (IANA)

  // ── Creative metadata ─────────────────────────────────────────────────────
  creativeId:   string | null;
  creativeName: string | null;
  thumbnailUrl: string | null;
  adCopy:       string | null;
  callToAction: string | null;

  // ── Aggregation window ────────────────────────────────────────────────────
  dateFrom: string;  // YYYY-MM-DD
  dateTo:   string;  // YYYY-MM-DD

  // ── Platform metrics (Meta, delivery only) ────────────────────────────────
  spend:       number;
  impressions: number;
  clicks:      number;

  // ── CRM metrics (attributed, source of truth) ─────────────────────────────
  // conversions may be fractional when spend-share distribution is used.
  // Round for display; use as-is for aggregation to maintain reconciliation.
  conversions: number;
  revenue:     number;

  // ── Attribution provenance ────────────────────────────────────────────────
  utmMatchedConversions:    number;  // matched via utm_content → ad id/name
  windowMatchedConversions: number;  // matched via utm_campaign + spend-share
  unattributedConversions:  number;  // could not be attributed to any ad
  attributionWindowDays:    number;

  // ── Derived metrics (computed, never NaN/Infinity) ────────────────────────
  ctr:  number;         // clicks / impressions * 100; 0 when impressions = 0
  cpc:  number | null;  // spend / clicks; null when clicks = 0
  cpm:  number | null;  // spend / impressions * 1000; null when impressions = 0
  cpa:  number | null;  // spend / conversions; null when conversions = 0
  roas: number;         // revenue / spend; 0 when spend = 0 or revenue = 0
  cvr:  number | null;  // conversions / clicks * 100; null when clicks = 0

  // ── Resolved goal (campaign → client → system default) ───────────────────
  // Inherited from the campaign this ad belongs to.
  resolvedGoal: ResolvedGoal;
  goalSource:   GoalSource;

  // ── Phase 3 evaluation (additive) ─────────────────────────────────────────
  evaluation: PerformanceEvaluation;
};

// ---------------------------------------------------------------------------
// CreativePerformanceMetrics
// The flat metric portion of a row — used for aggregation helpers.
// ---------------------------------------------------------------------------

export type CreativePerformanceMetrics = {
  spend:       number;
  impressions: number;
  clicks:      number;
  conversions: number;
  revenue:     number;
  ctr:         number;
  cpc:         number | null;
  cpm:         number | null;
  cpa:         number | null;
  roas:        number;
  cvr:         number | null;
};

// ---------------------------------------------------------------------------
// CreativeAttributionMethod
// How a CRM order was linked to an ad.
// ---------------------------------------------------------------------------

export type CreativeAttributionMethod =
  | "utm_content_id"       // utmContent === externalAdId (exact operator ID match)
  | "utm_content_name"     // normalize(utmContent) === normalize(adName)
  | "utm_campaign_window"  // campaign UTM match + 7-day spend-share distribution
  | "unattributed";        // no campaign could be determined

// ---------------------------------------------------------------------------
// CreativeAttributionResult
// Output of attributeOrdersToAds() — one entry per (order → ad) assignment.
// Conversions and revenue are fractional when spend-share is used.
// ---------------------------------------------------------------------------

export type CreativeAttributionResult = {
  adId:              string;   // "" when unattributed
  revenue:           number;
  conversions:       number;   // fractional for spend-share; 1.0 for UTM match
  attributionMethod: CreativeAttributionMethod;
};

// ---------------------------------------------------------------------------
// CreativePerformanceQuery
// Input parameters for getCreativePerformance().
// ---------------------------------------------------------------------------

export type CreativePerformanceQuery = {
  workspaceId?:     string | null;
  clientAccountId?: string;       // filter to one client
  campaignId?:      string;       // filter to one campaign (externalCampaignId)
  dateFrom:         string;       // YYYY-MM-DD
  dateTo:           string;       // YYYY-MM-DD
  windowDays?:      number;       // attribution lookback window (default 7)
};

// ---------------------------------------------------------------------------
// CreativePerformanceSummary
// Totals across all rows returned by a query.
// ---------------------------------------------------------------------------

export type CreativePerformanceSummary = {
  totalCreatives:   number;   // unique ad count
  totalSpend:       number;
  totalImpressions: number;
  totalClicks:      number;
  totalConversions: number;
  totalRevenue:     number;

  // Aggregate derived metrics (computed from totals, not average of rows)
  aggregateCtr:  number;
  aggregateCpc:  number | null;
  aggregateCpm:  number | null;
  aggregateCpa:  number | null;
  aggregateRoas: number;
  aggregateCvr:  number | null;

  // Attribution quality
  utmMatchRate:    number;  // fraction of conversions matched via utm_content
  windowMatchRate: number;  // fraction matched via campaign + spend-share
  unattributedRate: number; // fraction unattributed
};
