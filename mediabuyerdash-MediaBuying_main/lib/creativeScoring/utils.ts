// lib/creativeScoring/utils.ts
// Phase 8: Creative Draft Scoring, Ranking, and Approval Readiness Layer.
//
// Utility functions layered on top of the core heuristic scorer:
//
//   scoreCreative()         — score one variant + generate quality signals
//   rankCreatives()         — rank an array of scorecards (alias for rankCreativeDrafts)
//   assignReadinessStatus() — map scorecard → CreativeReadinessStatus
//   summarizeCreativeScore() — produce a human-readable single-sentence summary
//
// Architecture rules:
//   - All functions are pure — no side effects, no API calls.
//   - scoreCreative augments scoreCreativeDraft without modifying the core scorer.
//   - Quality signals are heuristic, explainable, and deterministic.
//   - assignReadinessStatus is the policy-translation layer between the internal
//     approval gate (CreativeApprovalReadiness) and the user-facing workflow status.
//   - CRM is the source of truth — ROAS/CPA from brief context inform signal generation.

import type { CreativeDraftVariant, CreativeBrief } from "../../types/creativeBrief";
import type {
  CreativeDraftScorecard,
  CreativeDraftRanking,
  CreativeReadinessStatus,
  CreativeQualitySignal,
  CreativeScoreBreakdown,
  CreativeScore,
} from "../../types/creativeScoring";
import { scoreCreativeDraft }  from "./scorer";
import { rankCreativeDrafts }  from "./ranking";

// ---------------------------------------------------------------------------
// Internal: derive a CreativeScore from a raw total
// ---------------------------------------------------------------------------

function buildCreativeScore(totalScore: number, scoredAt: string): CreativeScore {
  const tier =
    totalScore >= 72 ? "strong" :
    totalScore >= 55 ? "good"   :
    totalScore >= 35 ? "weak"   :
    "failing";
  return { value: totalScore, tier, scoredAt };
}

// ---------------------------------------------------------------------------
// Internal: detect quality signals from scorecard + brief context
//
// Signal detection is heuristic — same rules every time for the same input.
// ---------------------------------------------------------------------------

