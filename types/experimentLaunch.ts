// types/experimentLaunch.ts
// Typed models for Creative Experiment Launch Wiring.
//
// Design rules:
//   - Pure TypeScript — no imports from lib/ to avoid circular deps.
//   - Bridges approved creative drafts into structured experiment launch plans.
//   - CRM data (ROAS/CPA) is the source of truth — 7-day attribution enforced.
//   - No autonomous launch execution — human approval gates every launch action.
//   - Designed to wire into ExperimentPlan once the plan reaches ready_for_launch.

// ---------------------------------------------------------------------------
// Variant role
// ---------------------------------------------------------------------------

export type CreativeExperimentVariantRole =
  | "control"           // the existing / baseline creative being measured against
  | "challenger"        // the newly approved creative being tested
  | "backup_candidate"; // secondary candidate, not yet assigned to active test

// ---------------------------------------------------------------------------
// Readiness state lifecycle
// ---------------------------------------------------------------------------

export type CreativeExperimentReadinessState =
  | "draft"            // assembled but missing key fields
  | "needs_mapping"    // variant roles assigned but no campaign/ad set mapping
  | "needs_approval"   // all mapped and complete — awaiting human approval
  | "ready_for_launch" // approved and all guardrails pass — can transition to experiment
  | "blocked"          // has one or more blocking issues preventing progression
  | "launched";        // wired to an active ExperimentRecord

// ---------------------------------------------------------------------------
// Variant — either a control or challenger creative snapshot
// ---------------------------------------------------------------------------

export type CreativeExperimentVariant = {
  role:                  CreativeExperimentVariantRole;
  label:                 string;
  // Source creative references
  creativeId:            string | null;
  creativeName:          string | null;
  adExternalId:          string | null;   // Meta ad id
  adSetExternalId:       string | null;   // Meta ad set id
  campaignExternalId:    string | null;   // Meta campaign id
  // Source publish-prep references (for challenger)
  prepItemId:            string | null;   // PublishPrepRecord.id
  briefId:               string | null;
  variantId:             string | null;
  // Display
  variantTitle:          string | null;
  variantType:           "copy" | "image" | null;
};

export type CreativeExperimentControl = Omit<CreativeExperimentVariant, "role"> & {
  role: "control";
};

export type CreativeExperimentChallenger = Omit<CreativeExperimentVariant, "role"> & {
  role: "challenger";
  // Extra challenger context from publish-prep
  briefIntent:       string | null;   // what the brief was trying to achieve
  briefDraftType:    string | null;   // e.g. "copy_refresh", "new_angle"
  clientName:        string | null;
  campaignName:      string | null;
};

// ---------------------------------------------------------------------------
// Target mapping — which campaign and ad set the test runs in
// ---------------------------------------------------------------------------

export type CreativeExperimentMapping = {
  clientAccountId:      string;
  externalAdAccountId:  string | null;
  // Campaign
  campaignId:           string | null;   // internal DB id
  campaignName:         string | null;
  campaignExternalId:   string | null;   // Meta campaign id
  // Ad set
  adSetId:              string | null;   // internal DB id
  adSetName:            string | null;
  adSetExternalId:      string | null;   // Meta ad set id
  // Comparison mode
  comparisonMode:       "simultaneous" | "sequential";
};

// ---------------------------------------------------------------------------
// Success criteria — defines what constitutes a win
// ---------------------------------------------------------------------------

export type CreativeExperimentSuccessCriteria = {
  primaryMetric:            string;   // e.g. "roas_7d", "cpa_7d", "ctr", "orders"
  secondaryMetrics:         string[]; // additional tracked metrics
  guardrailMetrics:         string[]; // metrics that must not degrade (e.g. cpm, spend_floor)
  successThreshold:         number;   // minimum relative lift required (e.g. 0.10 = 10%)
  minSpendPerVariant:       number;   // $ minimum before evaluation is valid
  minConversionsPerVariant: number;   // conversion minimum before evaluation is valid
  evaluationWindowDays:     number;   // always 7 for 7-day CRM attribution window
  hypothesisStatement:      string | null;  // human-readable hypothesis
};

// ---------------------------------------------------------------------------
// Guardrail — a safety check that gates launch readiness
// ---------------------------------------------------------------------------

export type CreativeExperimentGuardrail = {
  key:      string;    // machine key
  label:    string;    // human label
  passed:   boolean;
  required: boolean;   // if true, failure blocks ready_for_launch state
  message:  string;
};

// ---------------------------------------------------------------------------
// Launch reason — a blocker, warning, or info note on the plan
// ---------------------------------------------------------------------------

export type CreativeExperimentLaunchReason = {
  key:      string;
  label:    string;
  severity: "blocking" | "warning" | "info";
  message:  string;
};

// ---------------------------------------------------------------------------
// Launch readiness — computed output of the readiness evaluation
// ---------------------------------------------------------------------------

export type CreativeExperimentLaunchReadiness = {
  state:         CreativeExperimentReadinessState;
  blockers:      CreativeExperimentLaunchReason[];
  warnings:      CreativeExperimentLaunchReason[];
  infos:         CreativeExperimentLaunchReason[];
  nextAction:    string;  // recommended next step for the reviewer
  isLaunchReady: boolean; // true only when state === "ready_for_launch"
};

