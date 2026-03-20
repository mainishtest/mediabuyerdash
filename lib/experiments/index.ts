// lib/experiments/index.ts
// Public API for the closed-loop experiment results and winner detection layer.

export { buildEvaluationWindow, buildWindowDates, buildEmptySnapshot, finaliseSnapshot } from "./builder";
export { ingestExperimentResults }                     from "./ingestor";
export { compareExperimentVariants, computeMetricDelta } from "./comparator";
export { detectWinner, buildExperimentOutcome }         from "./detector";
export { summarizeExperimentLearnings, attachOutcomeToCreativeHistory } from "./learnings";
export {
  saveExperimentPlan,
  upsertExperimentResult,
  saveExperimentLearnings,
  loadExperiments,
  loadExperimentById,
  updateExperimentStatus,
  loadExperimentLearnings,
  buildExperimentSummary,
} from "./db";

export type {
  ExperimentOutcome,
  ExperimentStatus,
  ExperimentComparisonMode,
  ExperimentMetricSnapshot,
  ExperimentMetricDelta,
  ExperimentComparison,
  WinnerDetectionResult,
  ExperimentLearning,
  ExperimentEvaluationWindow,
  ExperimentPlan,
  ExperimentResult,
  ExperimentWithResult,
  ExperimentListSummary,
} from "../../types/experiment";

export {
  OUTCOME_LABEL,
  OUTCOME_COLOR,
  OUTCOME_BG,
  STATUS_LABEL,
  PRIMARY_METRIC_LABEL,
} from "../../types/experiment";
