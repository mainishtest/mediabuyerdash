// ─────────────────────────────────────────────────────────────────────────────
// Copy Variation Generator
// ─────────────────────────────────────────────────────────────────────────────
// Generates copy variations by calling Anthropic/OpenAI directly.
// Eliminates the self-fetch pattern that fails on Vercel serverless.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "../../lib/db";
import type {
  VariationSourceContext,
  CopyVariationCandidate,
  CreativeVariationError,
} from "../../types/variationGeneration";

interface CopyGenerationResult {
  ok: boolean;
  variations: CopyVariationCandidate[];
  provider: string;
  tokensUsed?: number;
  error?: CreativeVariationError;
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function generateCopyVariationsFromSource(
  ctx: VariationSourceContext,
  options: {
    provider?: "anthropic" | "openai";
    variationCount?: number;
    notes?: string;
    baseUrl?: string;
  } = {}
): Promise<CopyGenerationResult> {
  const {
    provider = "anthropic",
    variationCount = 3,
    notes,
  } = options;

  const { source } = ctx;

  if (!source.hook && !source.bodyText && !source.callToAction) {
    return {
      ok: false,
      variations: [],
      provider,
      error: {
        code: "missing_source",
        message: "No source copy provided. Upload copy or select an ad with existing copy.",
        retryable: false,
      },
    };
  }

  try {
    // Load client copywriting prompt
    let copywritingPrompt: string | null = null;
    if (source.clientAccountId) {
      const client = await prisma.clientAccount.findUnique({
        where: { id: source.clientAccountId },
        select: { copywritingPrompt: true },
      });
      copywritingPrompt = client?.copywritingPrompt ?? null;
    }

    const enrichedNotes = buildEnrichedNotes(ctx, notes);

    const systemPrompt = `You are a senior direct-response copywriter for Facebook/Instagram ads.
You write clear, specific, emotionally relevant copy — never vague, generic, or hype-heavy.
You avoid language that sounds unbelievable.
${copywritingPrompt ? `\nCLIENT-SPECIFIC COPYWRITING RULES:\n${copywritingPrompt}\n\nFollow these rules strictly for all variations.` : ""}
Respond ONLY with valid JSON — no preamble, no markdown fences, no commentary.`;

    const userPrompt = `Here is the current Facebook ad copy that is running:

${source.clientName ? `CLIENT: ${source.clientName}` : ""}
${source.sourceCampaignName ? `CAMPAIGN: ${source.sourceCampaignName}` : ""}

CURRENT HOOK: ${source.hook || "(not provided)"}

CURRENT BODY:
${source.bodyText || "(not provided)"}

CURRENT CTA: ${source.callToAction || "Learn More"}

${source.imageHeadline ? `IMAGE HEADLINE: ${source.imageHeadline}` : ""}
${enrichedNotes ? `\nNOTES FROM MEDIA BUYER:\n${enrichedNotes}` : ""}

Generate exactly 3 ad copy variations. Each must take a DIFFERENT angle:
1. "outcome_led" — open with the result/outcome the customer most desires
2. "problem_first" — name the specific pain before presenting the solution
3. "social_proof" — open with a credibility signal or community validation

IMPORTANT — Match the LENGTH and STYLE of the current ad copy above:
- If the current body is long-form (200+ words, storytelling, testimonial-style), write LONG-FORM variations of similar length
- If the current body is short (under 100 words), write short variations
- Match the tone, narrative style, and pacing of the original
- Long-form ads should tell a COMPLETE STORY with a beginning, middle, and end
- Use paragraph breaks for readability (include \\n\\n between paragraphs)
- The hook should stop the scroll in the first line
- The body should be a full narrative that builds emotional connection before the pitch
- End the body with a natural transition to the CTA

Requirements for EACH variation:
- hook: 1–2 sentences, scroll-stopping opening line. Must NOT start with the same word as the other hooks.
- body: Full ad body text — match the length of the original copy. For long-form ads, write 200-400 words with paragraph breaks.
- callToAction: 3–10 words, natural invitation to click

Respond ONLY with this JSON array (no text outside):
[
  {"title": "Variation A — Outcome-Led", "hook": "...", "body": "...", "callToAction": "..."},
  {"title": "Variation B — Problem-First", "hook": "...", "body": "...", "callToAction": "..."},
  {"title": "Variation C — Social Proof", "hook": "...", "body": "...", "callToAction": "..."}
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
          message: result.error || "Copy generation failed",
          retryable: true,
        },
      };
    }

    const variations: CopyVariationCandidate[] = result.variations
      .slice(0, variationCount)
      .map((v, i) => ({
        title: v.title || `Variation ${i + 1}`,
        hook: v.hook || "",
        body: v.body || "",
        callToAction: v.callToAction || source.callToAction || "",
        angle: v.angle,
      }));

    return {
      ok: true,
      variations,
      provider: result.provider || provider,
      tokensUsed: result.tokensUsed,
    };
  } catch (err) {
    return {
      ok: false,
      variations: [],
      provider,
      error: {
        code: "provider_failure",
        message: err instanceof Error ? err.message : "Copy generation failed",
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
  variations: Array<{ title?: string; hook?: string; body?: string; callToAction?: string; angle?: string }>;
  provider?: string;
  tokensUsed?: number;
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

  return { ok: false, variations: [], error: "No AI provider configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY." };
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
        max_tokens: 8192,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });

    if (res.status === 429 && attempt < MAX_RETRIES) {
      const delay = 2000 * Math.pow(2, attempt);
      console.warn(`[copy-gen] Anthropic 429, retry ${attempt + 1}/${MAX_RETRIES} in ${delay / 1000}s`);
      await sleep(delay);
      continue;
    }

    const data = await res.json();
    if (!res.ok) {
      const errMsg = data?.error?.message ?? `Anthropic HTTP ${res.status}`;
      console.error(`[copy-gen] Anthropic error ${res.status}:`, JSON.stringify(data?.error ?? data).slice(0, 500));
      if (res.status === 429) {
        return { ok: false, variations: [], error: "Rate limited by Anthropic. Wait a moment and try again." };
      }
      return { ok: false, variations: [], error: errMsg };
    }

    const text = data?.content?.[0]?.text ?? "";
    const variations = parseVariations(text);
    return {
      ok: variations.length > 0,
      variations,
      provider: "anthropic",
      tokensUsed: (data?.usage?.input_tokens ?? 0) + (data?.usage?.output_tokens ?? 0),
      error: variations.length === 0 ? "AI returned invalid format" : undefined,
    };
  }
  return { ok: false, variations: [], error: "Rate limited by Anthropic after retries. Wait a moment and try again." };
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
        max_tokens: 8192,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (res.status === 429 && attempt < MAX_RETRIES) {
      const delay = 2000 * Math.pow(2, attempt);
      console.warn(`[copy-gen] OpenAI 429, retry ${attempt + 1}/${MAX_RETRIES} in ${delay / 1000}s`);
      await sleep(delay);
      continue;
    }

    const data = await res.json();
    if (!res.ok) {
      const errMsg = data?.error?.message ?? `OpenAI HTTP ${res.status}`;
      console.error(`[copy-gen] OpenAI error ${res.status}:`, JSON.stringify(data?.error ?? data).slice(0, 500));
      if (res.status === 429) {
        return { ok: false, variations: [], error: "Rate limited by OpenAI. Wait a moment and try again." };
      }
      return { ok: false, variations: [], error: errMsg };
    }

    const text = data?.choices?.[0]?.message?.content ?? "";
    const variations = parseVariations(text);
    return {
      ok: variations.length > 0,
      variations,
      provider: "openai",
      tokensUsed: (data?.usage?.prompt_tokens ?? 0) + (data?.usage?.completion_tokens ?? 0),
      error: variations.length === 0 ? "AI returned invalid format" : undefined,
  };
}

// ── Parse helpers ─────────────────────────────────────────────────────────

function parseVariations(text: string): Array<{
  title: string; hook: string; body: string; callToAction: string; angle?: string;
}> {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  let parsed: unknown;
  try { parsed = JSON.parse(cleaned); } catch { /* continue */ }

  if (Array.isArray(parsed)) return validateVariations(parsed);

  if (parsed && typeof parsed === "object" && Array.isArray((parsed as Record<string, unknown>).variations)) {
    return validateVariations((parsed as Record<string, unknown>).variations as unknown[]);
  }

  const arrStart = cleaned.indexOf("[");
  const arrEnd = cleaned.lastIndexOf("]");
  if (arrStart >= 0 && arrEnd > arrStart) {
    try {
      const extracted = JSON.parse(cleaned.slice(arrStart, arrEnd + 1));
      if (Array.isArray(extracted)) return validateVariations(extracted);
    } catch { /* give up */ }
  }

  return [];
}

function validateVariations(arr: unknown[]): Array<{
  title: string; hook: string; body: string; callToAction: string;
}> {
  return arr
    .filter((item): item is Record<string, unknown> =>
      item !== null && typeof item === "object" &&
      typeof (item as Record<string, unknown>).hook === "string" &&
      typeof (item as Record<string, unknown>).body === "string"
    )
    .map((item) => ({
      title: String(item.title ?? "Variation"),
      hook: String(item.hook),
      body: String(item.body),
      callToAction: String(item.callToAction ?? item.cta ?? "Learn More"),
    }));
}

// ── Prompt enrichment ───────────────────────────────────────────────────────

function buildEnrichedNotes(
  ctx: VariationSourceContext,
  userNotes?: string
): string {
  const parts: string[] = [];
  if (userNotes) parts.push(userNotes);

  if (ctx.performance) {
    const perf = ctx.performance;
    const perfParts: string[] = [];
    if (perf.ctr !== undefined) perfParts.push(`CTR: ${perf.ctr.toFixed(2)}%`);
    if (perf.roas !== undefined) perfParts.push(`ROAS: ${perf.roas.toFixed(2)}x`);
    if (perf.cpa !== undefined) perfParts.push(`CPA: $${perf.cpa.toFixed(2)}`);
    if (perf.frequency !== undefined) perfParts.push(`Frequency: ${perf.frequency.toFixed(1)}x`);
    if (perfParts.length > 0) parts.push(`Current performance: ${perfParts.join(", ")}`);
    if (perf.fatigueStatus && perf.fatigueStatus !== "healthy") {
      parts.push(`Fatigue status: ${perf.fatigueStatus}. This creative needs fresh angles.`);
    }
  }

  if (ctx.learnings.length > 0) {
    const topLearnings = ctx.learnings
      .slice(0, 5)
      .map((l) => `- ${l.insightText}`)
      .join("\n");
    parts.push(`Proven learnings to apply:\n${topLearnings}`);
  }

  return parts.join("\n\n");
}
