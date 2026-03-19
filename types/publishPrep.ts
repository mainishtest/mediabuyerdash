// types/publishPrep.ts
// Typed models for the Guarded Publish Preparation and Meta Launch Workflow.
//
// Design rules:
//   - Pure TypeScript — no imports from lib/ to avoid circular deps.
//   - Publish prep assembles, validates, and guardrail-checks a draft before launch.
//   - No Meta mutations happen in this layer — payload is prepared for human review.
//   - Designed to feed the next step: experiment planning and closed-loop testing.

// ---------------------------------------------------------------------------
// Status lifecycle
// ---------------------------------------------------------------------------

export type PublishPrepStatus =
  | "draft"               // assembled but not validated
  | "validating"          // validation in progress (client-side optimistic state)
  | "blocked"             // validation or guardrail failures prevent progression
  | "ready_for_approval"  // validation passed — awaiting human approval
  | "approved_for_launch" // human approved — awaiting final launch action
  | "ready_to_publish"    // all checks + approval done — safe to trigger publish
  | "publish_failed"      // publish action attempted and failed
  | "published";          // payload delivered for launch

// ---------------------------------------------------------------------------
// Execution mode — controls what publish actions are available
// ---------------------------------------------------------------------------

export type LaunchExecutionMode =
  | "manual_publish"    // human manually publishes via Meta Ads Manager
  | "guarded_publish";  // system triggers publish after all guardrails pass

// ---------------------------------------------------------------------------
// Error — structured publish blocker
// ---------------------------------------------------------------------------

export type PublishPrepError = {
  code:     string;
  message:  string;
  field?:   string;   // which field or step caused the error
  severity: "blocking" | "warning";
};

// ---------------------------------------------------------------------------
// Validation — checks that required conditions are met before approval
// ---------------------------------------------------------------------------

export type PublishValidationCheck = {
  key:     string;   // machine key, e.g. "required_fields"
  label:   string;   // human label
  passed:  boolean;
  message: string;   // explanation of pass or fail
};

export type PublishValidationResult = {
  passed:   boolean;
  checks:   PublishValidationCheck[];
  blockers: PublishPrepError[];     // only blocking failures
  warnings: PublishPrepError[];     // non-blocking issues
};

// ---------------------------------------------------------------------------
// Guardrail — policy and safety checks that gate the launch action
// ---------------------------------------------------------------------------

export type PublishGuardrailResult = {
  key:      string;
  label:    string;
  passed:   boolean;
  required: boolean;   // if true, failure blocks launch entirely
  message:  string;
};

// ---------------------------------------------------------------------------
// Target mapping — where the creative will be delivered
// ---------------------------------------------------------------------------

export type PublishTargetMapping = {
  targetCampaignId:         string | null;   // internal DB campaign id
  targetCampaignName:       string | null;
  targetCampaignExternalId: string | null;   // Meta campaign id
  targetAdSetId:            string | null;
  targetAdSetName:          string | null;
  targetAdSetExternalId:    string | null;   // Meta ad set id
  destinationUrl:           string | null;
  ctaType:                  string | null;
};

// ---------------------------------------------------------------------------
// Payload preview — what would be sent to Meta
// ---------------------------------------------------------------------------

export type PublishPayloadPreview = {
  variantTitle:        string;
  variantType:         "copy" | "image";
  // Copy fields
  hook:                string | null;
  body:                string | null;
  callToAction:        string | null;
  // Image fields
  conceptSummary:      string | null;
  visualChanges:       string | null;
  goal:                string | null;
  directResponseAngle: string | null;
  // Assembled Meta payload shape (ready for human review or API call)
  metaPayloadShape:    MetaCreativePayloadShape;
  // Context
  targetMapping:       PublishTargetMapping;
  launchNotes:         string | null;
};

