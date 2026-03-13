// Image Variation Concept Generator
//
// Produces 3 deterministic mock image variation concepts for a given ad.
// Concepts follow three distinct visual strategies:
//   1. Clean Focus    — remove clutter, single subject, minimal text
//   2. Proof-Led      — show real results, testimonials, or numbers
//   3. Contrast Frame — use visual contrast to direct the eye to the offer
//
// This is intentionally placeholder logic. When a real image-generation or
// creative-brief API is added (e.g. DALL·E, Adobe Firefly, an internal
// creative brief system), replace the function body only. The signature
// and return types remain stable.

import type { ImageVariationConcept, CreativeDiagnosisInput } from "../types/creativeDiagnosis";

// ── Strategy templates ────────────────────────────────────────────────────────

function cleanFocusConcept(id: string): ImageVariationConcept {
  return {
    id,
    title:           "Concept A — Clean Single Focus",
    conceptSummary:  "Strip all text overlay except a single 5-word headline. Feature one product or one person in a high-contrast, well-lit frame. The image communicates exactly one idea.",
    visualChanges:   "Remove all secondary text, badges, and icons. Use a solid or very lightly blurred background. Ensure the main subject occupies at least 60% of the frame. Keep headline to ≤ 5 words in large, readable typography.",
    goal:            "Reduce cognitive load — let the viewer understand the offer in under 1 second without reading body copy."
  };
}

function proofLedConcept(id: string): ImageVariationConcept {
  return {
    id,
    title:           "Concept B — Proof-Led Visual",
    conceptSummary:  "Lead with a real or representative result. Show a before/after, a screenshot of a metric, or a customer photo with a short bold quote. The image proves the claim rather than just stating it.",
    visualChanges:   "Replace current product-shot with a side-by-side or split-panel layout. Left panel: a relatable 'before' moment. Right panel: the outcome or result. Use a quote overlay of ≤ 10 words in a legible contrasting colour.",
    goal:            "Build immediate credibility by showing proof of the outcome — reduces scepticism and increases click-through for warm audiences."
  };
}

function contrastFrameConcept(id: string): ImageVariationConcept {
  return {
    id,
    title:           "Concept C — Contrast Frame",
    conceptSummary:  "Use a bold colour contrast or light-vs-dark split to direct the eye immediately to the offer or CTA area. The visual hierarchy is engineered: attention → benefit → action.",
    visualChanges:   "Apply a strong background colour (e.g. deep navy or vivid teal) that contrasts sharply with the product or person. Place the headline at the top in white. Place a clearly shaped CTA-style button graphic at the bottom. Minimal supporting text mid-frame.",
    goal:            "Engineer a natural eye path that ends at the call to action — increases the probability of a swipe-up or click even with a fast scroll."
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

// NOTE: This is a MOCK generator — no image API is called.
// The concepts are realistic creative briefs that a designer or AI image tool
// would use to produce actual creative assets. Replace this function body
// with an API call when real image generation is integrated.
export function generateImageVariations(
  input: CreativeDiagnosisInput
): ImageVariationConcept[] {
  const baseId = `img_var_${input.adId}`;
  return [
    cleanFocusConcept(`${baseId}_a`),
    proofLedConcept(`${baseId}_b`),
    contrastFrameConcept(`${baseId}_c`)
  ];
}
