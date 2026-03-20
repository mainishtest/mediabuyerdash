// lib/creativeGeneration/index.ts
// Public API for the creative generation engine.

export {
  buildCreativeGenerationInput,
  summarizeGenerationConstraints,
  normalizeCreativeOutput,
  attachSourceContextToDrafts,
  generateCreativeDrafts,
} from "./engine";

export {
  createGenerationJob,
  completeGenerationJob,
  failGenerationJob,
  loadGenerationJobs,
} from "./db";

// ── Phase 8: Performance-Driven Context Engine ────────────────────────────────

export {
  buildCreativeGenerationContext,
  buildContextSummaryForPrompt,
  META_PLATFORM_CONSTRAINTS,
} from "./context";

export {
  generateCreativeVariants,
  generateCreativeConcepts,
  generateCreativeCopyBlocks,
  applyCreativeConstraints,
  summarizeCreativeGeneration,
} from "./concepts";

export { buildContextBrief } from "./contextBrief";

// ── Type re-exports ───────────────────────────────────────────────────────────

export type {
  CreativeDraftAssetType,
  CreativeGenerationMode,
  CreativeGenerationConstraint,
  CreativeGenerationInput,
  CreativeGenerationOutput,
  CreativeGenerationJob,
  CreativeGenerationError,
  CreativeGenerationResult,
  CreativeGenerationSummary,
  CreativeGenerationModeInfo,
  // Phase 8 types
  CreativeGenerationRequest,
  CreativeGenerationContext,
  CreativeGenerationRunSummary,
  PlatformConstraint,
  CreativeAngle,
  CreativeHook,
  CreativeCopyBlock,
  CreativeConcept,
  CreativeVariant,
} from "../../types/creativeGeneration";

export { GENERATION_MODE_INFO } from "../../types/creativeGeneration";
