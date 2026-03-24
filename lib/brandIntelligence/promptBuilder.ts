// lib/brandIntelligence/promptBuilder.ts
// Structured prompt construction for copy and image generation.
// Assembles prompts from typed components — users never write prompts manually.
//
// Design rules:
//   - Pure functions — no DB, no API calls.
//   - Modular: copy and image prompt builders are independent.
//   - Prompt sections are structured for debugging/preview.
//   - Constraints (avoid list, voice rules) are always included.

import type {
  PromptSection,
  PromptGenerationContext,
  PromptGenerationResult,
  CreativeStrategyFrame,
  BrandMemoryData,
  VariationIntent,
} from "../../types/brandIntelligence";
import type { CreativeHookType, CreativeAngleType } from "../../types/brandIntelligence";
import { CREATIVE_HOOK_TYPES, CREATIVE_ANGLE_TYPES } from "../../types/brandIntelligence";

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

function buildBrandSection(ctx: PromptGenerationContext): PromptSection {
  const bp = ctx.brandProfile;
  const lines: string[] = [
    `Brand: ${bp.brandName}`,
  ];
  if (bp.industry) lines.push(`Industry: ${bp.industry}`);
  if (bp.productCategory) lines.push(`Category: ${bp.productCategory}`);
  if (bp.coreBenefit) lines.push(`Core Benefit: ${bp.coreBenefit}`);
  if (bp.uniqueMechanism) lines.push(`Unique Mechanism: ${bp.uniqueMechanism}`);
  if (bp.pricePoint) lines.push(`Price Point: ${bp.pricePoint}`);

  return { key: "brand_context", heading: "Brand Context", content: lines.join("\n") };
}

function buildOfferSection(ctx: PromptGenerationContext): PromptSection {
  const o = ctx.offerSummary;
  const lines: string[] = [
    `Product: ${o.productName}`,
  ];
  if (o.offerHeadline) lines.push(`Offer: ${o.offerHeadline}`);
  if (o.offerDetails) lines.push(`Details: ${o.offerDetails}`);
  if (o.mainProblem) lines.push(`Problem: ${o.mainProblem}`);
  if (o.mainSolution) lines.push(`Solution: ${o.mainSolution}`);
  if (o.urgencyAngle) lines.push(`Urgency: ${o.urgencyAngle}`);
  if (o.proofPoints.length > 0) {
    lines.push(`Proof: ${o.proofPoints.slice(0, 3).join("; ")}`);
  }

  return { key: "offer", heading: "Offer & Product", content: lines.join("\n") };
}

function buildAudienceSection(ctx: PromptGenerationContext): PromptSection {
  const a = ctx.audience;
  const lines: string[] = [];
  if (a.name) lines.push(`Persona: ${a.name}`);
  lines.push(`Description: ${a.description}`);
  lines.push(`Awareness: ${a.awarenessLevel.replace(/_/g, " ")}`);
  if (a.painPoints.length > 0) lines.push(`Pain Points: ${a.painPoints.join("; ")}`);
  if (a.desires.length > 0) lines.push(`Desires: ${a.desires.join("; ")}`);
  if (a.objections.length > 0) lines.push(`Objections: ${a.objections.join("; ")}`);
  if (a.languageStyle) lines.push(`Language Style: ${a.languageStyle}`);

  return { key: "audience", heading: "Target Audience", content: lines.join("\n") };
}

function buildStrategySection(ctx: PromptGenerationContext): PromptSection {
  const s = ctx.strategy;
  const hookLabel = CREATIVE_HOOK_TYPES.find((h) => h.type === s.hookType)?.label ?? s.hookType;
  const angleLabel = CREATIVE_ANGLE_TYPES.find((a) => a.type === s.angleType)?.label ?? s.angleType;

  const lines: string[] = [
    `Hook Strategy: ${hookLabel} — ${CREATIVE_HOOK_TYPES.find((h) => h.type === s.hookType)?.description ?? ""}`,
    `Angle: ${angleLabel} — ${CREATIVE_ANGLE_TYPES.find((a) => a.type === s.angleType)?.description ?? ""}`,
    `Offer Emphasis: ${s.offerEmphasis}`,
    `Voice: ${s.voiceStyle}`,
  ];
  if (s.variationIntent) {
    lines.push(`Variation Intent: ${s.variationIntent.replace(/_/g, " ")}`);
  }

  return { key: "strategy", heading: "Creative Strategy", content: lines.join("\n") };
}

