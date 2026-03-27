// Provider Response Parsing Types
//
// Typed models for converting provider-specific response payloads into
// normalized internal variation models. Kept separate from formatting
// adapters and provider execution.

import type { CopyVariation, ImageVariationConcept } from "./creativeDiagnosis";

// ── Provider response type ────────────────────────────────────────────────────

export type ProviderResponseType =
  | "openai_text_response"
  | "anthropic_text_response"
  | "image_provider_placeholder_response";

// ── Parse input ──────────────────────────────────────────────────────────────

export interface ProviderParseInput {
  provider:       ProviderResponseType;
  requestType:     "copy_generation" | "image_variation_generation";
  rawResponse:     unknown;
  requestMetadata?: {
    adId?:       string;
    campaignId?: string;
  };
}

// ── Parse result ─────────────────────────────────────────────────────────────

export type ProviderParseWarning = string;
export type ProviderParseError = string;

export interface CopyVariationParseResult {
  variations: CopyVariation[];
}

export interface ImageVariationParseResult {
  concepts: ImageVariationConcept[];
}

export interface ProviderParseResult {
  provider:     ProviderResponseType;
  requestType:  "copy_generation" | "image_variation_generation";
  copyResult?:  CopyVariationParseResult;
  imageResult?: ImageVariationParseResult;
  warnings:     ProviderParseWarning[];
  errors:       ProviderParseError[];
  readiness:     boolean;
  rawPreview:   string;
}

// ── UI preview ───────────────────────────────────────────────────────────────

export interface ParsedVariationPreview {
  provider:     ProviderResponseType;
  requestType:  "copy_generation" | "image_variation_generation";
  variations:   CopyVariation[] | ImageVariationConcept[];
  warnings:     ProviderParseWarning[];
  errors:       ProviderParseError[];
  readiness:    boolean;
  rawPreview:   string;
}
