// Creative Intelligence Types
//
// Models for the structured creative intelligence layer.
// Captures which creative patterns perform best across hooks, CTAs, body
// angles, and visual styles. Isolated from generation, approval, and launch
// models so the intelligence layer can evolve independently.

// ── Enumerations ──────────────────────────────────────────────────────────────

export type CreativePatternType =
  | "hook_type"
  | "cta_type"
  | "body_angle"
  | "emotional_driver"
  | "visual_style"
  | "image_concept"
  | "story_structure"
  | "offer_style";

export type CreativePatternStrength = "weak" | "moderate" | "strong";

export type CreativeSignalSource =
  | "ad"
  | "generated_copy"
  | "generated_image"
  | "launch_draft_variant";

// ── Core models ───────────────────────────────────────────────────────────────

// A named creative pattern — the taxonomy entry, not the observation.
export interface CreativePattern {
  id:               string;
  type:             CreativePatternType;
  label:            string;
  description:      string;
  clientAccountId?: string;
  campaignId?:      string;
  createdAt:        Date;
}

// A single observed signal: one creative trait tagged on one piece of content.
export interface CreativeSignal {
  id:               string;
  sourceType:       CreativeSignalSource;
  sourceId:         string;
  clientAccountId?: string;
  campaignId?:      string;
  patternType:      CreativePatternType;
  patternLabel:     string;
  createdAt:        Date;
}

// Evidence item linking a signal back to its original creative source.
export interface CreativePatternEvidence {
  sourceType: CreativeSignalSource;
  sourceId:   string;
  excerpt:    string;
}

// ── Performance layer ─────────────────────────────────────────────────────────

// Observed performance data aggregated for a single pattern.
// averageCPA/ROAS/CTR are null when real performance data is not yet linked.
export interface CreativePerformanceInsight {
  id:           string;
  patternType:  CreativePatternType;
  patternLabel: string;
  entityLevel:  "account" | "campaign" | "adset" | "ad" | "all";
  sampleCount:  number;
  averageCPA:   number | null;
  averageROAS:  number | null;
  averageCTR:   number | null;
  conversions:  number | null;
  strength:     CreativePatternStrength;
  summary:      string;
}

// ── Top-level summary ─────────────────────────────────────────────────────────

export interface CreativeIntelligenceSummary {
  totalSignals:      number;
  topHookPattern:    CreativePerformanceInsight | null;
  topCTAPattern:     CreativePerformanceInsight | null;
  topVisualPattern:  CreativePerformanceInsight | null;
  emergingLearnings: string[];
  insights:          CreativePerformanceInsight[];
}
