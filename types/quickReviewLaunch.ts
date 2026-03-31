// ─────────────────────────────────────────────────────────────────────────────
// Quick Review & Launch — Typed Models
// ─────────────────────────────────────────────────────────────────────────────
// These types support the simplified review-and-launch flow that takes a user
// from generated variations → approved candidate → Meta test launch in 3 clicks.
// ─────────────────────────────────────────────────────────────────────────────

// ── Review Candidates ───────────────────────────────────────────────────────

/** A candidate ready for review, assembled from a generation run. */
export interface CreativeReviewCandidate {
  id: string;
  generationRunId: string;
  variationType: "copy" | "image";
  title: string;

  /** Copy fields (if variationType === "copy") */
  hook?: string;
  body?: string;
  callToAction?: string;

  /** Image fields (if variationType === "image") */
  conceptSummary?: string;
  visualChanges?: string;
  goal?: string;
  generatedImageUrl?: string;

  approvalStatus: "draft" | "approved" | "rejected";
}

/** The full set of candidates from a generation run, ready for review. */
export interface CreativeReviewSet {
  generationRunId: string;
  clientAccountId: string;
  clientName?: string;
  sourceAdId?: string;
  sourceAdName?: string;
  copyCandidates: CreativeReviewCandidate[];
  imageCandidates: CreativeReviewCandidate[];
}

// ── Approval ────────────────────────────────────────────────────────────────

/** User's selection of which candidate to approve and launch. */
export interface CreativeApprovalSelection {
  generationRunId: string;
  variationType: "copy" | "image";
  variationId: string;
  decision: "approved" | "rejected";
  notes?: string;
}

// ── Launch Draft ────────────────────────────────────────────────────────────

/** A launch draft ready for Meta execution. */
export interface CreativeLaunchDraft {
  generationRunId: string;
  clientAccountId: string;
  approvedCopyId?: string;
  approvedImageId?: string;

  /** Target mapping for Meta */
  targetCampaignExternalId?: string;
  targetCampaignName?: string;
  targetAdSetExternalId?: string;
  targetAdSetName?: string;
  externalAdAccountId?: string;
  destinationUrl?: string;
  ctaType?: string;

  /** Challenger creative content (denormalized for launch) */
  hook?: string;
  body?: string;
  callToAction?: string;
  imageConceptTitle?: string;
}

/** Target mapping for Meta launch. */
export interface CreativeLaunchTarget {
  externalAdAccountId: string;
  targetCampaignExternalId: string;
  targetCampaignName?: string;
  targetAdSetExternalId: string;
  targetAdSetName?: string;
  destinationUrl?: string;
  ctaType?: string;
}

// ── Launch Status ───────────────────────────────────────────────────────────

export type CreativeLaunchStatusCode =
  | "draft"
  | "ready_for_launch"
  | "blocked"
  | "launching"
  | "launched"
  | "launch_failed";

export interface CreativeLaunchStatus {
  status: CreativeLaunchStatusCode;
  blockers: CreativeLaunchBlocker[];
  canLaunch: boolean;
}

export interface CreativeLaunchBlocker {
  type: string;
  label: string;
  severity: "error" | "warning";
}

// ── Launch Result ───────────────────────────────────────────────────────────

export interface CreativeLaunchResult {
  success: boolean;
  mode: "manual_publish" | "guarded_publish";
  message: string;
  metaCreativeId?: string;
  metaAdId?: string;
  errorCode?: string;
  errorDetail?: string;
}

// ── Guardrails ──────────────────────────────────────────────────────────────

export interface CreativeLaunchGuardrail {
  name: string;
  passed: boolean;
  required: boolean;
  reason?: string;
}

// ── Summary ─────────────────────────────────────────────────────────────────

export interface CreativeQuickLaunchSummary {
  generationRunId: string;
  sourceLabel: string;
  approvedVariationType: "copy" | "image" | "both" | "none";
  launchStatus: CreativeLaunchStatusCode;
  metaAdId?: string;
  metaCreativeId?: string;
  clientAccountId: string;
  createdAt: string;
}

export interface CreativeLaunchLink {
  type: "generation_run" | "meta_ad" | "meta_creative" | "source_asset" | "review";
  id: string;
  label: string;
  href: string;
}
