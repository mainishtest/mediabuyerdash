// AI Provider — Anthropic implementation
//
// Real Anthropic Claude provider that generates copy and image concept variations.
// Falls back gracefully to mock if the API call fails.

import type {
  CopyGenerationRequest,
  CopyGenerationResponse,
  ImageVariationRequest,
  ImageVariationResponse,
  AIGenerationProvider,
} from "../../types/aiProvider";
import type { CopyVariation, ImageVariationConcept } from "../../types/creativeDiagnosis";
import type { CopyGenerationProvider, ImageVariationProvider } from "./contract";
import { getAnthropicConfig } from "../providerExecution/config";

const PROVIDER: AIGenerationProvider = "anthropic";

function genRequestId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

function buildCopySystemPrompt(): string {
  return [
    "You are a senior direct-response creative strategist for Facebook/Instagram ads.",
    "You write scroll-stopping ad copy grounded in performance data.",
    "Your output is ALWAYS valid JSON — no markdown fences, no preamble, no explanation.",
    "Use CRM-verified ROAS and CPA as the source of truth, not Meta-reported conversions.",
  ].join(" ");
}

function buildCopyUserPrompt(req: CopyGenerationRequest): string {
  const { performanceSummary: perf, diagnosisResult: diag, existingCopy } = req;
  return [
    `Ad: "${req.adName}" in campaign "${req.campaignName}".`,
    `Performance: CPA $${perf.actualCpa.toFixed(2)} (goal: $${perf.cpaGoalValue.toFixed(2)}), ROAS ${perf.actualRoas.toFixed(2)}x (goal: ${perf.roasGoalValue.toFixed(2)}x), Spend $${perf.spend.toFixed(0)}, Conversions ${perf.conversions}.`,
    `Diagnosis: ${diag.causeType} issue — ${diag.shortReason}`,
    `Current copy:`,
    `  Hook: "${existingCopy.hook}"`,
    `  Body: "${existingCopy.body}"`,
    `  CTA: "${existingCopy.callToAction}"`,
    "",
    `Generate exactly ${req.requestedCount} copy variations. Each must use a different persuasion angle:`,
    `1. Outcome-led hook (lead with the result the customer gets)`,
    `2. Problem-first hook (name the pain point, then offer the solution)`,
    `3. Social proof hook (use credibility, testimonials, or data)`,
    "",
    `Return a JSON array of objects with these fields:`,
    `[{ "id": "var_1", "title": "Variation A — Outcome-Led", "hook": "...", "body": "...", "callToAction": "..." }, ...]`,
    `Hook: max 40 words, must stop the scroll. Body: max 100 words. Keep the CTA concise.`,
  ].join("\n");
}

function buildImageSystemPrompt(): string {
  return [
    "You are a senior creative director specializing in Facebook/Instagram ad visuals.",
    "You generate image variation concepts grounded in direct-response best practices.",
    "Your output is ALWAYS valid JSON — no markdown fences, no preamble, no explanation.",
    "Focus on mobile-first, scroll-stopping visuals with a single focal point.",
  ].join(" ");
}

