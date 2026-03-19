// lib/creativeBrief/index.ts
// Public surface area for the Creative Brief domain module.

export type {
  CreativeDraftType,
  CreativeGenerationIntent,
  CreativeReviewDecision,
  CreativeBriefStatus,
  CreativeBriefSection,
  CreativeBriefInput,
  CreativeDraftVariant,
  CreativeDraftSet,
  CreativeBrief,
  CreativeDraftSummary,
} from "../../types/creativeBrief";

export {
  inferGenerationIntent,
  summarizeCreativeWeaknesses,
  summarizeCreativeStrengths,
  buildCreativeBriefInput,
  buildCreativeDraftSet,
  buildCreativeBrief,
  buildCreativeReviewSummary,
} from "./briefs";

export {
  saveCreativeBrief,
  loadCreativeBriefs,
  loadCreativeBriefById,
  updateBriefStatus,
  updateVariantReview,
} from "./db";
