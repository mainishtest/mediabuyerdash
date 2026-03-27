// Provider Response Parsers
//
// Converts provider-specific response payloads into normalized internal
// CopyVariation and ImageVariationConcept models. Pure functions only.

import type { CopyVariation, ImageVariationConcept } from "../../types/creativeDiagnosis";
import type {
  ProviderResponseType,
  ProviderParseResult,
  ProviderParseWarning,
  ProviderParseError,
  ParsedVariationPreview
} from "../../types/providerParse";

// ── Validation helpers ───────────────────────────────────────────────────────

function safeJsonParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

function ensureId(v: unknown, index: number, prefix: string): string {
  if (typeof v === "string" && v.trim()) return v.trim();
  return `${prefix}_${index + 1}`;
}

function ensureString(v: unknown, defaultVal: string): string {
  if (typeof v === "string" && v.trim()) return v.trim();
  return defaultVal;
}

// ── Copy variation validation ──────────────────────────────────────────────────

function parseCopyVariation(raw: unknown, index: number): CopyVariation | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const hook = ensureString(o.hook, "");
  const body = ensureString(o.body, "");
  const cta = ensureString(o.callToAction, "");
  if (!hook || !body || !cta) return null;
  return {
    id:           ensureId(o.id, index, "cv"),
    title:        ensureString(o.title, `Variation ${index + 1}`),
    hook,
    body,
    callToAction: cta
  };
}

// ── Image concept validation ──────────────────────────────────────────────────

function parseImageConcept(raw: unknown, index: number): ImageVariationConcept | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const conceptSummary = ensureString(o.conceptSummary, "");
  const visualChanges = ensureString(o.visualChanges, "");
  const goal = ensureString(o.goal, "");
  if (!conceptSummary || !visualChanges || !goal) return null;
  return {
    id:             ensureId(o.id, index, "iv"),
    title:         ensureString(o.title, `Concept ${index + 1}`),
    conceptSummary,
    visualChanges,
    goal
  };
}

// ── OpenAI copy parser ───────────────────────────────────────────────────────

export function parseOpenAICopyResponse(raw: unknown): ProviderParseResult {
  const warnings: ProviderParseWarning[] = [];
  const errors: ProviderParseError[] = [];
  const rawPreview = JSON.stringify(raw, null, 2);

  if (!raw || typeof raw !== "object") {
    errors.push("Raw response is not an object");
    return {
      provider:     "openai_text_response",
      requestType:  "copy_generation",
      warnings,
      errors,
      readiness:    false,
      rawPreview
    };
  }

  const obj = raw as Record<string, unknown>;
  const choices = obj.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    errors.push("Missing or empty choices array");
    return {
      provider:     "openai_text_response",
      requestType:  "copy_generation",
      warnings,
      errors,
      readiness:    false,
      rawPreview
    };
  }

  const firstChoice = choices[0] as Record<string, unknown>;
  const message = firstChoice?.message as Record<string, unknown> | undefined;
  const content = message?.content;
  if (typeof content !== "string") {
    errors.push("Missing or invalid message content");
    return {
      provider:     "openai_text_response",
      requestType:  "copy_generation",
      warnings,
      errors,
      readiness:    false,
      rawPreview
    };
  }

  const parsed = safeJsonParse<{ variations?: unknown[] }>(content, {});
  const variationsArr = parsed?.variations;
  if (!Array.isArray(variationsArr)) {
    errors.push("Content does not contain variations array");
    return {
      provider:     "openai_text_response",
      requestType:  "copy_generation",
      warnings,
      errors,
      readiness:    false,
      rawPreview
    };
  }

  const variations: CopyVariation[] = [];
  for (let i = 0; i < variationsArr.length; i++) {
    const v = parseCopyVariation(variationsArr[i], i);
    if (v) variations.push(v);
    else warnings.push(`Skipped malformed variation at index ${i}`);
  }

  if (variations.length === 0) {
    errors.push("No valid copy variations parsed");
  }
  if (variations.length < 3 && variationsArr.length >= 3) {
    warnings.push("Fewer than 3 variations parsed; some may have been malformed");
  }

  return {
    provider:     "openai_text_response",
    requestType:  "copy_generation",
    copyResult:   { variations },
    warnings,
    errors,
    readiness:    variations.length > 0 && errors.length === 0,
    rawPreview
  };
}

// ── Anthropic copy parser ────────────────────────────────────────────────────

