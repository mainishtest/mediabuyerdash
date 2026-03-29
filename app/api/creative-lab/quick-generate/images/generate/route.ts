// Generate an actual image from a concept description.
// Primary: Flux Pro via fal.ai (best photorealism for ads)
// Fallback: DALL-E 3 via OpenAI

import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { concept, title, textOverlay, colorDirection, productName, productImageUrl, clientAccountId } = body as {
    concept: string;
    title?: string;
    textOverlay?: string;
    colorDirection?: string;
    productName?: string;
    productImageUrl?: string;
    clientAccountId?: string;
  };

  // Load product reference image from client settings if not provided
  let referenceImageUrl = productImageUrl ?? null;
  if (!referenceImageUrl && clientAccountId) {
    const { prisma } = await import("../../../../../../lib/db");
    const client = await prisma.clientAccount.findUnique({
      where: { id: clientAccountId },
      select: { productImageUrl: true },
    });
    referenceImageUrl = client?.productImageUrl ?? null;
  }

  if (!concept) {
    return NextResponse.json({ ok: false, error: "Concept description required" }, { status: 400 });
  }

  // Build prompt — shared across providers
  const prompt = [
    `Professional Facebook ad image for a health/wellness product.`,
    concept,
    colorDirection ? `Color palette: ${colorDirection}.` : "",
    textOverlay && textOverlay !== "none"
      ? `Include text overlay: "${textOverlay}" in clean, readable font.`
      : "Do NOT include any text on the image.",
    `Style: High-quality product photography, clean composition, professional lighting.`,
    `Square 1:1 format for Facebook/Instagram feed ad.`,
    `The image should look like a real, polished advertisement — photorealistic, not illustrated or cartoon-like.`,
  ].filter(Boolean).join(" ");

  const falKey    = process.env.FAL_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  // Primary: Flux Pro via fal.ai
  if (falKey) {
    const result = await generateWithFlux(falKey, prompt, title, referenceImageUrl);
    if (result.ok) return NextResponse.json(result);
    // If Flux fails, fall through to DALL-E
    console.error("[image-gen] Flux failed, trying DALL-E fallback:", result.error);
  }

  // Fallback: DALL-E 3 via OpenAI
  if (openaiKey) {
    return NextResponse.json(await generateWithDallE(openaiKey, prompt, title));
  }

  return NextResponse.json(
    { ok: false, error: "No image provider configured. Set FAL_KEY (Flux Pro) or OPENAI_API_KEY (DALL-E 3)." },
    { status: 500 },
  );
}

// ---------------------------------------------------------------------------
// Flux Pro via fal.ai
// ---------------------------------------------------------------------------

async function generateWithFlux(
  apiKey: string,
  prompt: string,
  title?: string,
  referenceImageUrl?: string | null,
): Promise<{ ok: boolean; imageUrl?: string; provider?: string; title?: string; error?: string }> {
  try {
    let endpoint: string;
    const requestBody: Record<string, unknown> = {
      prompt,
      image_size: "square",
      num_images: 1,
      safety_tolerance: "5",
    };

    if (referenceImageUrl) {
      // Use Flux Pro v1.1 with image_prompt_url for image-guided generation
      // This keeps the visual style/product from the reference while applying the new concept
      endpoint = "https://queue.fal.run/fal-ai/flux-pro/v1.1";
      requestBody.image_prompt_url = referenceImageUrl;
      requestBody.prompt = `Keep the exact product bottle/packaging shown in the reference image. Place it in this new scene: ${prompt}`;
    } else {
      endpoint = "https://queue.fal.run/fal-ai/flux-pro/v1.1";
    }

    const submitRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Key ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!submitRes.ok) {
      const errData = await submitRes.json().catch(() => ({}));
      return { ok: false, error: `Flux API ${submitRes.status}: ${(errData as Record<string, unknown>)?.detail ?? JSON.stringify(errData)}` };
    }

    const submitData = await submitRes.json() as {
      request_id?: string;
      images?: Array<{ url: string }>;
      status?: string;
    };

    // If synchronous response with images
    if (submitData.images?.[0]?.url) {
      return {
        ok: true,
        imageUrl: submitData.images[0].url,
        provider: "flux-pro",
        title,
      };
    }

    // If queued, poll for result
    if (submitData.request_id) {
      const imageUrl = await pollFluxResult(apiKey, submitData.request_id, endpoint);
      if (imageUrl) {
        return { ok: true, imageUrl, provider: "flux-pro", title };
      }
      return { ok: false, error: "Flux generation timed out" };
    }

    return { ok: false, error: "Unexpected Flux response format" };
  } catch (err) {
    return { ok: false, error: `Flux error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

async function pollFluxResult(apiKey: string, requestId: string, endpoint: string): Promise<string | null> {
  const maxAttempts = 30; // 30 * 2s = 60s max wait
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000));

    const res = await fetch(`${endpoint}/requests/${requestId}/status`, {
      headers: { "Authorization": `Key ${apiKey}` },
    });

    if (!res.ok) continue;

    const data = await res.json() as { status?: string; response?: { images?: Array<{ url: string }> } };

    if (data.status === "COMPLETED" && data.response?.images?.[0]?.url) {
      return data.response.images[0].url;
    }
    if (data.status === "FAILED") return null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// DALL-E 3 via OpenAI (fallback)
// ---------------------------------------------------------------------------

async function generateWithDallE(
  apiKey: string,
  prompt: string,
  title?: string,
): Promise<{ ok: boolean; imageUrl?: string; provider?: string; title?: string; error?: string }> {
  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
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
      return { ok: false, error: "Rate limited by OpenAI. Wait a moment and try again." };
    }

    const data = await res.json();

    if (!res.ok) {
      return { ok: false, error: data?.error?.message ?? `OpenAI HTTP ${res.status}` };
    }

    const imageUrl = data?.data?.[0]?.url;
    if (!imageUrl) {
      return { ok: false, error: "No image URL in DALL-E response" };
    }

    return { ok: true, imageUrl, provider: "dall-e-3", title };
  } catch (err) {
    return { ok: false, error: `DALL-E error: ${err instanceof Error ? err.message : String(err)}` };
  }
}
