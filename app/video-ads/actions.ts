"use server";

// Video Ad Generator — server actions
//
// All mutations go through here: create a concept (runs the full AI
// pipeline), regenerate a single section, update status/notes, delete.
//
// We catch VideoAdGenError and return a typed result object instead of
// throwing — the client form then shows a readable error state.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "../../lib/db";
import { VideoAdGenError } from "../../lib/videoAdGenerator/anthropic";
import {
  generateAngle,
  generateHooks,
  generateScript,
  generateShotList,
  generateCtas,
  generatePlatformVariants,
  generateFullConcept,
} from "../../lib/videoAdGenerator/generator";
import type {
  AdStyle,
  Platform,
  AwarenessStage,
  ConceptBrief,
  Hook,
} from "../../lib/videoAdGenerator/types";
import { hydrateConcept, type ConceptRecord } from "../../lib/videoAdGenerator/serialize";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formString(fd: FormData, key: string, fallback = ""): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : fallback;
}

async function loadBriefFromConcept(id: string): Promise<ConceptBrief> {
  const row = await prisma.videoAdConcept.findUnique({ where: { id } });
  if (!row) throw new VideoAdGenError(`Concept ${id} not found`);
  return {
    productName:    row.productName,
    offer:          row.offer,
    audience:       row.audience,
    painPoints:     row.painPoints,
    awarenessStage: row.awarenessStage as AwarenessStage,
    adStyle:        row.adStyle as AdStyle,
    platform:       row.platform as Platform,
    brandVoice:     row.brandVoice ?? undefined,
    extraNotes:     row.extraNotes ?? undefined,
  };
}

// ── Create (with full AI generation) ────────────────────────────────────────

export interface CreateConceptResult {
  ok:    boolean;
  id?:   string;
  error?: string;
}

export async function createConceptAction(formData: FormData): Promise<CreateConceptResult> {
  const brief: ConceptBrief = {
    productName:    formString(formData, "productName"),
    offer:          formString(formData, "offer"),
    audience:       formString(formData, "audience"),
    painPoints:     formString(formData, "painPoints"),
    awarenessStage: (formString(formData, "awarenessStage", "problem_aware") as AwarenessStage),
    adStyle:        (formString(formData, "adStyle", "ugc") as AdStyle),
    platform:       (formString(formData, "platform", "facebook") as Platform),
    brandVoice:     formString(formData, "brandVoice") || undefined,
    extraNotes:     formString(formData, "extraNotes") || undefined,
  };
  const title = formString(formData, "title") || `${brief.productName} — ${brief.adStyle}`;

  // Validate required fields
  const missing: string[] = [];
  if (!brief.productName) missing.push("product");
  if (!brief.offer)       missing.push("offer");
  if (!brief.audience)    missing.push("audience");
  if (!brief.painPoints)  missing.push("pain points");
  if (missing.length > 0) {
    return { ok: false, error: `Missing required fields: ${missing.join(", ")}` };
  }

  let created;
  try {
    const result = await generateFullConcept(brief);
    created = await prisma.videoAdConcept.create({
      data: {
        title,
        status:           "draft",
        platform:         brief.platform,
        adStyle:          brief.adStyle,
        productName:      brief.productName,
        offer:            brief.offer,
        audience:         brief.audience,
        painPoints:       brief.painPoints,
        awarenessStage:   brief.awarenessStage,
        brandVoice:       brief.brandVoice ?? null,
        extraNotes:       brief.extraNotes ?? null,
        angle:            JSON.stringify(result.angle),
        hooks:            JSON.stringify(result.hooks),
        script:           JSON.stringify(result.script),
        shotList:         JSON.stringify(result.shotList),
        ctas:             JSON.stringify(result.ctas),
        platformVariants: JSON.stringify(result.platformVariants),
      },
    });
  } catch (err) {
    const message = err instanceof VideoAdGenError
      ? err.message
      : err instanceof Error
        ? err.message
        : "Unknown error during generation";
    return { ok: false, error: message };
  }

  revalidatePath("/video-ads");
  redirect(`/video-ads/${created.id}`);
}

// ── Regenerate individual sections ──────────────────────────────────────────

export interface RegenerateResult {
  ok:    boolean;
  error?: string;
}

