// lib/brandIntelligence/brandContext.ts
// Builds brand context profiles from inputs + landing page extraction.
// Pure functions — no DB, no side effects.

import type {
  BrandContextProfile,
  BrandOfferSummary,
  BrandVoiceProfile,
  AudiencePersonaProfile,
  LandingPageExtraction,
  CreativeStylePreference,
  BrandMemoryData,
  BrandPromptSummary,
} from "../../types/brandIntelligence";

// ---------------------------------------------------------------------------
// Build brand context profile from landing page + user inputs
// ---------------------------------------------------------------------------

export function buildBrandContextProfile(opts: {
  clientAccountId: string;
  brandName:       string;
  landingPage?:    LandingPageExtraction | null;
  overrides?: Partial<BrandContextProfile>;
}): BrandContextProfile {
  const lp = opts.landingPage;

  return {
    clientAccountId: opts.clientAccountId,
    brandName:       opts.brandName,
    industry:        opts.overrides?.industry ?? null,
    productCategory: opts.overrides?.productCategory ?? null,
    coreBenefit:     opts.overrides?.coreBenefit ?? lp?.keyBenefits?.[0] ?? null,
    uniqueMechanism: opts.overrides?.uniqueMechanism ?? null,
    pricePoint:      opts.overrides?.pricePoint ?? lp?.price ?? null,
    targetGender:    opts.overrides?.targetGender ?? null,
    targetAgeRange:  opts.overrides?.targetAgeRange ?? null,
  };
}

// ---------------------------------------------------------------------------
// Build offer summary from landing page extraction
// ---------------------------------------------------------------------------

export function buildBrandOfferSummary(opts: {
  productName:   string;
  landingPage?:  LandingPageExtraction | null;
  overrides?:    Partial<BrandOfferSummary>;
}): BrandOfferSummary {
  const lp = opts.landingPage;

  return {
    productName:   opts.productName,
    offerHeadline: opts.overrides?.offerHeadline ?? lp?.headline ?? null,
    offerDetails:  opts.overrides?.offerDetails ?? lp?.offer ?? null,
    mainProblem:   opts.overrides?.mainProblem ?? null,
    mainSolution:  opts.overrides?.mainSolution ?? lp?.positioning ?? null,
    proofPoints:   opts.overrides?.proofPoints ?? lp?.testimonials ?? [],
    objections:    opts.overrides?.objections ?? [],
    urgencyAngle:  opts.overrides?.urgencyAngle ?? lp?.discount ?? null,
  };
}

// ---------------------------------------------------------------------------
// Infer brand voice from landing page signals
// ---------------------------------------------------------------------------

export function inferBrandVoice(opts: {
  landingPage?: LandingPageExtraction | null;
  stylePreference?: CreativeStylePreference | null;
  overrides?: Partial<BrandVoiceProfile>;
}): BrandVoiceProfile {
  const lp = opts.landingPage;
  const style = opts.stylePreference;

  // Default voice based on style preference
  let formality: BrandVoiceProfile["formality"] = "balanced";
  let vocabulary: BrandVoiceProfile["vocabulary"] = "moderate";
  let perspective: BrandVoiceProfile["perspective"] = "second_person";
  let toneKeywords: string[] = [];

  if (style === "aggressive_dr") {
    formality = "casual";
    vocabulary = "simple";
    toneKeywords = ["bold", "direct", "urgent", "conversational"];
  } else if (style === "clean_premium") {
    formality = "formal";
    vocabulary = "sophisticated";
    toneKeywords = ["polished", "confident", "elevated", "minimal"];
  } else if (style === "ugc_native") {
    formality = "casual";
    vocabulary = "simple";
    perspective = "first_person";
    toneKeywords = ["authentic", "casual", "relatable", "personal"];
  } else if (style === "product_focused") {
    formality = "balanced";
    vocabulary = "moderate";
    toneKeywords = ["clear", "informative", "benefit-driven", "specific"];
  }

  // Enrich from landing page tone
  if (lp?.tone) {
    const lpTones = lp.tone.split(/[,;]+/).map((t) => t.trim().toLowerCase()).filter(Boolean);
    toneKeywords = [...new Set([...toneKeywords, ...lpTones])];
  }

  if (toneKeywords.length === 0) {
    toneKeywords = ["professional", "clear", "persuasive"];
  }

  return {
    toneKeywords,
    formality:     opts.overrides?.formality ?? formality,
    perspective:   opts.overrides?.perspective ?? perspective,
    vocabulary:    opts.overrides?.vocabulary ?? vocabulary,
    avoidWords:    opts.overrides?.avoidWords ?? [],
    avoidTopics:   opts.overrides?.avoidTopics ?? [],
    examplePhrases: opts.overrides?.examplePhrases ?? [],
  };
}