// Representation of what a Meta ad creative payload would look like
// Does not call Meta — prepared for human review and future API integration.
export type MetaCreativePayloadShape = {
  adMessage:       string | null;   // primary text (hook + body joined)
  adHeadline:      string | null;   // headline or title
  adDescription:   string | null;   // body or concept summary
  ctaText:         string | null;   // call to action text
  ctaType:         string | null;   // Meta CTA enum e.g. SHOP_NOW, LEARN_MORE
  destinationUrl:  string | null;
  imageNote:       string | null;   // image concept for designer (image variants)
  adSetId:         string | null;   // Meta external ad set id
  campaignId:      string | null;   // Meta external campaign id
};

// ---------------------------------------------------------------------------
// Approval requirement — what is needed before the launch action fires
// ---------------------------------------------------------------------------

export type LaunchApprovalRequirement = {
  requiresHumanApproval: boolean;
  approverNote:          string;
  blockedReasons:        string[];
};

// ---------------------------------------------------------------------------
// Main entity — one publish prep item per approved variant
// ---------------------------------------------------------------------------

export type PublishPrepItem = {
  id:              string;
  briefId:         string;
  variantId:       string;
  clientAccountId: string;
  status:          PublishPrepStatus;
  executionMode:   LaunchExecutionMode;

  // Source snapshot
  variantTitle:  string;
  variantType:   "copy" | "image";
  briefIntent:   string;
  briefDraftType: string;
  clientName:    string;
  campaignName:  string | null;
  creativeName:  string | null;

  // Assembled content
  targetMapping:       PublishTargetMapping;
  payloadPreview:      PublishPayloadPreview | null;
  validation:          PublishValidationResult | null;
  guardrails:          PublishGuardrailResult[];
  approvalRequirement: LaunchApprovalRequirement;

  // Review state
  launchNotes:       string | null;
  approvedForLaunch: boolean;
  approvedAt:        string | null;
  publishedAt:       string | null;
  publishError:      string | null;

  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Summary — aggregate counts for the prep queue
// ---------------------------------------------------------------------------

export type PublishPrepSummary = {
  total:              number;
  draft:              number;
  blocked:            number;
  readyForApproval:   number;
  approvedForLaunch:  number;
  readyToPublish:     number;
  published:          number;
  publishFailed:      number;
};

// ---------------------------------------------------------------------------
// Display metadata
// ---------------------------------------------------------------------------

export const PREP_STATUS_LABEL: Record<PublishPrepStatus, string> = {
  draft:               "Draft",
  validating:          "Validating",
  blocked:             "Blocked",
  ready_for_approval:  "Ready for Approval",
  approved_for_launch: "Approved for Launch",
  ready_to_publish:    "Ready to Publish",
  publish_failed:      "Publish Failed",
  published:           "Published",
};

export const PREP_STATUS_COLOR: Record<PublishPrepStatus, string> = {
  draft:               "text-slate-400",
  validating:          "text-sky-400",
  blocked:             "text-rose-400",
  ready_for_approval:  "text-amber-400",
  approved_for_launch: "text-emerald-400",
  ready_to_publish:    "text-emerald-300",
  publish_failed:      "text-rose-400",
  published:           "text-emerald-500",
};

export const PREP_STATUS_BG: Record<PublishPrepStatus, string> = {
  draft:               "border-slate-700 bg-slate-800",
  validating:          "border-sky-700/50 bg-sky-950/20",
  blocked:             "border-rose-800/50 bg-rose-950/20",
  ready_for_approval:  "border-amber-700/50 bg-amber-950/20",
  approved_for_launch: "border-emerald-700/50 bg-emerald-950/20",
  ready_to_publish:    "border-emerald-600/50 bg-emerald-950/30",
  publish_failed:      "border-rose-800/50 bg-rose-950/20",
  published:           "border-emerald-600/50 bg-emerald-950/30",
};

export const EXEC_MODE_LABEL: Record<LaunchExecutionMode, string> = {
  manual_publish:  "Manual Publish",
  guarded_publish: "Guarded Publish",
};
