// ─────────────────────────────────────────────────────────────────────────────
// Variation Generation — Public API
// ─────────────────────────────────────────────────────────────────────────────

export { buildVariationSourceContext } from "./sourceContext";
export { generateCopyVariationsFromSource } from "./copyGenerator";
export {
  generateImageVariationsFromSource,
  renderImageConcept,
} from "./imageGenerator";
export { generateUnifiedVariationSet } from "./unified";
export {
  persistVariationCandidates,
  summarizeVariationGeneration,
} from "./persistence";