// ---------------------------------------------------------------------------
// Infer audience persona from landing page + offer
// ---------------------------------------------------------------------------

export function inferAudiencePersona(opts: {
  landingPage?:  LandingPageExtraction | null;
  offerSummary?: BrandOfferSummary | null;
  overrides?:    Partial<AudiencePersonaProfile>;
}): AudiencePersonaProfile {
  const lp = opts.landingPage;
  const offer = opts.offerSummary;

  const painPoints: string[] = opts.overrides?.painPoints ?? [];
  const desires: string[] = opts.overrides?.desires ?? [];

  // Infer pain points from offer
  if (offer?.mainProblem && painPoints.length === 0) {
    painPoints.push(offer.mainProblem);
  }

  // Infer desires from benefits
  if (lp?.keyBenefits) {
    for (const b of lp.keyBenefits.slice(0, 3)) {
      if (!desires.includes(b)) desires.push(b);
    }
  }

  return {
    name:           opts.overrides?.name ?? null,
    description:    opts.overrides?.description ?? "Target customer for this product",
    painPoints,
    desires,
    objections:     opts.overrides?.objections ?? offer?.objections ?? [],
    languageStyle:  opts.overrides?.languageStyle ?? null,
    awarenessLevel: opts.overrides?.awarenessLevel ?? "problem_aware",
  };
}

// ---------------------------------------------------------------------------
// Build complete brand memory from all parts
// ---------------------------------------------------------------------------

export function buildBrandMemoryData(opts: {
  brandProfile:    BrandContextProfile;
  offerSummary:    BrandOfferSummary;
  voiceProfile:    BrandVoiceProfile;
  audience:        AudiencePersonaProfile;
  landingPageUrl?: string | null;
  landingPageData?: LandingPageExtraction | null;
  stylePreference?: CreativeStylePreference | null;
  avoidList?:      string[];
  referenceNotes?: string | null;
}): BrandMemoryData {
  return {
    brandProfile:    opts.brandProfile,
    offerSummary:    opts.offerSummary,
    voiceProfile:    opts.voiceProfile,
    audience:        opts.audience,
    landingPageUrl:  opts.landingPageUrl ?? null,
    landingPageData: opts.landingPageData ?? null,
    stylePreference: opts.stylePreference ?? null,
    avoidList:       opts.avoidList ?? [],
    referenceNotes:  opts.referenceNotes ?? null,
  };
}

// ---------------------------------------------------------------------------
// Summarize brand prompt readiness
// ---------------------------------------------------------------------------

export function summarizeBrandPromptSystem(
  memory: BrandMemoryData | null,
): BrandPromptSummary {
  if (!memory) {
    return {
      brandName:       "",
      hasLandingPage:  false,
      hasVoiceProfile: false,
      hasAudience:     false,
      hasOffer:        false,
      strategyReady:   false,
      completeness:    0,
      missingFields:   ["brand profile", "offer", "voice", "audience", "landing page"],
      lastUpdated:     null,
    };
  }

  const missing: string[] = [];
  let score = 0;
  const total = 5;

  const hasLP = !!memory.landingPageData;
  if (hasLP) score++; else missing.push("landing page");

  const hasVoice = memory.voiceProfile.toneKeywords.length > 0;
  if (hasVoice) score++; else missing.push("voice profile");

  const hasAudience = memory.audience.description !== "Target customer for this product"
    || memory.audience.painPoints.length > 0;
  if (hasAudience) score++; else missing.push("audience");

  const hasOffer = !!memory.offerSummary.offerHeadline || !!memory.offerSummary.mainProblem;
  if (hasOffer) score++; else missing.push("offer details");

  const hasBrand = !!memory.brandProfile.brandName;
  if (hasBrand) score++; else missing.push("brand profile");

  return {
    brandName:       memory.brandProfile.brandName,
    hasLandingPage:  hasLP,
    hasVoiceProfile: hasVoice,
    hasAudience:     hasAudience,
    hasOffer:        hasOffer,
    strategyReady:   score >= 3,
    completeness:    Math.round((score / total) * 100),
    missingFields:   missing,
    lastUpdated:     null,
  };
}
