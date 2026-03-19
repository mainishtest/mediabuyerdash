// lib/creativeScoring/scorer.ts
// Deterministic heuristic scoring engine for creative draft variants.
//
// Architecture rules:
//   - All functions are pure — same input always produces same output.
//   - No AI API calls — scoring runs instantly at query time.
//   - CRM-verified ROAS/CPA from brief context inform goal_alignment scoring.
//   - Scoring is variant-type-aware: copy and image have different weights.
//   - Designed to be replaced or augmented with AI scoring in a future step.

import type {
  CreativeDraftScore,
  CreativeDraftScorecard,
  CreativeScoreDimension,
  CreativeApprovalReadiness,
  CreativeApprovalRisk,
  CreativeScoreExplanation,
}                              from "../../types/creativeScoring";
import { DIMENSION_LABEL }     from "../../types/creativeScoring";
import type {
  CreativeDraftVariant,
  CreativeBrief,
  CreativeGenerationIntent,
}                              from "../../types/creativeBrief";

// ---------------------------------------------------------------------------
// Scoring weights — must sum to 1.0 per variant type
// ---------------------------------------------------------------------------

const COPY_WEIGHTS: Record<CreativeScoreDimension, number> = {
  goal_alignment:     0.15,
  hook_strength:      0.20,
  offer_clarity:      0.12,
  message_clarity:    0.10,
  angle_novelty:      0.15,
  fatigue_separation: 0.08,
  brand_fit:          0.05,
  policy_risk:        0.10,
  launch_readiness:   0.05,
};

const IMAGE_WEIGHTS: Record<CreativeScoreDimension, number> = {
  goal_alignment:     0.20,
  hook_strength:      0.00,  // n/a for image briefs — redistributed to offer_clarity
  offer_clarity:      0.25,
  message_clarity:    0.15,
  angle_novelty:      0.15,
  fatigue_separation: 0.08,
  brand_fit:          0.05,
  policy_risk:        0.07,
  launch_readiness:   0.05,
};

// Minimum passing score per dimension (below = fail flag)
const DIMENSION_PASS_THRESHOLD = 4;

// Policy-sensitive patterns (lower policy_risk score when found)
const POLICY_RISK_PHRASES: RegExp[] = [
  /\bguaranteed?\b/i,
  /\b100%\s*(free|safe|effective|guaranteed)\b/i,
  /\bcure[sd]?\b/i,
  /\beliminate\s+debt\b/i,
  /\bget\s+rich\b/i,
  /\bwork\s+from\s+home\s+(income|money|earn)\b/i,
  /\blose\s+\d+\s+(pounds?|lbs?)\b/i,
  /\bno\s+risk\b/i,
  /\blast\s+chance\b/i,
  /\blimited\s+time\s+only\b/i,
];

// Strong hook signal words (positive)
const HOOK_SIGNAL_WORDS: RegExp[] = [
  /\?/,                             // question
  /"/,                              // quote
  /\b\d+\b/,                        // specific number
  /\byou\b/i,                       // direct address
  /\bstop\b|\bhow\b|\bwhy\b|\bwhat\b/i,
  /\bsecret\b|\btruth\b|\breal\b/i,
  /\bwasted\b|\bbreaking\b|\bfailed\b/i,
];

// ---------------------------------------------------------------------------
// Utility: word overlap ratio between two strings (0–1)
// ---------------------------------------------------------------------------

function wordOverlap(a: string, b: string): number {
  if (!a || !b) return 0;
  const setA = new Set(a.toLowerCase().match(/\b\w{4,}\b/g) ?? []);
  const setB = new Set(b.toLowerCase().match(/\b\w{4,}\b/g) ?? []);
  if (setA.size === 0) return 0;
  let shared = 0;
  for (const w of setA) {
    if (setB.has(w)) shared++;
  }
  return shared / setA.size;
}

// ---------------------------------------------------------------------------
// 1. goal_alignment — does the draft match strategic intent?
// ---------------------------------------------------------------------------

