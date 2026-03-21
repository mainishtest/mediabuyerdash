// lib/imageVariation/providers.ts
// Provider abstraction for image variation generation.
//
// Architecture:
//   - ImageVariationProvider interface defines the contract.
//   - BriefOnlyProvider always works — generates structured briefs.
//   - DalleProvider (stub) generates images when OPENAI_API_KEY is set.
//   - resolveImageVariationProvider() returns the best available provider.
//   - Mock provider returns deterministic output for testing.
//
// Adding a new provider:
//   1. Implement ImageVariationProvider interface
//   2. Add to resolveImageVariationProvider() priority list
//   3. Add config check to lib/providerExecution/config.ts if needed

import type {
  ImageVariationContext,
  ImageVariationCandidate,
  ImageVariationProviderType,
  ImageVariationProviderResult,
  ImageVariationPrompt,
} from "./types";
import { IMAGE_VARIATION_INTENTS } from "./types";
import { getAnthropicConfig, getOpenAIConfig } from "../providerExecution/config";

// ---------------------------------------------------------------------------
// Provider interface
// ---------------------------------------------------------------------------

export interface ImageVariationProvider {
  name:         ImageVariationProviderType;
  isAvailable(): boolean;
  generateVariations(
    ctx:            ImageVariationContext,
    prompt:         ImageVariationPrompt,
    candidateCount: number,
  ): Promise<ImageVariationProviderResult>;
}

// ---------------------------------------------------------------------------
// Brief-Only Provider — generates structured briefs via Anthropic (or mock)
// Always available — the fallback provider.
// ---------------------------------------------------------------------------

export class BriefOnlyProvider implements ImageVariationProvider {
  name: ImageVariationProviderType = "brief_only";

  isAvailable(): boolean {
    return true; // always available — falls back to mock if Anthropic isn't configured
  }

  async generateVariations(
    ctx:            ImageVariationContext,
    prompt:         ImageVariationPrompt,
    candidateCount: number,
  ): Promise<ImageVariationProviderResult> {
    const startedAt = Date.now();
    const config = getAnthropicConfig();

    // If Anthropic is configured, use it to generate briefs
    if (config.ready) {
      return this.generateWithAnthropic(ctx, prompt, candidateCount, config, startedAt);
    }

    // Otherwise, return structured mock output
    return this.generateMock(ctx, candidateCount, startedAt);
  }

  private async generateWithAnthropic(
    ctx:            ImageVariationContext,
    prompt:         ImageVariationPrompt,
    candidateCount: number,
    config:         { apiKey?: string; model?: string },
    startedAt:      number,
  ): Promise<ImageVariationProviderResult> {
    const model = config.model ?? "claude-3-5-haiku-20241022";

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:  "POST",
        headers: {
          "Content-Type":      "application/json",
          "x-api-key":         config.apiKey!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 2000,
          system:   prompt.system,
          messages: [{ role: "user", content: prompt.user }],
        }),
      });

      const latencyMs = Date.now() - startedAt;

      if (res.status === 429) {
        return { ok: false, error: "Rate limit reached. Try again shortly.", retryable: true };
      }

      const data = await res.json();

      if (!res.ok) {
        const msg = data?.error?.message ?? `HTTP ${res.status}`;
        return { ok: false, error: msg, retryable: res.status >= 500 };
      }

      const rawContent: string = data?.content?.[0]?.text ?? "";
      const tokensUsed = data?.usage
        ? (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0)
        : null;

      const candidates = parseAIResponse(rawContent, ctx, candidateCount);

      if (candidates.length === 0) {
        // Parse failed — fall back to mock
        const mockCandidates = buildMockCandidates(ctx, candidateCount);
        return {
          ok: true,
          candidates: mockCandidates,
          provider: "brief_only",
          tokensUsed,
          latencyMs,
        };
      }

      return {
        ok: true,
        candidates,
        provider: "brief_only",
        tokensUsed,
        latencyMs,
      };
    } catch (err) {
      // Network error — fall back to mock
      const mockCandidates = buildMockCandidates(ctx, candidateCount);
      return {
        ok: true,
        candidates: mockCandidates,
        provider: "brief_only",
        tokensUsed: null,
        latencyMs: Date.now() - startedAt,
      };
    }
  }

  private generateMock(
    ctx:            ImageVariationContext,
    candidateCount: number,
    startedAt:      number,
  ): Promise<ImageVariationProviderResult> {
    const candidates = buildMockCandidates(ctx, candidateCount);
    return Promise.resolve({
      ok:         true as const,
      candidates,
      provider:   "brief_only" as const,
      tokensUsed: null,
      latencyMs:  Date.now() - startedAt,
    });
  }
}

