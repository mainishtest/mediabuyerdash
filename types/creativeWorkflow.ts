// types/creativeWorkflow.ts
// Simplified creative workflow types.
//
// These power the unified Creative page where the user can:
//   1. See existing ads with performance data
//   2. Generate copy tests or image variations in one click
//   3. Review generated variants
//   4. Launch a test

// ---------------------------------------------------------------------------
// Creative Overview Item — one row/card in the ad list
// ---------------------------------------------------------------------------

export type CreativeOverviewItem = {
  /** Stable ID: `co_${clientAccountId}_${externalCreativeId}_${externalCampaignId}` */
  id: string;

  // Identity
  externalCreativeId: string;
  externalCampaignId: string;
  clientAccountId: string;
  clientName: string;
  creativeName: string | null;
  campaignName: string;

  // Visual
  thumbnailUrl: string | null;
  imageUrl: string | null;

  // Copy
  adCopy: string | null;
  callToAction: string | null;

  // Performance (CRM-verified where available)
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  frequency: number | null;
  roas: number | null;
  cpa: number | null;

  // Evaluation
  status: CreativeHealthStatus;
  statusLabel: string;

  // Actions available
  canGenerateCopy: boolean;
  canGenerateImage: boolean;
  canLaunchTest: boolean;
};

export type CreativeHealthStatus =
  | "strong"
  | "average"
  | "weak"
  | "fatigued"
  | "insufficient_data";

// ---------------------------------------------------------------------------
// Quick Generate
// ---------------------------------------------------------------------------

export type QuickGenerateMode = "copy_variations" | "image_brief_variations" | "full_refresh_package";

export const QUICK_GENERATE_MODES: Record<
  QuickGenerateMode,
  { label: string; description: string }
> = {
  copy_variations: {
    label: "Copy Tests",
    description: "3 new primary text variations based on this ad's copy and performance",
  },
  image_brief_variations: {
    label: "Image Variations",
    description: "3 image concept briefs based on this ad's visual style and performance",
  },
  full_refresh_package: {
    label: "Full Refresh",
    description: "3 copy variations + 3 image briefs for a complete creative refresh",
  },
};

export type QuickGenerateRequest = {
  overviewItemId: string;
  mode: QuickGenerateMode;
  /** Passed directly to creative-engine API */
  snapshot: {
    externalCreativeId: string;
    externalCampaignId: string;
    clientAccountId: string;
    spend: number;
    impressions: number;
    clicks: number;
    avgCtr: number;
    avgFrequency: number | null;
    campaignRoas: number | null;
    campaignCpa: number | null;
    adCopy: string | null;
    callToAction: string | null;
    creativeName: string | null;
    campaignName: string;
    clientName: string;
  };
};

export type QuickGenerateResult = {
  ok: boolean;
  mode: QuickGenerateMode;
  variants: GeneratedVariant[];
  summary: string;
  error?: string;
  provider?: string;
};

export type GeneratedVariant = {
  id: string;
  type: "copy" | "image_brief";
  title: string;
  content: string;
  rationale: string;
};

// ---------------------------------------------------------------------------
// Quick Launch
// ---------------------------------------------------------------------------

export type QuickLaunchDraft = {
  overviewItemId: string;
  controlCreativeId: string;
  challengerVariantId: string;
  challengerTitle: string;
  challengerType: "copy" | "image_brief" | "combined";
  clientAccountId: string;
  campaignId: string;
  /** Pre-filled from creative context */
  suggestedName: string;
  primaryMetric: "roas" | "cpa";
  evaluationWindowDays: 7 | 14 | 21 | 28;
};

// ---------------------------------------------------------------------------
// Workflow State
// ---------------------------------------------------------------------------

export type CreativeWorkflowStep =
  | "overview"
  | "generating"
  | "review"
  | "launch_setup"
  | "launched";

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export type CreativeOverviewFilters = {
  clientId: string | null;
  campaignId: string | null;
  status: CreativeHealthStatus | null;
  search: string;
};
