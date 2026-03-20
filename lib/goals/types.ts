// lib/goals/types.ts
// Typed models for the Phase 3 goals system.
//
// Design rules:
//   - GoalSource is deterministic: campaign > client > system_default.
//   - ResolvedGoal is always non-null — system defaults guarantee a value at every level.
//   - null fields in ResolvedGoal mean "no target set at any level except possibly system default".
//   - These types are the stable contract for evaluation, automation, and approval flows.

// ---------------------------------------------------------------------------
// GoalSource
// Where the active goal came from (resolution order).
// ---------------------------------------------------------------------------

export type GoalSource =
  | "campaign"       // explicit MetaCampaignGoal set on this campaign
  | "client"         // ClientGoalDefaults for this client
  | "system_default";// no explicit goal at any level — system fallbacks apply

// ---------------------------------------------------------------------------
// ClientGoal
// One row per ClientAccount — default goals for all campaigns.
// ---------------------------------------------------------------------------

export type ClientGoal = {
  clientAccountId: string;
  targetRoas:      number | null;
  targetCpa:       number | null;
  targetCtr:       number | null;  // percentage, e.g. 1.5 = 1.5%
  targetCvr:       number | null;  // percentage, e.g. 2.0 = 2.0%
  maxDailySpend:   number | null;
};

// ---------------------------------------------------------------------------
// CampaignGoal
// One row per externalCampaignId — overrides the client defaults for one campaign.
// ---------------------------------------------------------------------------

export type CampaignGoal = {
  externalCampaignId: string;
  targetRoas:         number | null;
  targetCpa:          number | null;
  targetCtr:          number | null;
  targetCvr:          number | null;
  maxDailySpend:      number | null;
};

// ---------------------------------------------------------------------------
// ResolvedGoal
// The effective goal for a specific entity after resolution.
// Each field has independently fallen through campaign → client → system default.
// The source field tracks the most specific level that had ANY non-null field.
// ---------------------------------------------------------------------------

export type ResolvedGoal = {
  targetRoas:    number | null;
  targetCpa:     number | null;
  targetCtr:     number | null;
  targetCvr:     number | null;
  maxDailySpend: number | null;
  source:        GoalSource;
};

// ---------------------------------------------------------------------------
// GoalResolutionContext
// Identifies what is being resolved — passed to async resolvers.
// ---------------------------------------------------------------------------

export type GoalResolutionContext = {
  campaignId:      string;   // externalCampaignId
  clientAccountId: string;
};

// ---------------------------------------------------------------------------
// GoalInput
// Accepted by upsert functions and API routes.
// All fields are optional — only provided fields are written.
// ---------------------------------------------------------------------------

export type GoalInput = {
  targetRoas?:    number | null;
  targetCpa?:     number | null;
  targetCtr?:     number | null;
  targetCvr?:     number | null;
  maxDailySpend?: number | null;
};
