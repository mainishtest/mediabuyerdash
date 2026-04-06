// ─────────────────────────────────────────────────────────────────────────────
// Image Variation Generator
// ─────────────────────────────────────────────────────────────────────────────
// Generates image variation concepts by calling Anthropic/OpenAI directly.
// Eliminates the self-fetch pattern that fails on Vercel serverless.
// Rendering individual concepts still uses the /api route (client-side call).
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "../../lib/db";
import type {
  VariationSourceContext,
  ImageVariationCandidate,
  CreativeVariationError,
} from "../../types/variationGeneration";

interface ImageGenerationResult {
  ok: boolean;
  variations: ImageVariationCandidate[];
  provider: string;
  error?: CreativeVariationError;
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function generateImageVariationsFromSource(
  ctx: VariationSourceContext,
  options: {
    provider?: "anthropic" | "openai";
    variationCount?: number;
    notes?: string;
    baseUrl?: string;
  } = {}
): Promise<ImageGenerationResult> {
  const {
    provider = "anthropic",
    variationCount = 3,
    notes,
  } = options;

  const { source } = ctx;

  if (!source.imageUrl) {
    return {
      ok: false,
      variations: [],
      provider,
      error: {
        code: "missing_source_image",
        message: "No source image provided. Upload an image or select an ad with an image.",
        retryable: false,
      },
    };
  }

  try {
    const imageDescription = buildImageDescription(ctx, notes);

    // Load client brand context and image directions
    let brandContext = "";
    let imageDirections = "";
    if (source.clientAccountId) {
      const client = await prisma.clientAccount.findUnique({
        where: { id: source.clientAccountId },
        select: { copywritingPrompt: true, imagePromptDirections: true, brandName: true },
      });
      if (client?.copywritingPrompt) {
        brandContext = `\nBRAND CONTEXT:\n${client.copywritingPrompt}`;
      }
      if (client?.imagePromptDirections) {
        imageDirections = `\nCLIENT IMAGE DIRECTIONS (follow these strictly):\n${client.imagePromptDirections}`;
      }
    }

    const systemPrompt = `You are a senior direct-response creative director specializing in Meta (Facebook/Instagram) ad imagery.
You design high-converting static image ads that stop the scroll and drive clicks.
You understand that the image is the #1 factor in ad performance — it must earn attention in under 0.5 seconds.
${brandContext}${imageDirections}
Respond ONLY with valid JSON — no preamble, no markdown fences, no commentary.`;

    const adCopy = [source.hook, source.bodyText].filter(Boolean).join(" — ");

    const userPrompt = `${source.clientName ? `CLIENT: ${source.clientName}` : ""}
${source.clientName ? `PRODUCT: ${source.clientName}` : ""}

CURRENT AD IMAGE:
${imageDescription || "No description provided — generate concepts based on the product/brand context."}

${adCopy ? `AD COPY (for context — the image should complement this message):\n${adCopy}\n` : ""}
${notes ? `CREATIVE DIRECTOR NOTES:\n${notes}\n` : ""}

Generate exactly 3 high-converting image variation concepts for a Facebook/Instagram feed ad.
Each concept should take a DIFFERENT visual approach:

1. "clean_hero" — Single product hero shot with maximum clarity. Clean background, strong lighting, product dominates the frame.

2. "lifestyle_proof" — Product in a real-life context showing the result/transformation. Human element, natural setting, emotional connection.

3. "pattern_interrupt" — Bold, unexpected visual that breaks the scroll pattern. Striking contrast, unusual composition, or provocative visual hook.

For EACH concept provide:
- title: Short name (e.g. "Clean Hero — Bottle Close-Up")
- concept: 2-3 sentences describing exactly what the image shows.
- whyItWorks: 1 sentence — the direct-response psychology behind this visual approach.
- textOverlay: Suggested text overlay on the image (5-7 words max or "none").
- colorDirection: Primary color palette direction.

Respond ONLY with this JSON array:
[
  {"title": "...", "concept": "...", "whyItWorks": "...", "textOverlay": "...", "colorDirection": "..."},
  {"title": "...", "concept": "...", "whyItWorks": "...", "textOverlay": "...", "colorDirection": "..."},
  {"title": "...", "concept": "...", "whyItWorks": "...", "textOverlay": "...", "colorDirection": "..."}
]`;

    // Call AI provider directly
    const result = await callAiProvider(provider, systemPrompt, userPrompt);

    if (!result.ok) {
      return {
        ok: false,
        variations: [],
        provider,
        error: {
          code: "provider_failure",
          message: result.error || "Image concept generation failed",
          retryable: true,
        },
      };
    }

    const variations: ImageVariationCandidate[] = result.concepts
      .slice(0, variationCount)
      .map((c, i) => ({
        title: String(c.title || `Concept ${i + 1}`),
        conceptSummary: String(c.concept || ""),
        visualChanges: String(c.whyItWorks || ""),
        goal: "variation",
        textOverlay: String(c.textOverlay || ""),
        colorDirection: String(c.colorDirection || ""),
        rendered: false,
      }));

    return {
      ok: true,
      variations,
      provider: result.provider || provider,
    };
  } catch (err) {
    return {
      ok: false,
      variations: [],
      provider,
      error: {
        code: "provider_failure",
        message: err instanceof Error ? err.message : "Image concept generation failed",
        retryable: true,
      },
    };
  }
}

// ── AI Provider calls ─────────────────────────────────────────────────────

async function callAiProvider(
  provider: string,
  systemPrompt: string,
  userPrompt: string
): Promise<{
  ok: boolean;
  concepts: Array<Record<string, unknown>>;
  provider?: string;
  error?: string;
}> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (provider === "anthropic" && anthropicKey) {
    return callAnthropic(anthropicKey, systemPrompt, userPrompt);
  }
  if (provider === "openai" && openaiKey) {
    return callOpenAI(openaiKey, systemPrompt, userPrompt);
  }
  if (anthropicKey) return callAnthropic(anthropicKey, systemPrompt, userPrompt);
  if (openaiKey) return callOpenAI(openaiKey, systemPrompt, userPrompt);

