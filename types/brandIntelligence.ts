// types/brandIntelligence.ts
// Typed models for the Brand-Level Prompt Intelligence System.
//
// Design rules:
//   - Pure TypeScript — no imports from lib/ to avoid circular deps.
//   - CRM is the source of truth for ROAS/CPA throughout.
//   - Models are designed for structured prompt assembly, not manual prompting.
//   - Landing-page extraction is stateless; brand memory is persistent.

// ---------------------------------------------------------------------------
// Hook types — scroll-stopping opening strategies
// ---------------------------------------------------------------------------

export type CreativeHookType =
  | "pain_point"
  | "benefit"
  | "curiosity"
  | "urgency"
  | "social_proof"
  | "authority"
  | "transformation"
  | "objection_break";

export const CREATIVE_HOOK_TYPES: { type: CreativeHookType; label: string; description: string }[] = [
  { type: "pain_point",      label: "Pain Point",      description: "Lead with the problem the audience feels" },
  { type: "benefit",         label: "Benefit",         description: "Lead with the positive outcome" },
  { type: "curiosity",       label: "Curiosity",       description: "Open a knowledge gap that demands a click" },
  { type: "urgency",         label: "Urgency",         description: "Time or scarcity pressure" },
  { type: "social_proof",    label: "Social Proof",    description: "Lead with testimonials, numbers, or community" },
  { type: "authority",       label: "Authority",       description: "Lead with expertise or credentials" },
  { type: "transformation",  label: "Transformation",  description: "Before/after framing of change" },
  { type: "objection_break", label: "Objection Break", description: "Address the biggest hesitation up front" },
];

// ---------------------------------------------------------------------------
// Angle types — strategic message positioning
// ---------------------------------------------------------------------------

export type CreativeAngleType =
  | "problem_solution"
  | "aspirational"
  | "emotional"
  | "logical"
  | "anti_competitor"
  | "before_after"
  | "ugc_style"
  | "premium_brand"
  | "discount_offer"
  | "mechanism_explainer";

export const CREATIVE_ANGLE_TYPES: { type: CreativeAngleType; label: string; description: string }[] = [
  { type: "problem_solution",    label: "Problem → Solution",  description: "Name the problem, present the fix" },
  { type: "aspirational",        label: "Aspirational",        description: "Show the dream state the product enables" },
  { type: "emotional",           label: "Emotional",           description: "Connect through feeling, not logic" },
  { type: "logical",             label: "Logical",             description: "Data, specs, and rational persuasion" },
  { type: "anti_competitor",     label: "Anti-Competitor",     description: "Position against alternatives" },
  { type: "before_after",        label: "Before / After",      description: "Contrast life before and after the product" },
  { type: "ugc_style",           label: "UGC Style",           description: "Casual, user-generated content tone" },
  { type: "premium_brand",       label: "Premium Brand",       description: "Elevated, polished brand voice" },
  { type: "discount_offer",      label: "Discount / Offer",    description: "Lead with a deal or limited offer" },
  { type: "mechanism_explainer", label: "Mechanism Explainer", description: "Explain how the product works" },
];

// ---------------------------------------------------------------------------
// Variation intents — what makes this variant different from the original
// ---------------------------------------------------------------------------

export type VariationIntent =
  | "stronger_hook"
  | "new_angle"
  | "more_aggressive"
  | "more_ugc"
  | "more_premium"
  | "clearer_offer"
  | "simpler_message"
  | "stronger_product_focus"
  | "stronger_visual_contrast"
  | "full_reset";

export const VARIATION_INTENTS: { intent: VariationIntent; label: string }[] = [
  { intent: "stronger_hook",            label: "Stronger Hook" },
  { intent: "new_angle",                label: "New Angle" },
  { intent: "more_aggressive",          label: "More Aggressive" },
  { intent: "more_ugc",                 label: "More UGC" },
  { intent: "more_premium",             label: "More Premium" },
  { intent: "clearer_offer",            label: "Clearer Offer" },
  { intent: "simpler_message",          label: "Simpler Message" },
  { intent: "stronger_product_focus",   label: "Stronger Product Focus" },
  { intent: "stronger_visual_contrast", label: "Stronger Visual Contrast" },
  { intent: "full_reset",               label: "Full Reset" },
];

// ---------------------------------------------------------------------------
// Creative style preference — user-facing style selector
// ---------------------------------------------------------------------------

export type CreativeStylePreference =
  | "aggressive_dr"    // aggressive direct response
  | "clean_premium"    // clean premium brand
  | "ugc_native"       // UGC / native style
  | "product_focused"; // product-focused

export const CREATIVE_STYLE_OPTIONS: { value: CreativeStylePreference; label: string }[] = [
  { value: "aggressive_dr",  label: "Aggressive Direct Response" },
  { value: "clean_premium",  label: "Clean Premium Brand" },
  { value: "ugc_native",     label: "UGC / Native Style" },
  { value: "product_focused", label: "Product Focused" },
];

// ---------------------------------------------------------------------------
// Landing page extraction — stateless output from URL analysis
// ---------------------------------------------------------------------------

export type LandingPageSignal = {
  type:       string;  // "headline" | "benefit" | "testimonial" | "price" | "cta" etc.
  value:      string;
  confidence: "high" | "medium" | "low";
};

export type LandingPageExtraction = {
  url:            string;
  headline:       string | null;
  subheadline:    string | null;
  offer:          string | null;
  keyBenefits:    string[];
  productDetails: string | null;
  price:          string | null;
  discount:       string | null;
  testimonials:   string[];
  tone:           string | null;
  positioning:    string | null;
  ctaLanguage:    string | null;
  signals:        LandingPageSignal[];
  extractedAt:    string; // ISO timestamp
  quality:        "rich" | "moderate" | "sparse";
};

