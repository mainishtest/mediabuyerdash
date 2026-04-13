// Generate 3 image variation concepts based on current ad creative.
// Returns structured briefs a designer/AI image tool can execute.

import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "../../../../../lib/db";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    currentImageDescription,
    productName,
    adCopy,
    clientAccountId,
    clientName,
    notes,
  } = body as {
    currentImageDescription?: string;
    productName?: string;
    adCopy?: string;
    clientAccountId?: string;
    clientName?: string;
    notes?: string;
  };

  // Load client copywriting prompt for brand context
  let brandContext = "";
  let imageDirections = "";
  if (clientAccountId) {
    const client = await prisma.clientAccount.findUnique({
      where: { id: clientAccountId },
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

  const userPrompt = `${clientName ? `CLIENT: ${clientName}` : ""}
${productName ? `PRODUCT: ${productName}` : ""}

CURRENT AD IMAGE:
${currentImageDescription || "No description provided — generate concepts based on the product/brand context."}

${adCopy ? `AD COPY (for context — the image should complement this message):\n${adCopy}\n` : ""}
${notes ? `CREATIVE DIRECTOR NOTES:\n${notes}\n` : ""}

Generate exactly 3 high-converting image variation concepts for a Facebook/Instagram feed ad.
Each concept should take a DIFFERENT visual approach:

1. "clean_hero" — Single product hero shot with maximum clarity. Clean background, strong lighting, product dominates the frame. Designed to communicate value in under 0.3 seconds.

2. "lifestyle_proof" — Product in a real-life context showing the result/transformation. Human element, natural setting, emotional connection. Shows what life looks like AFTER using the product.

3. "pattern_interrupt" — Bold, unexpected visual that breaks the scroll pattern. Could use striking contrast, unusual composition, before/after, or a provocative visual hook that demands attention.

For EACH concept provide:
- title: Short name (e.g. "Clean Hero — Bottle Close-Up")
- concept: 2-3 sentences describing exactly what the image shows. Specific enough for a designer or AI image tool to execute.
- whyItWorks: 1 sentence — the direct-response psychology behind this visual approach.
- textOverlay: Suggested text overlay on the image (if any). Keep to 5-7 words max or "none".
- colorDirection: Primary color palette direction (e.g. "warm earth tones", "clean white + gold", "dark moody contrast")

Respond ONLY with this JSON array:
[
  {"title": "...", "concept": "...", "whyItWorks": "...", "textOverlay": "...", "colorDirection": "..."},
  {"title": "...", "concept": "...", "whyItWorks": "...", "textOverlay": "...", "colorDirection": "..."},
  {"title": "...", "concept": "...", "whyItWorks": "...", "textOverlay": "...", "colorDirection": "..."}
]`;

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey    = process.env.OPENAI_API_KEY;

  const apiKey = anthropicKey || openaiKey;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "No AI provider configured." }, { status: 500 });
  }

  try {
    let concepts: unknown[] = [];

    if (anthropicKey) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });

      if (res.status === 429 || res.status === 529) {
        return NextResponse.json({ ok: false, error: res.status === 529 ? "Anthropic API is temporarily overloaded. Try again shortly." : "Rate limited. Wait a moment and try again." }, { status: res.status === 529 ? 503 : 429 });
      }

      const data = await res.json();
      if (!res.ok) {
        return NextResponse.json({ ok: false, error: data?.error?.message ?? `HTTP ${res.status}` }, { status: 500 });
      }

      const text = data?.content?.[0]?.text ?? "";
      concepts = parseJsonArray(text);
    } else if (openaiKey) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL ?? "gpt-4o",
          max_tokens: 4096,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return NextResponse.json({ ok: false, error: data?.error?.message ?? `HTTP ${res.status}` }, { status: 500 });
      }

      const text = data?.choices?.[0]?.message?.content ?? "";
      concepts = parseJsonArray(text);
    }

    if (concepts.length === 0) {
      return NextResponse.json({ ok: false, error: "AI returned invalid format." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, concepts });
  } catch (err) {
    return NextResponse.json({ ok: false, error: `Generation failed: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }
}

function parseJsonArray(text: string): unknown[] {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
  } catch { /* continue */ }

  const arrStart = cleaned.indexOf("[");
  const arrEnd   = cleaned.lastIndexOf("]");
  if (arrStart >= 0 && arrEnd > arrStart) {
    try {
      const extracted = JSON.parse(cleaned.slice(arrStart, arrEnd + 1));
      if (Array.isArray(extracted)) return extracted;
    } catch { /* give up */ }
  }

  return [];
}
