// app/api/creative-lab/quick-generate/route.ts
// Simple copy variation generator.
// Paste ad copy in, get 3 variations back. No pipeline, no briefs, no assembly.

import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "../../../../lib/db";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    hook,
    bodyText,
    cta,
    imageHeadline,
    clientAccountId,
    provider = "anthropic",
    clientName,
    campaignName,
    notes,
  } = body as {
    hook: string;
    bodyText: string;
    cta: string;
    imageHeadline?: string;
    clientAccountId?: string;
    provider?: "anthropic" | "openai";
    clientName?: string;
    campaignName?: string;
    notes?: string;
  };

  if (!hook && !bodyText) {
    return NextResponse.json(
      { ok: false, error: "Paste your ad copy — at least a hook or body is required." },
      { status: 400 },
    );
  }

  // Load client copywriting prompt if a client is selected
  let copywritingPrompt: string | null = null;
  if (clientAccountId) {
    const client = await prisma.clientAccount.findUnique({
      where: { id: clientAccountId },
      select: { copywritingPrompt: true, name: true, brandName: true },
    });
    copywritingPrompt = client?.copywritingPrompt ?? null;
  }

  // Build a focused prompt with the actual ad copy
  const systemPrompt = `You are a senior direct-response copywriter for Facebook/Instagram ads.
You write clear, specific, emotionally relevant copy — never vague, generic, or hype-heavy.
You avoid language that sounds unbelievable.
${copywritingPrompt ? `\nCLIENT-SPECIFIC COPYWRITING RULES:\n${copywritingPrompt}\n\nFollow these rules strictly for all variations.` : ""}
Respond ONLY with valid JSON — no preamble, no markdown fences, no commentary.`;

  const userPrompt = `Here is the current Facebook ad copy that is running:

${clientName ? `CLIENT: ${clientName}` : ""}
${campaignName ? `CAMPAIGN: ${campaignName}` : ""}

CURRENT HOOK: ${hook || "(not provided)"}

CURRENT BODY:
${bodyText || "(not provided)"}

CURRENT CTA: ${cta || "Learn More"}

${imageHeadline ? `IMAGE HEADLINE: ${imageHeadline}` : ""}
${notes ? `\nNOTES FROM MEDIA BUYER:\n${notes}` : ""}

Generate exactly 3 ad copy variations. Each must take a DIFFERENT angle:
1. "outcome_led" — open with the result/outcome the customer most desires
2. "problem_first" — name the specific pain before presenting the solution
3. "social_proof" — open with a credibility signal or community validation

Requirements for EACH variation:
- hook: 1–2 sentences, scroll-stopping, ≤ 40 words. Must NOT start with the same word as the other hooks.
- body: 2–4 sentences, benefit-focused, ≤ 80 words
- callToAction: 3–7 words, action-oriented verb phrase

Respond ONLY with this JSON array (no text outside):
[
  {"title": "Variation A — Outcome-Led", "hook": "...", "body": "...", "callToAction": "..."},
  {"title": "Variation B — Problem-First", "hook": "...", "body": "...", "callToAction": "..."},
  {"title": "Variation C — Social Proof", "hook": "...", "body": "...", "callToAction": "..."}
]`;

  // Determine which provider to use
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey    = process.env.OPENAI_API_KEY;

  if (provider === "anthropic" && anthropicKey) {
    return generateWithAnthropic(anthropicKey, systemPrompt, userPrompt);
  }
  if (provider === "openai" && openaiKey) {
    return generateWithOpenAI(openaiKey, systemPrompt, userPrompt);
  }
  // Fallback: try whichever is available
  if (anthropicKey) return generateWithAnthropic(anthropicKey, systemPrompt, userPrompt);
  if (openaiKey)    return generateWithOpenAI(openaiKey, systemPrompt, userPrompt);

  return NextResponse.json(
    { ok: false, error: "No AI provider configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY." },
    { status: 500 },
  );
}

// ---------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------

async function generateWithAnthropic(apiKey: string, system: string, user: string) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system,
        messages:   [{ role: "user", content: user }],
      }),
    });

    if (res.status === 429) {
      return NextResponse.json({ ok: false, error: "Rate limited by Anthropic. Wait a moment and try again." }, { status: 429 });
    }

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: data?.error?.message ?? `Anthropic HTTP ${res.status}` }, { status: 500 });
    }

    const text = data?.content?.[0]?.text ?? "";
    const variations = parseVariations(text);

    if (variations.length === 0) {
      return NextResponse.json({ ok: false, error: "AI returned invalid format. Raw response saved.", rawText: text }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      provider: "anthropic",
      model: data?.model,
      variations,
      usage: data?.usage,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: `Anthropic error: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// OpenAI
// ---------------------------------------------------------------------------

async function generateWithOpenAI(apiKey: string, system: string, user: string) {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:      process.env.OPENAI_MODEL ?? "gpt-4o",
        max_tokens: 2048,
        messages: [
          { role: "system", content: system },
          { role: "user",   content: user },
        ],
      }),
    });

    if (res.status === 429) {
      return NextResponse.json({ ok: false, error: "Rate limited by OpenAI. Wait a moment and try again." }, { status: 429 });
    }

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: data?.error?.message ?? `OpenAI HTTP ${res.status}` }, { status: 500 });
    }

    const text = data?.choices?.[0]?.message?.content ?? "";
    const variations = parseVariations(text);

    if (variations.length === 0) {
      return NextResponse.json({ ok: false, error: "AI returned invalid format. Raw response saved.", rawText: text }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      provider: "openai",
      model: data?.model,
      variations,
      usage: data?.usage,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: `OpenAI error: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Parse variations from AI response (handles all common formats)
// ---------------------------------------------------------------------------

function parseVariations(text: string): Array<{
  title: string; hook: string; body: string; callToAction: string;
}> {
  // Strip markdown fences
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  // Try direct parse
  let parsed: unknown;
  try { parsed = JSON.parse(cleaned); } catch { /* continue */ }

  // Handle raw array
  if (Array.isArray(parsed)) return validateVariations(parsed);

  // Handle {variations: [...]}
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as Record<string, unknown>).variations)) {
    return validateVariations((parsed as Record<string, unknown>).variations as unknown[]);
  }

  // Fallback: extract array from text
  const arrStart = cleaned.indexOf("[");
  const arrEnd   = cleaned.lastIndexOf("]");
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
      title:        String(item.title ?? "Variation"),
      hook:         String(item.hook),
      body:         String(item.body),
      callToAction: String(item.callToAction ?? item.cta ?? "Learn More"),
    }));
}
