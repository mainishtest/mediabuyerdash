// Prompt Render Utilities
//
// Renders prompt templates with assembled AI context. Kept separate from
// template definitions and provider contracts. Pure functions only.

import type { CopyGenerationContext, ImageGenerationContext } from "../types/promptAssembly";
import type {
  CopyPromptTemplate,
  ImagePromptTemplate,
  PromptRenderResult
} from "../types/promptTemplate";

// ── Flatten context for substitution ──────────────────────────────────────────

function flatten(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && value !== undefined && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      Object.assign(result, flatten(value as Record<string, unknown>, path));
    } else {
      result[path] = value == null ? "N/A" : String(value);
    }
  }
  return result;
}

// ── Substitute placeholders ────────────────────────────────────────────────────

function substitute(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const trimmed = key.trim();
    return values[trimmed] ?? `{{${trimmed}}}`;
  });
}

// ── Validate required fields for rendering ────────────────────────────────────

const COPY_REQUIRED_FIELDS = [
  "creative.currentHook",
  "creative.currentBody",
  "creative.currentCallToAction",
  "diagnosis.shortReason",
  "diagnosis.recommendationSummary"
];

const IMAGE_REQUIRED_FIELDS = [
  "creative.imageHeadline",
  "creative.imageStyle",
  "creative.dominantMessage",
  "creative.visualTheme",
  "diagnosis.shortReason",
  "diagnosis.recommendationSummary"
];

function getMissingFields(
  flat: Record<string, string>,
  required: string[]
): string[] {
  return required.filter((f) => {
    const v = flat[f];
    return !v || v === "N/A" || v.trim() === "";
  });
}

// ── Render template sections ──────────────────────────────────────────────────

function renderSections(
  sections: Record<string, string>,
  values: Record<string, string>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [name, text] of Object.entries(sections)) {
    result[name] = substitute(text, values);
  }
  return result;
}

// ── Build full prompt from sections ───────────────────────────────────────────

function buildFullPrompt(renderedSections: Record<string, string>): string {
  const order = Object.keys(renderedSections);
  return order
    .map((k) => `## ${k}\n\n${renderedSections[k]}`)
    .join("\n\n---\n\n");
}

// ── Public render functions ───────────────────────────────────────────────────

export function renderCopyPrompt(
  template: CopyPromptTemplate,
  context: CopyGenerationContext
): PromptRenderResult {
  const flat = flatten(context as unknown as Record<string, unknown>);
  const missing = getMissingFields(flat, COPY_REQUIRED_FIELDS);
  const warnings: string[] = [];

  if (missing.length > 0) {
    warnings.push(`Missing fields for optimal rendering: ${missing.join(", ")}`);
  }

  const renderedSections = renderSections(template.sections, flat);
  const fullPrompt = buildFullPrompt(renderedSections);

  return {
    renderedSections,
    fullPrompt,
    templateMetadata: template.metadata,
    templateVersion: template.version.version,
    warnings,
    missingFields: missing
  };
}

export function renderImagePrompt(
  template: ImagePromptTemplate,
  context: ImageGenerationContext
): PromptRenderResult {
  const flat = flatten(context as unknown as Record<string, unknown>);
  const missing = getMissingFields(flat, IMAGE_REQUIRED_FIELDS);
  const warnings: string[] = [];

  if (missing.length > 0) {
    warnings.push(`Missing fields for optimal rendering: ${missing.join(", ")}`);
  }

  const renderedSections = renderSections(template.sections, flat);
  const fullPrompt = buildFullPrompt(renderedSections);

  return {
    renderedSections,
    fullPrompt,
    templateMetadata: template.metadata,
    templateVersion: template.version.version,
    warnings,
    missingFields: missing
  };
}
