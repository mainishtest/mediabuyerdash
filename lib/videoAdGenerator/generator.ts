// Video Ad Generator — pipeline
//
// Orchestrates the sequence of LLM calls that turn a brief into a full
// concept. Each step is independently callable so the UI can regenerate
// a single section without redoing the whole pipeline.

import { VideoAdGenError } from "./anthropic";
import { callProviderJson } from "./providers";
import {
  anglePrompt,
  hooksPrompt,
  scriptPrompt,
  shotListPrompt,
  ctasPrompt,
  platformVariantsPrompt,
} from "./prompts";
import type {
  ConceptBrief,
  Angle,
  Hook,
  Script,
  ShotListItem,
  Cta,
  PlatformVariants,
} from "./types";

// ── Individual steps ─────────────────────────────────────────────────────────

export async function generateAngle(brief: ConceptBrief): Promise<Angle> {
  return callProviderJson<Angle>({ ...anglePrompt(brief), maxTokens: 1024 });
}

export async function generateHooks(brief: ConceptBrief, angle: Angle): Promise<Hook[]> {
  const result = await callProviderJson<Hook[]>({
    ...hooksPrompt(brief, angle),
    maxTokens: 2048,
  });
  if (!Array.isArray(result) || result.length === 0) {
    throw new VideoAdGenError("Hook generation returned no hooks");
  }
  return result;
}

export async function generateScript(
  brief: ConceptBrief,
  angle: Angle,
  hook: Hook
): Promise<Script> {
  return callProviderJson<Script>({
    ...scriptPrompt(brief, angle, hook),
    maxTokens: 2048,
  });
}

export async function generateShotList(
  brief: ConceptBrief,
  script: Script
): Promise<ShotListItem[]> {
  const result = await callProviderJson<ShotListItem[]>({
    ...shotListPrompt(brief, script),
    maxTokens: 3072,
  });
  if (!Array.isArray(result)) {
    throw new VideoAdGenError("Shot list generation did not return an array");
  }
  return result;
}

export async function generateCtas(
  brief: ConceptBrief,
  angle: Angle
): Promise<Cta[]> {
  const result = await callProviderJson<Cta[]>({
    ...ctasPrompt(brief, angle),
    maxTokens: 1024,
  });
  if (!Array.isArray(result)) {
    throw new VideoAdGenError("CTA generation did not return an array");
  }
  return result;
}

export async function generatePlatformVariants(
  brief: ConceptBrief,
  script: Script,
  hook: Hook
): Promise<PlatformVariants> {
  return callProviderJson<PlatformVariants>({
    ...platformVariantsPrompt(brief, script, hook),
    maxTokens: 2048,
  });
}

// ── Full pipeline ────────────────────────────────────────────────────────────

export interface FullConceptResult {
  angle:            Angle;
  hooks:            Hook[];
  script:           Script;
  shotList:         ShotListItem[];
  ctas:             Cta[];
  platformVariants: PlatformVariants;
}

export async function generateFullConcept(brief: ConceptBrief): Promise<FullConceptResult> {
  const angle = await generateAngle(brief);
  const hooks = await generateHooks(brief, angle);
  const leadHook = hooks[0];

  // Script + CTAs can run in parallel — neither depends on the other.
  const [script, ctas] = await Promise.all([
    generateScript(brief, angle, leadHook),
    generateCtas(brief, angle),
  ]);

  // Shot list + platform variants both depend on the script — run in parallel.
  const [shotList, platformVariants] = await Promise.all([
    generateShotList(brief, script),
    generatePlatformVariants(brief, script, leadHook),
  ]);

  return { angle, hooks, script, shotList, ctas, platformVariants };
}