// ---------------------------------------------------------------------------
// Brand context profile — the core brand understanding
// ---------------------------------------------------------------------------

export type BrandContextProfile = {
  clientAccountId: string;
  brandName:       string;
  industry:        string | null;
  productCategory: string | null;
  coreBenefit:     string | null;    // single most important benefit
  uniqueMechanism: string | null;    // what makes it work / why it's different
  pricePoint:      string | null;
  targetGender:    string | null;    // "male" | "female" | "all" | null
  targetAgeRange:  string | null;    // "25-45" etc.
};

// ---------------------------------------------------------------------------
// Brand offer summary — what is being sold
// ---------------------------------------------------------------------------

export type BrandOfferSummary = {
  productName:    string;
  offerHeadline:  string | null;
  offerDetails:   string | null;
  mainProblem:    string | null;      // what problem does this solve?
  mainSolution:   string | null;      // how does it solve it?
  proofPoints:    string[];           // testimonials, stats, authority signals
  objections:     string[];           // common objections
  urgencyAngle:   string | null;      // scarcity, deadline, etc.
};

// ---------------------------------------------------------------------------
// Brand voice profile — how the brand talks
// ---------------------------------------------------------------------------

export type BrandVoiceProfile = {
  toneKeywords:    string[];          // "bold", "conversational", "authoritative"
  formality:       "casual" | "balanced" | "formal";
  perspective:     "first_person" | "second_person" | "third_person";
  vocabulary:      "simple" | "moderate" | "sophisticated";
  avoidWords:      string[];          // words/phrases to never use
  avoidTopics:     string[];          // topics to never reference
  examplePhrases:  string[];          // brand-voice examples
};

// ---------------------------------------------------------------------------
// Audience persona profile
// ---------------------------------------------------------------------------

export type AudiencePersonaProfile = {
  name:            string | null;     // persona label e.g. "Busy Mom"
  description:     string;
  painPoints:      string[];
  desires:         string[];
  objections:      string[];
  languageStyle:   string | null;     // how this audience talks
  awarenessLevel:  "unaware" | "problem_aware" | "solution_aware" | "product_aware" | "most_aware";
};

// ---------------------------------------------------------------------------
// Creative strategy frame — bridges brand context → generation
// ---------------------------------------------------------------------------

export type CreativeStrategyFrame = {
  hookType:          CreativeHookType;
  angleType:         CreativeAngleType;
  offerEmphasis:     string;            // what to emphasize about the offer
  voiceStyle:        string;            // summary voice direction
  visualDirection:   string;            // image style guidance
  variationIntent:   VariationIntent | null;
  rationale:         string;            // why this strategy was chosen
};

// ---------------------------------------------------------------------------
// Prompt generation — structured prompt assembly
// ---------------------------------------------------------------------------

export type PromptSection = {
  key:     string;     // "brand_context" | "offer" | "audience" | "strategy" | "constraints"
  heading: string;
  content: string;
};

export type PromptGenerationContext = {
  brandProfile:    BrandContextProfile;
  offerSummary:    BrandOfferSummary;
  voiceProfile:    BrandVoiceProfile;
  audience:        AudiencePersonaProfile;
  landingPage:     LandingPageExtraction | null;
  strategy:        CreativeStrategyFrame;
  sourceAdContext: string | null;         // existing ad copy for reference
  performanceHints: string[];            // from learning memory
};

export type PromptGenerationRequest = {
  context:    PromptGenerationContext;
  mode:       "copy" | "image" | "both";
  count:      number;                     // how many variations
};

export type PromptGenerationResult = {
  copyPrompt:   string | null;
  imagePrompt:  string | null;
  sections:     PromptSection[];          // structured breakdown
  metadata: {
    hookType:   CreativeHookType;
    angleType:  CreativeAngleType;
    intent:     VariationIntent | null;
    generatedAt: string;
  };
};

// ---------------------------------------------------------------------------
// Brand clarification — smart questions when context is sparse
// ---------------------------------------------------------------------------

export type BrandClarificationQuestion = {
  id:          string;
  question:    string;
  hint:        string | null;             // helper text
  fieldKey:    string;                    // which field this populates
  inputType:   "text" | "select" | "multi_select";
  options:     string[] | null;           // for select/multi_select
  required:    boolean;
};

// ---------------------------------------------------------------------------
// Brand prompt summary — human-readable summary of the prompt system state
// ---------------------------------------------------------------------------

export type BrandPromptSummary = {
  brandName:        string;
  hasLandingPage:   boolean;
  hasVoiceProfile:  boolean;
  hasAudience:      boolean;
  hasOffer:         boolean;
  strategyReady:    boolean;
  completeness:     number;               // 0-100
  missingFields:    string[];
  lastUpdated:      string | null;
};

// ---------------------------------------------------------------------------
// Persisted brand memory — stored per client account (DB shape)
// ---------------------------------------------------------------------------

export type BrandMemoryData = {
  brandProfile:      BrandContextProfile;
  offerSummary:      BrandOfferSummary;
  voiceProfile:      BrandVoiceProfile;
  audience:          AudiencePersonaProfile;
  landingPageUrl:    string | null;
  landingPageData:   LandingPageExtraction | null;
  stylePreference:   CreativeStylePreference | null;
  avoidList:         string[];
  referenceNotes:    string | null;
};