function scoreGoalAlignment(
  variant: CreativeDraftVariant,
  intent:  CreativeGenerationIntent,
): { score: number; explanation: string } {
  // Intent ↔ variant type alignment
  const visualIntents: CreativeGenerationIntent[] = ["refresh_visual_direction"];
  const copyIntents:   CreativeGenerationIntent[] = ["refresh_hook", "refresh_angle", "preserve_winner_pattern"];

  const isCopy  = variant.variantType === "copy";
  const isImage = variant.variantType === "image";

  // Type mismatch: copy variant when visual intent, or vice versa
  if (isCopy && visualIntents.includes(intent)) {
    return { score: 4, explanation: "Copy variant generated for a visual-direction intent — image brief would be a stronger match for this intent." };
  }
  if (isImage && copyIntents.includes(intent)) {
    return { score: 5, explanation: "Image brief generated for a copy-focused intent — this can supplement but copy variants better match the priority." };
  }

  // Full reset: any type is fine
  if (intent === "full_reset") {
    const completeness = isCopy
      ? (variant.hook ? 1 : 0) + (variant.body ? 1 : 0) + (variant.callToAction ? 1 : 0)
      : (variant.conceptSummary ? 1 : 0) + (variant.visualChanges ? 1 : 0) + (variant.goal ? 1 : 0);
    const score = 5 + Math.round(completeness * 1.5);
    return { score: Math.min(score, 9), explanation: "Full reset intent — all variant types are appropriate. Completeness drives score." };
  }

  // Hook refresh: copy variant — score based on hook quality signals
  if (intent === "refresh_hook" && isCopy) {
    const hook = variant.hook ?? "";
    const signalCount = HOOK_SIGNAL_WORDS.filter((re) => re.test(hook)).length;
    const score = 5 + Math.min(signalCount, 4) + (hook.length > 10 && hook.length < 80 ? 1 : 0);
    return { score: Math.min(score, 10), explanation: "Hook refresh intent — copy variant with strong hook signals scores highest." };
  }

  // Angle refresh: copy variant
  if (intent === "refresh_angle" && isCopy) {
    const body = variant.body ?? "";
    const score = 6 + (body.length > 80 ? 1 : 0) + (body.length > 150 ? 1 : 0);
    return { score: Math.min(score, 9), explanation: "Angle refresh intent — copy variant with developed body copy scores well." };
  }

  // Preserve winner: copy variant — should retain CTA, moderate changes
  if (intent === "preserve_winner_pattern" && isCopy) {
    const hasCta = !!variant.callToAction;
    return { score: hasCta ? 8 : 6, explanation: "Preserve winner intent — retaining a strong CTA aligns with this pattern." };
  }

  // Visual direction: image variant
  if (intent === "refresh_visual_direction" && isImage) {
    const completeness = (variant.conceptSummary ? 1 : 0) + (variant.visualChanges ? 1 : 0) +
                         (variant.goal ? 1 : 0) + (variant.directResponseAngle ? 1 : 0);
    const score = 5 + Math.round(completeness * 1.25);
    return { score: Math.min(score, 10), explanation: "Visual direction intent — image brief completeness drives alignment score." };
  }

  return { score: 7, explanation: "Intent and variant type are aligned." };
}

// ---------------------------------------------------------------------------
// 2. hook_strength — quality of the opening hook (copy only)
// ---------------------------------------------------------------------------

function scoreHookStrength(
  variant:    CreativeDraftVariant,
  sourceCopy: string | null,
): { score: number; explanation: string } {
  if (variant.variantType === "image") {
    return { score: 0, explanation: "Not applicable for image briefs." };
  }

  const hook = variant.hook ?? "";
  if (!hook.trim()) {
    return { score: 1, explanation: "No hook provided — opening line is required for copy variants." };
  }

  const words = hook.trim().split(/\s+/).length;
  let score = 4;
  const signals: string[] = [];

  // Length: 5–25 words ideal
  if (words >= 5 && words <= 25) {
    score += 1;
    signals.push("ideal hook length");
  } else if (words < 5) {
    score -= 1;
    signals.push("hook may be too short");
  } else if (words > 40) {
    score -= 1;
    signals.push("hook is long — may lose scroll-stoppers before the finish");
  }

  // Signal words
  const signalHits = HOOK_SIGNAL_WORDS.filter((re) => re.test(hook)).length;
  score += Math.min(signalHits * 1, 3);
  if (signalHits > 0) signals.push(`${signalHits} engagement signal${signalHits > 1 ? "s" : ""} detected`);

  // Novelty vs source copy
  if (sourceCopy) {
    const overlap = wordOverlap(hook, sourceCopy);
    if (overlap < 0.2) {
      score += 1;
      signals.push("distinct from source copy");
    } else if (overlap > 0.6) {
      score -= 1;
      signals.push("high overlap with source copy — may not stop the scroll");
    }
  }

  // Quote format
  if (/^[""]/.test(hook.trim())) {
    score += 1;
    signals.push("opens with quote — strong social proof format");
  }

  const finalScore = Math.max(1, Math.min(score, 10));
  const explanation = signals.length > 0
    ? signals.join("; ") + "."
    : `Hook scored ${finalScore}/10.`;

  return { score: finalScore, explanation };
}