// ---------------------------------------------------------------------------
// Main entity — the experiment launch plan
// ---------------------------------------------------------------------------

export type CreativeExperimentLaunchPlan = {
  id:              string;
  clientAccountId: string;
  name:            string;
  hypothesis:      string | null;
  objective:       string | null;

  // Source references — links back to the approved creative workflow
  prepItemId:      string | null;   // PublishPrepRecord.id (challenger source)
  briefId:         string | null;
  variantId:       string | null;
  recommendationId: string | null;  // CreativeLabItem or recommendation id if applicable

  // Variants
  control:    CreativeExperimentControl;
  challenger: CreativeExperimentChallenger;

  // Where the test runs
  mapping:        CreativeExperimentMapping;

  // What constitutes a win
  successCriteria: CreativeExperimentSuccessCriteria;

  // Safety gates
  guardrails:     CreativeExperimentGuardrail[];

  // Computed readiness
  readiness:      CreativeExperimentLaunchReadiness;

  // Review state
  launchNotes:    string | null;
  approvedAt:     string | null;
  approvedBy:     string | null;

  // Linked experiment (populated when plan transitions to launched)
  linkedExperimentId: string | null;
  launchedAt:         string | null;

  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Summary — aggregate counts for the launch queue
// ---------------------------------------------------------------------------

export type CreativeExperimentLaunchSummary = {
  total:          number;
  draft:          number;
  needsMapping:   number;
  needsApproval:  number;
  readyForLaunch: number;
  blocked:        number;
  launched:       number;
};

// ---------------------------------------------------------------------------
// Input for creating a new launch plan
// ---------------------------------------------------------------------------

export type CreateExperimentLaunchPlanInput = {
  clientAccountId:  string;
  name:             string;
  hypothesis?:      string | null;
  objective?:       string | null;
  // Source
  prepItemId?:      string | null;
  briefId?:         string | null;
  variantId?:       string | null;
  recommendationId?: string | null;
  // Challenger fields (from publish prep)
  challengerVariantTitle?:    string | null;
  challengerVariantType?:     "copy" | "image" | null;
  challengerBriefIntent?:     string | null;
  challengerBriefDraftType?:  string | null;
  challengerClientName?:      string | null;
  challengerCampaignName?:    string | null;
  // Mapping
  targetCampaignId?:         string | null;
  targetCampaignName?:       string | null;
  targetCampaignExternalId?: string | null;
  targetAdSetId?:            string | null;
  targetAdSetName?:          string | null;
  targetAdSetExternalId?:    string | null;
  externalAdAccountId?:      string | null;
  comparisonMode?:           "simultaneous" | "sequential";
  // Success criteria
  primaryMetric?:             string;
  secondaryMetrics?:          string[];
  guardrailMetrics?:          string[];
  successThreshold?:          number;
  minSpendPerVariant?:        number;
  minConversionsPerVariant?:  number;
  evaluationWindowDays?:      number;
  // Notes
  launchNotes?:               string | null;
};

// ---------------------------------------------------------------------------
// Display metadata
// ---------------------------------------------------------------------------

export const READINESS_STATE_LABEL: Record<CreativeExperimentReadinessState, string> = {
  draft:            "Draft",
  needs_mapping:    "Needs Mapping",
  needs_approval:   "Needs Approval",
  ready_for_launch: "Ready for Launch",
  blocked:          "Blocked",
  launched:         "Launched",
};

export const READINESS_STATE_COLOR: Record<CreativeExperimentReadinessState, string> = {
  draft:            "text-slate-400",
  needs_mapping:    "text-amber-400",
  needs_approval:   "text-sky-400",
  ready_for_launch: "text-emerald-400",
  blocked:          "text-rose-400",
  launched:         "text-violet-400",
};

export const READINESS_STATE_BG: Record<CreativeExperimentReadinessState, string> = {
  draft:            "border-slate-700 bg-slate-800",
  needs_mapping:    "border-amber-700/40 bg-amber-950/20",
  needs_approval:   "border-sky-700/40 bg-sky-950/20",
  ready_for_launch: "border-emerald-700/40 bg-emerald-950/20",
  blocked:          "border-rose-800/40 bg-rose-950/20",
  launched:         "border-violet-700/40 bg-violet-950/20",
};

export const VARIANT_ROLE_LABEL: Record<CreativeExperimentVariantRole, string> = {
  control:          "Control",
  challenger:       "Challenger",
  backup_candidate: "Backup Candidate",
};

export const PRIMARY_METRIC_OPTIONS: Array<{ key: string; label: string }> = [
  { key: "roas_7d",  label: "ROAS (7-day CRM)"   },
  { key: "cpa_7d",   label: "CPA (7-day CRM)"    },
  { key: "orders",   label: "Orders"              },
  { key: "revenue",  label: "Revenue"             },
  { key: "ctr",      label: "CTR"                 },
  { key: "cpm",      label: "CPM"                 },
];
