// Generate an actual image from a concept description using DALL-E 3.
// Returns the generated image URL.

import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { concept, title, textOverlay, colorDirection, productName } = body as {
    concept: string;
    title?: string;
    textOverlay?: string;
    colorDirection?: string;
    productName?: string;
  };

  if (!concept) {
    return NextResponse.json({ ok: false, error: "Concept description required" }, { status: 400 });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json({ ok: false, error: "OPENAI_API_KEY not configured. DALL-E requires OpenAI." }, { status: 500 });
  }

  // Build a detailed prompt for DALL-E
  const prompt = [
    `Professional Facebook ad image for a health/wellness product.`,
    concept,
    colorDirection ? `Color palette: ${colorDirection}.` : "",
    textOverlay && textOverlay !== "none" ? `Include text overlay: "${textOverlay}" in clean, readable font.` : "Do NOT include any text on the image.",
    `Style: High-quality product photography, clean composition, professional lighting.`,
    `Aspect ratio: Square (1:1) for Facebook/Instagram feed ad.`,
    `The image should look like a real, polished advertisement — not AI-generated or cartoon-like.`,
  ].filter(Boolean).join(" ");

  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model:   "dall-e-3",
        prompt,
        n:       1,
        size:    "1024x1024",
        quality: "standard",
        response_format: "url",
      }),
    });

    if (res.status === 429) {
      return NextResponse.json({ ok: false, error: "Rate limited by OpenAI. Wait a moment and try again." }, { status: 429 });
    }

    const data = await res.json();

    if (!res.ok) {
      const errMsg = data?.error?.message ?? `OpenAI HTTP ${res.status}`;
      return NextResponse.json({ ok: false, error: errMsg }, { status: 500 });
    }

    const imageUrl = data?.data?.[0]?.url;
    const revisedPrompt = data?.data?.[0]?.revised_prompt;

    if (!imageUrl) {
      return NextResponse.json({ ok: false, error: "No image URL in response" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      imageUrl,
      revisedPrompt,
      title,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: `Image generation failed: ${err instanceof Error ? err.message : String(err)}`,
    }, { status: 500 });
  }
}