// ---------------------------------------------------------------------------
// 3. offer_clarity — how clearly the offer/value comes through
// ---------------------------------------------------------------------------

function scoreOfferClarity(variant: CreativeDraftVariant): { score: number; explanation: string } {
  if (variant.variantType === "copy") {
    const cta  = variant.callToAction ?? "";
    const body = variant.body ?? "";
    let score = 3;
    const signals: string[] = [];

    if (cta.trim().length > 0) { score += 2; signals.push("CTA present"); }
    if (body.length > 50)  { score += 1; signals.push("body copy developed"); }
    if (body.length > 120) { score += 1; signals.push("full body length"); }
    if (cta.length >= 3 && cta.length <= 30) { score += 1; signals.push("CTA concise"); }

    // Action verbs in CTA
    if (/\b(get|start|learn|see|try|join|discover|find|book|claim|unlock)\b/i.test(cta)) {
      score += 1;
      signals.push("action verb in CTA");
    }

    const explanation = signals.length > 0 ? signals.join("; ") + "." : "Offer clarity assessed.";
    return { score: Math.min(score, 10), explanation };
  }

  // Image brief
  const concept = variant.conceptSummary ?? "";
  const drAngle = variant.directResponseAngle ?? "";
  let score = 3;
  const signals: string[] = [];

  if (concept.length > 30) { score += 2; signals.push("concept summary present"); }
  if (concept.length > 80) { score += 1; signals.push("detailed concept"); }
  if (drAngle.length > 20) { score += 2; signals.push("DR angle articulated"); }
  if (variant.goal)         { score += 1; signals.push("visual goal stated"); }

  const explanation = signals.length > 0 ? signals.join("; ") + "." : "Offer clarity for image brief assessed.";
  return { score: Math.min(score, 10), explanation };
}

// ---------------------------------------------------------------------------
// 4. message_clarity — readability and structure
// ---------------------------------------------------------------------------

function scoreMessageClarity(variant: CreativeDraftVariant): { score: number; explanation: string } {
  if (variant.variantType === "copy") {
    const body = variant.body ?? "";
    const hook = variant.hook ?? "";
    let score = 4;
    const signals: string[] = [];

    const bodyWords = body.trim().split(/\s+/).length;
    if (bodyWords >= 30 && bodyWords <= 100) { score += 2; signals.push("body length ideal (30–100 words)"); }
    else if (bodyWords < 15) { score -= 1; signals.push("body is very short"); }
    else if (bodyWords > 150) { score -= 1; signals.push("body may be too long for feed"); }

    // Sentence variety
    const sentences = body.split(/[.!?]+/).filter((s) => s.trim().length > 5);
    if (sentences.length >= 2) { score += 1; signals.push("multi-sentence body"); }
    if (sentences.length >= 3) { score += 1; signals.push("full 3+ sentence structure"); }

    if (hook && body) { score += 1; signals.push("hook and body both present"); }

    const explanation = signals.length > 0 ? signals.join("; ") + "." : "Message clarity assessed.";
    return { score: Math.min(score, 10), explanation };
  }

  // Image brief
  const changes  = variant.visualChanges ?? "";
  const concept  = variant.conceptSummary ?? "";
  let score = 4;
  const signals: string[] = [];

  if (changes.length > 20) { score += 2; signals.push("visual changes described"); }
  if (concept.length > 60) { score += 2; signals.push("concept well articulated"); }
  if (variant.goal)        { score += 1; signals.push("design goal stated"); }

  return { score: Math.min(score, 10), explanation: signals.join("; ") + "." };
}

// ---------------------------------------------------------------------------
// 5. angle_novelty — how different from source creative
// ---------------------------------------------------------------------------

