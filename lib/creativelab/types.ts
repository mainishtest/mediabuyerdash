// lib/creativelab/types.ts
// Pure typed models for the creative performance diagnostics system.
//
// These types are intentionally separate from the generation pipeline types
// in lib/creativeDiagnosis.ts. That layer uses mock copy/image metadata for
// the AI generation workflow. This layer uses real Meta sync data.

// ---------------------------------------------------------------------------
// Evaluation status
// ---------------------------------------------------------------------------

export type CreativeEvaluationStatus =
  | "strong"           // high CTR + good ROAS — scale candidate
  | "average"          // within normal range — monitor
  | "weak"             // low CTR or click-through disconnect
  | "fatigued"         // high frequency — audience overexposed
  | "insufficient_data"; // < $50 spend — not enough signal

// ---------------------------------------------------------------------------
// Per-creative performance snapshot
//
// One snapshot per (externalCreativeId, externalCampaignId) pair.
// Metrics are aggregated from all ad-level MetaSyncedInsight rows
// for that creative in the 14-day detection window.
// ROAS/CPA come from ReconciledCampaignPerformance (CRM-verified).
// ---------------------------------------------------------------------------

export type CreativePerformanceSnapshot = {
  // Identity
  externalCreativeId:  string;
  creativeName:        string | null;
  thumbnailUrl:        string | null;  // Meta CDN URL — may expire
  imageUrl:            string | null;
  adCopy:              string | null;  // MetaSyncedCreative.body
  callToAction:        string | null;

  // Campaign context
  externalCampaignId: string;
  campaignName:       string;
  clientAccountId:    string;
  clientName:         string;

  // Aggregated metrics (14-day window, ad-level insights)
  spend:        number;
  impressions:  number;
  clicks:       number;
  avgCtr:       number;         // (clicks / impressions) * 100, as percentage
  avgFrequency: number | null;  // mean frequency across insight rows

  // CRM-verified campaign-level metrics (from ReconciledCampaignPerformance)
  // null when reconciliation has not been run for this campaign
  campaignRoas: number | null;
  campaignCpa:  number | null;

  // Computed evaluation
  evaluationStatus: CreativeEvaluationStatus;
};

// ---------------------------------------------------------------------------
// Diagnostic — one per snapshot, explaining the evaluation
// ---------------------------------------------------------------------------

export type CreativeDiagnostic = {
  externalCreativeId:   string;
  primaryIssue:         string;       // e.g. "Weak Hook", "Creative Fatigue", "Strong Performer"
  supportingSignals:    string[];     // 1–3 signal descriptions
  recommendedDirection: string;       // actionable next step
};

// ---------------------------------------------------------------------------
// Opportunity — actionable recommendation
// ---------------------------------------------------------------------------

export type CreativeOpportunityType = "scale" | "refresh" | "iterate" | "retire";

export type CreativeOpportunity = {
  externalCreativeId: string;
  creativeName:       string | null;
  opportunityType:    CreativeOpportunityType;
  headline:           string;
  description:        string;
  urgency:            "high" | "medium" | "low";
};
