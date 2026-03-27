// OpenAI Image Variation Provider
//
// Generates image variation concepts (creative briefs) using OpenAI GPT.
// Returns structured ImageVariationConcept[] — text descriptions for designers,
// not actual images.

import type {
  ImageVariationRequest,
  ImageVariationResponse,
  AIGenerationProvider,
} from "../../types/aiProvider";
import type { ImageVariationProvider } from "./contract";
import { getOpenAIConfig } from "../providerExecution/config";

const PROVIDER: AIGenerationProvider = "openai";

const SYSTEM_PROMPT = `You are a senior direct-response creative strategist specializing in Meta advertising (Facebook and Instagram).

Your task is to generate image variation concept briefs — structured descriptions that a designer can execute. You do NOT generate actual images.

Rules:
- Every concept must be grounded in the performance context provided
- Each concept must use a DIFFERENT visual strategy
- Respond ONLY with valid JSON — no preamble, no commentary, no markdown fences
- If you cannot generate a concept, return an empty array`;

function buildUserPrompt(req: ImageVariationRequest): string {
  const lines: string[] = [
    `AD: ${req.adName}`,
    `CAMPAIGN: ${req.campaignName}`,
    "",
    "PERFORMANCE CONTEXT:",
    `- CPA: $${req.performanceSummary.actualCpa.toFixed(2)} (goal: $${req.performanceSummary.cpaGoalValue.toFixed(2)})`,
    `- ROAS: ${req.performanceSummary.actualRoas.toFixed(2)}x (goal: ${req.performanceSummary.roasGoalValue.toFixed(2)}x)`,
    `- Spend: $${Math.round(req.performanceSummary.spend)}`,
    `- Conversions: ${req.performanceSummary.conversions}`,
    "",
    "CURRENT IMAGE:",
    `- Headline: "${req.existingImage.imageHeadline || "none"}"`,
    `- Style: ${req.existingImage.imageStyle || "unknown"}`,
    `- Dominant message: "${req.existingImage.dominantMessage || "none"}"`,
    `- Visual theme: ${req.existingImage.visualTheme || "unknown"}`,
    "",
    `DIAGNOSIS: ${req.diagnosisResult.causeType} issue (confidence: ${req.diagnosisResult.confidence})`,
    "",
    `Generate exactly ${req.requestedCount} image concept briefs. Each must use a different visual strategy:`,
    `1. "Clean Focus" — single subject, minimal text, maximum clarity`,
    `2. "Proof-Led" — shows results, metrics, or social proof visually`,
    `3. "Contrast Frame" — engineered visual hierarchy with bold contrast`,
    "",
    "Respond ONLY with this JSON array:",
    "[",
    `  {"id": "1", "title": "Concept A — Clean Focus", "conceptSummary": "...", "visualChanges": "...", "goal": "..."},`,
    `  {"id": "2", "title": "Concept B — Proof-Led Visual", "conceptSummary": "...", "visualChanges": "...", "goal": "..."},`,
    `  {"id": "3", "title": "Concept C — Contrast Frame", "conceptSummary": "...", "visualChanges": "...", "goal": "..."}`,
    "]",
  ];
  return lines.join("\n");
}

export const openaiImageProvider: ImageVariationProvider = {
  providerId: PROVIDER,

  async generateImageVariations(
    request: ImageVariationRequest,
  ): Promise<ImageVariationResponse> {
    const config = getOpenAIConfig();
    const requestId = `img_openai_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    if (!config.ready || !config.apiKey) {
      return {
        provider: PROVIDER,
        requestId,
        generatedConcepts: [],
        status: "failed",
        createdAt: new Date().toISOString(),
        errorMessage: config.message,
      };
    }

    const model = config.model ?? "gpt-4o-mini";

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildUserPrompt(request) },
          ],
          temperature: 0.7,
          response_format: { type: "json_object" },
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const errMsg =
          (data as Record<string, Record<string, string>>)?.error?.message ??
          `OpenAI API error: HTTP ${res.status}`;
        return {
          provider: PROVIDER,
          requestId,
          generatedConcepts: [],
          status: "failed",
          createdAt: new Date().toISOString(),
          errorMessage: errMsg,
        };
      }

      const data = await res.json();
      const rawContent: string = data?.choices?.[0]?.message?.content ?? "";

      // Parse the JSON response — handle both array and object-with-array
      let concepts: Array<Record<string, string>> = [];
      try {
        const parsed = JSON.parse(rawContent);
        if (Array.isArray(parsed)) {
          concepts = parsed;
        } else if (parsed && typeof parsed === "object") {
          // OpenAI json_object mode wraps in an object; find the array
          const arr = Object.values(parsed).find(Array.isArray);
          if (arr) concepts = arr as Array<Record<string, string>>;
        }
      } catch {
        return {
          provider: PROVIDER,
          requestId,
          generatedConcepts: [],
          status: "failed",
          createdAt: new Date().toISOString(),
          errorMessage: "Failed to parse OpenAI response as JSON",
        };
      }

      const generatedConcepts = concepts
        .filter((c) => c && typeof c === "object" && c.title)
        .map((c, idx) => ({
          id: c.id ?? `openai_img_${idx + 1}`,
          title: String(c.title),
          conceptSummary: String(c.conceptSummary ?? ""),
          visualChanges: String(c.visualChanges ?? ""),
          goal: String(c.goal ?? ""),
        }));

      return {
        provider: PROVIDER,
        requestId,
        generatedConcepts,
        status: "completed",
        createdAt: new Date().toISOString(),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        provider: PROVIDER,
        requestId,
        generatedConcepts: [],
        status: "failed",
        createdAt: new Date().toISOString(),
        errorMessage: `Network error: ${msg}`,
      };
    }
  },
};
