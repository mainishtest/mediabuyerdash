// lib/creativeScoring/index.ts
// Public API for the creative draft scoring and ranking engine.

export {
  scoreCreativeDraft,
  buildCreativeDraftScorecard,
  summarizeCreativeDraftStrengths,
  summarizeCreativeDraftRisks,
  buildScoreExplanation,
} from "./scorer";

export {
  rankCreativeDrafts,
  computeApprovalReadiness,
  buildCreativeDraftReviewSet,
} from "./ranking";

export type {
  CreativeScoreDimension,
  CreativeDraftScore,
  CreativeDraftScorecard,
  CreativeApprovalReadiness,
  CreativeApprovalRisk,
  CreativeScoreExplanation,
  CreativeDraftRanking,
  CreativeReviewFeedback,
  CreativeDraftReviewSet,
} from "../../types/creativeScoring";

export {
  DIMENSION_LABEL,
  READINESS_LABEL,
  READINESS_COLOR,
  READINESS_BG,
  RISK_LABEL,
  RISK_COLOR,
} from "../../types/creativeScoring";
