// AI Prompt / Input Assembly Types
//
// Structured context models for assembling data before it is passed to AI
// providers. Kept separate from types/aiProvider.ts (provider request/response)
// and types/creativeDiagnosis.ts (diagnosis logic) so the assembly layer can
// evolve independently — e.g. prompt templates, provider-specific formatting,
// versioning.

import type { RecommendationCauseType, RecommendationConfidence } from "./creativeDiagnosis";

// ── Sub-contexts ──────────────────────────────────────────────────────────────

export interface PerformanceContext {
  actualCpa:       number;
  actualRoas:     number;
  spend:          number;
  conversions:    number;
  revenue:        number;   // derived: spend * roas when available
  trendSummary:   string | null;   // e.g. "CPA 20% over goal, ROAS 15% below"
  evaluationStatus: "on_target" | "watch" | "below_goal";
}

export interface CampaignGoalContext {
  roasGoalType:  "high" | "low";
  roasGoalValue: number;
  cpaGoalType:   "high" | "low";
  cpaGoalValue:  number;
}

export interface CreativeContext {
  adName:         string;
  currentHook:    string;
  currentBody:    string;
  currentCallToAction: string;
  imageHeadline:  string;
  imageStyle:     string;
  dominantMessage: string;
  visualTheme:    string;
}

export interface DiagnosisContext {
  causeType:             RecommendationCauseType;
  confidence:            RecommendationConfidence;
  shortReason:           string;
  recommendationSummary: string;
}

// ── Assembled generation contexts ──────────────────────────────────────────────

export interface CopyGenerationContext {
  adId:           string;
  adName:         string;
  campaignId:     string;
  campaignName:   string;
  performance:    PerformanceContext;
  goals:          CampaignGoalContext;
  creative:       CreativeContext;
  diagnosis:      DiagnosisContext;
}

export interface ImageGenerationContext {
  adId:           string;
  adName:         string;
  campaignId:     string;
  campaignName:   string;
  performance:    PerformanceContext;
  goals:          CampaignGoalContext;
  creative:       CreativeContext;
  diagnosis:      DiagnosisContext;
}

// ── Assembly result wrapper ────────────────────────────────────────────────────

export interface PromptAssemblyResult<T> {
  context:       T;
  sourceIds:     {
    adId:       string;
    campaignId:  string;
  };
  ready:         boolean;
  missingFields: string[];
  warnings:      string[];
}

// ── Readiness check result ─────────────────────────────────────────────────────

export interface ReadinessCheckResult {
  ready:         boolean;
  missingFields: string[];
  warnings:      string[];
}
