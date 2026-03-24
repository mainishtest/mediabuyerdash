// lib/brandIntelligence/creativeStrategy.ts
// Turns brand context into strategic creative generation structure.
// Pure functions — no DB, no API calls.

import type {
  CreativeHookType,
  CreativeAngleType,
  CreativeStylePreference,
  CreativeStrategyFrame,
  VariationIntent,
  BrandMemoryData,
} from "../../types/brandIntelligence";

// ---------------------------------------------------------------------------
// Hook selection logic
// ---------------------------------------------------------------------------

function selectHookType(memory: BrandMemoryData): CreativeHookType {
  const style = memory.stylePreference;
  const hasTestimonials = memory.offerSummary.proofPoints.length > 0;
  const hasPainPoint = !!memory.offerSummary.mainProblem;
  const hasDiscount = !!memory.offerSummary.urgencyAngle;

  // Style-driven defaults
  if (style === "aggressive_dr") {
    if (hasPainPoint) return "pain_point";
    if (hasDiscount) return "urgency";
    return "curiosity";
  }
  if (style === "ugc_native") {
    if (hasTestimonials) return "social_proof";
    return "transformation";
  }
  if (style === "clean_premium") {
    return "benefit";
  }
  if (style === "product_focused") {
    return "benefit";
  }

  // General inference
  if (hasPainPoint) return "pain_point";
  if (hasTestimonials) return "social_proof";
  if (hasDiscount) return "urgency";
  return "benefit";
}

// ---------------------------------------------------------------------------
// Angle selection logic
// ---------------------------------------------------------------------------

function selectAngleType(memory: BrandMemoryData): CreativeAngleType {
  const style = memory.stylePreference;
  const hasProblem = !!memory.offerSummary.mainProblem;
  const hasDiscount = !!memory.offerSummary.urgencyAngle;

  if (style === "aggressive_dr") {
    if (hasProblem) return "problem_solution";
    if (hasDiscount) return "discount_offer";
    return "emotional";
  }
  if (style === "ugc_native") return "ugc_style";
  if (style === "clean_premium") return "premium_brand";
  if (style === "product_focused") {
    if (hasProblem) return "mechanism_explainer";
    return "problem_solution";
  }

  if (hasProblem) return "problem_solution";
  if (hasDiscount) return "discount_offer";
  return "aspirational";
}

// ---------------------------------------------------------------------------
// Voice style summary
// ---------------------------------------------------------------------------

function buildVoiceStyleSummary(memory: BrandMemoryData): string {
  const v = memory.voiceProfile;
  const parts: string[] = [];

  if (v.toneKeywords.length > 0) {
    parts.push(v.toneKeywords.slice(0, 4).join(", "));
  }
  parts.push(`${v.formality} formality`);
  parts.push(`${v.perspective.replace(/_/g, " ")} perspective`);

  return parts.join("; ");
}

// ---------------------------------------------------------------------------
// Visual direction summary
// ---------------------------------------------------------------------------

function buildVisualDirection(
  memory: BrandMemoryData,
  angleType: CreativeAngleType,
): string {
  const style = memory.stylePreference;

  if (style === "aggressive_dr") {
    return "Bold text overlays, high contrast, attention-grabbing colors. Product visible. Clear offer callout.";
  }
  if (style === "ugc_native") {
    return "Authentic, phone-shot aesthetic. Person holding/using product. Natural lighting. Minimal text overlay.";
  }
  if (style === "clean_premium") {
    return "Clean white/neutral background. Minimal text. Product hero shot. Premium typography.";
  }
  if (style === "product_focused") {
    return "Product front and center. Clear benefit callout. Clean layout. Benefit-focused text overlay.";
  }

  // Default based on angle
  if (angleType === "before_after") {
    return "Split layout showing transformation. Clear before/after contrast.";
  }
  if (angleType === "discount_offer") {
    return "Bold price/discount callout. Product visible. Urgency element (timer, badge).";
  }

  return "Clean product-focused layout with benefit-driven text overlay.";
}

// ---------------------------------------------------------------------------
// Offer emphasis
// ---------------------------------------------------------------------------

function buildOfferEmphasis(memory: BrandMemoryData): string {
  const offer = memory.offerSummary;
  const parts: string[] = [];

  if (offer.urgencyAngle) parts.push(`Discount/urgency: ${offer.urgencyAngle}`);
  if (offer.mainProblem) parts.push(`Problem solved: ${offer.mainProblem}`);
  if (offer.offerDetails) parts.push(`Offer: ${offer.offerDetails}`);
  if (offer.proofPoints.length > 0) parts.push(`Proof: ${offer.proofPoints[0]}`);

  return parts.join(". ") || "Emphasize the core product benefit.";
}

// ---------------------------------------------------------------------------
// Public API: Build creative strategy frame
// ---------------------------------------------------------------------------

export function buildCreativeStrategyFrame(
  memory: BrandMemoryData,
  intent?: VariationIntent | null,
): CreativeStrategyFrame {
  let hookType = selectHookType(memory);
  let angleType = selectAngleType(memory);

  // Override based on variation intent
  if (intent === "stronger_hook") hookType = "curiosity";
  if (intent === "new_angle") angleType = "emotional";
  if (intent === "more_aggressive") { hookType = "pain_point"; angleType = "problem_solution"; }
  if (intent === "more_ugc") { hookType = "social_proof"; angleType = "ugc_style"; }
  if (intent === "more_premium") { hookType = "benefit"; angleType = "premium_brand"; }
  if (intent === "clearer_offer") { hookType = "benefit"; angleType = "discount_offer"; }
  if (intent === "simpler_message") { hookType = "benefit"; angleType = "problem_solution"; }
  if (intent === "stronger_product_focus") { hookType = "benefit"; angleType = "mechanism_explainer"; }
  if (intent === "full_reset") { hookType = "curiosity"; angleType = "aspirational"; }

  const voiceStyle = buildVoiceStyleSummary(memory);
  const visualDirection = buildVisualDirection(memory, angleType);
  const offerEmphasis = buildOfferEmphasis(memory);

  const rationale = `Selected ${hookType} hook + ${angleType} angle based on `
    + (memory.stylePreference ? `${memory.stylePreference} style preference` : "inferred brand signals")
    + (intent ? `, with ${intent.replace(/_/g, " ")} intent` : "")
    + ".";

  return {
    hookType,
    angleType,
    offerEmphasis,
    voiceStyle,
    visualDirection,
    variationIntent: intent ?? null,
    rationale,
  };
}

// ---------------------------------------------------------------------------
// Public API: Build multiple strategy frames for variation set
// ---------------------------------------------------------------------------

export function buildVariationStrategySet(
  memory: BrandMemoryData,
  intents: VariationIntent[],
): CreativeStrategyFrame[] {
  return intents.map((intent) => buildCreativeStrategyFrame(memory, intent));
}
