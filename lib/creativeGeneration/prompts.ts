// lib/creativeGeneration/prompts.ts
// Prompt construction for the AI creative generation engine.
// Pure functions — no side effects, no API calls, no DB imports.
//
// Each generation mode gets a dedicated prompt builder that:
//   1. Sets a direct-response creative strategist persona (system)
//   2. Injects performance context, brief sections, and constraints (user)
//   3. Specifies a strict JSON output format with example shapes

import type { CreativeGenerationInput } from "../../types/creativeGeneration";
import type { CreativeBriefInput } from "../../types/creativeBrief";
import { summarizeCreativeWeaknesses, summarizeCreativeStrengths } from "../creativeBrief/briefs";

// ---------------------------------------------------------------------------
// Shared system prompt
// ---------------------------------------------------------------------------

export const GENERATION_SYSTEM_PROMPT = `You are a senior direct-response creative strategist specializing in Meta advertising (Facebook and Instagram feeds and stories).

Your role is to generate high-performing ad creative outputs based on real performance data, audience fatigue signals, and structured creative briefs.

Rules you always follow:
- Every output must be grounded in the performance context provided
- ROAS and CPA figures are always CRM-verified (7-day attribution) — never Meta self-reported
- Copy must stop the scroll in the first 3 words of the hook
- Never start multiple variations with the same word or phrase
- Body copy must be benefit-focused, not feature-focused
- Always write as if the reader is one scroll away from leaving the feed
- Respond ONLY with valid JSON — no preamble, no commentary, no markdown fences
- If you cannot generate a variation, return an empty array rather than invalid JSON`;

// ---------------------------------------------------------------------------
// Performance context block — shared across all modes
// ---------------------------------------------------------------------------

function buildPerformanceBlock(pc: CreativeBriefInput): string {
  const lines: Array<string> = [
    "PERFORMANCE CONTEXT (14-day window, CRM-verified):",
    `- Spend: $${Math.round(pc.spend)}`,
    `- CTR: ${pc.avgCtr.toFixed(2)}% ${pc.avgCtr < 0.8 ? "(below 0.8% threshold)" : "(acceptable)"}`,
    pc.avgFrequency != null
      ? `- Frequency: ${pc.avgFrequency.toFixed(1)}x ${pc.avgFrequency > 3.5 ? "(high — audience fatigued)" : pc.avgFrequency > 2.5 ? "(watch — approaching fatigue)" : "(healthy)"}`
      : "- Frequency: not available",
    pc.campaignRoas != null
      ? `- ROAS: ${pc.campaignRoas.toFixed(2)}x (CRM, 7-day attribution) ${pc.campaignRoas < 1.0 ? "— NEGATIVE ROI" : pc.campaignRoas < 1.5 ? "— below comfortable threshold" : "— acceptable"}`
      : "- ROAS: pending CRM reconciliation",
    ...(pc.campaignCpa != null ? [`- CPA: $${pc.campaignCpa.toFixed(2)} (CRM-verified)`] : []),
    `- Fatigue status: ${pc.fatigueStatus ?? "not assessed"}`,
    `- Evaluation status: ${pc.evaluationStatus}`,
  ];

  return lines.join("\n");
}

function buildCurrentCreativeBlock(pc: CreativeBriefInput): string {
  const lines: string[] = ["CURRENT CREATIVE (being refreshed):"];
  if (pc.adCopy) {
    lines.push(`- Copy: "${pc.adCopy.slice(0, 300)}${pc.adCopy.length > 300 ? "…" : ""}"`);
  } else {
    lines.push("- Copy: not available");
  }
  if (pc.callToAction) {
    lines.push(`- CTA: "${pc.callToAction}"`);
  }
  if (pc.thumbnailUrl) {
    lines.push(`- Has image: yes`);
  }
  return lines.join("\n");
}

function buildDiagnosisBlock(pc: CreativeBriefInput): string {
  const weaknesses = summarizeCreativeWeaknesses(pc);
  const strengths  = summarizeCreativeStrengths(pc);
  return [
    "WHAT IS NOT WORKING:",
    ...weaknesses.map((w) => `- ${w}`),
    "",
    "WHAT TO PRESERVE:",
    ...strengths.map((s) => `- ${s}`),
  ].join("\n");
}

function buildConstraintsBlock(input: CreativeGenerationInput): string {
  if (input.constraints.length === 0) return "";
  return [
    "CONSTRAINTS:",
    ...input.constraints.map((c) => `- [${c.type}] ${c.value} (${c.reason})`),
  ].join("\n");
}

