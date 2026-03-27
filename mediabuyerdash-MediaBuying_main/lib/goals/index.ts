// lib/goals/index.ts
// Public API for the Phase 3 goals system.
// Import from here — do not import sub-modules directly in app code.

export type {
  GoalSource,
  ClientGoal,
  CampaignGoal,
  ResolvedGoal,
  GoalResolutionContext,
  GoalInput,
} from "./types";

export { SYSTEM_DEFAULT_GOAL,
         SYSTEM_DEFAULT_ROAS,
         getSystemDefaultGoal }           from "./defaults";

export { getGoalSource,
         mergeGoalFields,
         resolveGoalForCampaign,
         resolveGoalForCreative }          from "./resolve";

export { getClientGoal,
         getCampaignGoal,
         upsertClientGoal,
         upsertCampaignGoal,
         getClientGoalsForClients,
         getCampaignGoalsForCampaigns,
         mapCampaignGoal,
         mapClientGoal }                  from "./service";
