// lib/creativelab/analysis.ts
// Creative image analysis using Claude Vision (claude-opus-4-6).
//
// Sends the uploaded image to Claude with a direct-response–focused prompt and
// parses the structured JSON response into UploadedCreativeAnalysis.

import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../db";

// ── Anthropic client ───────────────────────────────────────────────────────────

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ── Types ──────────────────────────────────────────────────────────────────────

interface VisionAnalysisResult {
  detectedStyle:                 string;
  dominantMessage:               string;
  visualTheme:                   string;
  clarityScore:                  number;   // 1–10
  attentionScore:                number;   // 1–10
  directResponseObservations:    string[]; // 4–6 observations
}

// ── Prompt ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior direct-response creative strategist specialising in Facebook and Instagram paid social advertising. Your role is to analyse ad creatives and provide structured, actionable feedback grounded in DR best practices.

When you receive an image, analyse it and respond with ONLY a valid JSON object — no prose, no markdown fences, just the raw JSON.`;

function buildUserPrompt(): string {
  return `Analyse this ad creative for direct-response effectiveness. Return ONLY a JSON object with these exact keys:

{
  "detectedStyle": one of "lifestyle" | "product-focus" | "text-heavy" | "before-after" | "general-static",
  "dominantMessage": short phrase describing the primary message or offer (e.g. "discount offer", "product benefit showcase"),
  "visualTheme": one of "dark" | "light-minimal" | "high-contrast" | "neutral",
  "clarityScore": integer 1–10 (how clear and readable is the main message to a cold audience),
  "attentionScore": integer 1–10 (how likely is this to stop the scroll in a busy feed),
  "directResponseObservations": array of 4–6 concise observation strings, each addressing a specific DR strength or weakness (offer visibility, CTA prominence, focal point, social proof, emotional hook, text legibility, visual hierarchy, urgency signal)
}

Scoring guide:
- clarityScore 8–10: offer/benefit immediately obvious; 5–7: requires a moment; 1–4: unclear or cluttered
- attentionScore 8–10: strong single focal point, high contrast, arresting composition; 5–7: decent but not striking; 1–4: blends into feed

Respond with the JSON object only. No explanation, no markdown.`;
}

// ── MIME → Anthropic media_type ───────────────────────────────────────────────

type SupportedMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

function toAnthropicMediaType(mimeType: string): SupportedMediaType {
  const allowed: SupportedMediaType[] = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (allowed.includes(mimeType as SupportedMediaType)) {
    return mimeType as SupportedMediaType;
  }
  return "image/jpeg";
}

// ── Parse Claude's JSON response ──────────────────────────────────────────────

function parseVisionResponse(text: string): VisionAnalysisResult {
  // Strip any accidental markdown fences just in case
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const parsed = JSON.parse(cleaned) as Partial<VisionAnalysisResult>;

  return {
    detectedStyle:              String(parsed.detectedStyle              ?? "general-static"),
    dominantMessage:            String(parsed.dominantMessage            ?? "general product"),
    visualTheme:                String(parsed.visualTheme                ?? "neutral"),
    clarityScore:               Math.min(10, Math.max(1, Number(parsed.clarityScore  ?? 5))),
    attentionScore:             Math.min(10, Math.max(1, Number(parsed.attentionScore ?? 5))),
    directResponseObservations: Array.isArray(parsed.directResponseObservations)
      ? parsed.directResponseObservations.map(String)
      : [],
  };
}

// ── Main analysis function ────────────────────────────────────────────────────

/**
 * Run Claude Vision analysis on an uploaded creative image and persist to DB.
 * Reads the image from the local filesystem, sends it to claude-opus-4-6,
 * and upserts the result into UploadedCreativeAnalysis.
 */
export async function analyzeCreativeImage(imageId: string): Promise<void> {
  const image = await prisma.uploadedCreativeImage.findUnique({
    where: { id: imageId },
  });
  if (!image) throw new Error("Image not found");

  // Mark as in-progress
  await prisma.uploadedCreativeAnalysis.upsert({
    where:  { uploadedCreativeImageId: imageId },
    create: { uploadedCreativeImageId: imageId, analysisStatus: "pending", analysisEngine: "claude_vision" },
    update: { analysisStatus: "pending" },
  });

  // Read image from disk (storagePath is relative to project root, e.g. /uploads/creatives/abc.jpg)
  const absolutePath = path.join(process.cwd(), "public", image.storagePath);
  const imageBuffer  = fs.readFileSync(absolutePath);
  const base64Data   = imageBuffer.toString("base64");
  const mediaType    = toAnthropicMediaType(image.mimeType);

  // Call Claude Vision
  const response = await anthropic.messages.create({
    model:      "claude-opus-4-6",
    max_tokens: 1024,
    thinking:   { type: "adaptive" },
    system:     SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type:   "image",
            source: { type: "base64", media_type: mediaType, data: base64Data },
          },
          { type: "text", text: buildUserPrompt() },
        ],
      },
    ],
  });

  // Extract text from response (skip thinking blocks)
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude Vision returned no text block");
  }

  const result = parseVisionResponse(textBlock.text);

  await prisma.uploadedCreativeAnalysis.upsert({
    where:  { uploadedCreativeImageId: imageId },
    create: {
      uploadedCreativeImageId:        imageId,
      analysisStatus:                 "completed",
      analysisEngine:                 "claude_vision",
      detectedStyle:                  result.detectedStyle,
      dominantMessage:                result.dominantMessage,
      visualTheme:                    result.visualTheme,
      clarityScore:                   result.clarityScore,
      attentionScore:                 result.attentionScore,
      directResponseObservationsJson: JSON.stringify(result.directResponseObservations),
    },
    update: {
      analysisStatus:                 "completed",
      analysisEngine:                 "claude_vision",
      detectedStyle:                  result.detectedStyle,
      dominantMessage:                result.dominantMessage,
      visualTheme:                    result.visualTheme,
      clarityScore:                   result.clarityScore,
      attentionScore:                 result.attentionScore,
      directResponseObservationsJson: JSON.stringify(result.directResponseObservations),
    },
  });
}