  return { ok: false, concepts: [], error: "No AI provider configured." };
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function callAnthropic(apiKey: string, system: string, user: string) {
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });

    if (res.status === 429 && attempt < MAX_RETRIES) {
      const delay = 2000 * Math.pow(2, attempt);
      console.warn(`[image-gen] Anthropic 429, retry ${attempt + 1}/${MAX_RETRIES} in ${delay / 1000}s`);
      await sleep(delay);
      continue;
    }

    const data = await res.json();
    if (!res.ok) {
      const errMsg = data?.error?.message ?? `HTTP ${res.status}`;
      console.error(`[image-gen] Anthropic error ${res.status}:`, JSON.stringify(data?.error ?? data).slice(0, 500));
      if (res.status === 429) {
        return { ok: false, concepts: [], error: "Rate limited. Wait a moment and try again." };
      }
      return { ok: false, concepts: [], error: errMsg };
    }

    const text = data?.content?.[0]?.text ?? "";
    const concepts = parseJsonArray(text);
    return {
      ok: concepts.length > 0,
      concepts,
      provider: "anthropic",
      error: concepts.length === 0 ? "AI returned invalid format" : undefined,
    };
  }
  return { ok: false, concepts: [], error: "Rate limited after retries. Wait a moment and try again." };
}

async function callOpenAI(apiKey: string, system: string, user: string) {
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o",
        max_tokens: 4096,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (res.status === 429 && attempt < MAX_RETRIES) {
      const delay = 2000 * Math.pow(2, attempt);
      console.warn(`[image-gen] OpenAI 429, retry ${attempt + 1}/${MAX_RETRIES} in ${delay / 1000}s`);
      await sleep(delay);
      continue;
    }

    const data = await res.json();
    if (!res.ok) {
      const errMsg = data?.error?.message ?? `OpenAI HTTP ${res.status}`;
      console.error(`[image-gen] OpenAI error ${res.status}:`, JSON.stringify(data?.error ?? data).slice(0, 500));
      if (res.status === 429) {
        return { ok: false, concepts: [], error: "Rate limited. Wait a moment and try again." };
      }
      return { ok: false, concepts: [], error: errMsg };
    }

    const text = data?.choices?.[0]?.message?.content ?? "";
    const concepts = parseJsonArray(text);
    return {
      ok: concepts.length > 0,
      concepts,
      provider: "openai",
      error: concepts.length === 0 ? "AI returned invalid format" : undefined,
    };
  }
  return { ok: false, concepts: [], error: "Rate limited after retries. Wait a moment and try again." };
}

// ── Parse helpers ─────────────────────────────────────────────────────────

function parseJsonArray(text: string): Array<Record<string, unknown>> {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed as Record<string, unknown>[];
  } catch { /* continue */ }

  const arrStart = cleaned.indexOf("[");
  const arrEnd = cleaned.lastIndexOf("]");
  if (arrStart >= 0 && arrEnd > arrStart) {
    try {
      const extracted = JSON.parse(cleaned.slice(arrStart, arrEnd + 1));
      if (Array.isArray(extracted)) return extracted as Record<string, unknown>[];
    } catch { /* give up */ }
  }

  return [];
}

// ── Context enrichment ──────────────────────────────────────────────────────

function buildImageDescription(
  ctx: VariationSourceContext,
  userNotes?: string
): string {
  const parts: string[] = [];

  if (ctx.source.imageUrl) {
    parts.push(`Source image URL: ${ctx.source.imageUrl}`);
  }
  if (ctx.source.imageHeadline) {
    parts.push(`Image headline: ${ctx.source.imageHeadline}`);
  }

  if (ctx.performance) {
    const perf = ctx.performance;
    if (perf.fatigueStatus && perf.fatigueStatus !== "healthy") {
      parts.push(`Creative is showing fatigue (frequency: ${perf.frequency?.toFixed(1)}x). Needs fresh visual approach.`);
    }
  }

  if (ctx.clientImageDirections) {
    parts.push(`Client image directions: ${ctx.clientImageDirections}`);
  }

  if (userNotes) parts.push(userNotes);

  return parts.join("\n");
}
