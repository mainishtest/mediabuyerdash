// lib/creativelab/analysis.ts
// First-pass creative image analysis.
//
// v1 engine: deterministic/mock — structured to be swapped for a real
// vision API (GPT-4o Vision, Claude Vision, etc.) in the next step.
//
// The analysis is framed around Facebook direct-response ad best practices.
// It does NOT imply guaranteed conversion outcomes.

import { prisma } from "../db";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AnalysisResult {
  visualHeadline:                 string | null;
  detectedStyle:                  string;
  dominantMessage:                string;
  visualTheme:                    string;
  clarityScore:                   number; // 1–10
  attentionScore:                 number; // 1–10
  directResponseObservations:     string[];
}

// ── Direct-response observation library ───────────────────────────────────────

const CLARITY_OBSERVATIONS = [
  "Message hierarchy may not be immediately clear to a cold audience",
  "Primary offer or benefit could be made more visually dominant",
  "Consider reducing visual elements competing with the main message",
  "Text legibility may benefit from higher contrast or larger type",
  "Key value proposition appears clear and upfront",
  "Offer clarity is strong — benefit is easy to identify at a glance",
  "Main message competes with background elements",
];

const ATTENTION_OBSERVATIONS = [
  "Focal point strength could be improved to stop the scroll faster",
  "Visual hierarchy guides the eye toward the primary message",
  "High-contrast composition likely to attract attention in feed",
  "Image may benefit from a stronger single focal point",
  "Color contrast appears strong for feed visibility",
  "Layout density may reduce attention speed on mobile",
  "Composition feels balanced but could be more arresting",
];

const DR_STRENGTH_OBSERVATIONS = [
  "Direct-response hook is not immediately visible",
  "Action cue (CTA) would benefit from higher visual prominence",
  "Offer or urgency signal is not strongly present",
  "Product or benefit appears to be the primary visual focus",
  "Consider adding or amplifying a visual urgency element",
  "Social proof or authority signal could strengthen conversion intent",
  "Emotional hook appears present — relatability may be high",
  "Product benefit visibility is a strength of this creative",
];

// ── Style classifier (deterministic from filename/mime hints) ─────────────────

function classifyStyle(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.includes("lifestyle") || lower.includes("person") || lower.includes("model")) {
    return "lifestyle";
  }
  if (lower.includes("product") || lower.includes("item") || lower.includes("pack")) {
    return "product-focus";
  }
  if (lower.includes("text") || lower.includes("copy") || lower.includes("offer")) {
    return "text-heavy";
  }
  if (lower.includes("before") || lower.includes("after")) {
    return "before-after";
  }
  return "general-static";
}

function classifyTheme(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.includes("dark") || lower.includes("black")) return "dark";
  if (lower.includes("light") || lower.includes("white") || lower.includes("clean")) return "light-minimal";
  if (lower.includes("bright") || lower.includes("color") || lower.includes("vivid")) return "high-contrast";
  return "neutral";
}

function inferMessage(style: string): string {
  switch (style) {
    case "lifestyle":      return "aspirational benefit or product-in-use";
    case "product-focus":  return "product showcase or feature highlight";
    case "text-heavy":     return "offer or discount driven";
    case "before-after":   return "transformation or problem-solution";
    default:               return "general brand or product awareness";
  }
}

// ── Seeded pseudo-random for deterministic-per-image scores ───────────────────

function seededInt(seed: string, min: number, max: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const normalised = Math.abs(hash) / 2147483647;
  return Math.round(min + normalised * (max - min));
}

function pickItems<T>(arr: T[], seed: string, count: number): T[] {
  const results: T[] = [];
  for (let i = 0; i < count; i++) {
    const idx = seededInt(seed + i, 0, arr.length - 1);
    results.push(arr[idx]);
  }
  return results;
}

// ── Main analysis function ────────────────────────────────────────────────────

/**
 * Run a first-pass analysis on an uploaded creative image and persist to DB.
 * v1: deterministic mock. Replace the body of this function with a real
 * vision API call (GPT-4o, Claude Vision) to upgrade to AI analysis.
 */
export async function analyzeCreativeImage(imageId: string): Promise<void> {
  const image = await prisma.uploadedCreativeImage.findUnique({
    where: { id: imageId },
  });
  if (!image) throw new Error("Image not found");

  const style         = classifyStyle(image.fileName);
  const theme         = classifyTheme(image.fileName);
  const message       = inferMessage(style);
  const clarityScore  = seededInt(imageId + "clarity",   5, 9);
  const attentionScore = seededInt(imageId + "attention", 4, 9);

  const observations = [
    ...pickItems(CLARITY_OBSERVATIONS,    imageId + "c", 2),
    ...pickItems(ATTENTION_OBSERVATIONS,  imageId + "a", 2),
    ...pickItems(DR_STRENGTH_OBSERVATIONS, imageId + "d", 2),
  ];

  await prisma.uploadedCreativeAnalysis.upsert({
    where:  { uploadedCreativeImageId: imageId },
    create: {
      uploadedCreativeImageId:        imageId,
      analysisStatus:                 "completed",
      analysisEngine:                 "mock_v1",
      detectedStyle:                  style,
      dominantMessage:                message,
      visualTheme:                    theme,
      clarityScore,
      attentionScore,
      directResponseObservationsJson: JSON.stringify(observations),
    },
    update: {
      analysisStatus:                 "completed",
      detectedStyle:                  style,
      dominantMessage:                message,
      visualTheme:                    theme,
      clarityScore,
      attentionScore,
      directResponseObservationsJson: JSON.stringify(observations),
    },
  });
}
