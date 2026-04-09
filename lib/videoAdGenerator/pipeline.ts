// Video Ad Generator V2 — Strategy Pipeline Orchestrator
//
// Runs 8 GPT calls in 5 round-trips with smart parallelization.
// Supports three modes: strategy_only, storyboard_only, render_ready.
// Each step is independently callable for per-section regeneration.

import { VideoAdGenError } from "./anthropic";
import { callProviderJson } from "./providers";
import {
  strategyAnglePrompt,
  strategyHookSetPrompt,
  strategyScriptPrompt,
  strategyShotListPrompt,
  strategyOnScreenTextPrompt,
  strategyCtaVariantsPrompt,
  strategyEditorNotesPrompt,
  strategyPlatformAdjustmentsPrompt,
} from "./strategyPrompts";
import type {
  ExpandedConceptBrief,
  StrategyAngleSet,
  StrategyHookSet,
  StrategyHook,
  StrategyScript,
  StrategyShotListItem,
  StrategyOnScreenText,
  StrategyCtaVariant,
  StrategyEditorNotes,
  StrategyPlatformAdjustment,
  StrategyRunOutput,
  PipelineOptions,
  GenerationTier,
} from "./types";

// ── Tier overrides per step ─────────────────────────────────────────
// Premium steps get the big model. Standard steps use the cheaper model.
// On re-runs, everything can drop to standard since the creative
// foundation was already set by a premium first run.

function stepTier(baseTier: GenerationTier, step: string, isFirstRun: boolean): GenerationTier {
  if (baseTier === "standard") return "standard";
  // Premium tier: only some steps actually need the big model
  const premiumSteps = isFirstRun
    ? ["angle", "hooks", "script", "shotList"]
    : ["angle", "script"]; // re-runs: only the creative core
  return premiumSteps.includes(step) ? "premium" : "standard";
}

// ── Individual strategy steps ───────────────────────────────────────

export async function generateStrategyAngleSet(
  brief: ExpandedConceptBrief,
  tier: GenerationTier = "premium"
): Promise<StrategyAngleSet> {
  const prompt = strategyAnglePrompt(brief);
  return callProviderJson<StrategyAngleSet>({ ...prompt, maxTokens: 1536 });
}

export async function generateStrategyHookSet(
  brief: ExpandedConceptBrief,
  angleSet: StrategyAngleSet,
  tier: GenerationTier = "premium"
): Promise<StrategyHookSet> {
  const prompt = strategyHookSetPrompt(brief, angleSet);
  const result = await callProviderJson<StrategyHookSet>({ ...prompt, maxTokens: 2048 });
  if (!result.hooks || !Array.isArray(result.hooks) || result.hooks.length === 0) {
    throw new VideoAdGenError("Hook generation returned no hooks");
  }
  return result;
}

export async function generateStrategyScript(
  brief: ExpandedConceptBrief,
  angleSet: StrategyAngleSet,
  hook: StrategyHook,
  tier: GenerationTier = "premium"
): Promise<StrategyScript> {
  const prompt = strategyScriptPrompt(brief, angleSet, hook);
  return callProviderJson<StrategyScript>({ ...prompt, maxTokens: 2048 });
}

export async function generateStrategyShotList(
  brief: ExpandedConceptBrief,
  script: StrategyScript,
  tier: GenerationTier = "premium"
): Promise<StrategyShotListItem[]> {
  const prompt = strategyShotListPrompt(brief, script);
  // Shot list returns an array, but JSON mode requires an object root.
  // The prompt asks for a JSON array, but OpenAI json_object mode needs an object.
  // We'll handle both: array or { scenes: [...] } or { shotList: [...] }
  const result = await callProviderJson<StrategyShotListItem[] | { scenes?: StrategyShotListItem[]; shotList?: StrategyShotListItem[] }>(
    { ...prompt, maxTokens: 4096 }
  );
  if (Array.isArray(result)) return result;
  if (result.scenes && Array.isArray(result.scenes)) return result.scenes;
  if (result.shotList && Array.isArray(result.shotList)) return result.shotList;
  throw new VideoAdGenError("Shot list generation did not return an array");
}

export async function generateStrategyOnScreenText(
  brief: ExpandedConceptBrief,
  script: StrategyScript,
  shotList: StrategyShotListItem[],
  tier: GenerationTier = "standard"
): Promise<StrategyOnScreenText[]> {
  const prompt = strategyOnScreenTextPrompt(brief, script, shotList);
  const result = await callProviderJson<StrategyOnScreenText[] | { scenes?: StrategyOnScreenText[]; onScreenText?: StrategyOnScreenText[] }>(
    { ...prompt, maxTokens: 2048 }
  );
  if (Array.isArray(result)) return result;
  if ((result as Record<string, unknown>).scenes && Array.isArray((result as Record<string, unknown>).scenes)) return (result as { scenes: StrategyOnScreenText[] }).scenes;
  if ((result as Record<string, unknown>).onScreenText && Array.isArray((result as Record<string, unknown>).onScreenText)) return (result as { onScreenText: StrategyOnScreenText[] }).onScreenText;
  throw new VideoAdGenError("On-screen text generation did not return an array");
}

