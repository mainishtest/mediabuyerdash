// Creative Diagnosis Utilities
//
// Deterministic rule-based engine that classifies whether poor ad performance
// is likely caused by copy, image, both, or is unclear.
//
// No AI / LLM calls are made here. This layer is intentionally isolated so
// it can be replaced or augmented with real AI providers later without
// changing the types or UI layer.

import type {
  CreativeDiagnosisInput,
  CreativeDiagnosisResult,
  CopyRecommendation,
  ImageRecommendation,
  RecommendationCauseType,
  RecommendationConfidence,
  AdCopyFields,
  AdImageMetadata
} from "../types/creativeDiagnosis";

// ── Thresholds ────────────────────────────────────────────────────────────────

// Minimum spend before a diagnosis can be made with any confidence.
const MIN_SPEND_FOR_SIGNAL = 100;

// Degree by which performance must miss goals to warrant diagnosis.
const MISS_THRESHOLD_PCT = 0.10;   // 10 % over CPA goal / below ROAS goal

// Weak copy signal words — hooks or CTAs that are so generic they provide no
// differentiation or reason to click.
const GENERIC_HOOKS = [
  "buy now", "shop now", "try it", "try it today", "buy today",
  "order now", "click here", "get it now", "check this out"
];

const WEAK_CTAS = [
  "learn more", "shop", "buy", "click", "go", "see more"
];

const WEAK_IMAGE_STYLES = ["text-heavy", "busy-collage"];
const WEAK_VISUAL_THEMES = ["busy-collage", "dark-mood"];

const CLUTTERED_HEADLINE_THRESHOLD = 60;   // characters — very long = too much info
const MINIMAL_BODY_THRESHOLD = 80;         // characters — too short = no substance

// ── Performance helpers ───────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function cpaOverGoalPct(actualCpa: number, goalValue: number): number {
  if (goalValue <= 0) return 0;
  return round2(Math.max(0, (actualCpa - goalValue) / goalValue) * 100);
}

function roasBelowGoalPct(actualRoas: number, goalValue: number): number {
  if (goalValue <= 0) return 0;
  return round2(Math.max(0, (goalValue - actualRoas) / goalValue) * 100);
}

function isUnderperforming(input: CreativeDiagnosisInput): boolean {
  const cpaMiss  = cpaOverGoalPct(input.actualCpa, input.cpaGoalValue);
  const roasMiss = roasBelowGoalPct(input.actualRoas, input.roasGoalValue);
  return cpaMiss > MISS_THRESHOLD_PCT * 100 || roasMiss > MISS_THRESHOLD_PCT * 100;
}

function performanceStatus(
  cpaMiss: number,
  roasMiss: number
): CreativeDiagnosisResult["performanceStatus"] {
  if (cpaMiss === 0 && roasMiss === 0) return "on_target";
  if (cpaMiss > 20 || roasMiss > 20)  return "below_goal";
  return "watch";
}

// ── Copy signal analysis ──────────────────────────────────────────────────────

function copyIsWeak(copy: AdCopyFields): boolean {
  const hookLower = copy.hook.toLowerCase().trim();
  const ctaLower  = copy.callToAction.toLowerCase().trim();
  const bodyLen   = copy.body.trim().length;

  const genericHook  = GENERIC_HOOKS.some((g) => hookLower.includes(g));
  const weakCta      = WEAK_CTAS.some((w) => ctaLower === w || ctaLower === `${w}.`);
  const thinBody     = bodyLen < MINIMAL_BODY_THRESHOLD;

  // Weak if hook is generic OR (both CTA is weak AND body is thin)
  return genericHook || (weakCta && thinBody);
}

// ── Image signal analysis ─────────────────────────────────────────────────────

function imageIsWeak(image: AdImageMetadata): boolean {
  const headlineCluttered = image.imageHeadline.length > CLUTTERED_HEADLINE_THRESHOLD;
  const styleWeak         = WEAK_IMAGE_STYLES.includes(image.imageStyle);
  const themeWeak         = WEAK_VISUAL_THEMES.includes(image.visualTheme);

  // Weak if headline is cluttered OR style is known-bad OR theme is known-bad
  return headlineCluttered || styleWeak || themeWeak;
}

// ── Reason builders ───────────────────────────────────────────────────────────

function buildCopyReason(copy: AdCopyFields): string {
  const parts: string[] = [];
  const hookLower = copy.hook.toLowerCase();
  if (GENERIC_HOOKS.some((g) => hookLower.includes(g))) {
    parts.push("hook lacks a specific benefit or pattern interrupt");
  }
  const ctaLower = copy.callToAction.toLowerCase();
  if (WEAK_CTAS.includes(ctaLower)) {
    parts.push("CTA is too generic to motivate action");
  }
  if (copy.body.trim().length < MINIMAL_BODY_THRESHOLD) {
    parts.push("body is too thin to build trust or justify the offer");
  }
  return parts.length > 0
    ? parts.join("; ")
    : "copy signals appear generic or undifferentiated";
}

function buildImageReason(image: AdImageMetadata): string {
  const parts: string[] = [];
  if (image.imageHeadline.length > CLUTTERED_HEADLINE_THRESHOLD) {
    parts.push("image headline is too long and cluttered");
  }
  if (WEAK_IMAGE_STYLES.includes(image.imageStyle)) {
    parts.push(`image style "${image.imageStyle}" tends to reduce clarity`);
  }
  if (WEAK_VISUAL_THEMES.includes(image.visualTheme)) {
    parts.push(`visual theme "${image.visualTheme}" may reduce trust or attention`);
  }
  return parts.length > 0
    ? parts.join("; ")
    : "image signals appear weak, cluttered, or off-message";
}

