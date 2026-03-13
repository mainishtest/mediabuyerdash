// Copy Generation Template v1
//
// Direct response ad copy with story-selling structure where appropriate.
// Guides AI toward compelling, conversion-oriented, testable variations.

import type { CopyPromptTemplate } from "../../../types/promptTemplate";

export const copyGenerationV1: CopyPromptTemplate = {
  version: {
    templateId:   "copy_generation_v1",
    version:      "1.0.0",
    templateType: "copy_generation",
    title:        "Direct Response Copy Generation",
    description:  "Generates 3 testable ad copy variations aligned with direct response best practices.",
    createdAt:    "2025-03-12",
    isActive:     true
  },
  metadata: {
    intendedOutputShape:   "3 variations, each with hook, body, callToAction",
    providerCompatibility: ["openai", "anthropic", "mock"],
    notes:                 ["Outputs are intended to be compelling and conversion-oriented, not guaranteed performance outcomes."],
    warnings:              ["Human review required before use. Do not publish without approval."],
    expectedVariationCount: 3,
    creativePrinciplesIncluded: [
      "direct response copywriting",
      "story-selling structure",
      "strong hooks",
      "clear pain points / desired outcomes",
      "emotional relevance",
      "specificity",
      "credibility cues",
      "compelling benefits",
      "clear CTAs",
      "testable variation"
    ]
  },
  sections: {
    systemInstructions: `You are an expert direct response copywriter for performance marketing. Your job is to write compelling Facebook ad copy that drives conversions. You write clear, specific, emotionally relevant copy — never vague, generic, or hype-heavy. You avoid language that sounds unbelievable.`,

    taskInstructions: `Generate 3 distinct ad copy variations for the following underperforming ad.

Campaign: {{campaignName}} ({{campaignId}})
Ad: {{adName}} ({{adId}})

Current performance: CPA ${{performance.actualCpa}}, ROAS {{performance.actualRoas}}×, ${{performance.spend}} spend, {{performance.conversions}} conversions.
Performance trend: {{performance.trendSummary}}

Campaign goals: CPA goal ${{goals.cpaGoalValue}}, ROAS goal {{goals.roasGoalValue}}×.

Diagnosis: {{diagnosis.causeType}} — {{diagnosis.shortReason}}
Recommendation: {{diagnosis.recommendationSummary}}

Current copy:
- Hook: {{creative.currentHook}}
- Body: {{creative.currentBody}}
- CTA: {{creative.currentCallToAction}}

Image context (for alignment): {{creative.imageHeadline}}, {{creative.imageStyle}}, {{creative.dominantMessage}}, {{creative.visualTheme}}`,

    outputRequirements: `Each variation MUST include:
1. Hook — attention-grabbing opening (1–2 sentences)
2. Body — main message with benefit, proof, or story
3. Call to Action — clear, direct CTA

Produce 3 meaningfully different variations. Do not produce near-duplicates. Each variation should test a different angle, hook style, or benefit emphasis.`,

    constraints: `- Stay aligned with campaign context and diagnosis context.
- Do not make performance guarantees or promises.
- Do not use hype that sounds unbelievable.
- Avoid vague, generic, weak marketing language.
- Preserve brand-appropriate tone.`,

    directResponsePrinciples: `Apply direct response best practices:
- Lead with a strong hook that stops the scroll
- Address a clear pain point or desired outcome
- Use emotional relevance — connect to what the reader cares about
- Be specific — numbers, outcomes, timeframes
- Include believable proof or credibility cues when relevant
- Emphasize compelling benefits, not features alone
- Every word should earn its place`,

    storySellingGuidance: `When relevant, use story-selling structure:
- Open with a relatable situation or transformation
- Show the before/after or problem/solution
- Use concrete details to make it believable
- Let the story carry the benefit — don't over-explain`,

    ctaGuidance: `Calls to action must be:
- Clear and direct
- Action-oriented (verb-first when appropriate)
- Specific to the offer or next step
- Varied between outputs — test different CTA angles`
  }
};
