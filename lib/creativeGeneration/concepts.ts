// lib/creativeGeneration/concepts.ts
// Utility functions for generating structured creative outputs from context.
//
// Functions:
//   generateCreativeVariants()     — flat variants from context + mode
//   generateCreativeConcepts()     — full concept packages (hook + copy + image)
//   generateCreativeCopyBlocks()   — structured copy blocks only
//   applyCreativeConstraints()     — validate against platform + custom constraints
//   summarizeCreativeGeneration()  — aggregate run summary
//
// Architecture:
//   - All async functions delegate generation to engine.ts (Anthropic or mock).
//   - buildContextBrief() bridges CreativeGenerationContext to the engine.
//   - Pure helpers (angle/hook builders) are deterministic from index.
//   - CRM-verified metrics (currentRoas, currentCpa) pass through unchanged.
//   - Safe for sparse data — fallbacks return empty arrays, never throw.

import type {
  CreativeGenerationContext,
  CreativeGenerationMode,
  CreativeGenerationConstraint,
  CreativeVariant,
  CreativeConcept,
  CreativeAngle,
  CreativeHook,
  CreativeCopyBlock,
  CreativeGenerationRunSummary,
} from "../../types/creativeGeneration";
import type { CreativeDraftVariant } from "../../types/creativeBrief";
import { generateCreativeDrafts, buildCreativeGenerationInput } from "./engine";
import { buildContextBrief }                                    from "./contextBrief";

// ---------------------------------------------------------------------------
// Angle catalogue — deterministic by index
// ---------------------------------------------------------------------------

const ANGLE_TYPES: Array<CreativeAngle["type"]> = [
  "outcome",
  "problem_first",
  "social_proof",
];

const ANGLE_NAMES: string[] = [
  "Outcome-Led",
  "Problem-First",
  "Social Proof",
];

const HOOK_TYPES: Array<CreativeHook["type"]> = [
  "outcome_led",
  "problem_first",
  "social_proof",
];

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function buildAngle(
  idx:  number,
  ctx:  CreativeGenerationContext,
): CreativeAngle {
  const i           = idx % ANGLE_TYPES.length;
  const angleType   = ANGLE_TYPES[i] ?? "outcome";
  const angleName   = ANGLE_NAMES[i] ?? "Direct";
  const signal      = ctx.evaluationStatus === "fatigued"
    ? `Frequency ${ctx.currentFrequency?.toFixed(1) ?? "?"} x — audience overexposed`
    : `CTR ${ctx.currentCtr.toFixed(2)}% — below scroll-stop threshold`;

  return {
    id:               crypto.randomUUID(),
    name:             angleName,
    type:             angleType,
    rationale:        `Selected because ${ctx.triggerType} signal requires ${angleName.toLowerCase()} approach.`,
    performanceSignal: signal,
  };
}

function buildHook(
  text:  string,
  idx:   number,
  angle: CreativeAngle,
): CreativeHook {
  const words = text.split(" ").filter(Boolean);
  return {
    id:        crypto.randomUUID(),
    text,
    type:      HOOK_TYPES[idx % HOOK_TYPES.length] ?? "outcome_led",
    angle:     angle.name,
    wordCount: words.length,
    charCount: text.length,
  };
}

function buildCopyBlock(
  v:     CreativeDraftVariant,
  idx:   number,
  ctx:   CreativeGenerationContext,
): CreativeCopyBlock {
  const angle  = buildAngle(idx, ctx);
  const hookText = v.hook ?? "";
  const hook   = buildHook(hookText, idx, angle);
  const body   = v.body ?? "";
  const allText = [hookText, body].join(" ");

  return {
    id:            crypto.randomUUID(),
    hook,
    body,
    callToAction:  v.callToAction ?? ctx.currentCta ?? "Learn More",
    angle,
    wordCount:     allText.split(" ").filter(Boolean).length,
    platformReady: hookText.length <= 125 && allText.length <= 500,
  };
}

function buildVariantRationale(ctx: CreativeGenerationContext): string {
  const ctrStr  = ctx.currentCtr.toFixed(2);
  const roasStr = ctx.currentRoas != null ? ` ROAS ${ctx.currentRoas.toFixed(2)}x (CRM).` : "";
  const memory  = ctx.winningPatterns.length > 0
    ? " Informed by winning patterns from learning memory." : "";
  return `CTR ${ctrStr}% → ${ctx.triggerType} trigger.${roasStr}${memory}`;
}