function scoreAngleNovelty(
  variant:    CreativeDraftVariant,
  sourceCopy: string | null,
  sourceCta:  string | null,
): { score: number; explanation: string } {
  if (variant.variantType === "image") {
    // For images, concept should differ from any source description
    const concept = variant.conceptSummary ?? "";
    const score = concept.length > 40 ? 8 : 6;
    return { score, explanation: "Image concept novelty — scored on concept completeness as source image is not analysed." };
  }

  if (!sourceCopy || sourceCopy.trim().length === 0) {
    return { score: 7, explanation: "No source copy available for comparison — baseline novelty score applied." };
  }

  const hook = variant.hook ?? "";
  const body = variant.body ?? "";

  const hookOverlap = wordOverlap(hook, sourceCopy);
  const bodyOverlap = wordOverlap(body, sourceCopy);
  const combined    = (hookOverlap * 0.6) + (bodyOverlap * 0.4);

  // Lower overlap = higher novelty
  const score = combined < 0.1 ? 10
    : combined < 0.2 ? 9
    : combined < 0.3 ? 8
    : combined < 0.4 ? 7
    : combined < 0.5 ? 6
    : combined < 0.6 ? 5
    : combined < 0.7 ? 4
    : 3;

  const overlapPct = Math.round(combined * 100);
  const explanation = combined < 0.3
    ? `Low word overlap with source (${overlapPct}%) — strong novelty signal.`
    : combined < 0.5
    ? `Moderate overlap with source (${overlapPct}%) — some novelty but may feel similar to audience.`
    : `High overlap with source (${overlapPct}%) — audience may recognise this as the same creative.`;

  return { score, explanation };
}

// ---------------------------------------------------------------------------
// 6. fatigue_separation — how well separated from the fatigued creative
// ---------------------------------------------------------------------------

function scoreFatigueSeparation(
  variant:       CreativeDraftVariant,
  noveltyScore:  number,
  fatigueStatus: string | null,
  avgFrequency:  number | null,
): { score: number; explanation: string } {
  // Start from novelty and apply fatigue context multiplier
  let base = noveltyScore;
  const signals: string[] = [];

  const freq = avgFrequency ?? 0;

  if (fatigueStatus === "severe_fatigue") {
    // High frequency + severe: novelty is critical — reward it more
    base = Math.round(base * 1.1);
    signals.push("severe fatigue — high novelty essential");
  } else if (fatigueStatus === "fatigued") {
    base = Math.round(base * 1.05);
    signals.push("audience fatigued — novelty weighted up");
  } else if (fatigueStatus === "watch" && freq > 2.5) {
    base = Math.round(base * 1.0);
    signals.push("watch status — frequency approaching threshold");
  } else if (!fatigueStatus || fatigueStatus === "healthy") {
    // No fatigue — fatigue separation less important, score modestly
    base = Math.round((base + 6) / 2);
    signals.push("no fatigue detected — separation less critical");
  }

  const explanation = signals.length > 0
    ? signals.join("; ") + `. Derived from novelty score of ${noveltyScore}/10.`
    : `Fatigue separation based on novelty score of ${noveltyScore}/10.`;

  return { score: Math.max(1, Math.min(base, 10)), explanation };
}

// ---------------------------------------------------------------------------
// 7. brand_fit — alignment with brand constraints
// ---------------------------------------------------------------------------

function scoreBrandFit(): { score: number; explanation: string } {
  // Default score when no brand constraints are configured
  return {
    score: 7,
    explanation: "No brand constraints configured — default score applied. Add brand guidelines to improve scoring accuracy.",
  };
}

// ---------------------------------------------------------------------------
// 8. policy_risk — compliance signal (higher = lower risk = better)
// ---------------------------------------------------------------------------

function scorePolicyRisk(variant: CreativeDraftVariant): { score: number; explanation: string } {
  const text = [
    variant.hook ?? "",
    variant.body ?? "",
    variant.callToAction ?? "",
    variant.conceptSummary ?? "",
  ].join(" ");

  if (!text.trim()) {
    return { score: 8, explanation: "No text content to evaluate for policy risk." };
  }

  const matches = POLICY_RISK_PHRASES.filter((re) => re.test(text));
  if (matches.length === 0) {
    return { score: 9, explanation: "No policy risk phrases detected." };
  }

  const score = Math.max(2, 9 - matches.length * 2);
  return {
    score,
    explanation: `${matches.length} policy-sensitive pattern${matches.length > 1 ? "s" : ""} detected — review before launch.`,
  };
}

