// Provider Formatting Adapter Types
//
// Typed models for converting internal rendered prompts into provider-specific
// request payload shapes. Kept separate from prompt templates and provider execution.

import type { PromptRenderResult } from "./promptTemplate";
import type { CopyGenerationContext, ImageGenerationContext } from "./promptAssembly";

// ── Provider adapter types ────────────────────────────────────────────────────

export type ProviderAdapterType =
  | "openai_text"
  | "anthropic_text"
  | "image_provider_placeholder";

// ── Request type ──────────────────────────────────────────────────────────────

export type ProviderRequestType =
  | "copy_generation"
  | "image_variation_generation";

// ── Format input ──────────────────────────────────────────────────────────────

export interface ProviderFormatInput {
  renderResult:  PromptRenderResult;
  context:       CopyGenerationContext | ImageGenerationContext;
  providerTarget: ProviderAdapterType;
  requestType:   ProviderRequestType;
}

// ── Provider payload shapes ────────────────────────────────────────────────────

/** OpenAI-style text generation payload */
export interface OpenAICopyPayload {
  model:       string;
  messages:    Array<{ role: "system" | "user"; content: string }>;
  temperature: number;
}

/** Anthropic-style text generation payload */
export interface AnthropicCopyPayload {
  model:      string;
  system:     string;
  messages:   Array<{ role: "user"; content: string }>;
  max_tokens: number;
}

export type CopyProviderPayload = OpenAICopyPayload | AnthropicCopyPayload;

export interface ImageProviderPayload {
  prompt:         string;
  styleGuidance:  string;
  variationCount: number;
  metadata:       {
    adId:       string;
    campaignId:  string;
    requestType: string;
  };
}

// ── Format result ─────────────────────────────────────────────────────────────

export type ProviderFormatWarning = string;

export interface ProviderFormatResult {
  provider:      ProviderAdapterType;
  requestType:   ProviderRequestType;
  payload:       CopyProviderPayload | ImageProviderPayload;
  warnings:      ProviderFormatWarning[];
  readiness:     boolean;
  missingFields: string[];
}

// ── UI preview ───────────────────────────────────────────────────────────────

export interface ProviderPayloadPreview {
  provider:      ProviderAdapterType;
  requestType:   ProviderRequestType;
  internalPrompt: string;
  payloadJson:   string;
  readiness:     boolean;
  warnings:      ProviderFormatWarning[];
  missingFields: string[];
}
