// Sample diagnosis inputs for the Creative Optimization Lab.
// Each entry represents a real ad that has performance below its campaign goals.
// The mix of copy and image signals is designed to exercise all diagnosis paths:
//   - ad_lab_1: copy weakness → classify as "copy"
//   - ad_lab_2: image weakness → classify as "image"
//   - ad_lab_3: both weak    → classify as "mixed"
//   - ad_lab_4: low spend    → classify as "unclear"

import type { CreativeDiagnosisInput } from "../../types/creativeDiagnosis";

export const mockCreativeDiagnosisInputs: CreativeDiagnosisInput[] = [

  // ── Ad 1: Weak copy, reasonable image ────────────────────────────────────
  // CPA 42 % over a $20 goal — ROAS 28 % below a 3.5× goal.
  // Hook is generic, body has no specificity, CTA is weak.
  // Image is a clean lifestyle shot — visually acceptable.
  {
    adId:         "ad_lab_1",
    adName:       "Video V1 — Broad (Q2)",
    campaignId:   "camp_1",
    campaignName: "Prospecting Q1",
    actualCpa:    28.40,
    actualRoas:   2.51,
    spend:        340.80,
    conversions:  12,
    cpaGoalValue: 20.00,
    cpaGoalType:  "low",
    roasGoalValue: 3.5,
    roasGoalType:  "high",
    copy: {
      hook:         "Try it today.",
      body:         "Get the product that everyone is talking about. Great quality, fast shipping.",
      callToAction: "Learn More"
    },
    image: {
      imageHeadline:   "New Arrivals",
      imageStyle:      "lifestyle",
      dominantMessage: "Product in a bright setting",
      visualTheme:     "clean-white"
    }
  },

  // ── Ad 2: Strong copy, weak image ─────────────────────────────────────────
  // CPA 65 % over a $25 goal — ROAS 38 % below a 2.5× goal.
  // Copy has a specific hook and benefit-driven body.
  // Image is text-heavy with a busy layout and off-brand visual theme.
  {
    adId:         "ad_lab_2",
    adName:       "Static V1 — Interest (Q2)",
    campaignId:   "camp_1",
    campaignName: "Prospecting Q1",
    actualCpa:    41.25,
    actualRoas:   1.54,
    spend:        495.00,
    conversions:  12,
    cpaGoalValue: 25.00,
    cpaGoalType:  "low",
    roasGoalValue: 2.5,
    roasGoalType:  "high",
    copy: {
      hook:         "Stop overpaying for results that disappear after 30 days.",
      body:         "Our system delivers compounding results because it works with your body's natural rhythm — not against it. Backed by 3 clinical studies and trusted by 14,000+ customers.",
      callToAction: "See How It Works"
    },
    image: {
      imageHeadline:   "LIMITED TIME: 40% OFF + FREE SHIPPING + BONUS GUIDE + MONEY BACK",
      imageStyle:      "text-heavy",
      dominantMessage: "Too many offers at once",
      visualTheme:     "busy-collage"
    }
  },

  // ── Ad 3: Both copy and image are weak ────────────────────────────────────
  // CPA 80 % over goal, ROAS 55 % below goal. Both signal problems.
  {
    adId:         "ad_lab_3",
    adName:       "Carousel V1 — Retargeting (Q2)",
    campaignId:   "camp_2",
    campaignName: "Retargeting Q1",
    actualCpa:    54.00,
    actualRoas:   1.12,
    spend:        378.00,
    conversions:   7,
    cpaGoalValue: 30.00,
    cpaGoalType:  "low",
    roasGoalValue: 2.5,
    roasGoalType:  "high",
    copy: {
      hook:         "Buy now.",
      body:         "Shop our store. Lots of great products.",
      callToAction: "Shop"
    },
    image: {
      imageHeadline:   "Sale",
      imageStyle:      "product-only",
      dominantMessage: "No clear benefit or differentiator",
      visualTheme:     "dark-mood"
    }
  },

  // ── Ad 4: Low spend, insufficient data ────────────────────────────────────
  // Only $28 spent — not enough signal to draw conclusions.
  {
    adId:         "ad_lab_4",
    adName:       "UGC Test V1 — Broad",
    campaignId:   "camp_1",
    campaignName: "Prospecting Q1",
    actualCpa:    28.00,
    actualRoas:   2.80,
    spend:        28.00,
    conversions:   1,
    cpaGoalValue: 20.00,
    cpaGoalType:  "low",
    roasGoalValue: 3.5,
    roasGoalType:  "high",
    copy: {
      hook:         "I was skeptical at first — then I tried it for 7 days.",
      body:         "Real talk: I've tried everything. This is the first thing that actually worked for me in 6 months. Here's exactly what happened...",
      callToAction: "Watch My Story"
    },
    image: {
      imageHeadline:   "Real Results",
      imageStyle:      "ugc",
      dominantMessage: "Authentic user testimonial",
      visualTheme:     "clean-white"
    }
  }

];
