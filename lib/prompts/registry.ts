// Prompt Template Registry
//
// Returns active template by type. Kept separate from rendering logic.
// Templates are versioned; registry returns the active version for each type.

import type { PromptTemplateType, CopyPromptTemplate, ImagePromptTemplate } from "../../types/promptTemplate";
import { copyGenerationV1 } from "./templates/copyGenerationV1";
import { imageVariationV1 } from "./templates/imageVariationV1";

export type ActiveTemplate = CopyPromptTemplate | ImagePromptTemplate;

export function getActiveTemplate(type: "copy_generation"): CopyPromptTemplate | null;
export function getActiveTemplate(type: "image_variation_generation"): ImagePromptTemplate | null;
export function getActiveTemplate(type: PromptTemplateType): ActiveTemplate | null;
export function getActiveTemplate(type: PromptTemplateType): ActiveTemplate | null {
  switch (type) {
    case "copy_generation":
      return copyGenerationV1;
    case "image_variation_generation":
      return imageVariationV1;
    case "copy_diagnosis":
    case "image_diagnosis":
      return null;
    default:
      return null;
  }
}