// ---------------------------------------------------------------------------
// DALL-E Provider — stub for future OpenAI DALL-E integration
// ---------------------------------------------------------------------------

export class DalleProvider implements ImageVariationProvider {
  name: ImageVariationProviderType = "dalle";

  isAvailable(): boolean {
    return getOpenAIConfig().ready;
  }

  async generateVariations(
    ctx:            ImageVariationContext,
    prompt:         ImageVariationPrompt,
    candidateCount: number,
  ): Promise<ImageVariationProviderResult> {
    // Stub — DALL-E integration not yet wired
    // When implemented:
    //   1. Call DALL-E 3 API with prompt.user as the generation prompt
    //   2. Map each response image to an ImageVariationCandidate with imageUrl
    //   3. Include brief fields alongside the generated image
    return {
      ok:      false,
      error:   "DALL-E provider is not yet fully implemented. Use brief_only mode.",
      retryable: false,
    };
  }
}

// ---------------------------------------------------------------------------
// Mock Provider — deterministic output for testing
// ---------------------------------------------------------------------------

export class MockProvider implements ImageVariationProvider {
  name: ImageVariationProviderType = "mock";

  isAvailable(): boolean {
    return true;
  }

  async generateVariations(
    ctx:            ImageVariationContext,
    _prompt:        ImageVariationPrompt,
    candidateCount: number,
  ): Promise<ImageVariationProviderResult> {
    return {
      ok:         true,
      candidates: buildMockCandidates(ctx, candidateCount),
      provider:   "mock",
      tokensUsed: null,
      latencyMs:  0,
    };
  }
}

// ---------------------------------------------------------------------------
// Provider resolution — returns the best available provider
// ---------------------------------------------------------------------------

export function resolveImageVariationProvider(): ImageVariationProvider {
  // Priority: DALL-E > Brief-only (always available)
  const dalle = new DalleProvider();
  if (dalle.isAvailable()) return dalle;

  return new BriefOnlyProvider();
}

// ---------------------------------------------------------------------------
// Parse AI response into candidates
// ---------------------------------------------------------------------------