function buildBriefDirectionBlock(input: CreativeGenerationInput): string {
  const directionSection = input.brief.sections.find((s) => s.key === "direction");
  const intentSection    = input.brief.sections.find((s) => s.key === "intent");
  const lines: string[] = [];
  if (intentSection) {
    lines.push(`STRATEGIC INTENT: ${intentSection.content.split("\n")[0].replace(/\*\*/g, "")}`);
  }
  if (directionSection) {
    lines.push("", "CREATIVE DIRECTION:", directionSection.content.replace(/\*\*/g, "").replace(/^- /gm, "• "));
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Copy variations prompt
// ---------------------------------------------------------------------------

export function buildCopyVariationsPrompt(input: CreativeGenerationInput): { system: string; user: string } {
  const pc = input.brief.input;

  const user = [
    `CLIENT: ${pc.clientName}`,
    pc.campaignName ? `CAMPAIGN: ${pc.campaignName}` : null,
    pc.creativeName ? `CREATIVE: ${pc.creativeName}` : null,
    "",
    buildPerformanceBlock(pc),
    "",
    buildCurrentCreativeBlock(pc),
    "",
    buildDiagnosisBlock(pc),
    "",
    buildBriefDirectionBlock(input),
    buildConstraintsBlock(input) ? `\n${buildConstraintsBlock(input)}` : "",
    `
Generate exactly 3 primary text variations. Each must use a DIFFERENT angle:
1. "outcome_led"  — open with the result/outcome the customer most desires
2. "problem_first" — name the specific pain before presenting the solution
3. "social_proof"  — open with a credibility signal, testimonial framing, or community validation

Requirements for EACH variation:
- hook: 1–2 sentences, scroll-stopping, ≤ 40 words. Must NOT start with the same word as the other hooks.
- body: 2–4 sentences, benefit-focused, ≤ 80 words
- callToAction: 3–7 words, action-oriented verb phrase
- Title must include the angle name and a descriptive suffix

Respond ONLY with this JSON (no text outside the array):
[
  {"title": "Variation A — Outcome-Led Hook", "hook": "...", "body": "...", "callToAction": "..."},
  {"title": "Variation B — Problem-First Hook", "hook": "...", "body": "...", "callToAction": "..."},
  {"title": "Variation C — Social Proof Hook", "hook": "...", "body": "...", "callToAction": "..."}
]`,
  ].filter((l) => l !== null).join("\n");

  return { system: GENERATION_SYSTEM_PROMPT, user };
}

// ---------------------------------------------------------------------------
// Headline variations prompt
// ---------------------------------------------------------------------------

export function buildHeadlineVariationsPrompt(input: CreativeGenerationInput): { system: string; user: string } {
  const pc = input.brief.input;

  const user = [
    `CLIENT: ${pc.clientName}`,
    pc.campaignName ? `CAMPAIGN: ${pc.campaignName}` : null,
    "",
    buildPerformanceBlock(pc),
    "",
    buildCurrentCreativeBlock(pc),
    "",
    buildDiagnosisBlock(pc),
    "",
    buildBriefDirectionBlock(input),
    `
Generate exactly 3 headline variations. Each headline is a standalone scroll-stopping first line.

Requirements for EACH headline:
- 1 sentence only, ≤ 15 words
- Must stop the scroll in the first 3 words
- Each must open with a DIFFERENT word
- Types: question / bold claim / curiosity gap (one of each)

Respond ONLY with this JSON:
[
  {"title": "Headline A — Question", "hook": "...", "callToAction": "${pc.callToAction ?? "Learn More"}"},
  {"title": "Headline B — Bold Claim", "hook": "...", "callToAction": "${pc.callToAction ?? "Learn More"}"},
  {"title": "Headline C — Curiosity Gap", "hook": "...", "callToAction": "${pc.callToAction ?? "Learn More"}"}
]`,
  ].filter((l) => l !== null).join("\n");

  return { system: GENERATION_SYSTEM_PROMPT, user };
}

// ---------------------------------------------------------------------------
// Angle variations prompt
// ---------------------------------------------------------------------------

export function buildAngleVariationsPrompt(input: CreativeGenerationInput): { system: string; user: string } {
  const pc = input.brief.input;

  const user = [
    `CLIENT: ${pc.clientName}`,
    pc.campaignName ? `CAMPAIGN: ${pc.campaignName}` : null,
    "",
    buildPerformanceBlock(pc),
    "",
    buildCurrentCreativeBlock(pc),
    "",
    buildDiagnosisBlock(pc),
    "",
    buildBriefDirectionBlock(input),
    `
Generate exactly 3 full message angle variations. Each takes a completely different positioning approach.

Angle types:
1. "identity"  — connect the offer to who the customer aspires to BE, not just what they want to DO
2. "fear_of_loss" — frame around what they risk losing by NOT acting (without being manipulative)
3. "authority" — position with expertise, results data, or insider knowledge framing

Requirements for EACH angle:
- hook: 1–2 sentences, ≤ 40 words, must NOT start the same as other hooks
- body: 3–5 sentences, angle-consistent throughout, ≤ 100 words
- callToAction: 3–7 words

Respond ONLY with this JSON:
[
  {"title": "Angle A — Identity Positioning", "hook": "...", "body": "...", "callToAction": "..."},
  {"title": "Angle B — Fear of Loss", "hook": "...", "body": "...", "callToAction": "..."},
  {"title": "Angle C — Authority / Proof", "hook": "...", "body": "...", "callToAction": "..."}
]`,
  ].filter((l) => l !== null).join("\n");

  return { system: GENERATION_SYSTEM_PROMPT, user };
}

// ---------------------------------------------------------------------------
// Image brief variations prompt
// ---------------------------------------------------------------------------

export function buildImageBriefVariationsPrompt(input: CreativeGenerationInput): { system: string; user: string } {
  const pc = input.brief.input;

  const user = [
    `CLIENT: ${pc.clientName}`,
    pc.campaignName ? `CAMPAIGN: ${pc.campaignName}` : null,
    "",
    buildPerformanceBlock(pc),
    "",
    buildCurrentCreativeBlock(pc),
    "",
    buildDiagnosisBlock(pc),
    "",
    buildBriefDirectionBlock(input),
    `
Generate exactly 3 image concept briefs for a Meta feed ad creative.

Concept types:
1. "clean_focus" — single hero subject, minimal text, maximum clarity — communicates value in < 0.3 seconds
2. "proof_led"   — shows a result, metric, customer moment, or before/after — builds instant credibility
3. "contrast_frame" — engineered eye path: foreground subject → benefit text → CTA — high visual contrast

Requirements for EACH concept:
- conceptSummary: 2–3 sentences describing the image in enough detail for a designer to execute it
- visualChanges: 1–2 sentences describing what changes from the current creative
- goal: 1 sentence — what this image is designed to do (scroll-stop / build trust / drive click)
- directResponseAngle: 1 sentence — how the image supports the offer and message

Respond ONLY with this JSON:
[
  {"title": "Concept A — Clean Focus", "conceptSummary": "...", "visualChanges": "...", "goal": "...", "directResponseAngle": "..."},
  {"title": "Concept B — Proof-Led Visual", "conceptSummary": "...", "visualChanges": "...", "goal": "...", "directResponseAngle": "..."},
  {"title": "Concept C — Contrast Frame", "conceptSummary": "...", "visualChanges": "...", "goal": "...", "directResponseAngle": "..."}
]`,
  ].filter((l) => l !== null).join("\n");

  return { system: GENERATION_SYSTEM_PROMPT, user };
}

// ---------------------------------------------------------------------------
// Full refresh package prompt
// ---------------------------------------------------------------------------

export function buildFullRefreshPackagePrompt(input: CreativeGenerationInput): { system: string; user: string } {
  const pc = input.brief.input;

  const user = [
    `CLIENT: ${pc.clientName}`,
    pc.campaignName ? `CAMPAIGN: ${pc.campaignName}` : null,
    "",
    buildPerformanceBlock(pc),
    "",
    buildCurrentCreativeBlock(pc),
    "",
    buildDiagnosisBlock(pc),
    "",
    buildBriefDirectionBlock(input),
    buildConstraintsBlock(input) ? `\n${buildConstraintsBlock(input)}` : "",
    `
Generate a complete creative refresh package: 3 copy variations AND 3 image concept briefs.

This creative needs a full reset. Generate all 6 outputs as a cohesive set where each copy variation
is paired with a compatible image direction.

Copy variations (variantType: "copy"):
1. Outcome-led hook + compatible image brief
2. Problem-first hook + compatible image brief
3. Social proof hook + compatible image brief

For copy variants include: hook (≤ 40 words), body (≤ 80 words), callToAction (3–7 words)
For image variants include: conceptSummary, visualChanges, goal, directResponseAngle

Respond ONLY with this JSON array (6 items total — 3 copy then 3 image):
[
  {"title": "Copy A — Outcome-Led", "variantType": "copy", "hook": "...", "body": "...", "callToAction": "..."},
  {"title": "Copy B — Problem-First", "variantType": "copy", "hook": "...", "body": "...", "callToAction": "..."},
  {"title": "Copy C — Social Proof", "variantType": "copy", "hook": "...", "body": "...", "callToAction": "..."},
  {"title": "Image A — Outcome Visual", "variantType": "image", "conceptSummary": "...", "visualChanges": "...", "goal": "...", "directResponseAngle": "..."},
  {"title": "Image B — Proof Visual", "variantType": "image", "conceptSummary": "...", "visualChanges": "...", "goal": "...", "directResponseAngle": "..."},
  {"title": "Image C — Contrast Visual", "variantType": "image", "conceptSummary": "...", "visualChanges": "...", "goal": "...", "directResponseAngle": "..."}
]`,
  ].filter((l) => l !== null).join("\n");

  return { system: GENERATION_SYSTEM_PROMPT, user };
}

// ---------------------------------------------------------------------------
// Mode → prompt builder dispatcher
// ---------------------------------------------------------------------------

export function buildPromptForMode(input: CreativeGenerationInput): { system: string; user: string } {
  switch (input.mode) {
    case "copy_variations":        return buildCopyVariationsPrompt(input);
    case "headline_variations":    return buildHeadlineVariationsPrompt(input);
    case "angle_variations":       return buildAngleVariationsPrompt(input);
    case "image_brief_variations": return buildImageBriefVariationsPrompt(input);
    case "full_refresh_package":   return buildFullRefreshPackagePrompt(input);
    default: {
      // TypeScript exhaustive check — should never happen
      const _m: never = input.mode;
      return buildCopyVariationsPrompt(input);
    }
  }
}