function buildConceptRationale(ctx: CreativeGenerationContext): string {
  return [
    `Generated to address ${ctx.triggerType} signal.`,
    `CTR ${ctx.currentCtr.toFixed(2)}% — ${ctx.evaluationStatus} status.`,
    ctx.currentRoas != null
      ? `CRM ROAS ${ctx.currentRoas.toFixed(2)}x (7-day attribution).` : null,
    ctx.winningPatterns.length > 0
      ? `Draws from ${ctx.winningPatterns.length} winning pattern(s) in learning memory.` : null,
    ctx.dataQuality === "sparse"
      ? "⚠ Sparse data — concept is broadly framed." : null,
  ].filter(Boolean).join(" ");
}

function estimateConceptScore(
  hook:  CreativeHook,
  block: CreativeCopyBlock,
  ctx:   CreativeGenerationContext,
): number {
  let score = 50;
  if (hook.charCount  <= 40)                    score += 15;  // short hook — good for mobile
  if (hook.charCount  >= 10)                    score += 5;   // not too short
  if (block.platformReady)                       score += 10;  // within Meta limits
  if (ctx.winningPatterns.length > 0)           score += 10;  // informed by learning memory
  if (ctx.dataQuality === "rich")               score += 10;  // strong data basis
  if (ctx.dataQuality === "sparse")             score -= 15;  // weak data
  if (ctx.currentCtr < 0.5)                     score -= 5;   // very low baseline CTR
  return Math.min(100, Math.max(0, score));
}

