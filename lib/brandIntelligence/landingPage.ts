// lib/brandIntelligence/landingPage.ts
// Fetches a landing page URL and extracts structured brand/offer signals.
//
// Design rules:
//   - Stateless — no DB writes. Caller persists if desired.
//   - Uses Anthropic for extraction when available, falls back to regex heuristics.
//   - Safe for invalid URLs, timeouts, sparse pages.
//   - HTML is stripped to text before sending to LLM (token efficiency).

import type { LandingPageExtraction, LandingPageSignal } from "../../types/brandIntelligence";

// ---------------------------------------------------------------------------
// HTML → plain text (simple, no dependency)
// ---------------------------------------------------------------------------

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, " [HEADER] ")
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n## $1\n")
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n### $1\n")
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n#### $1\n")
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "• $1\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#?\w+;/gi, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Fetch page content
// ---------------------------------------------------------------------------

async function fetchPageText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(url, {
      signal:  controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MediaBuyerDash/1.0; +https://mediabuyerdash.com)",
        Accept:       "text/html",
      },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    return stripHtml(html);
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Anthropic-powered extraction
// ---------------------------------------------------------------------------

const EXTRACTION_PROMPT = `You are analyzing a landing page for a media buyer building Facebook ads.
Extract the following from the page content. Return ONLY valid JSON matching this shape:
{
  "headline": string or null,
  "subheadline": string or null,
  "offer": string or null,
  "keyBenefits": string[],
  "productDetails": string or null,
  "price": string or null,
  "discount": string or null,
  "testimonials": string[],
  "tone": string or null,
  "positioning": string or null,
  "ctaLanguage": string or null
}

Rules:
- Extract what is actually on the page. Do not invent content.
- "tone" should be 2-4 adjective keywords like "bold, conversational, premium"
- "positioning" should be a 1-sentence summary of how the brand positions itself
- "keyBenefits" should be the 3-5 most important benefits mentioned
- "testimonials" should include up to 3 short quotes if present
- If something is not found, use null or empty array
- Keep values concise — no full paragraphs`;

async function extractWithAnthropic(
  pageText: string,
): Promise<Omit<LandingPageExtraction, "url" | "extractedAt" | "quality" | "signals"> | null> {
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic();

    // Truncate to ~8k chars to stay within reasonable token limits
    const truncated = pageText.slice(0, 8000);

    const response = await client.messages.create({
      model:      "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role:    "user",
          content: `${EXTRACTION_PROMPT}\n\n--- PAGE CONTENT ---\n${truncated}`,
        },
      ],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Regex-based fallback extraction
// ---------------------------------------------------------------------------

function extractWithHeuristics(
  pageText: string,
): Omit<LandingPageExtraction, "url" | "extractedAt" | "quality" | "signals"> {
  const lines = pageText.split("\n").map((l) => l.trim()).filter(Boolean);

  // Find headline (first ## heading or first line > 10 chars)
  let headline: string | null = null;
  let subheadline: string | null = null;
  for (const line of lines) {
    if (line.startsWith("## ") && !headline) {
      headline = line.replace(/^##\s*/, "");
    } else if (line.startsWith("### ") && headline && !subheadline) {
      subheadline = line.replace(/^###\s*/, "");
    }
  }
  if (!headline && lines.length > 0) headline = lines[0].slice(0, 120);

  // Find price
  const priceMatch = pageText.match(/\$\d+[\d,.]*(?:\s*\/\s*\w+)?/);
  const price = priceMatch ? priceMatch[0] : null;

  // Find discount
  const discountMatch = pageText.match(/(\d+%\s*off|\bsave\s+\$?\d+)/i);
  const discount = discountMatch ? discountMatch[0] : null;

  // Find bullet benefits
  const benefits = lines
    .filter((l) => l.startsWith("•"))
    .map((l) => l.replace(/^•\s*/, ""))
    .slice(0, 5);

  return {
    headline,
    subheadline,
    offer:          null,
    keyBenefits:    benefits,
    productDetails: null,
    price,
    discount,
    testimonials:   [],
    tone:           null,
    positioning:    null,
    ctaLanguage:    null,
  };
}

// ---------------------------------------------------------------------------
// Build signals from extraction
// ---------------------------------------------------------------------------

function buildSignals(
  data: Omit<LandingPageExtraction, "url" | "extractedAt" | "quality" | "signals">,
): LandingPageSignal[] {
  const signals: LandingPageSignal[] = [];

  if (data.headline) {
    signals.push({ type: "headline", value: data.headline, confidence: "high" });
  }
  if (data.offer) {
    signals.push({ type: "offer", value: data.offer, confidence: "high" });
  }
  if (data.price) {
    signals.push({ type: "price", value: data.price, confidence: "medium" });
  }
  if (data.discount) {
    signals.push({ type: "discount", value: data.discount, confidence: "medium" });
  }
  if (data.ctaLanguage) {
    signals.push({ type: "cta", value: data.ctaLanguage, confidence: "high" });
  }
  for (const b of data.keyBenefits.slice(0, 3)) {
    signals.push({ type: "benefit", value: b, confidence: "medium" });
  }
  for (const t of data.testimonials.slice(0, 2)) {
    signals.push({ type: "testimonial", value: t, confidence: "medium" });
  }

  return signals;
}

// ---------------------------------------------------------------------------
// Classify extraction quality
// ---------------------------------------------------------------------------

function classifyQuality(
  data: Omit<LandingPageExtraction, "url" | "extractedAt" | "quality" | "signals">,
): "rich" | "moderate" | "sparse" {
  let score = 0;
  if (data.headline) score++;
  if (data.offer) score++;
  if (data.keyBenefits.length >= 3) score++;
  if (data.price) score++;
  if (data.tone) score++;
  if (data.testimonials.length > 0) score++;
  if (data.positioning) score++;

  if (score >= 5) return "rich";
  if (score >= 3) return "moderate";
  return "sparse";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function extractLandingPageContext(url: string): Promise<LandingPageExtraction> {
  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new Error("Invalid protocol");
    }
  } catch {
    return {
      url,
      headline: null, subheadline: null, offer: null,
      keyBenefits: [], productDetails: null,
      price: null, discount: null, testimonials: [],
      tone: null, positioning: null, ctaLanguage: null,
      signals: [],
      extractedAt: new Date().toISOString(),
      quality: "sparse",
    };
  }

  // Fetch page
  let pageText: string;
  try {
    pageText = await fetchPageText(parsedUrl.toString());
  } catch {
    return {
      url,
      headline: null, subheadline: null, offer: null,
      keyBenefits: [], productDetails: null,
      price: null, discount: null, testimonials: [],
      tone: null, positioning: null, ctaLanguage: null,
      signals: [],
      extractedAt: new Date().toISOString(),
      quality: "sparse",
    };
  }

  if (pageText.length < 50) {
    return {
      url,
      headline: null, subheadline: null, offer: null,
      keyBenefits: [], productDetails: null,
      price: null, discount: null, testimonials: [],
      tone: null, positioning: null, ctaLanguage: null,
      signals: [],
      extractedAt: new Date().toISOString(),
      quality: "sparse",
    };
  }

  // Try Anthropic first, fall back to heuristics
  const extracted = (await extractWithAnthropic(pageText)) ?? extractWithHeuristics(pageText);

  const signals = buildSignals(extracted);
  const quality = classifyQuality(extracted);

  return {
    url,
    ...extracted,
    signals,
    extractedAt: new Date().toISOString(),
    quality,
  };
}
