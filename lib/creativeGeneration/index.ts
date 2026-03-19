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
} from "../../types/creativeGeneration";

export { GENERATION_MODE_INFO } from "../../types/creativeGeneration";