function parseAIResponse(
  rawContent:     string,
  ctx:            ImageVariationContext,
  candidateCount: number,
): ImageVariationCandidate[] {
  let parsed: unknown;
  try {
    const cleaned = rawContent
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  const intentInfo = IMAGE_VARIATION_INTENTS[ctx.intent];
  const performanceSignal = buildPerformanceSignal(ctx);

  return parsed
    .slice(0, candidateCount)
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object")
    .map((item): ImageVariationCandidate => ({
      id:                   crypto.randomUUID(),
      title:                String(item.title ?? "Image Variation"),
      intent:               ctx.intent,
      conceptSummary:       String(item.conceptSummary ?? ""),
      visualChanges:        String(item.visualChanges ?? ""),
      goal:                 String(item.goal ?? ""),
      directResponseAngle:  String(item.directResponseAngle ?? ""),
      imageUrl:             null,
      providerRequestId:    null,
      sourceCreativeId:     ctx.creativeId,
      sourceAssetUrl:       ctx.sourceAsset.url,
      campaignId:           ctx.campaignId,
      clientAccountId:      ctx.clientAccountId,
      rationale:            `Generated for ${intentInfo.label} intent. ${performanceSignal}`,
      performanceSignal,
      status:               "generated",
    }));
}

// ---------------------------------------------------------------------------
// Mock candidates — structured output matching real shape
// ---------------------------------------------------------------------------

function buildMockCandidates(
  ctx:            ImageVariationContext,
  candidateCount: number,
): ImageVariationCandidate[] {
  const intentInfo = IMAGE_VARIATION_INTENTS[ctx.intent];
  const performanceSignal = buildPerformanceSignal(ctx);

  const templates: Array<{
    title: string;
    conceptSummary: string;
    visualChanges: string;
    goal: string;
    directResponseAngle: string;
  }> = [
    {
      title:               "Concept A — Clean Hero Focus",
      conceptSummary:      "Single hero element against a high-contrast minimal background. One clear subject dominates the frame with no competing visual elements. A single bold benefit statement appears in the lower third.",
      visualChanges:       "Remove background clutter. Increase subject-to-background contrast to at least 4:1. Reduce text to one prominent line.",
      goal:                "Communicate core value proposition in under 0.3 seconds on a mobile feed.",
      directResponseAngle: "Immediate visual clarity — the viewer understands the offer before reading any copy.",
    },
    {
      title:               "Concept B — Proof-Led Visual",
      conceptSummary:      "Show a tangible result: a metric, customer outcome, or before/after comparison. The key number or result is the dominant visual element at 2x the size of surrounding text, anchored with a credibility marker.",
      visualChanges:       "Replace current hero with a result-focused frame. Add a data point or testimonial anchor. Use a proof-first visual hierarchy.",
      goal:                "Build instant trust by showing proof before asking for attention.",
      directResponseAngle: "The image does the persuasion work — copy amplifies what the viewer already believes after seeing the proof.",
    },
    {
      title:               "Concept C — Contrast Frame Composition",
      conceptSummary:      "Engineered eye-path layout: bold foreground subject draws the eye first, a contrasting benefit callout in the upper third catches the second glance, CTA-style text anchors the bottom. Dark background with warm accent color.",
      visualChanges:       "Redesign layout for deliberate eye path: subject → benefit → CTA. Use warm accent (amber or coral) against dark background.",
      goal:                "Guide the viewer's eye through the visual in a specific order that mirrors the copy structure.",
      directResponseAngle: "The image teaches scroll-stopper behavior — look here, then here, then click.",
    },
    {
      title:               "Concept D — UGC-Style Authentic Frame",
      conceptSummary:      "Casual, authentic visual that feels like user-generated content rather than produced advertising. Screenshot-style or selfie-style framing with organic text overlays that mimic social media native content.",
      visualChanges:       "Move from polished to authentic. Use raw or lightly filtered imagery. Replace designed text with handwritten-style or caption-style overlays.",
      goal:                "Break through ad blindness by looking like organic content in the feed.",
      directResponseAngle: "Trust through authenticity — the viewer engages because it does not look like an ad.",
    },
    {
      title:               "Concept E — Split Comparison",
      conceptSummary:      "Side-by-side or before/after split frame showing transformation or comparison. The left side represents the problem state, the right side represents the solution state. A clear divider separates the two halves.",
      visualChanges:       "Replace single-image layout with a split comparison format. Use contrasting color temperatures for each side.",
      goal:                "Communicate transformation and value gap in a single glance.",
      directResponseAngle: "Visual storytelling that compresses the value proposition into one image frame.",
    },
  ];

  return templates.slice(0, candidateCount).map((t): ImageVariationCandidate => ({
    id:                   crypto.randomUUID(),
    title:                t.title,
    intent:               ctx.intent,
    conceptSummary:       t.conceptSummary,
    visualChanges:        t.visualChanges,
    goal:                 t.goal,
    directResponseAngle:  t.directResponseAngle,
    imageUrl:             null,
    providerRequestId:    null,
    sourceCreativeId:     ctx.creativeId,
    sourceAssetUrl:       ctx.sourceAsset.url,
    campaignId:           ctx.campaignId,
    clientAccountId:      ctx.clientAccountId,
    rationale:            `Mock output — AI provider not configured. ${intentInfo.label}: ${intentInfo.description}. ${performanceSignal}`,
    performanceSignal,
    status:               "generated",
  }));
}

// ---------------------------------------------------------------------------
// Performance signal builder
// ---------------------------------------------------------------------------

function buildPerformanceSignal(ctx: ImageVariationContext): string {
  const parts: string[] = [];
  if (ctx.currentCtr < 0.8) parts.push(`CTR ${ctx.currentCtr.toFixed(2)}% — below threshold`);
  if (ctx.currentFrequency != null && ctx.currentFrequency > 3.5) {
    parts.push(`Frequency ${ctx.currentFrequency.toFixed(1)}x — audience fatigued`);
  }
  if (ctx.currentRoas != null) {
    parts.push(`ROAS ${ctx.currentRoas.toFixed(2)}x (CRM, 7-day)`);
  }
  if (parts.length === 0) parts.push(`${ctx.evaluationStatus} evaluation at ${ctx.currentCtr.toFixed(2)}% CTR`);
  return parts.join(". ") + ".";
}