function detectQualitySignals(
  scorecard: CreativeDraftScorecard,
  brief:     CreativeBrief,
): CreativeQualitySignal[] {
  const signals: CreativeQualitySignal[] = [];

  const dim = (key: string) => scorecard.dimensions.find((d) => d.dimension === key);

  const policyScore  = dim("policy_risk")?.score      ?? 10;
  const noveltyScore = dim("angle_novelty")?.score     ?? 7;
  const hookScore    = dim("hook_strength")?.score     ?? 0;
  const hookWeight   = dim("hook_strength")?.weight    ?? 0;
  const launchScore  = dim("launch_readiness")?.score  ?? 10;
  const goalScore    = dim("goal_alignment")?.score    ?? 0;

  const hasSourceCopy = !!brief.input.adCopy?.trim();
  const hasCrmData    = brief.input.campaignRoas !== null || brief.input.campaignCpa !== null;
  const isCopy        = scorecard.variantType === "copy";

  // ── winning_pattern_match ────────────────────────────────────────────────
  // Preserve-winner intent + strong goal alignment = the draft honours the pattern.
  if (brief.intent === "preserve_winner_pattern" && goalScore >= 7) {
    signals.push({
      type:     "winning_pattern_match",
      label:    "Winning Pattern",
      detail:   "Aligns with preserve_winner_pattern intent — goal alignment confirms the winning structure is retained.",
      severity: "positive",
    });
  }

  // ── duplicate_detected ───────────────────────────────────────────────────
  // Angle novelty ≤ 3 with source copy present = near-duplicate.
  if (hasSourceCopy && noveltyScore <= 3) {
    signals.push({
      type:     "duplicate_detected",
      label:    "Near Duplicate",
      detail:   `Very high word overlap with source creative (novelty ${noveltyScore}/10) — audience may recognise this as the same ad.`,
      severity: "critical",
    });
  }

  // ── missing_signals ──────────────────────────────────────────────────────
  // Launch readiness < 4 means required fields are absent.
  if (launchScore < 4) {
    signals.push({
      type:     "missing_signals",
      label:    "Missing Fields",
      detail:   "Required creative fields are absent (hook, body, or CTA for copy; concept and visual changes for image). Complete before advancing.",
      severity: "critical",
    });
  }

  // ── low_confidence ───────────────────────────────────────────────────────
  // No CRM metrics and no source copy = scoring is based on structure alone.
  if (!hasCrmData && !hasSourceCopy) {
    signals.push({
      type:     "low_confidence",
      label:    "Low Context",
      detail:   "No CRM ROAS/CPA and no source copy available — scoring reflects structure only, not performance alignment. Use with caution.",
      severity: "warning",
    });
  }

  // ── policy_flag ──────────────────────────────────────────────────────────
  // Policy risk < 5 = compliance phrases detected.
  if (policyScore < 5) {
    signals.push({
      type:     "policy_flag",
      label:    "Policy Risk",
      detail:   `Policy-sensitive language detected (policy score ${policyScore}/10) — review for platform compliance before submitting for approval.`,
      severity: "critical",
    });
  }

  // ── high_novelty ─────────────────────────────────────────────────────────
  // Novelty ≥ 8 with source copy present = strong freshness signal.
  if (hasSourceCopy && noveltyScore >= 8) {
    signals.push({
      type:     "high_novelty",
      label:    "High Novelty",
      detail:   `Very low word overlap with source creative (novelty ${noveltyScore}/10) — audience is unlikely to experience ad fatigue from this variant.`,
      severity: "positive",
    });
  }

  // ── hook_weakness ────────────────────────────────────────────────────────
  // Copy variant with hook below threshold.
  if (isCopy && hookWeight > 0 && hookScore < 4) {
    signals.push({
      type:     "hook_weakness",
      label:    "Weak Hook",
      detail:   `Hook strength is ${hookScore}/10 — below the passing threshold. Scroll-stopping power may be limited; consider regenerating the hook.`,
      severity: "warning",
    });
  }

  // ── platform_compliant ───────────────────────────────────────────────────
  // Policy clean + all fields present = platform ready.
  if (policyScore >= 8 && launchScore >= 8) {
    signals.push({
      type:     "platform_compliant",
      label:    "Platform Ready",
      detail:   "No policy risk phrases detected and all required fields are present — this variant is structurally ready for the Meta platform.",
      severity: "positive",
    });
  }

  return signals;
}

// ---------------------------------------------------------------------------
// Public API: assignReadinessStatus
//
// Maps CreativeApprovalReadiness (internal policy gate) →
// CreativeReadinessStatus (user-facing workflow label).
//
// high_potential is promoted when:
//   - conditionally_ready AND (novelty ≥ 8 OR hook ≥ 8)
//   This surfaces creatives that are technically imperfect but have strong
//   freshness or hook power — worth prioritising for human review.
// ---------------------------------------------------------------------------

export function assignReadinessStatus(
  scorecard:         CreativeDraftScorecard,
  manuallyRejected?: boolean,
): CreativeReadinessStatus {
  if (manuallyRejected) return "rejected";

  const { approvalReadiness } = scorecard;

  if (approvalReadiness === "ready_for_publish_prep") {
    return "ready_for_approval";
  }

  if (approvalReadiness === "conditionally_ready") {
    const novelty = scorecard.dimensions.find((d) => d.dimension === "angle_novelty")?.score ?? 0;
    const hook    = scorecard.dimensions.find((d) => d.dimension === "hook_strength")?.score  ?? 0;
    // Promote to high_potential if novelty or hook is strong
    if (novelty >= 8 || hook >= 8) {
      return "high_potential";
    }
    return "needs_review";
  }

  if (approvalReadiness === "review_required") {
    return "needs_review";
  }

  return "draft"; // not_ready — critical failures
}