export async function generateStrategyCtaVariants(
  brief: ExpandedConceptBrief,
  angleSet: StrategyAngleSet,
  tier: GenerationTier = "standard"
): Promise<StrategyCtaVariant[]> {
  const prompt = strategyCtaVariantsPrompt(brief, angleSet);
  const result = await callProviderJson<StrategyCtaVariant[] | { ctas?: StrategyCtaVariant[]; ctaVariants?: StrategyCtaVariant[] }>(
    { ...prompt, maxTokens: 1536 }
  );
  if (Array.isArray(result)) return result;
  if ((result as Record<string, unknown>).ctas && Array.isArray((result as Record<string, unknown>).ctas)) return (result as { ctas: StrategyCtaVariant[] }).ctas;
  if ((result as Record<string, unknown>).ctaVariants && Array.isArray((result as Record<string, unknown>).ctaVariants)) return (result as { ctaVariants: StrategyCtaVariant[] }).ctaVariants;
  throw new VideoAdGenError("CTA generation did not return an array");
}

export async function generateStrategyEditorNotes(
  brief: ExpandedConceptBrief,
  script: StrategyScript,
  shotList: StrategyShotListItem[],
  tier: GenerationTier = "standard"
): Promise<StrategyEditorNotes> {
  const prompt = strategyEditorNotesPrompt(brief, script, shotList);
  return callProviderJson<StrategyEditorNotes>({ ...prompt, maxTokens: 1536 });
}

export async function generateStrategyPlatformAdjustments(
  brief: ExpandedConceptBrief,
  output: Partial<StrategyRunOutput>,
  tier: GenerationTier = "standard"
): Promise<StrategyPlatformAdjustment[]> {
  const prompt = strategyPlatformAdjustmentsPrompt(brief, output);
  const result = await callProviderJson<StrategyPlatformAdjustment[] | { adjustments?: StrategyPlatformAdjustment[]; platformAdjustments?: StrategyPlatformAdjustment[] }>(
    { ...prompt, maxTokens: 1536 }
  );
  if (Array.isArray(result)) return result;
  if ((result as Record<string, unknown>).adjustments && Array.isArray((result as Record<string, unknown>).adjustments)) return (result as { adjustments: StrategyPlatformAdjustment[] }).adjustments;
  if ((result as Record<string, unknown>).platformAdjustments && Array.isArray((result as Record<string, unknown>).platformAdjustments)) return (result as { platformAdjustments: StrategyPlatformAdjustment[] }).platformAdjustments;
  throw new VideoAdGenError("Platform adjustments generation did not return an array");
}

// ── Full pipeline orchestrator ──────────────────────────────────────

export async function executeStrategyPipeline(
  brief: ExpandedConceptBrief,
  options: PipelineOptions = { mode: "storyboard_only", tier: "premium" }
): Promise<StrategyRunOutput> {
  const { mode, tier, selectedHookIndex = 0 } = options;
  const isFirstRun = true; // TODO: track via StrategyRun version

  // Phase 1: Angle (sequential — everything depends on this)
  const angleSet = await generateStrategyAngleSet(
    brief,
    stepTier(tier, "angle", isFirstRun)
  );

  // Phase 2: Hooks (sequential — script depends on hook selection)
  const hookSet = await generateStrategyHookSet(
    brief,
    angleSet,
    stepTier(tier, "hooks", isFirstRun)
  );

  const selectedHook = hookSet.hooks[selectedHookIndex] ?? hookSet.hooks[0];
  if (!selectedHook) throw new VideoAdGenError("No hooks available to build script from");

  // Phase 3: Script + CTA variants in parallel
  const [script, ctaVariants] = await Promise.all([
    generateStrategyScript(brief, angleSet, selectedHook, stepTier(tier, "script", isFirstRun)),
    generateStrategyCtaVariants(brief, angleSet, stepTier(tier, "ctas", isFirstRun)),
  ]);

  // For strategy_only mode, stop here with partial output
  if (mode === "strategy_only") {
    return {
      angleSet,
      hookSet,
      script,
      shotList: [],
      onScreenText: [],
      ctaVariants,
      editorNotes: {
        overallPacing: "",
        colorGrading: "",
        musicDirection: "",
        soundDesign: "",
        graphicsStyle: "",
        complianceNotes: [],
      },
      platformAdjustments: [],
    };
  }

  // Phase 4: Shot list + Editor notes in parallel
  const [shotList, editorNotes] = await Promise.all([
    generateStrategyShotList(brief, script, stepTier(tier, "shotList", isFirstRun)),
    generateStrategyEditorNotes(brief, script, [], stepTier(tier, "editorNotes", isFirstRun)),
  ]);

  // Phase 5: On-screen text + Platform adjustments in parallel
  const partialOutput: Partial<StrategyRunOutput> = {
    angleSet,
    hookSet,
    script,
    shotList,
    ctaVariants,
    editorNotes,
  };

  const [onScreenText, platformAdjustments] = await Promise.all([
    generateStrategyOnScreenText(brief, script, shotList, stepTier(tier, "ost", isFirstRun)),
    generateStrategyPlatformAdjustments(brief, partialOutput, stepTier(tier, "platform", isFirstRun)),
  ]);

  return {
    angleSet,
    hookSet,
    script,
    shotList,
    onScreenText,
    ctaVariants,
    editorNotes,
    platformAdjustments,
  };
}
