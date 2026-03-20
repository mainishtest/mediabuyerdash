// lib/experimentLaunch/index.ts
// Public API for the Creative Experiment Launch Wiring layer.

export {
  buildCreativeExperimentLaunchPlan,
  buildCreativeExperimentLaunchPlanFromPrepItem,
  assignCreativeExperimentRoles,
} from "./builder";

export {
  buildCreativeExperimentMapping,
  isMappingComplete,
  getMappingBlockers,
} from "./mapping";

export {
  buildCreativeExperimentSuccessCriteria,
  buildCreativeExperimentGuardrails,
  allRequiredGuardrailsPass,
} from "./criteria";

export {
  computeCreativeExperimentLaunchReadiness,
  recomputePlanReadiness,
  buildExperimentLaunchSummary,
  summarizeCreativeExperimentLaunchPlan,
} from "./readiness";

export {
  saveExperimentLaunchPlan,
  updateExperimentLaunchPlan,
  loadExperimentLaunchPlans,
  loadExperimentLaunchPlanById,
  buildExperimentLaunchPlanSummary,
} from "./db";

export type {
  CreativeExperimentVariantRole,
  CreativeExperimentReadinessState,
  CreativeExperimentVariant,
  CreativeExperimentControl,
  CreativeExperimentChallenger,
  CreativeExperimentMapping,
  CreativeExperimentSuccessCriteria,
  CreativeExperimentGuardrail,
  CreativeExperimentLaunchReason,
  CreativeExperimentLaunchReadiness,
  CreativeExperimentLaunchPlan,
  CreativeExperimentLaunchSummary,
  CreateExperimentLaunchPlanInput,
} from "../../types/experimentLaunch";

export {
  READINESS_STATE_LABEL,
  READINESS_STATE_COLOR,
  READINESS_STATE_BG,
  VARIANT_ROLE_LABEL,
  PRIMARY_METRIC_OPTIONS,
} from "../../types/experimentLaunch";
