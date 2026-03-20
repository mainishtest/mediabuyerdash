// types/creativeGeneration.ts
// Typed models for the Performance-Driven AI Creative Generation Engine.
//
// Design rules:
//   - Pure TypeScript — no imports from lib/ to avoid circular deps.
//   - Generation is separate from brief assembly (lib/creativeBrief/).
//   - Generation engine (lib/creativeGeneration/) is separate from the UI.
//   - CRM is the source of truth for ROAS/CPA throughout.

import type { CreativeBrief, CreativeDraftVariant } from "./creativeBrief";

// ---------------------------------------------------------------------------
// Asset type — what kind of asset a single generated output represents
// ---------------------------------------------------------------------------

export type CreativeDraftAssetType =
  | "primary_text"   // Facebook/Instagram primary text field
  | "headline"       // Short headline / hook only
  | "angle"          // Full copy with new message angle
  | "image_brief"    // Structured image concept brief for a designer
  | "full_concept";  // Unified brief: hook + image direction + copy angle

// ---------------------------------------------------------------------------
// Generation mode — which generation action was requested
// ---------------------------------------------------------------------------

export type CreativeGenerationMode =
  | "copy_variations"         // 3 new primary text variations (hook + body + CTA)
  | "headline_variations"     // 3 new headlines only
  | "angle_variations"        // 3 new message angles with full copy
  | "image_brief_variations"  // 3 new image concept briefs
  | "full_refresh_package";   // 3 copy + 3 image brief variants (6 total)

// ---------------------------------------------------------------------------
// Generation constraint — a guardrail applied to the generation prompt
// ---------------------------------------------------------------------------

export type CreativeGenerationConstraint = {
  type:   string;  // "brand_voice" | "char_limit" | "platform" | "compliance" | "offer"
  value:  string;
  reason: string;
};

// ---------------------------------------------------------------------------
// Generation input — all context passed to the generation engine
// ---------------------------------------------------------------------------

export type CreativeGenerationInput = {
  // Identity
  briefId:     string;
  mode:        CreativeGenerationMode;

  // Full brief document (contains input, sections, existing draft set)
  brief:       CreativeBrief;

  // Optional constraints from brand/compliance context
  constraints: CreativeGenerationConstraint[];

  // If true, replace existing AI-generated variants for this mode
  regenerate:  boolean;
};

// ---------------------------------------------------------------------------
// Generation output — what the engine returns on success
// ---------------------------------------------------------------------------

export type CreativeGenerationOutput = {
  jobId:       string;
  mode:        CreativeGenerationMode;
  provider:    string;   // "anthropic_text" | "mock"
  rationale:   string;   // human-readable explanation of approach taken
  variants:    CreativeDraftVariant[];
  tokensUsed:  number | null;
  latencyMs:   number | null;
  generatedAt: string;   // ISO string
};

// ---------------------------------------------------------------------------
// Generation job — persisted record of one generation run
// ---------------------------------------------------------------------------

export type CreativeGenerationJob = {
  id:           string;
  briefId:      string;
  mode:         CreativeGenerationMode;
  provider:     string;
  status:       "running" | "completed" | "failed";
  variantCount: number;
  tokensUsed:   number | null;
  latencyMs:    number | null;
  errorMessage: string | null;
  createdAt:    string;   // ISO string
  completedAt:  string | null;
};

// ---------------------------------------------------------------------------
// Generation error — structured failure information
// ---------------------------------------------------------------------------

export type CreativeGenerationError = {
  code:      string;    // "provider_not_configured" | "api_error" | "parse_error" | "partial_output" | "unsupported_mode"
  message:   string;
  retryable: boolean;
};

// ---------------------------------------------------------------------------
// Generation result — the union return type from the engine
// ---------------------------------------------------------------------------

export type CreativeGenerationResult =
  | { ok: true;  output: CreativeGenerationOutput }
  | { ok: false; error:  CreativeGenerationError; partialOutput?: CreativeGenerationOutput };

// ---------------------------------------------------------------------------
// Generation summary — aggregate counts for the generation history panel
// ---------------------------------------------------------------------------

export type CreativeGenerationSummary = {
  totalRuns:        number;
  totalVariants:    number;
  approvedVariants: number;
  lastRunAt:        string | null;   // ISO string
  lastProvider:     string | null;
};

// ---------------------------------------------------------------------------
// Mode display metadata — used by UI to render mode selector
// ---------------------------------------------------------------------------

export type CreativeGenerationModeInfo = {
  mode:        CreativeGenerationMode;
  label:       string;
  description: string;
  outputCount: number;   // how many variants this mode generates
  assetTypes:  CreativeDraftAssetType[];
};

export const GENERATION_MODE_INFO: Record<CreativeGenerationMode, CreativeGenerationModeInfo> = {
  copy_variations: {
    mode:        "copy_variations",
    label:       "Copy Variations",
    description: "3 new primary text variations — each with a distinct hook, body, and CTA",
    outputCount: 3,
    assetTypes:  ["primary_text"],
  },
  headline_variations: {
    mode:        "headline_variations",
    label:       "Headline Variations",
    description: "3 new headlines — scroll-stopping first lines to test against the current hook",
    outputCount: 3,
    assetTypes:  ["headline"],
  },
  angle_variations: {
    mode:        "angle_variations",
    label:       "Angle Variations",
    description: "3 new message angles — full copy rethink with distinct positioning",
    outputCount: 3,
    assetTypes:  ["angle"],
  },
  image_brief_variations: {
    mode:        "image_brief_variations",
    label:       "Image Briefs",
    description: "3 image concept briefs — structured direction for a designer or image tool",
    outputCount: 3,
    assetTypes:  ["image_brief"],
  },
  full_refresh_package: {
    mode:        "full_refresh_package",
    label:       "Full Refresh Package",
    description: "3 copy variations + 3 image briefs — complete creative replacement set",
    outputCount: 6,
    assetTypes:  ["primary_text", "image_brief"],
  },
};
