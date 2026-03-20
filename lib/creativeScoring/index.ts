// lib/creativeScoring/index.ts
// Public API for the creative draft scoring, ranking, and approval readiness engine.
//
// Two layers:
//   Core (scorer.ts + ranking.ts) — unchanged heuristic engine
//   Utils (utils.ts)              — Phase 8 additions: quality signals, readiness status,
//                                   scoreCreative(), rankCreatives(), assignReadinessStatus(),
//                                   summarizeCreativeScore()

// ── Core scorer ──────────────────────────────────────────────────────────────

export {
  scoreCreativeDraft,
  buildCreativeDraftScorecard,
  summarizeCreativeDraftStrengths,
  summarizeCreativeDraftRisks,
  buildScoreExplanation,
} from "./scorer";

// ── Core ranking ─────────────────────────────────────────────────────────────

export {
  rankCreativeDrafts,
  computeApprovalReadiness,
  buildCreativeDraftReviewSet,
} from "./ranking";

// ── Phase 8 utilities ─────────────────────────────────────────────────────────

export {
  scoreCreative,
  rankCreatives,
  assignReadinessStatus,
  summarizeCreativeScore,
  buildCreativeScoreBreakdown,
} from "./utils";

// ── Types ─────────────────────────────────────────────────────────────────────

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
  // Phase 8 additions
  CreativeQualitySignalType,
  CreativeQualitySignal,
  CreativeReadinessStatus,
  CreativeRejectionReason,
  CreativeScore,
  CreativeScoreBreakdown,
  CreativeRanking,
} from "../../types/creativeScoring";

// ── Display constants ─────────────────────────────────────────────────────────

export {
  DIMENSION_LABEL,
  READINESS_LABEL,
  READINESS_COLOR,
  READINESS_BG,
  RISK_LABEL,
  RISK_COLOR,
  // Phase 8 additions
  READINESS_STATUS_LABEL,
  READINESS_STATUS_COLOR,
  READINESS_STATUS_BG,
  QUALITY_SIGNAL_ICON,
  QUALITY_SIGNAL_COLOR,
  QUALITY_SIGNAL_BG,
} from "../../types/creativeScoring";