function buildRecommendationSummary(
  causeType: RecommendationCauseType,
  cpaMiss: number,
  roasMiss: number
): string {
  const perfNote =
    cpaMiss > 0 ? `CPA is ${cpaMiss}% over goal` :
    roasMiss > 0 ? `ROAS is ${roasMiss}% below goal` :
    "performance is off target";

  switch (causeType) {
    case "copy":
      return `${perfNote}. The messaging signals appear generic — prioritise testing a new hook and benefit-driven body copy.`;
    case "image":
      return `${perfNote}. The static image shows clarity or style weaknesses — prioritise a cleaner, more focused visual direction.`;
    case "mixed":
      return `${perfNote}. Both copy and image signals are weak. Test one variable at a time: start with copy, then image.`;
    case "unclear":
      return "Insufficient spend or signal to diagnose. Allow more budget to accumulate before drawing conclusions.";
    default:
      return "Performance is off target. Review audience targeting, offer competitiveness, and landing page alignment.";
  }
}

// ── Main diagnosis function ───────────────────────────────────────────────────

export function diagnoseCreative(
  input: CreativeDiagnosisInput
): CreativeDiagnosisResult {
  const cpaMiss  = cpaOverGoalPct(input.actualCpa, input.cpaGoalValue);
  const roasMiss = roasBelowGoalPct(input.actualRoas, input.roasGoalValue);
  const status   = performanceStatus(cpaMiss, roasMiss);

  // ── Low spend: unclear ────────────────────────────────────────────────────
  if (input.spend < MIN_SPEND_FOR_SIGNAL || !isUnderperforming(input)) {
    return {
      adId:                  input.adId,
      adName:                input.adName,
      campaignId:            input.campaignId,
      campaignName:          input.campaignName,
      causeType:             "unclear",
      confidence:            "low",
      shortReason:           input.spend < MIN_SPEND_FOR_SIGNAL
                               ? "Not enough spend to diagnose"
                               : "Performance is within acceptable range",
      recommendationSummary: buildRecommendationSummary("unclear", cpaMiss, roasMiss),
      cpaOverGoalPct:        cpaMiss,
      roasBelowGoalPct:      roasMiss,
      performanceStatus:     status
    };
  }

  const weakCopy  = copyIsWeak(input.copy);
  const weakImage = imageIsWeak(input.image);

  let causeType:  RecommendationCauseType;
  let confidence: RecommendationConfidence;
  let shortReason: string;

  if (weakCopy && weakImage) {
    causeType   = "mixed";
    confidence  = "medium";
    shortReason = `Both copy and image signals are weak. ${buildCopyReason(input.copy)}. ${buildImageReason(input.image)}.`;
  } else if (weakCopy) {
    causeType   = "copy";
    confidence  = cpaMiss > 30 || roasMiss > 30 ? "high" : "medium";
    shortReason = buildCopyReason(input.copy);
  } else if (weakImage) {
    causeType   = "image";
    confidence  = cpaMiss > 30 || roasMiss > 30 ? "high" : "medium";
    shortReason = buildImageReason(input.image);
  } else {
    causeType   = "other";
    confidence  = "low";
    shortReason = "Copy and image signals appear adequate — consider audience, offer, or landing page";
  }

  return {
    adId:                  input.adId,
    adName:                input.adName,
    campaignId:            input.campaignId,
    campaignName:          input.campaignName,
    causeType,
    confidence,
    shortReason,
    recommendationSummary: buildRecommendationSummary(causeType, cpaMiss, roasMiss),
    cpaOverGoalPct:        cpaMiss,
    roasBelowGoalPct:      roasMiss,
    performanceStatus:     status
  };
}

// ── Recommendation generators ─────────────────────────────────────────────────

export function generateCopyRecommendation(
  input: CreativeDiagnosisInput
): CopyRecommendation {
  const hookLower = input.copy.hook.toLowerCase();
  const isGenericHook = GENERIC_HOOKS.some((g) => hookLower.includes(g));

  const whatToChange = isGenericHook
    ? "Replace the generic hook with a specific, emotionally resonant pattern interrupt"
    : "Strengthen the body copy with a concrete proof point or specific benefit claim";

  const whyItMatters =
    "The hook is the first thing the audience sees. If it fails to stop the scroll or create curiosity, no amount of strong body copy will recover the conversion.";

  const suggestedFocus =
    "Test a hook that names the specific outcome the customer wants (e.g. 'How I cut my CPA by 40% without changing the offer') paired with a CTA that states the next step clearly (e.g. 'See The Full Strategy').";

  return { adId: input.adId, whatToChange, whyItMatters, suggestedFocus };
}

export function generateImageRecommendation(
  input: CreativeDiagnosisInput
): ImageRecommendation {
  const isTextHeavy = WEAK_IMAGE_STYLES.includes(input.image.imageStyle);

  const whatToChange = isTextHeavy
    ? "Reduce text overlay to a single short statement — let the visual do the heavy lifting"
    : "Replace the current visual theme with a cleaner, benefit-focused composition";

  const whyItMatters =
    "Cluttered or off-theme images cause viewers to scroll past before reading any copy. The image must communicate the core benefit in under 1 second.";

  const suggestedFocus =
    "Test a single-focus image: one clear subject, one short headline (max 6 words), and a visual treatment that matches the brand's trust signal (e.g. clean white with a product-in-use shot).";

  return { adId: input.adId, whatToChange, whyItMatters, suggestedFocus };
}

// ── Batch helper ──────────────────────────────────────────────────────────────

export function diagnoseAll(
  inputs: CreativeDiagnosisInput[]
): CreativeDiagnosisResult[] {
  return inputs.map(diagnoseCreative);
}
