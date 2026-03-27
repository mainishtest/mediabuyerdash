// lib/creativeTestResults/index.ts
// Public API for the Creative Performance Results Ingestion and Tracking layer.

export { ingestCreativeTestResults } from "./ingestor";

export {
  adaptSnapshot,
  buildTestEvaluationWindow,
  compareCreativeTestVariants,
  evaluateCreativeTestOutcome,
  computeCreativeTestConfidence,
  deriveTrackingState,
} from "./evaluator";

export {
  buildCreativeLifecycleResultLink,
  buildCreativeTestResultSummary,
  summarizeCreativeTestResult,
  buildRecommendedNextStep,
} from "./lifecycle";

export {
  saveCreativeTestResult,
  updateCreativeTestResult,
  loadCreativeTestResults,
  loadCreativeTestResultById,
  buildCreativeTestResultDbSummary,
  saveCreativeLifecycleResultLink,
  loadLifecycleLinksForResult,
  loadLifecycleLinksForPrepItem,
} from "./db";

export type {
  CreativeTestTrackingState,
  CreativeTestOutcome,
  CreativeTestMetricSnapshot,
  CreativeTestComparison,
  CreativeTestEvaluationWindow,
  CreativeTestOutcomeReason,
  CreativeTestConfidenceLevel,
  CreativeTestConfidence,
  CreativeLifecycleResultLink,
  CreativeTestResult,
  CreativeTestResultSummary,
  CreateCreativeTestResultInput,
} from "../../types/creativeTestResults";

export {
  TEST_TRACKING_STATE_LABEL,
  TEST_TRACKING_STATE_COLOR,
  TEST_TRACKING_STATE_BG,
  TEST_OUTCOME_LABEL,
  TEST_OUTCOME_COLOR,
  TEST_OUTCOME_BG,
  CONFIDENCE_LEVEL_LABEL,
  CONFIDENCE_LEVEL_COLOR,
} from "../../types/creativeTestResults";
