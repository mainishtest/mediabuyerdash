// Prompt Template Types
//
// Reusable, versioned prompt templates for AI generation. Kept separate from
// types/promptAssembly.ts (assembly) and types/aiProvider.ts (provider contracts)
// so templates can evolve independently — e.g. A/B testing, provider adapters.

// ── Template type ─────────────────────────────────────────────────────────────

export type PromptTemplateType =
  | "copy_generation"
  | "image_variation_generation"
  | "copy_diagnosis"
  | "image_diagnosis";

// ── Version metadata ──────────────────────────────────────────────────────────

export interface PromptTemplateVersion {
  templateId:   string;
  version:      string;
  templateType: PromptTemplateType;
  title:        string;
  description:  string;
  createdAt:    string;   // ISO date
  isActive:     boolean;
}

// ── Template metadata ──────────────────────────────────────────────────────────

export interface PromptTemplateMetadata {
  intendedOutputShape:   string;
  providerCompatibility: string[];
  notes:                 string[];
  warnings:              string[];
  expectedVariationCount: number;
  creativePrinciplesIncluded: string[];
}

// ── Copy prompt template ───────────────────────────────────────────────────────

export interface CopyPromptTemplate {
  version:   PromptTemplateVersion;
  metadata:  PromptTemplateMetadata;
  sections:  {
    systemInstructions:   string;
    taskInstructions:    string;
    outputRequirements:  string;
    constraints:         string;
    directResponsePrinciples: string;
    storySellingGuidance: string;
    ctaGuidance:         string;
  };
}

// ── Image prompt template ──────────────────────────────────────────────────────

export interface ImagePromptTemplate {
  version:   PromptTemplateVersion;
  metadata:  PromptTemplateMetadata;
  sections:  {
    systemInstructions:      string;
    taskInstructions:       string;
    visualConstraints:      string;
    outputRequirements:     string;
    attentionGrabbingPrinciples: string;
    visualHierarchyGuidance: string;
    actionDrivingGuidance:   string;
  };
}

// ── Render input / result ──────────────────────────────────────────────────────

export type PromptRenderInput<T> = {
  template: T;
  context:  Record<string, unknown>;
};

export interface PromptRenderResult {
  renderedSections: Record<string, string>;
  fullPrompt:       string;
  templateMetadata: PromptTemplateMetadata;
  templateVersion:  string;
  warnings:         string[];
  missingFields:    string[];
}