export function parseAnthropicCopyResponse(raw: unknown): ProviderParseResult {
  const warnings: ProviderParseWarning[] = [];
  const errors: ProviderParseError[] = [];
  const rawPreview = JSON.stringify(raw, null, 2);

  if (!raw || typeof raw !== "object") {
    errors.push("Raw response is not an object");
    return {
      provider:     "anthropic_text_response",
      requestType:  "copy_generation",
      warnings,
      errors,
      readiness:    false,
      rawPreview
    };
  }

  const obj = raw as Record<string, unknown>;
  const contentArr = obj.content;
  if (!Array.isArray(contentArr) || contentArr.length === 0) {
    errors.push("Missing or empty content array");
    return {
      provider:     "anthropic_text_response",
      requestType:  "copy_generation",
      warnings,
      errors,
      readiness:    false,
      rawPreview
    };
  }

  const firstBlock = contentArr[0] as Record<string, unknown>;
  const text = firstBlock?.text;
  if (typeof text !== "string") {
    errors.push("Missing or invalid text in content block");
    return {
      provider:     "anthropic_text_response",
      requestType:  "copy_generation",
      warnings,
      errors,
      readiness:    false,
      rawPreview
    };
  }

  const parsed = safeJsonParse<{ variations?: unknown[] }>(text, {});
  const variationsArr = parsed?.variations;
  if (!Array.isArray(variationsArr)) {
    errors.push("Content does not contain variations array");
    return {
      provider:     "anthropic_text_response",
      requestType:  "copy_generation",
      warnings,
      errors,
      readiness:    false,
      rawPreview
    };
  }

  const variations: CopyVariation[] = [];
  for (let i = 0; i < variationsArr.length; i++) {
    const v = parseCopyVariation(variationsArr[i], i);
    if (v) variations.push(v);
    else warnings.push(`Skipped malformed variation at index ${i}`);
  }

  if (variations.length === 0) {
    errors.push("No valid copy variations parsed");
  }
  if (variations.length < 3 && variationsArr.length >= 3) {
    warnings.push("Fewer than 3 variations parsed; some may have been malformed");
  }

  return {
    provider:     "anthropic_text_response",
    requestType:  "copy_generation",
    copyResult:   { variations },
    warnings,
    errors,
    readiness:    variations.length > 0 && errors.length === 0,
    rawPreview
  };
}

// ── Placeholder image parser ──────────────────────────────────────────────────

export function parsePlaceholderImageResponse(raw: unknown): ProviderParseResult {
  const warnings: ProviderParseWarning[] = [];
  const errors: ProviderParseError[] = [];
  const rawPreview = JSON.stringify(raw, null, 2);

  if (!raw || typeof raw !== "object") {
    errors.push("Raw response is not an object");
    return {
      provider:     "image_provider_placeholder_response",
      requestType:  "image_variation_generation",
      warnings,
      errors,
      readiness:    false,
      rawPreview
    };
  }

  const obj = raw as Record<string, unknown>;
  const conceptsArr = obj.concepts;
  if (!Array.isArray(conceptsArr)) {
    errors.push("Missing or invalid concepts array");
    return {
      provider:     "image_provider_placeholder_response",
      requestType:  "image_variation_generation",
      warnings,
      errors,
      readiness:    false,
      rawPreview
    };
  }

  const concepts: ImageVariationConcept[] = [];
  for (let i = 0; i < conceptsArr.length; i++) {
    const c = parseImageConcept(conceptsArr[i], i);
    if (c) concepts.push(c);
    else warnings.push(`Skipped malformed concept at index ${i}`);
  }

  if (concepts.length === 0) {
    errors.push("No valid image concepts parsed");
  }
  if (concepts.length < 3 && conceptsArr.length >= 3) {
    warnings.push("Fewer than 3 concepts parsed; some may have been malformed");
  }

  return {
    provider:     "image_provider_placeholder_response",
    requestType:  "image_variation_generation",
    imageResult:  { concepts },
    warnings,
    errors,
    readiness:     concepts.length > 0 && errors.length === 0,
    rawPreview
  };
}

// ── Preview helper ───────────────────────────────────────────────────────────

export function toParsedPreview(result: ProviderParseResult): ParsedVariationPreview {
  const variations = result.copyResult?.variations ?? result.imageResult?.concepts ?? [];
  return {
    provider:    result.provider,
    requestType: result.requestType,
    variations,
    warnings:    result.warnings,
    errors:      result.errors,
    readiness:   result.readiness,
    rawPreview:  result.rawPreview
  };
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

export function parseProviderResponse(
  raw: unknown,
  provider: ProviderResponseType,
  requestType: "copy_generation" | "image_variation_generation"
): ProviderParseResult | null {
  if (requestType === "copy_generation") {
    if (provider === "openai_text_response") return parseOpenAICopyResponse(raw);
    if (provider === "anthropic_text_response") return parseAnthropicCopyResponse(raw);
  }
  if (requestType === "image_variation_generation" && provider === "image_provider_placeholder_response") {
    return parsePlaceholderImageResponse(raw);
  }
  return null;
}
