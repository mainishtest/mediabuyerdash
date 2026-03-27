// Mock Generation Pipeline Types
//
// Orchestration models for the end-to-end mock generation flow.
// Kept separate from diagnosis, assembly, rendering, formatting, and parsing.

import type {
  CopyVariation,
  ImageVariationConcept,
  CreativeLabEntry
} from "./creativeDiagnosis";
import type { ProviderAdapterType } from "./providerFormat";

// ── Pipeline step ────────────────────────────────────────────────────────────

export type MockGenerationPipelineStep =
  | "diagnosis"
  | "input_assembly"
  | "prompt_render"
  | "provider_format"
  | "mock_provider_response"
  | "response_parse"
  | "approval_ready_output";

// ── Execution status ──────────────────────────────────────────────────────────

export type PipelineExecutionStatus =
  | "idle"
  | "running"
  | "completed"
  | "failed"
  | "partial";

// ── Step result ──────────────────────────────────────────────────────────────

export interface PipelineStepResult {
  step:       MockGenerationPipelineStep;
  status:     "ok" | "skipped" | "failed";
  output?:    unknown;
  error?:     string;
}

// ── Errors and warnings ──────────────────────────────────────────────────────

export type PipelineError = string;
export type PipelineWarning = string;

// ── Pipeline input ───────────────────────────────────────────────────────────

export interface MockGenerationPipelineInput {
  entry:         CreativeLabEntry;
  requestType:   "copy_generation" | "image_variation_generation";
  provider:      ProviderAdapterType;
}

// ── Pipeline result ───────────────────────────────────────────────────────────

export interface MockGenerationPipelineResult {
  requestType:   "copy_generation" | "image_variation_generation";
  provider:      ProviderAdapterType;
  status:        PipelineExecutionStatus;
  stepResults:   PipelineStepResult[];
  copyOutput?:   CopyVariation[];
  imageOutput?:  ImageVariationConcept[];
  warnings:      PipelineWarning[];
  errors:        PipelineError[];
  trace:         {
    diagnosis?:   unknown;
    assembledContext?: unknown;
    renderedPrompt?: string;
    formattedPayload?: unknown;
    rawMockResponse?: unknown;
    parsedOutput?: unknown;
  };
}