// ---------------------------------------------------------------------------
// 9. launch_readiness — are all required fields present?
// ---------------------------------------------------------------------------

function scoreLaunchReadiness(variant: CreativeDraftVariant): { score: number; explanation: string } {
  if (variant.variantType === "copy") {
    const hasHook = !!variant.hook?.trim();
    const hasBody = !!variant.body?.trim();
    const hasCta  = !!variant.callToAction?.trim();
    const complete = (hasHook ? 1 : 0) + (hasBody ? 1 : 0) + (hasCta ? 1 : 0);
    const score = complete === 3 ? 10 : complete === 2 ? 7 : complete === 1 ? 4 : 1;
    const missing = [
      !hasHook ? "hook" : null,
      !hasBody ? "body" : null,
      !hasCta  ? "CTA"  : null,
    ].filter(Boolean);
    const explanation = complete === 3
      ? "All required copy fields present (hook, body, CTA)."
      : `Missing: ${missing.join(", ")}.`;
    return { score, explanation };
  }

  // Image brief
  const hasConcept  = !!variant.conceptSummary?.trim();
  const hasChanges  = !!variant.visualChanges?.trim();
  const hasGoal     = !!variant.goal?.trim();
  const hasDrAngle  = !!variant.directResponseAngle?.trim();
  const complete    = (hasConcept ? 1 : 0) + (hasChanges ? 1 : 0) + (hasGoal ? 1 : 0) + (hasDrAngle ? 1 : 0);
  const score       = complete === 4 ? 10 : complete === 3 ? 8 : complete === 2 ? 5 : complete === 1 ? 3 : 1;
  const missing     = [
    !hasConcept ? "concept summary" : null,
    !hasChanges ? "visual changes"  : null,
    !hasGoal    ? "goal"            : null,
    !hasDrAngle ? "DR angle"        : null,
  ].filter(Boolean);
  const explanation = complete === 4
    ? "All required image brief fields present."
    : `Missing: ${missing.join(", ")}.`;
  return { score, explanation };
}

// ---------------------------------------------------------------------------
// Compute approval readiness from total score + key dimensions
// ---------------------------------------------------------------------------

function computeReadiness(
  totalScore:    number,
  policyScore:   number,
  launchScore:   number,
): CreativeApprovalReadiness {
  if (totalScore >= 72 && policyScore >= 7 && launchScore >= 7) {
    return "ready_for_publish_prep";
  }
  if (totalScore >= 55 && policyScore >= 5 && launchScore >= 5) {
    return "conditionally_ready";
  }
  if (totalScore >= 35) {
    return "review_required";
  }
  return "not_ready";
}

// ---------------------------------------------------------------------------
// Compute risk level
// ---------------------------------------------------------------------------

function computeRisk(
  policyScore: number,
  totalScore:  number,
): CreativeApprovalRisk {
  if (policyScore < 4 || totalScore < 35) return "high";
  if (policyScore < 7 || totalScore < 55) return "medium";
  return "low";
}

// ---------------------------------------------------------------------------
// Build explanation: strengths + risks + notes
// ---------------------------------------------------------------------------

function buildExplanation(
  dimensions: CreativeDraftScore[],
  totalScore: number,
  readiness:  CreativeApprovalReadiness,
): CreativeScoreExplanation {
  const strengths: string[] = [];
  const risks:     string[] = [];
  const notes:     string[] = [];

  for (const dim of dimensions) {
    if (dim.weight === 0) continue;
    if (dim.score >= 8) {
      strengths.push(`${dim.label}: ${dim.explanation}`);
    } else if (!dim.pass && dim.weight > 0.05) {
      risks.push(`${dim.label}: ${dim.explanation}`);
    }
  }

  if (readiness === "ready_for_publish_prep") {
    notes.push("This variant meets the threshold for publish preparation. Human approval still required before any Meta action.");
  } else if (readiness === "conditionally_ready") {
    notes.push("This variant has acceptable quality with noted weaknesses. Review the risks before approving.");
  } else if (readiness === "review_required") {
    notes.push("This variant needs human review. Address the flagged risks before proceeding.");
  } else {
    notes.push("This variant has critical quality issues. Consider regenerating with a different angle or mode.");
  }

  if (totalScore > 0) {
    notes.push(`CRM ROAS/CPA used as source of truth throughout scoring context.`);
  }

  return { strengths, risks, notes };
}

