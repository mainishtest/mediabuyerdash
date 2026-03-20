// types/creativeGeneration.ts
// Typed models for the Performance-Driven AI Creative Generation Engine.
//
// Design rules:
//   - Pure TypeScript — no imports from lib/ to avoid circular deps.
//   - Generation is separate from brief assembly (lib/creativeBrief/).
//   - Generation engine (lib/creativeGeneration/) is separate from the UI.
//   - CRM is the source of truth for ROAS/CPA throughout.
//
// Phase 8 additions (performance-driven context engine):
//   - CreativeGenerationRequest  — rich request with trigger context
//   - CreativeGenerationContext  — multi-source context object
//   - PlatformConstraint         — Meta format limits
//   - CreativeAngle              — strategic message positioning
//   - CreativeHook               — scroll-stopping opening line
//   - CreativeCopyBlock          — structured copy block
//   - CreativeConcept            — full concept (hook + copy + image brief)
//   - CreativeVariant            — rich variant with workflow status
//   - CreativeGenerationRunSummary — aggregate run summary

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

// ─── Phase 8: Performance-Driven Creative Generation Engine ──────────────────

// ---------------------------------------------------------------------------
// Rich generation request — includes trigger context and source signals
// ---------------------------------------------------------------------------

export type CreativeGenerationRequest = {
  clientAccountId: string;
  campaignId:      string | null;
  creativeId:      string | null;
  mode:            CreativeGenerationMode;
  triggerType:     "fatigue" | "underperformance" | "opportunity" | "manual";
  triggerContext:  string | null;
  constraints:     CreativeGenerationConstraint[];
  regenerate:      boolean;
};

// ---------------------------------------------------------------------------
// Platform constraint — Meta ad format limits
// ---------------------------------------------------------------------------

export type PlatformConstraint = {
  field:    string;      // "primary_text" | "headline" | "description" | "call_to_action"
  maxChars: number | null;
  maxWords: number | null;
  note:     string;
};

// ---------------------------------------------------------------------------
// Message angle — strategic positioning direction
// ---------------------------------------------------------------------------

export type CreativeAngle = {
  id:               string;
  name:             string;
  type:             "identity" | "outcome" | "problem_first" | "social_proof" | "fear_of_loss" | "authority" | "curiosity";
  rationale:        string;         // why this angle was selected
  performanceSignal: string;        // which performance signal drove the angle choice
};

// ---------------------------------------------------------------------------
// Creative hook — scroll-stopping opening line
// ---------------------------------------------------------------------------

export type CreativeHook = {
  id:        string;
  text:      string;
  type:      "question" | "bold_claim" | "curiosity_gap" | "outcome_led" | "problem_first" | "social_proof";
  angle:     string;      // angle name this hook belongs to
  wordCount: number;
  charCount: number;
};

// ---------------------------------------------------------------------------
// Creative copy block — full structured copy (hook + body + CTA)
// ---------------------------------------------------------------------------

export type CreativeCopyBlock = {
  id:            string;
  hook:          CreativeHook;
  body:          string;
  callToAction:  string;
  angle:         CreativeAngle;
  wordCount:     number;
  platformReady: boolean;   // within Meta primary_text limits
};

// ---------------------------------------------------------------------------
// Creative concept — a complete output unit (angle + copy + optional image)
// ---------------------------------------------------------------------------

export type CreativeConcept = {
  id:                   string;
  title:                string;
  angle:                CreativeAngle;
  copyBlock:            CreativeCopyBlock;
  imageBrief?: {
    conceptSummary:      string;
    visualChanges:       string;
    goal:                string;
    directResponseAngle: string;
  };
  performanceRationale: string;   // why this concept addresses the performance signal
  triggerLink:          string;   // e.g. "CTR 0.42% — hook weakness detected"
  estimatedScore:       number;   // 0–100 estimated output quality
  isVariantOf?:         string;   // parent concept ID if this is a derived variant
};

// ---------------------------------------------------------------------------
// Creative variant — richer variant with workflow status tracking
// ---------------------------------------------------------------------------

export type CreativeVariant = {
  id:          string;
  conceptId:   string;
  variantType: "copy" | "image" | "full_concept";
  title:       string;

  // Copy fields
  hook?:         string;
  body?:         string;
  callToAction?: string;

  // Image brief fields
  conceptSummary?:      string;
  visualChanges?:       string;
  goal?:                string;
  directResponseAngle?: string;

  // Metadata
  angle?:               string;
  performanceRationale?: string;

  // Workflow status
  status:          "generated" | "saved_draft" | "sent_to_scoring" | "sent_to_approval" | "edited";
  reviewDecision?: "approve" | "reject" | "request_revision" | null;
  reviewNote?:     string | null;
  editedCopy?:     string | null;
  generatedAt:     string;   // ISO string
};

// ---------------------------------------------------------------------------
// Generation context — multi-source context built before generation
// ---------------------------------------------------------------------------

export type CreativeGenerationContext = {
  // Identity
  clientAccountId: string;
  clientName:      string;
  campaignId:      string | null;
  campaignName:    string | null;
  creativeId:      string | null;
  creativeName:    string | null;

  // Performance signals (CRM-verified where applicable)
  currentCtr:       number;
  currentFrequency: number | null;
  currentRoas:      number | null;   // CRM-verified — 7-day attribution
  currentCpa:       number | null;   // CRM-verified — 7-day attribution
  currentSpend:     number;
  evaluationStatus: string;          // "fatigued" | "weak" | "strong" | "moderate"
  fatigueStatus:    string | null;

  // Goal context
  roasGoal:        number | null;
  cpaGoal:         number | null;
  primaryGoalType: string | null;

  // Learning memory (from learningMemory module)
  winningPatterns:    string[];   // winning_hook, winning_angle, winning_offer_framing
  losingPatterns:     string[];   // poor_performer_pattern, fatigue_pattern
  audienceInsights:   string[];   // audience_message_fit
  experimentInsights: string[];   // experiment_pattern

  // Current creative content (being refreshed)
  currentCopy:     string | null;
  currentHeadline: string | null;
  currentCta:      string | null;
  hasThumbnail:    boolean;

  // Platform constraints
  platformConstraints: PlatformConstraint[];

  // Trigger information
  triggerType:      "fatigue" | "underperformance" | "opportunity" | "manual";
  triggerRationale: string;

  // Data quality
  builtAt:     string;    // ISO string
  dataQuality: "sparse" | "moderate" | "rich";
};

// ---------------------------------------------------------------------------
// Generation run summary — aggregate stats for the UI run history panel
// ---------------------------------------------------------------------------

export type CreativeGenerationRunSummary = {
  contextClientId:   string;
  contextClientName: string;
  triggerType:       string;
  triggerRationale:  string;
  conceptsGenerated: number;
  variantsGenerated: number;
  modesUsed:         CreativeGenerationMode[];
  dataQuality:       string;
  provider:          string;
  generatedAt:       string;   // ISO string
  warnings:          string[];
};
