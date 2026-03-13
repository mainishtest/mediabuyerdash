// AI Creative Diagnosis and Recommendation Types
//
// These types are intentionally isolated from:
//   - types/media.ts       (ad hierarchy / performance)
//   - types/reporting.ts   (UTM reporting rows)
// so the diagnosis / recommendation pipeline can evolve toward real LLM or
// image-generation APIs without touching other layers.

// ── Classification types ──────────────────────────────────────────────────────

// What the diagnosis system believes is the likely root cause of poor performance.
export type RecommendationCauseType =
  | "copy"    // ad messaging is likely the problem
  | "image"   // static image creative is likely the problem
  | "mixed"   // both copy and image show weakness signals
  | "unclear" // insufficient signal to classify confidently
  | "other";  // audience, offer, budget, or external factor

// How confident the diagnosis engine is in its classification.
export type RecommendationConfidence = "low" | "medium" | "high";

// ── Input types ────────────────────────────────────────────────────────────────

// Copy-specific fields captured from the current ad creative.
export interface AdCopyFields {
  hook:         string;  // opening line / scroll-stop statement
  body:         string;  // main body text
  callToAction: string;  // button / CTA label
}

// Metadata describing the static image attached to the ad.
export interface AdImageMetadata {
  imageHeadline:    string;  // overlaid headline on the image
  imageStyle:       string;  // e.g. "lifestyle", "product-only", "text-heavy", "ugc"
  dominantMessage:  string;  // what the image primarily communicates
  visualTheme:      string;  // e.g. "clean-white", "dark-mood", "busy-collage"
}

// Everything the diagnosis engine needs for a single ad evaluation.
export interface CreativeDiagnosisInput {
  adId:           string;
  adName:         string;
  campaignId:     string;
  campaignName:   string;
  // Actual performance
  actualCpa:      number;
  actualRoas:     number;
  spend:          number;
  conversions:    number;
  // Campaign goals for context
  cpaGoalValue:   number;
  cpaGoalType:    "high" | "low";
  roasGoalValue:  number;
  roasGoalType:   "high" | "low";
  // Creative content
  copy:           AdCopyFields;
  image:          AdImageMetadata;
}

// ── Diagnosis result ──────────────────────────────────────────────────────────

export interface CreativeDiagnosisResult {
  adId:                  string;
  adName:                string;
  campaignId:            string;
  campaignName:          string;
  causeType:             RecommendationCauseType;
  confidence:            RecommendationConfidence;
  shortReason:           string;
  recommendationSummary: string;
  // Derived performance signals
  cpaOverGoalPct:        number;   // how much CPA exceeds goal (0 = on target)
  roasBelowGoalPct:      number;   // how much ROAS falls below goal (0 = on target)
  performanceStatus:     "on_target" | "watch" | "below_goal";
}

// ── Recommendation models ──────────────────────────────────────────────────────

export interface CopyRecommendation {
  adId:             string;
  whatToChange:     string;   // plain-language description of the problem
  whyItMatters:     string;   // link between copy weakness and performance issue
  suggestedFocus:   string;   // specific messaging direction to test
}

export interface ImageRecommendation {
  adId:           string;
  whatToChange:   string;
  whyItMatters:   string;
  suggestedFocus: string;
}

// ── Variation models ───────────────────────────────────────────────────────────

// A single copy test variation (hook / body / CTA).
export interface CopyVariation {
  id:              string;
  title:           string;
  hook:            string;
  body:            string;
  callToAction:    string;
  // Set when a variation has been persisted to the database.
  approvalStatus?: string;
}

// A concept description for a new static image creative direction.
export interface ImageVariationConcept {
  id:              string;
  title:           string;
  conceptSummary:  string;   // what the creative tries to communicate
  visualChanges:   string;   // specific visual elements that differ from control
  goal:            string;   // hypothesis: what this change is trying to improve
  // Set when a variation has been persisted to the database.
  approvalStatus?: string;
}

// ── Aggregated output ─────────────────────────────────────────────────────────

// All diagnosis + recommendation data for a single ad.
export interface CreativeLabEntry {
  input:              CreativeDiagnosisInput;
  diagnosis:          CreativeDiagnosisResult;
  copyRecommendation:  CopyRecommendation | null;
  imageRecommendation: ImageRecommendation | null;
}