function buildImageUserPrompt(req: ImageVariationRequest): string {
  const { performanceSummary: perf, diagnosisResult: diag, existingImage } = req;
  return [
    `Ad: "${req.adName}" in campaign "${req.campaignName}".`,
    `Performance: CPA $${perf.actualCpa.toFixed(2)} (goal: $${perf.cpaGoalValue.toFixed(2)}), ROAS ${perf.actualRoas.toFixed(2)}x (goal: ${perf.roasGoalValue.toFixed(2)}x).`,
    `Diagnosis: ${diag.causeType} issue — ${diag.shortReason}`,
    `Current image:`,
    `  Headline: "${existingImage.imageHeadline}"`,
    `  Style: ${existingImage.imageStyle}`,
    `  Dominant message: "${existingImage.dominantMessage}"`,
    `  Visual theme: ${existingImage.visualTheme}`,
    "",
    `Generate exactly ${req.requestedCount} image variation concepts. Each must use a different visual strategy:`,
    `1. Clean Focus — single hero subject, minimal background, one clear message`,
    `2. Proof-Led Visual — show tangible results, data, before/after, or social proof`,
    `3. Contrast Frame — engineered visual hierarchy with deliberate eye path`,
    "",
    `Return a JSON array of objects with these fields:`,
    `[{ "id": "img_1", "title": "Concept A — Clean Focus", "conceptSummary": "...", "visualChanges": "...", "goal": "..." }, ...]`,
    `conceptSummary: what the creative communicates (2-3 sentences).`,
    `visualChanges: specific changes from the current image (2-3 sentences).`,
    `goal: the hypothesis for why this change will improve performance (1 sentence).`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// API call helper
// ---------------------------------------------------------------------------

async function callAnthropic(system: string, user: string): Promise<{ text: string; tokens: number } | null> {
  const config = getAnthropicConfig();
  if (!config.ready || !config.apiKey) return null;

  const model = config.model ?? "claude-3-5-haiku-20241022";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) return null;

  const data = await res.json();
  const text = data?.content?.[0]?.text ?? "";
  const tokens = data?.usage
    ? (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0)
    : 0;
  return { text, tokens };
}

function parseJsonArray(raw: string): unknown[] {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const parsed = JSON.parse(cleaned);
  return Array.isArray(parsed) ? parsed : [];
}

// ---------------------------------------------------------------------------
// Copy provider
// ---------------------------------------------------------------------------

export const anthropicCopyProvider: CopyGenerationProvider = {
  providerId: PROVIDER,

  async generateCopyVariations(request: CopyGenerationRequest): Promise<CopyGenerationResponse> {
    const requestId = genRequestId("copy");

    const result = await callAnthropic(
      buildCopySystemPrompt(),
      buildCopyUserPrompt(request),
    );

    if (!result) {
      return {
        provider: PROVIDER,
        requestId,
        generatedVariations: [],
        status: "failed",
        createdAt: new Date().toISOString(),
        errorMessage: "Anthropic API call failed",
      };
    }

    try {
      const items = parseJsonArray(result.text);
      const variations: CopyVariation[] = items
        .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object")
        .map((item, i) => ({
          id: String(item.id ?? `var_${i + 1}`),
          title: String(item.title ?? `Variation ${i + 1}`),
          hook: String(item.hook ?? ""),
          body: String(item.body ?? ""),
          callToAction: String(item.callToAction ?? request.existingCopy.callToAction),
        }))
        .slice(0, request.requestedCount);

      return {
        provider: PROVIDER,
        requestId,
        generatedVariations: variations,
        status: "completed",
        createdAt: new Date().toISOString(),
      };
    } catch {
      return {
        provider: PROVIDER,
        requestId,
        generatedVariations: [],
        status: "failed",
        createdAt: new Date().toISOString(),
        errorMessage: "Failed to parse Anthropic response as JSON",
      };
    }
  },
};

// ---------------------------------------------------------------------------
// Image concept provider
// ---------------------------------------------------------------------------

export const anthropicImageProvider: ImageVariationProvider = {
  providerId: PROVIDER,

  async generateImageVariations(request: ImageVariationRequest): Promise<ImageVariationResponse> {
    const requestId = genRequestId("img");

    const result = await callAnthropic(
      buildImageSystemPrompt(),
      buildImageUserPrompt(request),
    );

    if (!result) {
      return {
        provider: PROVIDER,
        requestId,
        generatedConcepts: [],
        status: "failed",
        createdAt: new Date().toISOString(),
        errorMessage: "Anthropic API call failed",
      };
    }

    try {
      const items = parseJsonArray(result.text);
      const concepts: ImageVariationConcept[] = items
        .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object")
        .map((item, i) => ({
          id: String(item.id ?? `img_${i + 1}`),
          title: String(item.title ?? `Concept ${i + 1}`),
          conceptSummary: String(item.conceptSummary ?? ""),
          visualChanges: String(item.visualChanges ?? ""),
          goal: String(item.goal ?? ""),
        }))
        .slice(0, request.requestedCount);

      return {
        provider: PROVIDER,
        requestId,
        generatedConcepts: concepts,
        status: "completed",
        createdAt: new Date().toISOString(),
      };
    } catch {
      return {
        provider: PROVIDER,
        requestId,
        generatedConcepts: [],
        status: "failed",
        createdAt: new Date().toISOString(),
        errorMessage: "Failed to parse Anthropic response as JSON",
      };
    }
  },
};