function buildConstraintsSection(ctx: PromptGenerationContext): PromptSection {
  const v = ctx.voiceProfile;
  const lines: string[] = [];

  lines.push(`Tone: ${v.toneKeywords.join(", ")}`);
  lines.push(`Formality: ${v.formality}`);
  lines.push(`Perspective: ${v.perspective.replace(/_/g, " ")}`);
  lines.push(`Vocabulary: ${v.vocabulary}`);

  if (v.avoidWords.length > 0) lines.push(`Never use these words: ${v.avoidWords.join(", ")}`);
  if (v.avoidTopics.length > 0) lines.push(`Never reference: ${v.avoidTopics.join(", ")}`);

  // Platform constraints for Facebook static ads
  lines.push("\nFacebook Ad Format:");
  lines.push("- Primary text: max 125 chars visible (truncated after)");
  lines.push("- Headline: max 40 chars");
  lines.push("- Description: max 30 chars");

  return { key: "constraints", heading: "Constraints & Voice Rules", content: lines.join("\n") };
}

function buildSourceAdSection(ctx: PromptGenerationContext): PromptSection | null {
  if (!ctx.sourceAdContext) return null;
  return {
    key:     "source_ad",
    heading: "Source Ad Reference",
    content: ctx.sourceAdContext,
  };
}

function buildPerformanceSection(ctx: PromptGenerationContext): PromptSection | null {
  if (ctx.performanceHints.length === 0) return null;
  return {
    key:     "performance",
    heading: "Performance Signals",
    content: ctx.performanceHints.join("\n"),
  };
}

// ---------------------------------------------------------------------------
// Copy prompt builder
// ---------------------------------------------------------------------------

export function buildCopyPrompt(ctx: PromptGenerationContext, count: number = 3): string {
  const sections: string[] = [];

  sections.push("You are a world-class direct-response copywriter creating Facebook ad copy.");
  sections.push(`Generate ${count} copy variation(s) for a static Facebook ad.\n`);

  const brandSection = buildBrandSection(ctx);
  sections.push(`## ${brandSection.heading}\n${brandSection.content}\n`);

  const offerSection = buildOfferSection(ctx);
  sections.push(`## ${offerSection.heading}\n${offerSection.content}\n`);

  const audienceSection = buildAudienceSection(ctx);
  sections.push(`## ${audienceSection.heading}\n${audienceSection.content}\n`);

  const strategySection = buildStrategySection(ctx);
  sections.push(`## ${strategySection.heading}\n${strategySection.content}\n`);

  const constraintsSection = buildConstraintsSection(ctx);
  sections.push(`## ${constraintsSection.heading}\n${constraintsSection.content}\n`);

  const sourceAd = buildSourceAdSection(ctx);
  if (sourceAd) sections.push(`## ${sourceAd.heading}\n${sourceAd.content}\n`);

  const perf = buildPerformanceSection(ctx);
  if (perf) sections.push(`## ${perf.heading}\n${perf.content}\n`);

  sections.push(`## Output Format
Return a JSON array of ${count} objects, each with:
{
  "title": "Variation label",
  "hook": "The scroll-stopping opening line (max 125 chars)",
  "body": "The supporting body copy (2-3 sentences)",
  "callToAction": "CTA text (2-5 words)"
}

Rules:
- Each variation must use the specified hook strategy and angle
- Each variation should take a different creative approach within the strategy
- Write for Facebook static ads — concise, punchy, scroll-stopping
- CRM revenue is the real metric — write copy that drives purchases, not just clicks
- Return ONLY the JSON array, no markdown fences`);

  return sections.join("\n");
}

