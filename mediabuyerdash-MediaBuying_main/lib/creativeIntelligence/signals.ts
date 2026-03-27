// Creative Signal Extraction
//
// Deterministic, keyword-based tagging of creative content.
// No AI — designed to be augmented or replaced with AI tagging later.
// All functions are pure and side-effect-free.

import type { CreativeSignal, CreativePatternType } from "../../types/creativeIntelligence";

// ── Input types ────────────────────────────────────────────────────────────────

export interface RawCopyInput {
  id:               string;
  title:            string;
  hook?:            string | null;
  body?:            string | null;
  callToAction?:    string | null;
  clientAccountId?: string | null;
  campaignId?:      string | null;
}

export interface RawImageInput {
  id:               string;
  title:            string;
  conceptSummary?:  string | null;
  visualChanges?:   string | null;
  goal?:            string | null;
  clientAccountId?: string | null;
  campaignId?:      string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function lc(s?: string | null): string {
  return (s ?? "").toLowerCase();
}

function signal(
  sourceType: CreativeSignal["sourceType"],
  sourceId:   string,
  patternType: CreativePatternType,
  patternLabel: string,
  meta: { clientAccountId?: string | null; campaignId?: string | null }
): CreativeSignal {
  return {
    id:               `${sourceId}:${patternType}`,
    sourceType,
    sourceId,
    clientAccountId:  meta.clientAccountId ?? undefined,
    campaignId:       meta.campaignId ?? undefined,
    patternType,
    patternLabel,
    createdAt: new Date(),
  };
}

// ── Detectors ─────────────────────────────────────────────────────────────────

function detectHookType(hook: string): string {
  const h = lc(hook);
  if (h.endsWith("?") || /^(why|what|how|are|do|did|have|is|can)\b/.test(h))
    return "question_hook";
  if (/\b(stop|urgent|today only|limited|last chance|hurry|expires)\b/.test(h))
    return "urgency_hook";
  if (/\b(imagine|picture this|when i|after years|once|story)\b/.test(h))
    return "story_hook";
  if (/(\d+\s?%|\d+ out of|research shows|studies show|\d+ people)/.test(h))
    return "stat_hook";
  if (/\b(tired|frustrated|struggling|sick of|hate|problem|mistake)\b/.test(h))
    return "pain_hook";
  if (/\b(transform|become|achieve|finally|went from|results in)\b/.test(h))
    return "transformation_hook";
  return "direct_hook";
}

function detectCTAType(cta: string): string {
  const c = lc(cta);
  if (/\b(shop|buy|order|purchase)\b/.test(c))             return "shop_cta";
  if (/\b(learn|discover|find out|see how)\b/.test(c))      return "learn_cta";
  if (/\b(try|test|get started|start free)\b/.test(c))      return "try_cta";
  if (/\b(claim|unlock|grab|get your|take advantage)\b/.test(c)) return "claim_cta";
  if (/\b(book|schedule|reserve)\b/.test(c))                return "book_cta";
  if (/\bfree\b/.test(c))                                   return "free_offer_cta";
  return "generic_cta";
}

function detectBodyAngle(body: string): string {
  const b = lc(body);
  if (/\b(problem|solve|fix|solution|struggle|issue)\b/.test(b))              return "problem_solution";
  if (/\b(customers|reviews|trusted|thousands|people love|testimonial)\b/.test(b)) return "social_proof";
  if (/\b(limited|don.t wait|expires|today only|hurry)\b/.test(b))            return "urgency";
  if (/\b(before|after|changed|results|transformed|journey)\b/.test(b))       return "transformation";
  if (/\b(feel|love|heart|family|happiness|joy|emotion)\b/.test(b))           return "emotional";
  return "direct_benefit";
}

function detectVisualStyle(summary: string, changes?: string | null): string {
  const t = lc(summary) + " " + lc(changes);
  if (/\b(ugc|user.generated|authentic|real person|selfie|phone.shot)\b/.test(t))
    return "ugc_style";
  if (/\b(testimonial|quote|review|person speaking|talking head)\b/.test(t))
    return "testimonial_style";
  if (/\b(before.after|comparison|transformation|split)\b/.test(t))
    return "before_after";
  if (/\b(text overlay|headline|bold text|copy.heavy)\b/.test(t))
    return "text_focused";
  if (/\b(lifestyle|scene|setting|in.use|in the)\b/.test(t))
    return "lifestyle";
  if (/\b(product|close.up|showcase|detail|feature|ingredient)\b/.test(t))
    return "product_focused";
  if (/\b(clean|minimal|white|simple|elegant)\b/.test(t))
    return "minimalist";
  return "general_visual";
}

// ── Public API ────────────────────────────────────────────────────────────────

export function extractCopySignals(inputs: RawCopyInput[]): CreativeSignal[] {
  const out: CreativeSignal[] = [];
  for (const v of inputs) {
    if (v.hook)          out.push(signal("generated_copy", v.id, "hook_type",   detectHookType(v.hook),   v));
    if (v.callToAction)  out.push(signal("generated_copy", v.id, "cta_type",    detectCTAType(v.callToAction), v));
    if (v.body)          out.push(signal("generated_copy", v.id, "body_angle",  detectBodyAngle(v.body),  v));
  }
  return out;
}

export function extractImageSignals(inputs: RawImageInput[]): CreativeSignal[] {
  const out: CreativeSignal[] = [];
  for (const v of inputs) {
    if (v.conceptSummary)
      out.push(signal("generated_image", v.id, "visual_style", detectVisualStyle(v.conceptSummary, v.visualChanges), v));
  }
  return out;
}

export function extractCreativeSignals(
  copyInputs:  RawCopyInput[],
  imageInputs: RawImageInput[]
): CreativeSignal[] {
  return [...extractCopySignals(copyInputs), ...extractImageSignals(imageInputs)];
}