// ---------------------------------------------------------------------------
// Public API: scoreCreative
//
// Wraps scoreCreativeDraft() and augments the scorecard with:
//   - qualitySignals (detected from scorecard + brief context)
//   - readinessStatus (workflow-level label derived from approvalReadiness)
//
// The underlying scorer.ts is unchanged — this is a pure additive layer.
// ---------------------------------------------------------------------------

export function scoreCreative(
  variant: CreativeDraftVariant,
  brief:   CreativeBrief,
): CreativeDraftScorecard {
  const scorecard      = scoreCreativeDraft(variant, brief);
  const qualitySignals = detectQualitySignals(scorecard, brief);
  const readinessStatus = assignReadinessStatus(scorecard);

  return {
    ...scorecard,
    qualitySignals,
    readinessStatus,
  };
}

// ---------------------------------------------------------------------------
// Public API: rankCreatives
//
// Clean named alias for rankCreativeDrafts — same deterministic ranking logic.
// Exposed under the spec-aligned name for external consumers.
// ---------------------------------------------------------------------------

export function rankCreatives(
  scorecards: CreativeDraftScorecard[],
): CreativeDraftRanking[] {
  return rankCreativeDrafts(scorecards);
}

// ---------------------------------------------------------------------------
// Public API: summarizeCreativeScore
//
// Produces a single human-readable sentence summarising a scored variant.
// Used for compact list views and audit logs.
// ---------------------------------------------------------------------------

export function summarizeCreativeScore(scorecard: CreativeDraftScorecard): string {
  const { totalScore, variantType, riskLevel } = scorecard;
  const readinessStatus = scorecard.readinessStatus ?? assignReadinessStatus(scorecard);

  const scorePhrase =
    totalScore >= 72 ? `scores ${totalScore}/100 — strong quality` :
    totalScore >= 55 ? `scores ${totalScore}/100 — acceptable quality` :
    totalScore >= 35 ? `scores ${totalScore}/100 — below threshold` :
    `scores ${totalScore}/100 — critical issues detected`;

  const statusPhrase =
    readinessStatus === "ready_for_approval" ? "ready for approval" :
    readinessStatus === "high_potential"     ? "high potential — prioritise for review" :
    readinessStatus === "needs_review"       ? "needs human review before advancing" :
    readinessStatus === "rejected"           ? "rejected — will not proceed" :
    "not ready — address critical issues first";

  const riskPhrase = riskLevel === "high"
    ? " High policy risk — compliance review required."
    : "";

  return `${variantType === "copy" ? "Copy" : "Image"} variant ${scorePhrase} — ${statusPhrase}.${riskPhrase}`;
}

// ---------------------------------------------------------------------------
// Public API: buildCreativeScoreBreakdown
//
// Assembles a CreativeScoreBreakdown from a scored variant.
// Useful when consumers need the spec-aligned type explicitly.
// ---------------------------------------------------------------------------

export function buildCreativeScoreBreakdown(
  scorecard: CreativeDraftScorecard,
  brief:     CreativeBrief,
): CreativeScoreBreakdown {
  const qualitySignals  = scorecard.qualitySignals  ?? detectQualitySignals(scorecard, brief);
  const readinessStatus = scorecard.readinessStatus ?? assignReadinessStatus(scorecard);
  const score           = buildCreativeScore(scorecard.totalScore, scorecard.scoredAt);

  return {
    variantId:       scorecard.variantId,
    variantTitle:    scorecard.variantTitle,
    variantType:     scorecard.variantType,
    score,
    dimensions:      scorecard.dimensions,
    readinessStatus,
    approvalGate:    scorecard.approvalReadiness,
    riskLevel:       scorecard.riskLevel,
    qualitySignals,
    explanation:     scorecard.explanation,
  };
}
