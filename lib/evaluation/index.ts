// lib/evaluation/index.ts
// Public API for the Phase 3 evaluation module.

export type {
  PerformanceStatus,
  RecommendationType,
  ConfidenceLevel,
  PerformanceDelta,
  Recommendation,
  EvaluationReason,
  PerformanceEvaluation,
  EvaluationInput,
} from "./types";

export { EVAL_THRESHOLDS } from "./thresholds";

export {
  computePerformanceDeltas,
  computeConfidence,
  classifyPerformanceStatus,
  buildRecommendation,
  buildEvaluationReasonSummary,
  evaluatePerformance,
} from "./evaluate";
