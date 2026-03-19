// lib/publishPrep/index.ts
// Public API for the guarded publish preparation and Meta launch workflow.

export { buildPublishPrepItem, buildPublishPayloadPreview }   from "./builder";
export { validateCreativeDraftForPublish, validateTargetMapping, summarizePublishBlockers } from "./validator";
export { evaluatePublishGuardrails, canProceedToLaunch, deriveStatusFromResults } from "./guardrails";
export {
  savePublishPrepItem,
  loadPublishPrepItems,
  loadPublishPrepItemById,
  updatePublishPrepStatus,
  updatePublishPrepMapping,
  updatePublishPrepNotes,
  buildPublishPrepSummary,
} from "./db";

export type {
  PublishPrepItem,
  PublishPrepStatus,
  LaunchExecutionMode,
  PublishPrepError,
  PublishValidationCheck,
  PublishValidationResult,
  PublishGuardrailResult,
  PublishTargetMapping,
  PublishPayloadPreview,
  MetaCreativePayloadShape,
  LaunchApprovalRequirement,
  PublishPrepSummary,
} from "../../types/publishPrep";

export {
  PREP_STATUS_LABEL,
  PREP_STATUS_COLOR,
  PREP_STATUS_BG,
  EXEC_MODE_LABEL,
} from "../../types/publishPrep";