// ---------------------------------------------------------------------------
// Image prompt builder
// ---------------------------------------------------------------------------

export function buildImagePrompt(ctx: PromptGenerationContext, count: number = 3): string {
  const sections: string[] = [];

  sections.push("You are a creative director designing static Facebook ad images.");
  sections.push(`Generate ${count} image concept brief(s).\n`);

  const brandSection = buildBrandSection(ctx);
  sections.push(`## ${brandSection.heading}\n${brandSection.content}\n`);

  sections.push(`## Visual Direction\n${ctx.strategy.visualDirection}\n`);

  const strategySection = buildStrategySection(ctx);
  sections.push(`## ${strategySection.heading}\n${strategySection.content}\n`);

  if (ctx.voiceProfile.avoidTopics.length > 0) {
    sections.push(`## Visual Restrictions\nDo not include: ${ctx.voiceProfile.avoidTopics.join(", ")}\n`);
  }

  const sourceAd = buildSourceAdSection(ctx);
  if (sourceAd) sections.push(`## ${sourceAd.heading}\n${sourceAd.content}\n`);

  sections.push(`## Output Format
Return a JSON array of ${count} objects, each with:
{
  "title": "Concept name",
  "description": "Visual concept description (2-3 sentences)",
  "textOverlay": "Primary text that appears on the image (if any)",
  "layoutNotes": "Layout and composition guidance",
  "colorPalette": "Suggested colors"
}

Rules:
- Each concept should be a distinct visual approach within the strategy
- Designed for 1:1 or 4:5 Facebook ad placement
- Product must be visible or referenced in the concept
- Text overlays should be minimal and readable at small sizes
- Return ONLY the JSON array, no markdown fences`);

  return sections.join("\n");
}

// ---------------------------------------------------------------------------
// Build prompt generation context from brand memory
// ---------------------------------------------------------------------------

export function buildPromptGenerationContext(
  memory: BrandMemoryData,
  strategy: CreativeStrategyFrame,
  sourceAdContext?: string | null,
  performanceHints?: string[],
): PromptGenerationContext {
  return {
    brandProfile:     memory.brandProfile,
    offerSummary:     memory.offerSummary,
    voiceProfile:     memory.voiceProfile,
    audience:         memory.audience,
    landingPage:      memory.landingPageData,
    strategy,
    sourceAdContext:  sourceAdContext ?? null,
    performanceHints: performanceHints ?? [],
  };
}

// ---------------------------------------------------------------------------
// Full prompt generation result (copy + image)
// ---------------------------------------------------------------------------

export function generatePromptResult(
  ctx: PromptGenerationContext,
  mode: "copy" | "image" | "both",
  count: number = 3,
): PromptGenerationResult {
  const sections: PromptSection[] = [
    buildBrandSection(ctx),
    buildOfferSection(ctx),
    buildAudienceSection(ctx),
    buildStrategySection(ctx),
    buildConstraintsSection(ctx),
  ];

  const sourceAd = buildSourceAdSection(ctx);
  if (sourceAd) sections.push(sourceAd);
  const perf = buildPerformanceSection(ctx);
  if (perf) sections.push(perf);

  return {
    copyPrompt:  mode === "image" ? null : buildCopyPrompt(ctx, count),
    imagePrompt: mode === "copy" ? null : buildImagePrompt(ctx, count),
    sections,
    metadata: {
      hookType:    ctx.strategy.hookType,
      angleType:   ctx.strategy.angleType,
      intent:      ctx.strategy.variationIntent,
      generatedAt: new Date().toISOString(),
    },
  };
}

// ---------------------------------------------------------------------------
// Build variation prompt set — multiple strategy frames, each producing prompts
// ---------------------------------------------------------------------------

export function buildVariationPromptSet(
  memory: BrandMemoryData,
  strategies: CreativeStrategyFrame[],
  mode: "copy" | "image" | "both",
): PromptGenerationResult[] {
  return strategies.map((strategy) => {
    const ctx = buildPromptGenerationContext(memory, strategy);
    return generatePromptResult(ctx, mode, 3);
  });
}
