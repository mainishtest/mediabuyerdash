// lib/outcomeActions/index.ts
// Public API for the outcome action recommendation layer.

export {
  buildOutcomeActionRecommendations,
  computeOutcomeActionPriority,
  computeActionReadiness,
  summarizeOutcomeActions,
} from "./recommender";

export {
  buildScalePlan,
  buildLoserHandlingPlan,
  buildFollowUpExperimentPlan,
} from "./plans";

export type {
  OutcomeActionType,
  OutcomeActionPriority,
  ActionReadinessState,
  OutcomeActionReason,
  ScalePlan,
  LoserHandlingPlan,
  FollowUpExperimentPlan,
  OutcomeActionRecommendation,
  OutcomeActionSummary,
} from "../../types/outcomeActions";

export {
  ACTION_TYPE_LABEL,
  ACTION_PRIORITY_LABEL,
  ACTION_PRIORITY_COLOR,
  ACTION_PRIORITY_BG,
  READINESS_LABEL,
  READINESS_COLOR,
} from "../../types/outcomeActions";
