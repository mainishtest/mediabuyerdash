// lib/imageVariation/prompts.ts
// Prompt construction for image variation generation.
// Pure functions — no side effects, no API calls, no DB imports.
//
// Each variation intent maps to a specific visual direction in the prompt.
// The prompt always requests structured JSON output (image concept briefs).

import type {
  ImageVariationContext,
  ImageVariationIntent,
  ImageVariationPrompt,
} from "./types";
import { IMAGE_VARIATION_INTENTS } from "./types";
import { buildImageContextSummary } from "./context";

// ---------------------------------------------------------------------------
// System prompt — image variation specialist persona
// ---------------------------------------------------------------------------

const IMAGE_VARIATION_SYSTEM_PROMPT = `You are a senior visual creative strategist specializing in direct-response Meta advertising (Facebook and Instagram feeds, stories, and reels).

Your role is to generate structured image variation briefs that a designer or image generation tool can execute. Each brief must be grounded in real performance data, audience fatigue signals, and creative context.

Rules you always follow:
- Every image concept must be tied to a specific performance signal or strategic reason
- ROAS and CPA figures are always CRM-verified (7-day attribution) — never Meta self-reported
- Image concepts must work on mobile-first feeds — visual clarity in under 0.3 seconds
- Each variation must be visually distinct — no two concepts should share the same composition approach
- Respond ONLY with valid JSON — no preamble, no commentary, no markdown fences
- If you cannot generate a variation, return an empty array rather than invalid JSON`;

// ---------------------------------------------------------------------------
// Intent-specific direction blocks
// ---------------------------------------------------------------------------

const INTENT_DIRECTIONS: Record<ImageVariationIntent, string> = {
  refresh_visual_hook: `VISUAL DIRECTION: The image's scroll-stop power has decayed. Generate variations that:
- Use a completely different visual entry point to catch the eye
- Change the dominant visual element or its treatment
- Test a new contrast, scale, or composition approach
- Each variation must stop the scroll in a different way`,

  refresh_offer_framing: `VISUAL DIRECTION: The offer needs to be framed differently. Generate variations that:
- Change how the value proposition is visually communicated
- Reposition text overlays, callouts, or benefit highlighting
- Try different visual metaphors for the same offer
- The offer itself stays the same — only the visual framing changes`,

  refresh_composition: `VISUAL DIRECTION: The image layout needs restructuring. Generate variations that:
- Change the visual hierarchy (what the eye sees first, second, third)
- Try different aspect ratios or crop approaches for the key elements
- Reorganize the relationship between subject, text, and whitespace
- Each variation must create a different eye-path through the image`,

  refresh_color_direction: `VISUAL DIRECTION: The color palette needs a shift. Generate variations that:
- Test a distinctly different color scheme or mood
- Consider contrast against the Meta feed (dark/light backgrounds)
- Use color to create visual hierarchy and guide attention
- Ensure accessibility — maintain sufficient contrast ratios`,

  refresh_product_focus: `VISUAL DIRECTION: The product presentation needs a new angle. Generate variations that:
- Show the product from a different perspective or in a different context
- Change the scale, setting, or usage scenario
- Test product-in-use vs. product-alone vs. product-with-result approaches
- Each variation must highlight a different product benefit or attribute`,

  refresh_lifestyle_angle: `VISUAL DIRECTION: The lifestyle context needs refreshing. Generate variations that:
- Place the product/service in a different aspirational scenario
- Change the demographic, setting, or emotional tone
- Test different "day in the life" or situational framings
- Each variation must tell a different visual story`,

  refresh_ugc_style: `VISUAL DIRECTION: Move toward an authentic, user-generated content aesthetic. Generate variations that:
- Use a more casual, authentic, less polished visual approach
- Consider screenshot-style, selfie-style, or behind-the-scenes framing
- Test "real person" vs. "editorial" visual language
- Each variation should feel like content, not advertising`,

  full_visual_reset: `VISUAL DIRECTION: This is a complete visual overhaul. Generate variations that:
- Start from scratch — do not reference the current image direction
- Test fundamentally different visual approaches (clean vs. busy, warm vs. cool, product vs. lifestyle)
- Each variation should represent a different creative hypothesis about what will engage this audience
- Consider what would work for someone seeing this brand for the first time on a crowded feed`,
};

// ---------------------------------------------------------------------------
// Main: buildImageVariationPrompt
// ---------------------------------------------------------------------------

export function buildImageVariationPrompt(
  ctx:            ImageVariationContext,
  candidateCount: number,
): ImageVariationPrompt {
  const intentInfo  = IMAGE_VARIATION_INTENTS[ctx.intent];
  const contextBlock = buildImageContextSummary(ctx);
  const direction    = INTENT_DIRECTIONS[ctx.intent];

  const exampleCandidate = JSON.stringify({
    title:               "Concept A — [Descriptive Name]",
    conceptSummary:      "2-3 sentences describing the image concept in enough detail for execution",
    visualChanges:       "1-2 sentences: what specifically changes from the current creative",
    goal:                "1 sentence: scroll-stop / build trust / drive click / communicate value",
    directResponseAngle: "1 sentence: how this image supports the offer and message",
  }, null, 2);

  const user = [
    contextBlock,
    "",
    `VARIATION INTENT: ${intentInfo.label}`,
    intentInfo.description,
    "",
    direction,
    "",
    `Generate exactly ${candidateCount} image variation concept briefs.`,
    "",
    "Requirements for EACH concept:",
    "- title: Short descriptive name (e.g. 'Concept A — Clean Hero Shot')",
    "- conceptSummary: 2–3 sentences describing the image in enough detail for a designer to execute it",
    "- visualChanges: 1–2 sentences describing what specifically changes from the current creative",
    "- goal: 1 sentence — what this image is designed to do (scroll-stop / build trust / drive click)",
    "- directResponseAngle: 1 sentence — how the image supports the offer and message",
    "",
    "Each concept MUST be visually distinct from the others.",
    "Each concept MUST reference the performance context in its approach.",
    "",
    `Respond ONLY with a JSON array of ${candidateCount} objects matching this shape:`,
    exampleCandidate,
  ].join("\n");

  // Simple deterministic hash for dedup
  const contextHash = simpleHash(
    `${ctx.clientAccountId}:${ctx.creativeId}:${ctx.intent}:${ctx.triggerType}:${ctx.builtAt}`,
  );

  return {
    system:      IMAGE_VARIATION_SYSTEM_PROMPT,
    user,
    intent:      ctx.intent,
    constraints: ctx.constraints,
    contextHash,
  };
}

// ---------------------------------------------------------------------------
// Hash helper
// ---------------------------------------------------------------------------

function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
