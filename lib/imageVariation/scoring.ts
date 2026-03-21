// lib/imageVariation/scoring.ts
// Deterministic heuristic scoring, ranking, and publish-prep linkage
// for approved image variation candidates.
//
// Architecture:
//   - Pure functions — same input always produces same output.
//   - No AI API calls — scoring runs instantly.
//   - Mirrors lib/creativeScoring/scorer.ts patterns, adapted for image variations.
//   - Readiness thresholds match existing creative scoring.

import type { ImageVariationCandidate, ImageVariationContext } from "./types";
import { IMAGE_VARIATION_INTENTS } from "./types";
import {
  IMAGE_VARIATION_SCORE_DIMENSIONS,
} from "./scoringTypes";
import type {
  ImageVariationScoreDimension,
  ImageVariationScore,
  ImageVariationScorecard,
  ImageVariationScoreExplanation,
  ImageVariationReadiness,
  ImageVariationRisk,
  ImageVariationRanking,
  ImageVariationRankingSummary,
  ImageVariationLaunchReadiness,
  ImageVariationPublishPrepLink,
  ImageVariationSelectionDecision,
} from "./scoringTypes";

const PASS_THRESHOLD = 4;

// Policy-risk patterns (same as creative scorer)
const POLICY_RISK_PHRASES: RegExp[] = [
  /\bguaranteed?\b/i,
  /\b100%\s*(free|safe|effective|guaranteed)\b/i,
  /\bcure[sd]?\b/i,
  /\beliminate\s+debt\b/i,
  /\bget\s+rich\b/i,
  /\blose\s+\d+\s+(pounds?|lbs?)\b/i,
  /\bno\s+risk\b/i,
  /\blast\s+chance\b/i,
  /\blimited\s+time\s+only\b/i,
];

// ---------------------------------------------------------------------------
// Public: scoreImageVariation
// Score a single approved candidate against its context.
// ---------------------------------------------------------------------------