export async function regenerateAngleAction(conceptId: string): Promise<RegenerateResult> {
  try {
    const brief = await loadBriefFromConcept(conceptId);
    const angle = await generateAngle(brief);
    await prisma.videoAdConcept.update({
      where: { id: conceptId },
      data:  { angle: JSON.stringify(angle) },
    });
    revalidatePath(`/video-ads/${conceptId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Regenerate failed" };
  }
}

export async function regenerateHooksAction(conceptId: string): Promise<RegenerateResult> {
  try {
    const brief = await loadBriefFromConcept(conceptId);
    const row = await prisma.videoAdConcept.findUnique({ where: { id: conceptId } });
    if (!row?.angle) throw new VideoAdGenError("Generate an angle first");
    const angle = JSON.parse(row.angle);
    const hooks = await generateHooks(brief, angle);
    await prisma.videoAdConcept.update({
      where: { id: conceptId },
      data:  { hooks: JSON.stringify(hooks) },
    });
    revalidatePath(`/video-ads/${conceptId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Regenerate failed" };
  }
}

export async function regenerateScriptAction(conceptId: string): Promise<RegenerateResult> {
  try {
    const brief = await loadBriefFromConcept(conceptId);
    const row = await prisma.videoAdConcept.findUnique({ where: { id: conceptId } });
    if (!row?.angle || !row?.hooks) throw new VideoAdGenError("Generate angle and hooks first");
    const angle = JSON.parse(row.angle);
    const hooks: Hook[] = JSON.parse(row.hooks);
    const leadHook = hooks[0];
    if (!leadHook) throw new VideoAdGenError("No hooks available");
    const script = await generateScript(brief, angle, leadHook);
    await prisma.videoAdConcept.update({
      where: { id: conceptId },
      data:  { script: JSON.stringify(script) },
    });
    revalidatePath(`/video-ads/${conceptId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Regenerate failed" };
  }
}

export async function regenerateShotListAction(conceptId: string): Promise<RegenerateResult> {
  try {
    const brief = await loadBriefFromConcept(conceptId);
    const row = await prisma.videoAdConcept.findUnique({ where: { id: conceptId } });
    if (!row?.script) throw new VideoAdGenError("Generate a script first");
    const script = JSON.parse(row.script);
    const shotList = await generateShotList(brief, script);
    await prisma.videoAdConcept.update({
      where: { id: conceptId },
      data:  { shotList: JSON.stringify(shotList) },
    });
    revalidatePath(`/video-ads/${conceptId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Regenerate failed" };
  }
}

export async function regenerateCtasAction(conceptId: string): Promise<RegenerateResult> {
  try {
    const brief = await loadBriefFromConcept(conceptId);
    const row = await prisma.videoAdConcept.findUnique({ where: { id: conceptId } });
    if (!row?.angle) throw new VideoAdGenError("Generate an angle first");
    const angle = JSON.parse(row.angle);
    const ctas = await generateCtas(brief, angle);
    await prisma.videoAdConcept.update({
      where: { id: conceptId },
      data:  { ctas: JSON.stringify(ctas) },
    });
    revalidatePath(`/video-ads/${conceptId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Regenerate failed" };
  }
}

export async function regeneratePlatformVariantsAction(conceptId: string): Promise<RegenerateResult> {
  try {
    const brief = await loadBriefFromConcept(conceptId);
    const row = await prisma.videoAdConcept.findUnique({ where: { id: conceptId } });
    if (!row?.script || !row?.hooks) throw new VideoAdGenError("Generate script and hooks first");
    const script = JSON.parse(row.script);
    const hooks: Hook[] = JSON.parse(row.hooks);
    const leadHook = hooks[0];
    if (!leadHook) throw new VideoAdGenError("No hooks available");
    const variants = await generatePlatformVariants(brief, script, leadHook);
    await prisma.videoAdConcept.update({
      where: { id: conceptId },
      data:  { platformVariants: JSON.stringify(variants) },
    });
    revalidatePath(`/video-ads/${conceptId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Regenerate failed" };
  }
}

// ── Metadata mutations ───────────────────────────────────────────────────────

export async function updateConceptMetaAction(
  conceptId: string,
  data: { status?: string; notes?: string; title?: string }
): Promise<RegenerateResult> {
  try {
    await prisma.videoAdConcept.update({
      where: { id: conceptId },
      data,
    });
    revalidatePath(`/video-ads/${conceptId}`);
    revalidatePath(`/video-ads`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Update failed" };
  }
}

export async function deleteConceptAction(conceptId: string): Promise<void> {
  await prisma.videoAdConcept.delete({ where: { id: conceptId } });
  revalidatePath("/video-ads");
  redirect("/video-ads");
}

// ── Read helpers for server components ──────────────────────────────────────

export async function listConcepts() {
  const rows = await prisma.videoAdConcept.findMany({
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => hydrateConcept(r as ConceptRecord));
}

export async function getConcept(id: string) {
  const row = await prisma.videoAdConcept.findUnique({ where: { id } });
  return row ? hydrateConcept(row as ConceptRecord) : null;
}

// ═══════════════════════════════════════════════════════════════════════
// V2 — Two-engine architecture actions
//
// Uses GPT strategy engine → render brief compiler → Veo (stub).
// All v1 actions above are preserved and continue to work.
// ═══════════════════════════════════════════════════════════════════════

import {
  executeStrategyPipeline,
  generateStrategyAngleSet,
  generateStrategyHookSet,
  generateStrategyScript,
  generateStrategyShotList,
  generateStrategyOnScreenText,
  generateStrategyCtaVariants,
  generateStrategyEditorNotes,
  generateStrategyPlatformAdjustments,
} from "../../lib/videoAdGenerator/pipeline";
import { compileRenderBrief, COMPILER_VERSION } from "../../lib/videoAdGenerator/renderCompiler";
import { composeScenePrompt } from "../../lib/videoAdGenerator/veo";
import type {
  ExpandedConceptBrief,
  MarketSophistication,
  CtaGoal,
  VisualStyle,
  ClaimProofPoint,
  PipelineMode,
  GenerationTier,
  PipelineOptions,
  StrategyRunOutput,
  ConceptStatus,
  ApprovedStructure,
  StrategyAngleSet,
  StrategyHookSet,
  StrategyScript,
  StrategyShotListItem,
  StrategyOnScreenText,
  StrategyCtaVariant,
  StrategyEditorNotes,
  StrategyPlatformAdjustment,
} from "../../lib/videoAdGenerator/types";
import { NEXT_STATUS } from "../../lib/videoAdGenerator/types";

// ── Parse expanded brief from form ──────────────────────────────────

function parseExpandedBrief(fd: FormData): ExpandedConceptBrief {
  const keyClaims: ClaimProofPoint[] = [];
  const claimsRaw = formString(fd, "keyClaims");
  if (claimsRaw) {
    try { keyClaims.push(...JSON.parse(claimsRaw)); } catch { /* ignore */ }
  }

  const refUrls: string[] = [];
  const refsRaw = formString(fd, "referenceAssetUrls");
  if (refsRaw) {
    try { refUrls.push(...JSON.parse(refsRaw)); } catch {
      // Accept comma-separated URLs too
      refUrls.push(...refsRaw.split(",").map((u) => u.trim()).filter(Boolean));
    }
  }

  return {
    productName:         formString(fd, "productName"),
    offer:               formString(fd, "offer"),
    audience:            formString(fd, "audience"),
    painPoints:          formString(fd, "painPoints"),
    awarenessStage:      formString(fd, "awarenessStage", "problem_aware") as AwarenessStage,
    adStyle:             formString(fd, "adStyle", "ugc") as AdStyle,
    platform:            formString(fd, "platform", "facebook") as Platform,
    brandVoice:          formString(fd, "brandVoice") || undefined,
    extraNotes:          formString(fd, "extraNotes") || undefined,
    brandName:           formString(fd, "brandName") || undefined,
    marketSophistication: (parseInt(formString(fd, "marketSophistication", "3")) || 3) as MarketSophistication,
    keyClaims,
    ctaGoal:             (formString(fd, "ctaGoal", "purchase") as CtaGoal),
    visualStyle:         (formString(fd, "visualStyle", "polished_ugc") as VisualStyle),
    referenceAssetUrls:  refUrls,
  };
}

// ── Create v2 concept ───────────────────────────────────────────────

export async function createConceptV2Action(formData: FormData): Promise<CreateConceptResult> {
  const brief = parseExpandedBrief(formData);
  const title = formString(formData, "title") || `${brief.productName} — ${brief.adStyle} (v2)`;
  const mode = (formString(formData, "pipelineMode", "storyboard_only") as PipelineMode);
  const tier = (formString(formData, "tier", "premium") as GenerationTier);

  // Validate
  const missing: string[] = [];
  if (!brief.productName) missing.push("product");
  if (!brief.offer)       missing.push("offer");
  if (!brief.audience)    missing.push("audience");
  if (!brief.painPoints)  missing.push("pain points");
  if (missing.length > 0) {
    return { ok: false, error: `Missing required fields: ${missing.join(", ")}` };
  }

  const options: PipelineOptions = { mode, tier };

  let conceptId: string;
  try {
    // 1. Create concept row
    const concept = await prisma.videoAdConcept.create({
      data: {
        title,
        status:              "draft",
        platform:            brief.platform,
        adStyle:             brief.adStyle,
        productName:         brief.productName,
        offer:               brief.offer,
        audience:            brief.audience,
        painPoints:          brief.painPoints,
        awarenessStage:      brief.awarenessStage,
        brandVoice:          brief.brandVoice ?? null,
        extraNotes:          brief.extraNotes ?? null,
        brandName:           brief.brandName ?? null,
        marketSophistication: brief.marketSophistication,
        keyClaims:           JSON.stringify(brief.keyClaims),
        ctaGoal:             brief.ctaGoal,
        visualStyle:         brief.visualStyle,
        referenceAssetUrls:  JSON.stringify(brief.referenceAssetUrls),
        engineVersion:       "v2",
      },
    });
    conceptId = concept.id;

    // 2. Create strategy run record
    const strategyRun = await prisma.strategyRun.create({
      data: {
        conceptId,
        version:       1,
        status:        "running",
        mode,
        tier,
        model:         process.env.OPENAI_VIDEO_AD_PREMIUM_MODEL ?? "gpt-4o",
        inputSnapshot: JSON.stringify(brief),
      },
    });

    // 3. Execute strategy pipeline
    const startMs = Date.now();
    const result = await executeStrategyPipeline(brief, options);

    // 4. Store strategy outputs
    await prisma.strategyRun.update({
      where: { id: strategyRun.id },
      data: {
        status:              "completed",
        angleSet:            JSON.stringify(result.angleSet),
        hookSet:             JSON.stringify(result.hookSet),
        scriptSet:           JSON.stringify(result.script),
        shotList:            JSON.stringify(result.shotList),
        onScreenText:        JSON.stringify(result.onScreenText),
        ctaVariants:         JSON.stringify(result.ctaVariants),
        editorNotes:         JSON.stringify(result.editorNotes),
        platformAdjustments: JSON.stringify(result.platformAdjustments),
        durationMs:          Date.now() - startMs,
        completedAt:         new Date(),
      },
    });

    // 5. If render_ready mode, compile render brief
    if (mode === "render_ready") {
      const renderBrief = compileRenderBrief(result, brief, strategyRun.id);
      renderBrief.globalMetadata.conceptId = conceptId;

      await prisma.renderRun.create({
        data: {
          strategyRunId:  strategyRun.id,
          version:        1,
          status:         "compiled",
          renderBrief:    JSON.stringify(renderBrief),
          compilerVersion: COMPILER_VERSION,
        },
      });
    }
  } catch (err) {
    const message = err instanceof VideoAdGenError
      ? err.message
      : err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }

  revalidatePath("/video-ads");
  redirect(`/video-ads/${conceptId}`);
}

// ── Regenerate full strategy (creates new version) ──────────────────

export async function regenerateStrategyV2Action(
  conceptId: string,
  mode: PipelineMode = "storyboard_only",
  tier: GenerationTier = "premium"
): Promise<RegenerateResult> {
  try {
    const concept = await prisma.videoAdConcept.findUnique({ where: { id: conceptId } });
    if (!concept) throw new VideoAdGenError("Concept not found");
    if (concept.engineVersion !== "v2") {
      throw new VideoAdGenError("This concept uses v1 engine. Use v1 regenerate actions.");
    }

    // Get next version number
    const latestRun = await prisma.strategyRun.findFirst({
      where: { conceptId },
      orderBy: { version: "desc" },
    });
    const nextVersion = (latestRun?.version ?? 0) + 1;

    // Parse brief from concept
    const brief = parseExpandedBriefFromConcept(concept);
    const options: PipelineOptions = { mode, tier };

    const strategyRun = await prisma.strategyRun.create({
      data: {
        conceptId,
        version:       nextVersion,
        status:        "running",
        mode,
        tier,
        model:         process.env.OPENAI_VIDEO_AD_PREMIUM_MODEL ?? "gpt-4o",
        inputSnapshot: JSON.stringify(brief),
      },
    });

    const startMs = Date.now();
    const result = await executeStrategyPipeline(brief, options);

    await prisma.strategyRun.update({
      where: { id: strategyRun.id },
      data: {
        status:              "completed",
        angleSet:            JSON.stringify(result.angleSet),
        hookSet:             JSON.stringify(result.hookSet),
        scriptSet:           JSON.stringify(result.script),
        shotList:            JSON.stringify(result.shotList),
        onScreenText:        JSON.stringify(result.onScreenText),
        ctaVariants:         JSON.stringify(result.ctaVariants),
        editorNotes:         JSON.stringify(result.editorNotes),
        platformAdjustments: JSON.stringify(result.platformAdjustments),
        durationMs:          Date.now() - startMs,
        completedAt:         new Date(),
      },
    });

    revalidatePath(`/video-ads/${conceptId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Strategy regeneration failed" };
  }
}

// ── Compile render brief from latest strategy run ───────────────────

export async function compileRenderBriefAction(
  conceptId: string
): Promise<{ ok: boolean; renderRunId?: string; error?: string }> {
  try {
    const concept = await prisma.videoAdConcept.findUnique({ where: { id: conceptId } });
    if (!concept) throw new VideoAdGenError("Concept not found");

    const latestRun = await prisma.strategyRun.findFirst({
      where: { conceptId, status: "completed" },
      orderBy: { version: "desc" },
    });
    if (!latestRun) throw new VideoAdGenError("No completed strategy run found");

    const brief = JSON.parse(latestRun.inputSnapshot) as ExpandedConceptBrief;
    const strategyOutput: StrategyRunOutput = {
      angleSet:            JSON.parse(latestRun.angleSet!),
      hookSet:             JSON.parse(latestRun.hookSet!),
      script:              JSON.parse(latestRun.scriptSet!),
      shotList:            JSON.parse(latestRun.shotList!),
      onScreenText:        JSON.parse(latestRun.onScreenText || "[]"),
      ctaVariants:         JSON.parse(latestRun.ctaVariants || "[]"),
      editorNotes:         JSON.parse(latestRun.editorNotes!),
      platformAdjustments: JSON.parse(latestRun.platformAdjustments || "[]"),
    };

    const renderBrief = compileRenderBrief(strategyOutput, brief, latestRun.id);
    renderBrief.globalMetadata.conceptId = conceptId;

    // Get next render version
    const latestRender = await prisma.renderRun.findFirst({
      where: { strategyRunId: latestRun.id },
      orderBy: { version: "desc" },
    });
    const nextVersion = (latestRender?.version ?? 0) + 1;

    const renderRun = await prisma.renderRun.create({
      data: {
        strategyRunId:  latestRun.id,
        version:        nextVersion,
        status:         "compiled",
        renderBrief:    JSON.stringify(renderBrief),
        compilerVersion: COMPILER_VERSION,
      },
    });

    revalidatePath(`/video-ads/${conceptId}`);
    return { ok: true, renderRunId: renderRun.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Render brief compilation failed" };
  }
}

// ── V2 read helpers ─────────────────────────────────────────────────

export async function getLatestStrategyRun(conceptId: string) {
  return prisma.strategyRun.findFirst({
    where: { conceptId, status: "completed" },
    orderBy: { version: "desc" },
  });
}

export async function getStrategyRunHistory(conceptId: string) {
  return prisma.strategyRun.findMany({
    where: { conceptId },
    orderBy: { version: "desc" },
  });
}

export async function getLatestRenderRun(strategyRunId: string) {
  return prisma.renderRun.findFirst({
    where: { strategyRunId },
    orderBy: { version: "desc" },
  });
}

export async function getRenderBriefPreview(conceptId: string) {
  const strategyRun = await getLatestStrategyRun(conceptId);
  if (!strategyRun) return null;

  const renderRun = await getLatestRenderRun(strategyRun.id);
  if (!renderRun?.renderBrief) return null;

  const brief = JSON.parse(renderRun.renderBrief) as import("../../lib/videoAdGenerator/types").FullRenderBrief;

  // Attach Veo prompt previews
  const scenesWithPrompts = brief.scenes.map((scene) => ({
    ...scene,
    veoPromptPreview: composeScenePrompt(scene),
  }));

  return { ...brief, scenes: scenesWithPrompts };
}

// ── Utility: parse brief from DB concept row ────────────────────────

function parseExpandedBriefFromConcept(concept: {
  productName: string;
  offer: string;
  audience: string;
  painPoints: string;
  awarenessStage: string;
  adStyle: string;
  platform: string;
  brandVoice: string | null;
  extraNotes: string | null;
  brandName: string | null;
  marketSophistication: number;
  keyClaims: string | null;
  ctaGoal: string | null;
  visualStyle: string | null;
  referenceAssetUrls: string | null;
}): ExpandedConceptBrief {
  let keyClaims: ClaimProofPoint[] = [];
  try { keyClaims = JSON.parse(concept.keyClaims ?? "[]"); } catch { /* ignore */ }

  let refUrls: string[] = [];
  try { refUrls = JSON.parse(concept.referenceAssetUrls ?? "[]"); } catch { /* ignore */ }

  return {
    productName:         concept.productName,
    offer:               concept.offer,
    audience:            concept.audience,
    painPoints:          concept.painPoints,
    awarenessStage:      concept.awarenessStage as AwarenessStage,
    adStyle:             concept.adStyle as AdStyle,
    platform:            concept.platform as Platform,
    brandVoice:          concept.brandVoice ?? undefined,
    extraNotes:          concept.extraNotes ?? undefined,
    brandName:           concept.brandName ?? undefined,
    marketSophistication: (concept.marketSophistication ?? 3) as MarketSophistication,
    keyClaims,
    ctaGoal:             (concept.ctaGoal ?? "purchase") as CtaGoal,
    visualStyle:         (concept.visualStyle ?? "polished_ugc") as VisualStyle,
    referenceAssetUrls:  refUrls,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// V3 — Creative Workspace actions
// ═══════════════════════════════════════════════════════════════════════

async function getLatestCompletedRun(conceptId: string) {
  const run = await prisma.strategyRun.findFirst({
    where: { conceptId, status: "completed" },
    orderBy: { version: "desc" },
  });
  if (!run) throw new VideoAdGenError("No completed strategy run. Generate a strategy first.");
  return run;
}

async function getBriefForConcept(conceptId: string): Promise<ExpandedConceptBrief> {
  const concept = await prisma.videoAdConcept.findUnique({ where: { id: conceptId } });
  if (!concept) throw new VideoAdGenError("Concept not found");
  return parseExpandedBriefFromConcept(concept);
}

export async function regenV2AngleAction(conceptId: string): Promise<RegenerateResult> {
  try {
    const [brief, run] = await Promise.all([getBriefForConcept(conceptId), getLatestCompletedRun(conceptId)]);
    const result = await generateStrategyAngleSet(brief);
    await prisma.strategyRun.update({ where: { id: run.id }, data: { angleSet: JSON.stringify(result) } });
    revalidatePath(`/video-ads/${conceptId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Regen failed" };
  }
}

export async function regenV2HooksAction(conceptId: string): Promise<RegenerateResult> {
  try {
    const [brief, run] = await Promise.all([getBriefForConcept(conceptId), getLatestCompletedRun(conceptId)]);
    if (!run.angleSet) throw new VideoAdGenError("Generate an angle first");
    const angleSet = JSON.parse(run.angleSet) as StrategyAngleSet;
    const result = await generateStrategyHookSet(brief, angleSet);
    await prisma.strategyRun.update({ where: { id: run.id }, data: { hookSet: JSON.stringify(result) } });
    revalidatePath(`/video-ads/${conceptId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Regen failed" };
  }
}

export async function regenV2ScriptAction(conceptId: string, hookIndex = 0): Promise<RegenerateResult> {
  try {
    const [brief, run] = await Promise.all([getBriefForConcept(conceptId), getLatestCompletedRun(conceptId)]);
    if (!run.angleSet || !run.hookSet) throw new VideoAdGenError("Generate angle and hooks first");
    const angleSet = JSON.parse(run.angleSet) as StrategyAngleSet;
    const hookSet = JSON.parse(run.hookSet) as StrategyHookSet;
    const hook = hookSet.hooks[hookIndex] ?? hookSet.hooks[0];
    if (!hook) throw new VideoAdGenError("No hooks available");
    const result = await generateStrategyScript(brief, angleSet, hook);
    await prisma.strategyRun.update({ where: { id: run.id }, data: { scriptSet: JSON.stringify(result) } });
    revalidatePath(`/video-ads/${conceptId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Regen failed" };
  }
}

export async function regenV2ShotListAction(conceptId: string): Promise<RegenerateResult> {
  try {
    const [brief, run] = await Promise.all([getBriefForConcept(conceptId), getLatestCompletedRun(conceptId)]);
    if (!run.scriptSet) throw new VideoAdGenError("Generate a script first");
    const script = JSON.parse(run.scriptSet) as StrategyScript;
    const result = await generateStrategyShotList(brief, script);
    await prisma.strategyRun.update({ where: { id: run.id }, data: { shotList: JSON.stringify(result) } });
    revalidatePath(`/video-ads/${conceptId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Regen failed" };
  }
}

export async function regenV2OSTAction(conceptId: string): Promise<RegenerateResult> {
  try {
    const [brief, run] = await Promise.all([getBriefForConcept(conceptId), getLatestCompletedRun(conceptId)]);
    if (!run.scriptSet || !run.shotList) throw new VideoAdGenError("Generate script and shot list first");
    const script = JSON.parse(run.scriptSet) as StrategyScript;
    const shotList = JSON.parse(run.shotList) as StrategyShotListItem[];
    const result = await generateStrategyOnScreenText(brief, script, shotList);
    await prisma.strategyRun.update({ where: { id: run.id }, data: { onScreenText: JSON.stringify(result) } });
    revalidatePath(`/video-ads/${conceptId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Regen failed" };
  }
}

export async function regenV2CtasAction(conceptId: string): Promise<RegenerateResult> {
  try {
    const [brief, run] = await Promise.all([getBriefForConcept(conceptId), getLatestCompletedRun(conceptId)]);
    if (!run.angleSet) throw new VideoAdGenError("Generate an angle first");
    const angleSet = JSON.parse(run.angleSet) as StrategyAngleSet;
    const result = await generateStrategyCtaVariants(brief, angleSet);
    await prisma.strategyRun.update({ where: { id: run.id }, data: { ctaVariants: JSON.stringify(result) } });
    revalidatePath(`/video-ads/${conceptId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Regen failed" };
  }
}

export async function regenV2EditorNotesAction(conceptId: string): Promise<RegenerateResult> {
  try {
    const [brief, run] = await Promise.all([getBriefForConcept(conceptId), getLatestCompletedRun(conceptId)]);
    if (!run.scriptSet) throw new VideoAdGenError("Generate a script first");
    const script = JSON.parse(run.scriptSet) as StrategyScript;
    const shotList = run.shotList ? JSON.parse(run.shotList) as StrategyShotListItem[] : [];
    const result = await generateStrategyEditorNotes(brief, script, shotList);
    await prisma.strategyRun.update({ where: { id: run.id }, data: { editorNotes: JSON.stringify(result) } });
    revalidatePath(`/video-ads/${conceptId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Regen failed" };
  }
}

export async function regenV2PlatformAction(conceptId: string): Promise<RegenerateResult> {
  try {
    const [brief, run] = await Promise.all([getBriefForConcept(conceptId), getLatestCompletedRun(conceptId)]);
    const partial: Partial<StrategyRunOutput> = {};
    if (run.angleSet) partial.angleSet = JSON.parse(run.angleSet);
    if (run.hookSet) partial.hookSet = JSON.parse(run.hookSet);
    if (run.scriptSet) partial.script = JSON.parse(run.scriptSet);
    if (run.shotList) partial.shotList = JSON.parse(run.shotList);
    if (run.ctaVariants) partial.ctaVariants = JSON.parse(run.ctaVariants);
    if (run.editorNotes) partial.editorNotes = JSON.parse(run.editorNotes);
    const result = await generateStrategyPlatformAdjustments(brief, partial);
    await prisma.strategyRun.update({ where: { id: run.id }, data: { platformAdjustments: JSON.stringify(result) } });
    revalidatePath(`/video-ads/${conceptId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Regen failed" };
  }
}

export async function updateFavoritesAction(
  conceptId: string,
  data: { favoriteHookIndex?: number | null; favoriteCtaIndex?: number | null; winningTags?: string[] }
): Promise<RegenerateResult> {
  try {
    const updateData: Record<string, unknown> = {};
    if (data.favoriteHookIndex !== undefined) updateData.favoriteHookIndex = data.favoriteHookIndex;
    if (data.favoriteCtaIndex !== undefined) updateData.favoriteCtaIndex = data.favoriteCtaIndex;
    if (data.winningTags !== undefined) updateData.winningTags = JSON.stringify(data.winningTags);
    await prisma.videoAdConcept.update({ where: { id: conceptId }, data: updateData });
    revalidatePath(`/video-ads/${conceptId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Update failed" };
  }
}

export async function updateHandoffAction(
  conceptId: string,
  data: { editorHandoffNotes?: string; creatorHandoffNotes?: string; approvedStructure?: ApprovedStructure }
): Promise<RegenerateResult> {
  try {
    const updateData: Record<string, unknown> = {};
    if (data.editorHandoffNotes !== undefined) updateData.editorHandoffNotes = data.editorHandoffNotes;
    if (data.creatorHandoffNotes !== undefined) updateData.creatorHandoffNotes = data.creatorHandoffNotes;
    if (data.approvedStructure !== undefined) updateData.approvedStructure = JSON.stringify(data.approvedStructure);
    await prisma.videoAdConcept.update({ where: { id: conceptId }, data: updateData });
    revalidatePath(`/video-ads/${conceptId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Update failed" };
  }
}

export async function advanceStatusAction(conceptId: string): Promise<RegenerateResult> {
  try {
    const concept = await prisma.videoAdConcept.findUnique({ where: { id: conceptId } });
    if (!concept) throw new VideoAdGenError("Concept not found");
    const next = NEXT_STATUS[concept.status as ConceptStatus];
    if (!next) return { ok: false, error: `Cannot advance from "${concept.status}"` };
    await prisma.videoAdConcept.update({ where: { id: conceptId }, data: { status: next } });
    revalidatePath(`/video-ads/${conceptId}`);
    revalidatePath("/video-ads");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Status advance failed" };
  }
}

export async function setStatusAction(conceptId: string, status: string): Promise<RegenerateResult> {
  try {
    await prisma.videoAdConcept.update({ where: { id: conceptId }, data: { status } });
    revalidatePath(`/video-ads/${conceptId}`);
    revalidatePath("/video-ads");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Status update failed" };
  }
}

export async function duplicateConceptAction(conceptId: string): Promise<CreateConceptResult> {
  try {
    const original = await prisma.videoAdConcept.findUnique({ where: { id: conceptId } });
    if (!original) throw new VideoAdGenError("Concept not found");
    const { id: _id, createdAt: _ca, updatedAt: _ua, ...rest } = original;
    const duplicate = await prisma.videoAdConcept.create({
      data: {
        ...rest,
        title: `${original.title} (copy)`,
        status: "draft",
        duplicatedFromId: conceptId,
        favoriteHookIndex: null,
        favoriteCtaIndex: null,
        approvedStructure: null,
        winningTags: null,
      },
    });
    const latestRun = await prisma.strategyRun.findFirst({
      where: { conceptId, status: "completed" },
      orderBy: { version: "desc" },
    });
    if (latestRun) {
      const { id: _rid, conceptId: _cid, createdAt: _rca, completedAt: _rco, ...runRest } = latestRun;
      await prisma.strategyRun.create({
        data: { ...runRest, conceptId: duplicate.id, version: 1 },
      });
    }
    revalidatePath("/video-ads");
    return { ok: true, id: duplicate.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Duplicate failed" };
  }
}

export async function getConceptWorkspace(id: string) {
  return prisma.videoAdConcept.findUnique({ where: { id } });
}

// ═══════════════════════════════════════════════════════════════════════
// V3 — Creative Asset + Provider actions
// ═══════════════════════════════════════════════════════════════════════

import { getAvailableProviders, isProviderAvailable } from "../../lib/videoAdGenerator/providers";
import type { AssetType, AssetSourceType, AIProviderSlug } from "../../lib/videoAdGenerator/types";
import { PROVIDER_REGISTRY } from "../../lib/videoAdGenerator/types";

// ── Provider management ───────────────────────────────────────────────

/** Return all providers with their availability status (read env vars at runtime) */
export async function getProvidersAction() {
  return getAvailableProviders();
}

/** Seed/sync the AIProvider table from the PROVIDER_REGISTRY constant */
export async function syncProvidersAction(): Promise<{ ok: boolean; synced: number }> {
  const slugs = Object.keys(PROVIDER_REGISTRY) as AIProviderSlug[];
  let synced = 0;
  for (const slug of slugs) {
    const config = PROVIDER_REGISTRY[slug];
    await prisma.aIProvider.upsert({
      where: { provider: slug },
      update: {
        displayName:  config.displayName,
        isActive:     isProviderAvailable(slug),
        capabilities: JSON.stringify(config.capabilities),
        apiKeyEnvVar: config.apiKeyEnvVar,
        defaultModel: config.defaultModel,
      },
      create: {
        provider:     slug,
        displayName:  config.displayName,
        isActive:     isProviderAvailable(slug),
        capabilities: JSON.stringify(config.capabilities),
        apiKeyEnvVar: config.apiKeyEnvVar,
        defaultModel: config.defaultModel,
      },
    });
    synced++;
  }
  return { ok: true, synced };
}

// ── Creative Asset CRUD ───────────────────────────────────────────────

export interface AssetResult {
  ok:     boolean;
  id?:    string;
  error?: string;
}

/** Create a new creative asset (imported or external URL) */
export async function createAssetAction(data: {
  name:         string;
  type:         AssetType;
  sourceType:   AssetSourceType;
  url?:         string;
  thumbnailUrl?: string;
  mimeType?:    string;
  headline?:    string;
  body?:        string;
  callToAction?: string;
  tags?:        string[];
  notes?:       string;
  conceptId?:   string;
}): Promise<AssetResult> {
  try {
    const asset = await prisma.creativeAsset.create({
      data: {
        name:         data.name,
        type:         data.type,
        sourceType:   data.sourceType,
        status:       "draft",
        url:          data.url ?? null,
        thumbnailUrl: data.thumbnailUrl ?? null,
        mimeType:     data.mimeType ?? null,
        headline:     data.headline ?? null,
        body:         data.body ?? null,
        callToAction: data.callToAction ?? null,
        tags:         data.tags ? JSON.stringify(data.tags) : null,
        notes:        data.notes ?? null,
        conceptId:    data.conceptId ?? null,
      },
    });
    revalidatePath("/video-ads");
    return { ok: true, id: asset.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Asset creation failed" };
  }
}

/** Update asset metadata */
export async function updateAssetAction(
  assetId: string,
  data: Partial<{
    name: string;
    status: string;
    url: string;
    thumbnailUrl: string;
    headline: string;
    body: string;
    callToAction: string;
    tags: string[];
    notes: string;
  }>
): Promise<AssetResult> {
  try {
    await prisma.creativeAsset.update({
      where: { id: assetId },
      data: {
        ...data,
        tags: data.tags ? JSON.stringify(data.tags) : undefined,
      },
    });
    revalidatePath("/video-ads");
    return { ok: true, id: assetId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Asset update failed" };
  }
}

/** Delete an asset */
export async function deleteAssetAction(assetId: string): Promise<AssetResult> {
  try {
    await prisma.creativeAsset.delete({ where: { id: assetId } });
    revalidatePath("/video-ads");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Asset deletion failed" };
  }
}

/** List assets, optionally filtered by concept or type */
export async function listAssetsAction(filters?: {
  conceptId?: string;
  type?: AssetType;
  sourceType?: AssetSourceType;
  status?: string;
}) {
  return prisma.creativeAsset.findMany({
    where: {
      ...(filters?.conceptId  ? { conceptId:  filters.conceptId }  : {}),
      ...(filters?.type       ? { type:       filters.type }       : {}),
      ...(filters?.sourceType ? { sourceType: filters.sourceType } : {}),
      ...(filters?.status     ? { status:     filters.status }     : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

/** Promote a concept's render output to a standalone creative asset */
export async function promoteToAssetAction(conceptId: string): Promise<AssetResult> {
  try {
    const concept = await prisma.videoAdConcept.findUnique({ where: { id: conceptId } });
    if (!concept) throw new VideoAdGenError("Concept not found");

    // Find the latest completed render run
    const latestRun = await prisma.strategyRun.findFirst({
      where: { conceptId, status: "completed" },
      orderBy: { version: "desc" },
      include: { renderRuns: { orderBy: { version: "desc" }, take: 1 } },
    });

    const renderRun = latestRun?.renderRuns?.[0];

    const asset = await prisma.creativeAsset.create({
      data: {
        name:         `${concept.title} — Video`,
        type:         "video",
        sourceType:   "generated",
        status:       "ready",
        conceptId:    conceptId,
        renderRunId:  renderRun?.id ?? null,
        provider:     "anthropic", // strategy provider
        headline:     concept.title,
        notes:        concept.notes,
        tags:         concept.winningTags,
      },
    });

    revalidatePath("/video-ads");
    revalidatePath(`/video-ads/${conceptId}`);
    return { ok: true, id: asset.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Promote to asset failed" };
  }
}

/** Link a creative asset to an ad */
export async function linkAssetToAdAction(adId: string, assetId: string): Promise<AssetResult> {
  try {
    await prisma.ad.update({
      where: { id: adId },
      data: { creativeAssetId: assetId },
    });
    // Mark asset as in_use
    await prisma.creativeAsset.update({
      where: { id: assetId },
      data: { status: "in_use" },
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Link failed" };
  }
}