function draftToVariant(
  v:         CreativeDraftVariant,
  conceptId: string,
  ctx:       CreativeGenerationContext,
): CreativeVariant {
  const angle = buildAngle(0, ctx);
  return {
    id:                   v.id,
    conceptId,
    variantType:          v.variantType === "image" ? "image" : "copy",
    title:                v.title,
    hook:                 v.hook,
    body:                 v.body,
    callToAction:         v.callToAction,
    conceptSummary:       v.conceptSummary,
    visualChanges:        v.visualChanges,
    goal:                 v.goal,
    directResponseAngle:  v.directResponseAngle,
    angle:                angle.name,
    performanceRationale: buildVariantRationale(ctx),
    status:               "generated",
    reviewDecision:       null,
    reviewNote:           null,
    editedCopy:           null,
    generatedAt:          new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// generateCreativeVariants
// Generates flat CreativeVariant[] from context + mode.
// Delegates generation to the existing Anthropic/mock engine.
// ---------------------------------------------------------------------------

export async function generateCreativeVariants(
  context: CreativeGenerationContext,
  mode:    CreativeGenerationMode,
): Promise<CreativeVariant[]> {
  try {
    const brief  = buildContextBrief(context);
    const input  = buildCreativeGenerationInput({ brief, mode, regenerate: false });
    const result = await generateCreativeDrafts(input);

    if (!result.ok) return [];

    const conceptId = result.output.jobId;
    return result.output.variants.map((v) => draftToVariant(v, conceptId, context));
  } catch (err) {
    console.error("[generateCreativeVariants] Failed:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// generateCreativeConcepts
// Generates full_refresh_package and organises into CreativeConcept[].
// Each concept pairs a copy variation with an image brief.
// ---------------------------------------------------------------------------

export async function generateCreativeConcepts(
  context: CreativeGenerationContext,
): Promise<CreativeConcept[]> {
  try {
    const brief  = buildContextBrief(context);
    const input  = buildCreativeGenerationInput({
      brief,
      mode:       "full_refresh_package",
      regenerate: false,
    });
    const result = await generateCreativeDrafts(input);

    if (!result.ok) return [];

    const copyVariants  = result.output.variants.filter((v) => v.variantType === "copy");
    const imageVariants = result.output.variants.filter((v) => v.variantType === "image");

    return copyVariants.map((copy, idx): CreativeConcept => {
      const image    = imageVariants[idx] ?? null;
      const angle    = buildAngle(idx, context);
      const hookText = copy.hook ?? "";
      const hook     = buildHook(hookText, idx, angle);

      const copyBlock: CreativeCopyBlock = {
        id:            crypto.randomUUID(),
        hook,
        body:          copy.body ?? "",
        callToAction:  copy.callToAction ?? context.currentCta ?? "Learn More",
        angle,
        wordCount:     [hookText, copy.body ?? ""].join(" ").split(" ").filter(Boolean).length,
        platformReady: hookText.length <= 125 && (copy.body ?? "").length <= 500,
      };

      return {
        id:                   crypto.randomUUID(),
        title:                copy.title,
        angle,
        copyBlock,
        imageBrief:           image ? {
          conceptSummary:      image.conceptSummary      ?? "",
          visualChanges:       image.visualChanges       ?? "",
          goal:                image.goal                ?? "",
          directResponseAngle: image.directResponseAngle ?? "",
        } : undefined,
        performanceRationale: buildConceptRationale(context),
        triggerLink:          context.triggerRationale,
        estimatedScore:       estimateConceptScore(hook, copyBlock, context),
      };
    });
  } catch (err) {
    console.error("[generateCreativeConcepts] Failed:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// generateCreativeCopyBlocks
// Generates structured CreativeCopyBlock[] (copy only) from context.
// ---------------------------------------------------------------------------

export async function generateCreativeCopyBlocks(
  context: CreativeGenerationContext,
): Promise<CreativeCopyBlock[]> {
  try {
    const brief  = buildContextBrief(context);
    const input  = buildCreativeGenerationInput({
      brief,
      mode:       "copy_variations",
      regenerate: false,
    });
    const result = await generateCreativeDrafts(input);

    if (!result.ok) return [];

    return result.output.variants
      .filter((v) => v.variantType === "copy")
      .map((v, idx) => buildCopyBlock(v, idx, context));
  } catch (err) {
    console.error("[generateCreativeCopyBlocks] Failed:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// applyCreativeConstraints
// Validates CreativeVariant[] against Meta platform limits and custom
// constraints. Returns valid variants + a warnings list.
// ---------------------------------------------------------------------------

export function applyCreativeConstraints(
  variants:    CreativeVariant[],
  constraints: CreativeGenerationConstraint[],
): { valid: CreativeVariant[]; warnings: string[] } {
  const warnings: string[] = [];
  const valid:    CreativeVariant[] = [];

  for (const v of variants) {
    let passes = true;

    // Hook length advisory (not a hard reject — Meta shows full text on expansion)
    if (v.hook && v.hook.length > 200) {
      warnings.push(`"${v.title}": hook is ${v.hook.length} chars (recommended ≤ 125 for mobile feed preview)`);
    }

    // Apply custom constraints
    for (const c of constraints) {
      if (c.type === "char_limit" && v.variantType === "copy") {
        const fullCopy = [v.hook, v.body].filter(Boolean).join(" ");
        const limit    = parseInt(c.value, 10);
        if (!isNaN(limit) && fullCopy.length > limit) {
          warnings.push(`"${v.title}": exceeds char limit ${limit} (${fullCopy.length} chars) — ${c.reason}`);
          passes = false;
        }
      }

      if (c.type === "compliance" && v.variantType === "copy") {
        const disallowed = c.value.toLowerCase().split(",").map((s: string) => s.trim()).filter(Boolean);
        const fullCopy   = [v.hook, v.body].filter(Boolean).join(" ").toLowerCase();
        for (const term of disallowed) {
          if (fullCopy.includes(term)) {
            warnings.push(`"${v.title}": contains restricted term "${term}" (${c.reason})`);
          }
        }
      }

      if (c.type === "brand_voice" && v.variantType === "copy") {
        // Advisory only — flag for human review, don't auto-reject
        warnings.push(`"${v.title}": review against brand voice guideline: ${c.value}`);
      }
    }

    if (passes) valid.push(v);
  }

  return { valid, warnings };
}

// ---------------------------------------------------------------------------
// summarizeCreativeGeneration
// Builds a CreativeGenerationRunSummary for the UI run history panel.
// ---------------------------------------------------------------------------

export function summarizeCreativeGeneration(
  concepts:  CreativeConcept[],
  variants:  CreativeVariant[],
  context:   CreativeGenerationContext,
  provider:  string,
  modes:     CreativeGenerationMode[],
  warnings:  string[],
): CreativeGenerationRunSummary {
  return {
    contextClientId:   context.clientAccountId,
    contextClientName: context.clientName,
    triggerType:       context.triggerType,
    triggerRationale:  context.triggerRationale,
    conceptsGenerated: concepts.length,
    variantsGenerated: variants.length,
    modesUsed:         modes,
    dataQuality:       context.dataQuality,
    provider,
    generatedAt:       new Date().toISOString(),
    warnings,
  };
}