export function scoreImageVariation(
  candidate: ImageVariationCandidate,
  context:   ImageVariationContext | null,
  requestId: string,
): ImageVariationScorecard {
  const dims = Object.keys(IMAGE_VARIATION_SCORE_DIMENSIONS) as ImageVariationScoreDimension[];

  const scores: ImageVariationScore[] = dims.map((dim) => {
    const info = IMAGE_VARIATION_SCORE_DIMENSIONS[dim];
    const { score, explanation } = scoreDimension(dim, candidate, context);
    const contribution = Math.round(score * info.weight * 10);
    return {
      dimension:    dim,
      score,
      weight:       info.weight,
      contribution,
      label:        info.label,
      explanation,
      pass:         score >= PASS_THRESHOLD,
    };
  });

  const totalScore = scores.reduce((sum, s) => sum + s.contribution, 0);
  const readiness  = computeReadiness(totalScore, scores);
  const riskLevel  = computeRisk(totalScore, scores);
  const explanation = buildExplanation(scores, candidate, context);

  return {
    candidateId:    candidate.id,
    candidateTitle: candidate.title,
    requestId,
    dimensions:     scores,
    totalScore,
    readiness,
    riskLevel,
    explanation,
    scoredAt:       new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Public: buildImageVariationScorecard
// Alias for scoreImageVariation (named per spec).
// ---------------------------------------------------------------------------

export const buildImageVariationScorecard = scoreImageVariation;

// ---------------------------------------------------------------------------
// Public: rankImageVariationCandidates
// Sort scorecards into a ranked list.
// ---------------------------------------------------------------------------

export function rankImageVariationCandidates(
  scorecards: ImageVariationScorecard[],
): ImageVariationRanking[] {
  if (scorecards.length === 0) return [];

  const READINESS_PRIORITY: Record<ImageVariationReadiness, number> = {
    ready_for_publish_prep: 0,
    conditionally_ready:    1,
    review_required:        2,
    not_ready:              3,
    blocked:                4,
  };

  const sorted = [...scorecards].sort((a, b) => {
    // 1. Total score DESC
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    // 2. Readiness priority ASC
    const rp = READINESS_PRIORITY[a.readiness] - READINESS_PRIORITY[b.readiness];
    if (rp !== 0) return rp;
    // 3. Visual distinctiveness DESC
    const aD = a.dimensions.find((d) => d.dimension === "visual_distinctiveness")?.score ?? 0;
    const bD = b.dimensions.find((d) => d.dimension === "visual_distinctiveness")?.score ?? 0;
    if (bD !== aD) return bD - aD;
    // 4. Stable tie-break
    return a.candidateId.localeCompare(b.candidateId);
  });

  return sorted.map((sc, idx) => ({
    rank:        idx + 1,
    candidateId: sc.candidateId,
    scorecard:   sc,
    rankReason:  buildRankReason(sc, idx, sorted),
  }));
}

// ---------------------------------------------------------------------------
// Public: computeImageVariationReadiness
// Standalone readiness from scorecard.
// ---------------------------------------------------------------------------

export function computeImageVariationReadiness(
  scorecard: ImageVariationScorecard,
): ImageVariationReadiness {
  return scorecard.readiness;
}

// ---------------------------------------------------------------------------
// Public: summarizeImageVariationRanking
// Aggregate stats for a scored set.
// ---------------------------------------------------------------------------

export function summarizeImageVariationRanking(
  requestId:  string,
  scorecards: ImageVariationScorecard[],
): ImageVariationRankingSummary {
  const rankings = rankImageVariationCandidates(scorecards);
  const avg = scorecards.length > 0
    ? Math.round(scorecards.reduce((s, c) => s + c.totalScore, 0) / scorecards.length)
    : 0;

  return {
    requestId,
    totalCandidates:      scorecards.length,
    readyForPublishPrep:  scorecards.filter((s) => s.readiness === "ready_for_publish_prep").length,
    conditionallyReady:   scorecards.filter((s) => s.readiness === "conditionally_ready").length,
    reviewRequired:       scorecards.filter((s) => s.readiness === "review_required").length,
    notReady:             scorecards.filter((s) => s.readiness === "not_ready").length,
    blocked:              scorecards.filter((s) => s.readiness === "blocked").length,
    highRisk:             scorecards.filter((s) => s.riskLevel === "high").length,
    topRankedCandidateId: rankings[0]?.candidateId ?? null,
    averageScore:         avg,
    scoredAt:             new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Public: buildImageVariationPublishPrepLink
// Create a linkage record for a scored candidate.
// ---------------------------------------------------------------------------

export function buildImageVariationPublishPrepLink(
  candidate: ImageVariationCandidate,
  scorecard: ImageVariationScorecard,
  requestId: string,
): ImageVariationPublishPrepLink {
  return {
    candidateId:      candidate.id,
    requestId,
    sourceCreativeId: candidate.sourceCreativeId,
    campaignId:       candidate.campaignId,
    clientAccountId:  candidate.clientAccountId,
    readiness:        scorecard.readiness,
    totalScore:       scorecard.totalScore,
    linkedAt:         new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Public: computeLaunchReadiness
// Overall readiness for a full scored set.
// ---------------------------------------------------------------------------

export function computeLaunchReadiness(
  requestId:  string,
  scorecards: ImageVariationScorecard[],
): ImageVariationLaunchReadiness {
  const readyCandidates = scorecards.filter((s) => s.readiness === "ready_for_publish_prep");
  const blockers: string[] = [];

  if (scorecards.length === 0) {
    blockers.push("No approved candidates to score.");
  }
  if (readyCandidates.length === 0 && scorecards.length > 0) {
    blockers.push("No candidates meet the publish-prep readiness threshold.");
  }
  const highRisk = scorecards.filter((s) => s.riskLevel === "high");
  if (highRisk.length > 0) {
    blockers.push(`${highRisk.length} candidate(s) flagged as high risk.`);
  }

  const hasReady = readyCandidates.length > 0;
  const nextStep = hasReady
    ? "Select top-ranked candidates for publish preparation."
    : blockers.length > 0
    ? "Resolve blockers before proceeding."
    : "Score approved candidates first.";

  return {
    requestId,
    hasReadyCandidates: hasReady,
    readyCount:         readyCandidates.length,
    blockerCount:       blockers.length,
    blockers,
    nextStep,
  };
}

// ---------------------------------------------------------------------------
// Internal: score individual dimensions
// ---------------------------------------------------------------------------

function scoreDimension(
  dim:       ImageVariationScoreDimension,
  candidate: ImageVariationCandidate,
  context:   ImageVariationContext | null,
): { score: number; explanation: string } {
  switch (dim) {
    case "source_goal_alignment":   return scoreGoalAlignment(candidate, context);
    case "visual_distinctiveness":  return scoreVisualDistinctiveness(candidate, context);
    case "offer_clarity":           return scoreOfferClarity(candidate);
    case "brand_fit":               return scoreBrandFit(candidate, context);
    case "fatigue_separation":      return scoreFatigueSeparation(candidate, context);
    case "format_readiness":        return scoreFormatReadiness(candidate);
    case "recommendation_fit":      return scoreRecommendationFit(candidate, context);
    case "policy_risk":             return scorePolicyRisk(candidate);
    case "launch_readiness":        return scoreLaunchReadiness(candidate);
  }
}

function scoreGoalAlignment(
  c: ImageVariationCandidate,
  ctx: ImageVariationContext | null,
): { score: number; explanation: string } {
  if (!ctx) return { score: 5, explanation: "No context available — default alignment." };

  const intentInfo = IMAGE_VARIATION_INTENTS[c.intent];
  if (!intentInfo) return { score: 5, explanation: "Unknown intent — scored at baseline." };

  // Completeness of brief fields
  const fields = [c.conceptSummary, c.visualChanges, c.goal, c.directResponseAngle];
  const filled = fields.filter((f) => f && f.length > 10).length;
  const base = 4 + filled; // 4-8

  // Bonus if intent matches trigger type
  const triggerBonus =
    (ctx.triggerType === "fatigue" && c.intent.includes("refresh")) ? 1 :
    (ctx.triggerType === "manual" && c.intent === "full_visual_reset") ? 1 : 0;

  const score = Math.min(base + triggerBonus, 10);
  return { score, explanation: `Intent "${intentInfo.label}" — ${filled}/4 brief fields complete, trigger alignment ${triggerBonus > 0 ? "bonus applied" : "neutral"}.` };
}

function scoreVisualDistinctiveness(
  c: ImageVariationCandidate,
  ctx: ImageVariationContext | null,
): { score: number; explanation: string } {
  // Measure based on visual changes description quality
  const changes = c.visualChanges ?? "";
  const concept = c.conceptSummary ?? "";

  if (!changes && !concept) return { score: 2, explanation: "No visual direction described — low distinctiveness." };

  const changeWords = changes.split(/\s+/).length;
  const conceptWords = concept.split(/\s+/).length;

  let score = 4;
  if (changeWords > 15) score += 1;
  if (changeWords > 30) score += 1;
  if (conceptWords > 20) score += 1;
  if (conceptWords > 40) score += 1;

  // Full visual reset intent gets bonus
  if (c.intent === "full_visual_reset") score += 1;

  // Penalty if changes are too short (likely minor tweak)
  if (changeWords < 8) score -= 1;

  score = Math.max(2, Math.min(score, 10));
  return { score, explanation: `Visual changes: ${changeWords} words, concept: ${conceptWords} words${c.intent === "full_visual_reset" ? " (full reset bonus)" : ""}.` };
}

function scoreOfferClarity(c: ImageVariationCandidate): { score: number; explanation: string } {
  const drAngle = c.directResponseAngle ?? "";
  const goal = c.goal ?? "";

  let score = 4;
  if (drAngle.length > 10) score += 2;
  if (drAngle.length > 40) score += 1;
  if (goal.length > 10) score += 1;
  if (goal.length > 30) score += 1;

  // Check for action-oriented language
  const actionWords = /\b(buy|shop|get|claim|try|start|join|save|order|discover)\b/i;
  if (actionWords.test(drAngle) || actionWords.test(goal)) score += 1;

  score = Math.max(2, Math.min(score, 10));
  return { score, explanation: `DR angle: ${drAngle.length > 0 ? "present" : "missing"}, goal: ${goal.length > 0 ? "present" : "missing"}.` };
}

function scoreBrandFit(
  c: ImageVariationCandidate,
  ctx: ImageVariationContext | null,
): { score: number; explanation: string } {
  // Without brand guidelines loaded, score based on concept coherence
  const concept = c.conceptSummary ?? "";
  if (!concept) return { score: 4, explanation: "No concept summary — brand fit indeterminate." };

  let score = 6; // default reasonable fit
  if (concept.length > 30) score += 1;
  if (concept.length > 60) score += 1;

  // If context has constraints, check for mentions
  if (ctx && ctx.constraints.length > 0) {
    score += 1; // context-aware generation is a positive signal
  }

  score = Math.min(score, 10);
  return { score, explanation: `Concept described (${concept.length} chars)${ctx?.constraints.length ? ", constraint-aware generation" : ""}.` };
}

function scoreFatigueSeparation(
  c: ImageVariationCandidate,
  ctx: ImageVariationContext | null,
): { score: number; explanation: string } {
  if (!ctx) return { score: 5, explanation: "No context — default fatigue separation." };

  let score = 5;

  // Fatigue-triggered variations should score higher on separation
  if (ctx.triggerType === "fatigue") {
    score += 2;
    if (c.intent === "full_visual_reset") score += 1;
    if (c.intent.includes("refresh")) score += 1;
  }

  // Underperformance also implies need for change
  if (ctx.triggerType === "underperformance") {
    score += 1;
  }

  // Manual or opportunity — neutral
  score = Math.max(3, Math.min(score, 10));
  return { score, explanation: `Trigger: ${ctx.triggerType}${ctx.triggerType === "fatigue" ? " — strong separation signal" : ""}.` };
}

function scoreFormatReadiness(c: ImageVariationCandidate): { score: number; explanation: string } {
  const fields = [
    { name: "conceptSummary",      val: c.conceptSummary },
    { name: "visualChanges",       val: c.visualChanges },
    { name: "goal",                val: c.goal },
    { name: "directResponseAngle", val: c.directResponseAngle },
  ];

  const present = fields.filter((f) => f.val && f.val.length > 5);
  const missing = fields.filter((f) => !f.val || f.val.length <= 5).map((f) => f.name);

  const score = Math.round((present.length / fields.length) * 10);
  const explanation = missing.length === 0
    ? "All required brief fields present."
    : `Missing or incomplete: ${missing.join(", ")}.`;

  return { score: Math.max(1, score), explanation };
}

function scoreRecommendationFit(
  c: ImageVariationCandidate,
  ctx: ImageVariationContext | null,
): { score: number; explanation: string } {
  if (!ctx || !ctx.recommendationId) {
    return { score: 6, explanation: "No recommendation linked — scored at baseline." };
  }

  // If recommendation-triggered, check if intent aligns
  let score = 6;
  if (ctx.triggerType === "fatigue" || ctx.triggerType === "underperformance") {
    score += 2; // recommendation-driven trigger
  }
  if (ctx.triggerRationale && ctx.triggerRationale.length > 20) {
    score += 1; // detailed rationale available
  }

  score = Math.min(score, 10);
  return { score, explanation: `Recommendation-linked generation (${ctx.triggerType}).` };
}

function scorePolicyRisk(c: ImageVariationCandidate): { score: number; explanation: string } {
  const text = [c.conceptSummary, c.visualChanges, c.goal, c.directResponseAngle]
    .filter(Boolean)
    .join(" ");

  let matches = 0;
  for (const re of POLICY_RISK_PHRASES) {
    if (re.test(text)) matches++;
  }

  const score = Math.max(2, 9 - matches * 2);
  const explanation = matches === 0
    ? "No policy-risk patterns detected."
    : `${matches} policy-risk pattern(s) detected — review before launch.`;

  return { score, explanation };
}

function scoreLaunchReadiness(c: ImageVariationCandidate): { score: number; explanation: string } {
  const fields = [c.conceptSummary, c.visualChanges, c.goal, c.directResponseAngle];
  const filled = fields.filter((f) => f && f.length > 10).length;

  let score = filled >= 4 ? 9 : filled >= 3 ? 7 : filled >= 2 ? 5 : 3;

  // Bonus for having an image URL (real provider output)
  if (c.imageUrl) score = Math.min(score + 1, 10);

  // Penalty if still in "generated" status (not saved/sent_to_review)
  if (c.status === "generated") score = Math.max(score - 2, 1);

  return { score, explanation: `${filled}/4 fields complete${c.imageUrl ? ", image generated" : ", brief only"}.` };
}

// ---------------------------------------------------------------------------
// Internal: compute readiness from scores
// Same thresholds as creative scoring: 72/55/35
// ---------------------------------------------------------------------------

function computeReadiness(
  totalScore: number,
  scores:     ImageVariationScore[],
): ImageVariationReadiness {
  const policy = scores.find((s) => s.dimension === "policy_risk")?.score ?? 9;
  const launch = scores.find((s) => s.dimension === "launch_readiness")?.score ?? 5;
  const format = scores.find((s) => s.dimension === "format_readiness")?.score ?? 5;

  // Blocked: critical policy or format failure
  if (policy <= 2 || format <= 2) return "blocked";

  if (totalScore >= 72 && policy >= 7 && launch >= 7) return "ready_for_publish_prep";
  if (totalScore >= 55 && policy >= 5 && launch >= 5) return "conditionally_ready";
  if (totalScore >= 35) return "review_required";
  return "not_ready";
}

function computeRisk(
  totalScore: number,
  scores:     ImageVariationScore[],
): ImageVariationRisk {
  const policy = scores.find((s) => s.dimension === "policy_risk")?.score ?? 9;
  if (policy < 5 || totalScore < 35) return "high";
  if (policy < 7 || totalScore < 55) return "medium";
  return "low";
}

// ---------------------------------------------------------------------------
// Internal: build explanation from scores
// ---------------------------------------------------------------------------

function buildExplanation(
  scores:    ImageVariationScore[],
  candidate: ImageVariationCandidate,
  context:   ImageVariationContext | null,
): ImageVariationScoreExplanation {
  const strengths: string[] = [];
  const risks: string[] = [];
  const notes: string[] = [];

  const strong = scores.filter((s) => s.score >= 7 && s.weight > 0);
  const weak   = scores.filter((s) => s.score < 4 && s.weight > 0);

  for (const s of strong) {
    strengths.push(`${s.label}: ${s.score}/10 — ${s.explanation}`);
  }
  for (const s of weak) {
    risks.push(`${s.label}: ${s.score}/10 — ${s.explanation}`);
  }

  if (context?.dataQuality === "sparse") {
    notes.push("Sparse performance data — scoring relies on structural signals only.");
  }
  if (!candidate.imageUrl) {
    notes.push("Brief-only candidate — no generated image. Scoring based on concept description.");
  }

  return { strengths, risks, notes };
}

// ---------------------------------------------------------------------------
// Internal: build rank reason
// ---------------------------------------------------------------------------

function buildRankReason(
  sc:     ImageVariationScorecard,
  index:  number,
  all:    ImageVariationScorecard[],
): string {
  const readinessLabel = sc.readiness.replace(/_/g, " ");
  if (index === 0) {
    return sc.totalScore >= 70
      ? `Ranked #1 with ${sc.totalScore}/100 — ${readinessLabel}.`
      : `Ranked #1 by total score (${sc.totalScore}/100) — ${readinessLabel}.`;
  }

  const topScore = all[0].totalScore;
  const gap = topScore - sc.totalScore;
  if (gap <= 5) {
    return `Ranked #${index + 1} — within ${gap} points of the top candidate.`;
  }

  const weakDim = sc.dimensions
    .filter((d) => d.weight > 0 && !d.pass)
    .sort((a, b) => a.score - b.score)[0];

  if (weakDim) {
    return `Ranked #${index + 1} — held back by ${weakDim.label.toLowerCase()} (${weakDim.score}/10).`;
  }

  return `Ranked #${index + 1} with ${sc.totalScore}/100.`;
}