// ---------------------------------------------------------------------------
// Public API: scoreCreativeDraft
// Main entry point — scores one variant against its brief context.
// ---------------------------------------------------------------------------

export function scoreCreativeDraft(
  variant: CreativeDraftVariant,
  brief:   CreativeBrief,
): CreativeDraftScorecard {
  const weights = variant.variantType === "copy" ? COPY_WEIGHTS : IMAGE_WEIGHTS;
  const pc      = brief.input;
  const now     = new Date().toISOString();

  // Compute each dimension
  const goalResult    = scoreGoalAlignment(variant, brief.intent);
  const hookResult    = scoreHookStrength(variant, pc.adCopy);
  const offerResult   = scoreOfferClarity(variant);
  const msgResult     = scoreMessageClarity(variant);
  const noveltyResult = scoreAngleNovelty(variant, pc.adCopy, pc.callToAction);
  const fatigueResult = scoreFatigueSeparation(variant, noveltyResult.score, pc.fatigueStatus, pc.avgFrequency);
  const brandResult   = scoreBrandFit();
  const policyResult  = scorePolicyRisk(variant);
  const launchResult  = scoreLaunchReadiness(variant);

  const rawScores: Record<CreativeScoreDimension, { score: number; explanation: string }> = {
    goal_alignment:     goalResult,
    hook_strength:      hookResult,
    offer_clarity:      offerResult,
    message_clarity:    msgResult,
    angle_novelty:      noveltyResult,
    fatigue_separation: fatigueResult,
    brand_fit:          brandResult,
    policy_risk:        policyResult,
    launch_readiness:   launchResult,
  };

  const dimensions: CreativeDraftScore[] = (Object.keys(rawScores) as CreativeScoreDimension[]).map((dim) => {
    const raw    = rawScores[dim];
    const weight = weights[dim];
    return {
      dimension:   dim,
      score:       raw.score,
      weight,
      contribution: Math.round(raw.score * weight * 10),
      label:       DIMENSION_LABEL[dim],
      explanation: raw.explanation,
      pass:        weight === 0 ? true : raw.score >= DIMENSION_PASS_THRESHOLD,
    };
  });

  // Weighted total (0–100)
  const totalScore = Math.round(
    dimensions.reduce((sum, d) => sum + d.contribution, 0)
  );

  const policyScore = rawScores.policy_risk.score;
  const launchScore = rawScores.launch_readiness.score;

  const approvalReadiness = computeReadiness(totalScore, policyScore, launchScore);
  const riskLevel         = computeRisk(policyScore, totalScore);
  const explanation       = buildExplanation(dimensions, totalScore, approvalReadiness);

  return {
    variantId:         variant.id,
    variantTitle:      variant.title,
    variantType:       variant.variantType,
    dimensions,
    totalScore,
    approvalReadiness,
    riskLevel,
    explanation,
    scoredAt: now,
  };
}

// ---------------------------------------------------------------------------
// Public API: buildCreativeDraftScorecard — alias for scoreCreativeDraft
// Kept for API symmetry with spec naming.
// ---------------------------------------------------------------------------

export const buildCreativeDraftScorecard = scoreCreativeDraft;

// ---------------------------------------------------------------------------
// Public API: summarizeCreativeDraftStrengths
// ---------------------------------------------------------------------------

export function summarizeCreativeDraftStrengths(scorecard: CreativeDraftScorecard): string[] {
  return scorecard.explanation.strengths;
}

// ---------------------------------------------------------------------------
// Public API: summarizeCreativeDraftRisks
// ---------------------------------------------------------------------------

export function summarizeCreativeDraftRisks(scorecard: CreativeDraftScorecard): string[] {
  return scorecard.explanation.risks;
}

// ---------------------------------------------------------------------------
// Public API: buildScoreExplanation
// Returns the explanation portion of an already-built scorecard.
// ---------------------------------------------------------------------------

export function buildScoreExplanation(scorecard: CreativeDraftScorecard) {
  return scorecard.explanation;
}
