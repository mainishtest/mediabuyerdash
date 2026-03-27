// Provider Execution Types
//
// Typed models for real provider API execution. Kept separate from
// formatting adapters and response parsing.

import type { ProviderAdapterType } from "./providerFormat";
import type { OpenAICopyPayload, AnthropicCopyPayload, ImageProviderPayload } from "./providerFormat";

// ── Execution status ──────────────────────────────────────────────────────────

export type ProviderExecutionStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "rate_limited";

// ── Errors and metadata ────────────────────────────────────────────────────────

export type ProviderExecutionError = string;

export interface ProviderRateLimitInfo {
  retryAfter?: number;
  limit?:     string;
  remaining?: number;
}

export interface ProviderExecutionMetadata {
  model?:        string;
  usage?:        { prompt_tokens?: number; completion_tokens?: number };
  rateLimit?:    ProviderRateLimitInfo;
  latencyMs?:    number;
}

// ── Execution input ────────────────────────────────────────────────────────────

export interface ProviderExecutionInput {
  provider:       ProviderAdapterType;
  requestType:    "copy_generation" | "image_variation_generation";
  payload:        OpenAICopyPayload | AnthropicCopyPayload | ImageProviderPayload;
  requestMetadata?: {
    adId?:       string;
    campaignId?: string;
  };
}

// ── Execution result ──────────────────────────────────────────────────────────

export interface ProviderExecutionResult {
  provider:     ProviderAdapterType;
  requestType:  "copy_generation" | "image_variation_generation";
  status:       ProviderExecutionStatus;
  rawResponse:  unknown;
  metadata:     ProviderExecutionMetadata;
  warnings:     string[];
  errors:       ProviderExecutionError[];
}
