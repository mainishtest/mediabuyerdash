// types/creativeWorkspace.ts
// Typed models for the Creative Review Workspace — unified ops view.
//
// Pure TypeScript — no lib/ imports.

// ---------------------------------------------------------------------------
// Workspace item — a creative that needs attention
// ---------------------------------------------------------------------------

export type WorkspaceItem = {
  id: string;

  // Context
  clientAccountId: string;
  clientName: string;
  campaignId: string | null;
  campaignName: string | null;
  adSetId: string | null;
  adSetName: string | null;
  adId: string | null;
  adName: string | null;

  // Performance KPIs
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  frequency: number | null;
  cpa: number | null;
  roas: number | null;

  // Diagnosis
  diagnosisCause: "copy" | "image" | "mixed" | "unclear" | "other";
  diagnosisConfidence: "low" | "medium" | "high";
  diagnosisSummary: string;
  fatigueStatus: string | null;
  fatigueSignals: Array<{ label: string; severity: "warning" | "critical" }>;
  whyNeedsAttention: string;

  // Current creative content
  thumbnailUrl: string | null;
  currentHook: string | null;
  currentBody: string | null;
  currentCta: string | null;

  // Strengths / weaknesses
  strengths: string[];
  weaknesses: string[];
  changeNotes: string | null;

  // Status
  priority: "low" | "medium" | "high" | "urgent";
  sourceType: string;
  status: WorkspaceItemStatus;
};

export type WorkspaceItemStatus =
  | "needs_review"
  | "in_review"
  | "generating"
  | "comparing"
  | "approved"
  | "test_created"
  | "queued_for_launch"
  | "archived";

// ---------------------------------------------------------------------------
// Copy variation
// ---------------------------------------------------------------------------

export type WorkspaceCopyVariation = {
  id: string;
  title: string;
  hook: string;
  body: string;
  callToAction: string;
  approvalStatus: "draft" | "approved" | "rejected" | "favorite";
};

// ---------------------------------------------------------------------------
// Image variation (concept — not a rendered image)
// ---------------------------------------------------------------------------

export type WorkspaceImageVariation = {
  id: string;
  title: string;
  conceptSummary: string;
  visualChanges: string;
  goal: string;
  thumbnailUrl: string | null;
  approvalStatus: "draft" | "approved" | "rejected" | "favorite";
};

// ---------------------------------------------------------------------------
// Combination mockup — one image + one copy paired together
// ---------------------------------------------------------------------------

export type WorkspaceCombination = {
  id: string;
  imageVariationId: string;
  copyVariationId: string;
  // Denormalized for display
  imageTitle: string;
  imageConcept: string;
  imageThumbnailUrl: string | null;
  copyTitle: string;
  hook: string;
  body: string;
  callToAction: string;
  // Review
  rating: "none" | "strong" | "weak" | "favorite";
  readyForTest: boolean;
};

// ---------------------------------------------------------------------------
// Test draft — lightweight packaging of approved combinations
// ---------------------------------------------------------------------------

export type WorkspaceTestDraft = {
  id: string;
  name: string;
  combinationIds: string[];
  campaignId: string | null;
  campaignName: string | null;
  status: "draft" | "ready" | "launched";
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Launch queue item
// ---------------------------------------------------------------------------

export type WorkspaceLaunchItem = {
  id: string;
  testDraftId: string;
  testName: string;
  combinationCount: number;
  status: "blocked" | "incomplete" | "ready" | "launched";
  blockedReason: string | null;
  campaignName: string | null;
  createdAt: string;
};
