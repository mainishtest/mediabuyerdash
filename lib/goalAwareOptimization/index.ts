// lib/goalAwareOptimization/index.ts
// Public API for the goal-aware optimization layer.
//
// Architecture:
//   snapshot.ts          — buildReconciledPerformanceSnapshot (aggregation)
//   evaluate.ts          — evaluateEntityAgainstGoals (deterministic evaluation)
//   recommend.ts         — buildGoalAwareRecommendation (action mapping)
//   campaignEvaluation.ts — evaluateCampaignsFromReconciledMetrics
//   adSetEvaluation.ts   — evaluateAdSetsFromReconciledMetrics
//   adEvaluation.ts      — evaluateAdsFromReconciledMetrics

export type { RawPerformanceInput } from "./snapshot";
export { buildReconciledPerformanceSnapshot } from "./snapshot";
export { evaluateEntityAgainstGoals } from "./evaluate";
export { buildGoalAwareRecommendation } from "./recommend";
export { evaluateCampaignsFromReconciledMetrics } from "./campaignEvaluation";
export { evaluateAdSetsFromReconciledMetrics } from "./adSetEvaluation";
export { evaluateAdsFromReconciledMetrics } from "./adEvaluation";
