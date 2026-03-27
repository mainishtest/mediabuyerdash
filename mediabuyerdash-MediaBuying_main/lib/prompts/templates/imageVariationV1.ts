// Image Variation Generation Template v1
//
// Attention-grabbing static image concepts for direct response.
// Guides AI toward clear, testable visual variation concepts.

import type { ImagePromptTemplate } from "../../../types/promptTemplate";

export const imageVariationV1: ImagePromptTemplate = {
  version: {
    templateId:   "image_variation_v1",
    version:      "1.0.0",
    templateType: "image_variation_generation",
    title:        "Direct Response Image Variation",
    description:  "Generates 3 testable static image concept variations for performance ads.",
    createdAt:    "2025-03-12",
    isActive:     true
  },
  metadata: {
    intendedOutputShape:   "3 concept summaries with visual changes and goals",
    providerCompatibility: ["openai", "anthropic", "mock"],
    notes:                 ["Outputs are concept descriptions for human/designer execution. Not guaranteed performance outcomes."],
    warnings:              ["Human review required before use. Do not publish without approval."],
    expectedVariationCount: 3,
    creativePrinciplesIncluded: [
      "attention-grabbing concepts",
      "visual clarity",
      "message-to-market fit",
      "strong focal points",
      "readable visual hierarchy",
      "clear offer/problem/solution",
      "action-oriented concepts",
      "testable visual variation"
    ]
  },
  sections: {
    systemInstructions: `You are an expert in direct response visual creative for performance marketing. Your job is to describe static image concepts that grab attention and support conversion goals. You prioritize clear focal points, strong visual communication, and concepts that make the offer or problem/solution visually obvious.`,

    taskInstructions: "Generate 3 distinct static image concept variations for the following underperforming ad.\n\n" +
      "Campaign: {{campaignName}} ({{campaignId}})\n" +
      "Ad: {{adName}} ({{adId}})\n\n" +
      "Current performance: CPA ${{performance.actualCpa}}, ROAS {{performance.actualRoas}}×, ${{performance.spend}} spend.\n" +
      "Performance trend: {{performance.trendSummary}}\n\n" +
      "Campaign goals: CPA goal ${{goals.cpaGoalValue}}, ROAS goal {{goals.roasGoalValue}}×.\n\n" +
      "Diagnosis: {{diagnosis.causeType}} — {{diagnosis.shortReason}}\n" +
      "Recommendation: {{diagnosis.recommendationSummary}}\n\n" +
      "Current image: {{creative.imageHeadline}}, {{creative.imageStyle}}, {{creative.dominantMessage}}, {{creative.visualTheme}}\n\n" +
      "Current copy context: Hook — {{creative.currentHook}}; CTA — {{creative.currentCallToAction}}",

    visualConstraints: `- Concepts must be describable as static images (no video).
- Align with diagnosis context and campaign context.
- Avoid cluttered or confusing visual ideas.
- Each concept should be meaningfully different — testable variation, not tiny cosmetic changes.`,

    outputRequirements: `Each concept MUST include:
1. Concept summary — what the image shows and why it works
2. Visual changes — specific differences from current creative
3. Goal — what this variation tests or improves

Produce 3 meaningfully different concepts. Do not produce near-duplicates. Each should test a different visual angle, focal point, or message emphasis.`,

    attentionGrabbingPrinciples: `Apply attention-grabbing principles:
- Lead with a strong focal point — one clear subject or message
- Use contrast, color, or composition to stop the scroll
- Make the main message readable at thumbnail size
- Avoid visual noise that competes with the core message`,

    visualHierarchyGuidance: `Visual hierarchy must support the message:
- Primary message should dominate
- Secondary elements support, not compete
- Clear path for the eye — what to see first, second
- Readable text overlays when used — legible, not cramped`,

    actionDrivingGuidance: `Concepts should support direct response goals:
- Make the offer, problem, or solution visually obvious when appropriate
- Use action-oriented imagery when it fits the product
- Support the CTA — image and copy should work together
- Test different visual approaches to the same conversion goal`
  }
};
