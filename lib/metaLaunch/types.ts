// lib/metaLaunch/types.ts
// Typed models for the Meta creative launch pipeline.
// Pure TypeScript — no imports from lib/ to avoid circular deps.

// ---------------------------------------------------------------------------
// Launch status lifecycle
// ---------------------------------------------------------------------------

export type MetaLaunchStatus =
  | "draft"               // launch request created but not yet ready
  | "ready_for_approval"  // all validation passed, awaiting human approval
  | "approved"            // human approved — ready to execute
  | "launching"           // Meta API call in progress
  | "launched"            // successfully created Meta entities
  | "failed"              // Meta API call failed
  | "blocked";            // policy or guardrail block prevents launch

// ---------------------------------------------------------------------------
// Variant role in a test
// ---------------------------------------------------------------------------

export type MetaLaunchVariantRole =
  | "control"             // existing baseline creative
  | "challenger"          // newly launched creative being tested
  | "backup_candidate";   // approved but not yet launched

// ---------------------------------------------------------------------------
// Launch request — input to the executor
// ---------------------------------------------------------------------------

export type MetaLaunchRequest = {
  prepItemId:       string;
  clientAccountId:  string;
  workspaceId?:     string | null;
  variantRole:      MetaLaunchVariantRole;
  executionMode:    "manual_publish" | "guarded_publish";

  // Optional experiment/launch plan linkage
  experimentId?:    string | null;
  launchPlanId?:    string | null;
  briefId?:        string | null;
  variantId?:      string | null;

  // Control creative reference (for experiment wiring)
  controlAdExternalId?:      string | null;
  controlAdSetExternalId?:   string | null;
  controlCampaignExternalId?: string | null;
  controlCreativeId?:        string | null;
  controlLabel?:             string;
};

// ---------------------------------------------------------------------------
// Launch target — where the creative will be placed
// ---------------------------------------------------------------------------

export type MetaLaunchTarget = {
  targetCampaignExternalId: string | null;
  targetCampaignName:       string | null;
  targetAdSetExternalId:    string | null;
  targetAdSetName:          string | null;
  externalAdAccountId:      string | null;
};

// ---------------------------------------------------------------------------
// Launch result — output from the executor
// ---------------------------------------------------------------------------

export type MetaLaunchResult = {
  success:          boolean;
  launchRecordId:   string;
  status:           MetaLaunchStatus;
  message:          string;
  metaCreativeId?:  string | null;
  metaAdId?:        string | null;
  errorCode?:       string | null;
  errorDetail?:     string | null;
  experimentId?:    string | null;
};

// ---------------------------------------------------------------------------
// Policy gate check result
// ---------------------------------------------------------------------------

export type PolicyGateResult = {
  allowed:  boolean;
  checks:   PolicyGateCheck[];
  blockers: string[];
};

export type PolicyGateCheck = {
  key:     string;
  label:   string;
  passed:  boolean;
  message: string;
};

// ---------------------------------------------------------------------------
// Credential resolution result
// ---------------------------------------------------------------------------

export type ResolvedCredentials = {
  accessToken:        string;
  externalAdAccountId: string;
  connectionId:       string;
};

// ---------------------------------------------------------------------------
// Launch summary for UI
// ---------------------------------------------------------------------------

export type MetaLaunchSummary = {
  total:              number;
  draft:              number;
  readyForApproval:   number;
  approved:           number;
  launching:          number;
  launched:           number;
  failed:             number;
  blocked:            number;
};

// ---------------------------------------------------------------------------
// Display metadata
// ---------------------------------------------------------------------------

export const LAUNCH_STATUS_LABEL: Record<MetaLaunchStatus, string> = {
  draft:               "Draft",
  ready_for_approval:  "Ready for Approval",
  approved:            "Approved",
  launching:           "Launching",
  launched:            "Launched",
  failed:              "Failed",
  blocked:             "Blocked",
};

export const VARIANT_ROLE_LABEL: Record<MetaLaunchVariantRole, string> = {
  control:          "Control",
  challenger:       "Challenger",
  backup_candidate: "Backup Candidate",
};
