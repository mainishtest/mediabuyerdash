// types/creativeBrief.ts
// Typed models for the Creative Brief Generation and Review Workflow.
//
// Design rules:
//   - Pure TypeScript — no imports from lib/ to avoid circular deps.
//   - lib/creativeBrief/briefs.ts bridges these with refresh queue, fatigue,
//     and performance module outputs.
//   - CRM is the source of truth for ROAS/CPA — reflected throughout.
//   - Designed for the next step: AI generation and guarded publish workflow.

// ---------------------------------------------------------------------------
// Draft type — what kind of creative output is being requested
// ---------------------------------------------------------------------------

export type CreativeDraftType =
  | "copy_variation"       // 3 new copy angles — same visual
  | "headline_variation"   // 3 new headline/hook variants — same body
  | "angle_variation"      // 3 new message angle briefs — full copy rethink
  | "image_brief"          // 3 image variation concept briefs — new visual direction
  | "full_refresh_brief";  // complete replacement: new hook + visual + copy angle

// ---------------------------------------------------------------------------
// Generation intent — strategic direction behind the refresh
// ---------------------------------------------------------------------------

export type CreativeGenerationIntent =
  | "preserve_winner_pattern"    // winning creative, extend life via fresh copy/image
  | "refresh_hook"               // hook/headline is weak — rewrite the opening
  | "refresh_angle"              // message angle is wrong — new positioning needed
  | "refresh_visual_direction"   // image is the problem — new visual concept
  | "full_reset";                // everything underperforming — complete replacement

// ---------------------------------------------------------------------------
// Review decision — reviewer's action on a draft variant
// ---------------------------------------------------------------------------

export type CreativeReviewDecision = "approve" | "reject" | "request_revision";

// ---------------------------------------------------------------------------
// Brief status — lifecycle of a brief through the review queue
// ---------------------------------------------------------------------------

export type CreativeBriefStatus =
  | "draft"               // generated but not yet reviewed
  | "in_review"           // buyer is actively reviewing
  | "approved"            // approved — ready for the next step (generation/launch)
  | "rejected"            // dismissed — not proceeding
  | "revision_requested"; // returned for more context or changes

// ---------------------------------------------------------------------------
// Brief section — one structured block of the brief document
// ---------------------------------------------------------------------------

export type CreativeBriefSection = {
  key:     string;  // machine-readable: "context", "diagnosis", "direction" etc.
  heading: string;  // human-readable section title
  content: string;  // markdown-compatible text
};

// ---------------------------------------------------------------------------
// Brief input — assembled from refresh queue item + optional enrichment
//
// This is the canonical input for all brief generation functions.
// CRM metrics (campaignRoas, campaignCpa) are always CRM-verified.
// ---------------------------------------------------------------------------

export type CreativeBriefInput = {
  // Source linkage
  sourceItemId:    string;  // refresh queue item ID that triggered this brief
  clientAccountId: string;
  clientName:      string;
  campaignId:      string | null;
  campaignName:    string | null;
  creativeId:      string | null;
  creativeName:    string | null;

  // Performance context (14-day window)
  spend:        number;
  impressions:  number;
  clicks:       number;
  avgCtr:       number;
  avgFrequency: number | null;
  campaignRoas: number | null;  // CRM-verified — null if not reconciled
  campaignCpa:  number | null;  // CRM-verified — null if not reconciled

  // Creative content (current version — being refreshed)
  adCopy:       string | null;
  callToAction: string | null;
  thumbnailUrl: string | null;

  // Signal context (from refresh queue)
  fatigueStatus:           string | null;   // CreativeFatigueStatus value
  evaluationStatus:        string;          // CreativeEvaluationStatus value
  priorityReason:          string;          // human-readable priority explanation
  signalSummary:           string[];        // list of signal labels from sourceSignals

  // Recommendation context (from refresh queue)
  recommendedActionType:   string;          // CreativeRefreshActionType value
  recommendationRationale: string;

  // Optional enrichment
  notes: string | null;
};

// ---------------------------------------------------------------------------
// Draft variant — one generated output (copy or image brief)
// ---------------------------------------------------------------------------

export type CreativeDraftVariant = {
  id:          string;
  variantType: "copy" | "image";
  title:       string;  // e.g. "Variation A — Outcome-Led Hook"

  // Copy variant fields (populated for copy_variation, headline_variation, angle_variation)
  hook?:         string;
  body?:         string;
  callToAction?: string;

  // Image brief fields (populated for image_brief, full_refresh_brief)
  conceptSummary?:      string;
  visualChanges?:       string;
  goal?:                string;
  directResponseAngle?: string;

  // Review state
  reviewDecision: CreativeReviewDecision | null;
  reviewNote:     string | null;
  reviewedAt:     string | null;  // ISO string
};

// ---------------------------------------------------------------------------
// Draft set — a collection of variants generated for one brief
// ---------------------------------------------------------------------------

export type CreativeDraftSet = {
  draftType:   CreativeDraftType;
  intent:      CreativeGenerationIntent;
  generatedAt: string;  // ISO string
  variants:    CreativeDraftVariant[];
};

// ---------------------------------------------------------------------------
// Creative brief — the full document (input + sections + generated drafts)
// ---------------------------------------------------------------------------

export type CreativeBrief = {
  // Identity
  id:              string;  // cuid from DB
  sourceItemId:    string;  // refresh queue item ID

  // Classification
  draftType:       CreativeDraftType;
  intent:          CreativeGenerationIntent;
  status:          CreativeBriefStatus;

  // Client + campaign context
  clientAccountId: string;
  clientName:      string;
  campaignId:      string | null;
  campaignName:    string | null;
  creativeId:      string | null;
  creativeName:    string | null;

  // Assembled input (preserved for audit and next-step usage)
  input:    CreativeBriefInput;

  // Structured brief document
  sections: CreativeBriefSection[];

  // Generated drafts
  draftSet: CreativeDraftSet;

  // Buyer notes
  notes: string | null;

  // Timestamps
  createdAt: string;  // ISO string
  updatedAt: string;  // ISO string
};

// ---------------------------------------------------------------------------
// Review summary — aggregate counts for stat cards
// ---------------------------------------------------------------------------

export type CreativeDraftSummary = {
  total:             number;
  draft:             number;
  inReview:          number;
  approved:          number;
  rejected:          number;
  revisionRequested: number;
};
