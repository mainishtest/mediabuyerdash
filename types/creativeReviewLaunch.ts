// types/creativeReviewLaunch.ts
// Typed models for the simplified review → approve → launch-to-Meta flow.
//
// This bridges the quick-generate output into the publish-prep + Meta launch
// pipeline with minimal friction (select → approve → launch in 3 clicks).

// ---------------------------------------------------------------------------
// Review candidate — a generated variant ready for human review
// ---------------------------------------------------------------------------

export type CreativeReviewCandidate = {
  id:           string;
  variantType:  "copy" | "image";
  title:        string;
  content:      string;       // full copy text or image brief summary
  rationale:    string;
  sourceId:     string;       // source creative/asset ID
  sourceType:   "synced_ad" | "uploaded_asset";
  generationJobId: string | null; // AIGenerationJob.id from quick-generate
};

// ---------------------------------------------------------------------------
// Approval selection — which candidate the user chose
// ---------------------------------------------------------------------------

export type CreativeApprovalSelection = {
  candidateId:     string;
  variantType:     "copy" | "image";
  title:           string;
  content:         string;
  decision:        "approved" | "rejected" | "regenerate";
  approvedAt:      string | null;
};

// ---------------------------------------------------------------------------
// Launch draft — assembled from approved candidate + source context
// ---------------------------------------------------------------------------

export type CreativeLaunchDraft = {
  id:               string;
  prepItemId:       string | null;  // PublishPrepRecord.id once created
  candidateId:      string;
  variantType:      "copy" | "image";
  variantTitle:     string;

  // Source context
  sourceCreativeId: string;
  sourceType:       "synced_ad" | "uploaded_asset";
  clientAccountId:  string;
  clientName:       string;
  campaignName:     string | null;
  creativeName:     string | null;

  // Target — where to launch the challenger
  target:           CreativeLaunchTarget;

  // Payload preview
  hook:             string | null;
  body:             string | null;
  callToAction:     string | null;
  conceptSummary:   string | null;
  visualChanges:    string | null;
  imageNote:        string | null;

  // State
  status:           CreativeLaunchStatus;
  blockers:         CreativeLaunchBlocker[];
};

// ---------------------------------------------------------------------------
// Launch target — the Meta campaign/adset to launch into
// ---------------------------------------------------------------------------

export type CreativeLaunchTarget = {
  campaignExternalId:  string | null;
  campaignName:        string | null;
  adSetExternalId:     string | null;
  adSetName:           string | null;
  destinationUrl:      string | null;
  ctaType:             string | null;
};

// ---------------------------------------------------------------------------
// Launch status
// ---------------------------------------------------------------------------

export type CreativeLaunchStatus =
  | "draft"
  | "ready"
  | "blocked"
  | "launching"
  | "launched"
  | "failed";

// ---------------------------------------------------------------------------
// Launch result — what came back from Meta
// ---------------------------------------------------------------------------

export type CreativeLaunchResult = {
  success:          boolean;
  launchRecordId:   string | null;
  metaCreativeId:   string | null;
  metaAdId:         string | null;
  experimentId:     string | null;
  message:          string;
  errorCode:        string | null;
};

// ---------------------------------------------------------------------------
// Guardrail — a check that must pass before launch
// ---------------------------------------------------------------------------

export type CreativeLaunchGuardrail = {
  key:      string;
  label:    string;
  passed:   boolean;
  required: boolean;
  message:  string;
};

// ---------------------------------------------------------------------------
// Blocker — a reason launch cannot proceed
// ---------------------------------------------------------------------------

export type CreativeLaunchBlocker = {
  code:    string;
  message: string;
};

// ---------------------------------------------------------------------------
// Quick launch summary — for the UI after launch
// ---------------------------------------------------------------------------

export type CreativeQuickLaunchSummary = {
  candidateTitle:    string;
  variantType:       "copy" | "image";
  sourceCreativeName: string | null;
  launchStatus:      CreativeLaunchStatus;
  metaAdId:          string | null;
  experimentId:      string | null;
  launchedAt:        string | null;
};

// ---------------------------------------------------------------------------
// Link — ties a launched test back to the source creative
// ---------------------------------------------------------------------------

export type CreativeLaunchLink = {
  launchRecordId:   string;
  prepItemId:       string;
  sourceCreativeId: string;
  sourceType:       "synced_ad" | "uploaded_asset";
  clientAccountId:  string;
  experimentId:     string | null;
};
