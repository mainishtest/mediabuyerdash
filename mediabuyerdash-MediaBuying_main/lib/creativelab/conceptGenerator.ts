// lib/creativelab/conceptGenerator.ts
// Generates 3 image iteration concepts per uploaded creative.
//
// v1: deterministic concepts based on analysis results.
// v2 upgrade path: replace generateConceptsForImage() with an LLM prompt
// that receives the analysis JSON and returns structured concept objects.
//
// Concepts are framed around Facebook direct-response best practices.
// They do NOT imply guaranteed conversion improvements.

import { prisma } from "../db";

// ── Concept templates (one per DR angle) ─────────────────────────────────────

interface ConceptTemplate {
  directResponseAngle: string;
  title:               (style: string) => string;
  conceptSummary:      (style: string, message: string) => string;
  visualChanges:       string;
  goal:                string;
}

const CONCEPT_TEMPLATES: ConceptTemplate[] = [
  {
    directResponseAngle: "stronger offer clarity",
    title: (_style) => "Offer-First Variant",
    conceptSummary: (_style, message) =>
      `Restructure the layout to lead with the primary offer or benefit from '${message}'. Move the value proposition to the top-left or center of the frame where attention is highest. Reduce competing visual elements.`,
    visualChanges:
      "Reposition headline to top-third. Increase font size and contrast of offer text. Reduce visual noise in the background. Add a clear offer callout (e.g., bold discount or key benefit statement).",
    goal: "Make the core offer immediately visible within 1–2 seconds of viewing.",
  },
  {
    directResponseAngle: "stronger product focus",
    title: (_style) => "Product-Hero Variant",
    conceptSummary: (style, _message) =>
      `Redesign around a single dominant product or result image. For a '${style}' style ad, isolate the product or outcome against a clean, high-contrast background to reduce cognitive load.`,
    visualChanges:
      "Crop or composite to show product prominently (60–70% of frame). Simplify background to solid or minimal gradient. Remove secondary images or text that compete with the product. Add a brief benefit label beneath the product.",
    goal: "Establish a single clear focal point that communicates product value without distraction.",
  },
  {
    directResponseAngle: "stronger action-driving cue",
    title: (_style) => "CTA-Forward Variant",
    conceptSummary: (_style, message) =>
      `Reframe the creative to make the call-to-action visually prominent for '${message}'. Add or enlarge the CTA button/text element and create a visual path that guides the eye toward it.`,
    visualChanges:
      "Add high-contrast CTA overlay (e.g., bold button shape). Use directional visual cues (arrow, eye direction, layout flow) pointing toward the CTA. Reduce text blocks to a single benefit statement above the CTA. Ensure CTA reads clearly on both mobile and desktop.",
    goal: "Drive click intent by making the next action obvious and visually unmissable.",
  },
  {
    directResponseAngle: "stronger emotional hook",
    title: (_style) => "Emotion-Led Variant",
    conceptSummary: (style, _message) =>
      `Reframe the creative around an emotional trigger relevant to the audience pain point or aspiration. For a '${style}' creative, this means leading with a relatable moment or desired outcome before revealing the product.`,
    visualChanges:
      "Lead with a human or aspirational outcome image. Rewrite the hook text to address a specific pain point or desire. Use warm or high-energy color grading aligned with the emotional tone. Product or offer appears after the emotional setup.",
    goal: "Connect with audience emotion first to increase relevance and scroll-stopping power.",
  },
  {
    directResponseAngle: "improved contrast and readability",
    title: (_style) => "High-Contrast Clarity Variant",
    conceptSummary: (_style, message) =>
      `Improve visual clarity for '${message}' by increasing contrast ratios, simplifying the color palette, and ensuring text legibility at mobile thumbnail sizes.`,
    visualChanges:
      "Increase background-to-text contrast ratio to minimum 4.5:1. Limit palette to 2–3 dominant colors. Remove or de-emphasize low-contrast elements. Increase minimum font size to 18px equivalent at standard feed display size. Bold the primary message.",
    goal: "Ensure the message is fully legible on mobile at a glance, reducing drop-off from unreadable creatives.",
  },
];

// ── Concept selector (deterministic per image) ────────────────────────────────

function selectTemplates(imageId: string, count: number): ConceptTemplate[] {
  // Use the imageId as a seed to deterministically pick `count` distinct templates
  let seed = 0;
  for (let i = 0; i < imageId.length; i++) {
    seed = ((seed << 5) - seed) + imageId.charCodeAt(i);
    seed |= 0;
  }
  const start = Math.abs(seed) % CONCEPT_TEMPLATES.length;
  const picked: ConceptTemplate[] = [];
  for (let i = 0; i < count; i++) {
    picked.push(CONCEPT_TEMPLATES[(start + i) % CONCEPT_TEMPLATES.length]);
  }
  return picked;
}

// ── Main generator ────────────────────────────────────────────────────────────

/**
 * Generate 3 iteration concepts for an uploaded creative image.
 * Replaces existing concepts for the image.
 *
 * v1: deterministic based on analysis. Replace this function with an LLM
 * call in the next step — the interface contract (imageId → void, writes to DB)
 * stays the same.
 */
export async function generateConceptsForImage(imageId: string): Promise<void> {
  const image = await prisma.uploadedCreativeImage.findUnique({
    where:   { id: imageId },
    include: { analysis: true },
  });
  if (!image) throw new Error("Image not found");

  const style   = image.analysis?.detectedStyle  ?? "general-static";
  const message = image.analysis?.dominantMessage ?? "general brand or product";

  const templates = selectTemplates(imageId, 3);

  // Delete existing draft concepts before regenerating
  await prisma.generatedImageIterationConcept.deleteMany({
    where: { uploadedCreativeImageId: imageId, approvalStatus: "draft" },
  });

  await prisma.generatedImageIterationConcept.createMany({
    data: templates.map((t) => ({
      uploadedCreativeImageId: imageId,
      title:               t.title(style),
      conceptSummary:      t.conceptSummary(style, message),
      visualChanges:       t.visualChanges,
      goal:                t.goal,
      directResponseAngle: t.directResponseAngle,
      approvalStatus:      "draft",
    })),
  });
}
