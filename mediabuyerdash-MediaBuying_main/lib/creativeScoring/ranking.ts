// lib/creativeScoring/ranking.ts
// Ranking, approval-readiness computation, and review set assembly.
//
// Architecture rules:
//   - All functions are pure — no side effects, no API calls.
//   - Ranking is deterministic: totalScore → readiness priority → novelty → id.
//   - computeApprovalReadiness is a policy function, not UI logic.
//   - Designed to feed the publish preparation workflow in the next step.

import type {
  CreativeDraftScorecard,
  CreativeDraftRanking,
  CreativeDraftReviewSet,
  CreativeApprovalReadiness,
}                              from "../../types/creativeScoring";

// ---------------------------------------------------------------------------
// Readiness sort priority (lower = better rank)
// ---------------------------------------------------------------------------

const READINESS_PRIORITY: Record<CreativeApprovalReadiness, number> = {
  ready_for_publish_prep: 0,
  conditionally_ready:    1,
  review_required:        2,
  not_ready:              3,
};

// ---------------------------------------------------------------------------
// Public API: rankCreativeDrafts
// Sorts scorecards into a ranked list.
// Primary:   totalScore DESC
// Secondary: readiness priority ASC
// Tertiary:  angle_novelty score DESC (prefer fresher angles)
// Quaternary: variantId ASC (stable tie-break)
// ---------------------------------------------------------------------------

export function rankCreativeDrafts(
  scorecards: CreativeDraftScorecard[],
): CreativeDraftRanking[] {
  if (scorecards.length === 0) return [];

  const sorted = [...scorecards].sort((a, b) => {
    // 1. Total score descending
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    // 2. Readiness priority ascending
    const rp = READINESS_PRIORITY[a.approvalReadiness] - READINESS_PRIORITY[b.approvalReadiness];
    if (rp !== 0) return rp;
    // 3. Novelty (angle_novelty dimension) descending
    const aN = a.dimensions.find((d) => d.dimension === "angle_novelty")?.score ?? 0;
    const bN = b.dimensions.find((d) => d.dimension === "angle_novelty")?.score ?? 0;
    if (bN !== aN) return bN - aN;
    // 4. Stable tie-break
    return a.variantId.localeCompare(b.variantId);
  });

  return sorted.map((scorecard, index) => ({
    rank:       index + 1,
    variantId:  scorecard.variantId,
    scorecard,
    rankReason: buildRankReason(scorecard, index, sorted),
  }));
}

function buildRankReason(
  scorecard:  CreativeDraftScorecard,
  index:      number,
  allSorted:  CreativeDraftScorecard[],
): string {
  if (index === 0) {
    return scorecard.totalScore >= 70
      ? `Ranked #1 with ${scorecard.totalScore}/100 — ${scorecard.approvalReadiness.replace(/_/g, " ")}.`
      : `Ranked #1 by total score (${scorecard.totalScore}/100) — still requires review.`;
  }

  const topScore = allSorted[0].totalScore;
  const gap      = topScore - scorecard.totalScore;

  if (gap <= 5) {
    return `Ranked #${index + 1} — within ${gap} points of the top variant. Close competition.`;
  }

  const weakDimension = scorecard.dimensions
    .filter((d) => d.weight > 0 && !d.pass)
    .sort((a, b) => a.score - b.score)[0];

  if (weakDimension) {
    return `Ranked #${index + 1} — held back by ${weakDimension.label.toLowerCase()} (${weakDimension.score}/10).`;
  }

  return `Ranked #${index + 1} with ${scorecard.totalScore}/100.`;
}

// ---------------------------------------------------------------------------
// Public API: computeApprovalReadiness
// Standalone policy function — derive readiness from scorecard.
// ---------------------------------------------------------------------------

export function computeApprovalReadiness(
  scorecard: CreativeDraftScorecard,
): CreativeApprovalReadiness {
  return scorecard.approvalReadiness;
}

// ---------------------------------------------------------------------------
// Public API: buildCreativeDraftReviewSet
// Assemble the full scored + ranked output for one brief.
// ---------------------------------------------------------------------------

export function buildCreativeDraftReviewSet(
  briefId:    string,
  scorecards: CreativeDraftScorecard[],
): CreativeDraftReviewSet {
  const rankings = rankCreativeDrafts(scorecards);

  const readyCount        = scorecards.filter((s) => s.approvalReadiness === "ready_for_publish_prep").length;
  const conditionalCount  = scorecards.filter((s) => s.approvalReadiness === "conditionally_ready").length;
  const reviewCount       = scorecards.filter((s) => s.approvalReadiness === "review_required").length;
  const notReadyCount     = scorecards.filter((s) => s.approvalReadiness === "not_ready").length;
  const highRiskCount     = scorecards.filter((s) => s.riskLevel === "high").length;
  const averageScore      = scorecards.length > 0
    ? Math.round(scorecards.reduce((s, c) => s + c.totalScore, 0) / scorecards.length)
    : 0;

  return {
    briefId,
    rankings,
    summary: {
      totalVariants:        scorecards.length,
      readyForPublishPrep:  readyCount,
      conditionallyReady:   conditionalCount,
      reviewRequired:       reviewCount,
      notReady:             notReadyCount,
      highRisk:             highRiskCount,
      topRankedVariantId:   rankings[0]?.variantId ?? null,
      averageScore,
    },
    scoredAt: new Date().toISOString(),
  };
}
