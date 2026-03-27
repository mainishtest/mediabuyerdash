// app/api/creative-lab/creative-engine/route.ts
// Performance-Driven AI Creative Engine API
//
// POST /api/creative-lab/creative-engine
//   Generates creative concepts and variants from a performance context.
//   Delegates to the generation engine (Anthropic or structured mock).
//
// Request body:
//   {
//     clientAccountId: string
//     snapshot:        CreativePerformanceSnapshot   (serialised from server)
//     mode:            "concepts" | "variants" | "copy_blocks"
//     triggerType:     "fatigue" | "underperformance" | "opportunity" | "manual"
//     generationMode:  CreativeGenerationMode        (optional, for "variants" mode)
//     constraints:     CreativeGenerationConstraint[] (optional)
//     roasGoal:        number | null                 (optional)
//     cpaGoal:         number | null                 (optional)
//     primaryGoalType: string | null                 (optional)
//   }
//
// Response on success:
//   { ok: true, concepts?, variants?, copyBlocks?, summary, warnings, contextMeta }
//
// Response on error:
//   { ok: false, error: string }
//
// Design rules:
//   - Requires authenticated session — returns 401 otherwise.
//   - CRM-verified ROAS/CPA flows from snapshot → context → generation.
//   - Generation always returns structured output (Anthropic or mock fallback).
//   - Constraint violations produce warnings, not hard errors.
//   - Never auto-publishes — returns raw structured output only.

import { NextResponse }                       from "next/server";
import { getServerSession }                   from "next-auth";
import { authOptions }                        from "../../../../lib/auth";
import {
  buildCreativeGenerationContext,
}                                             from "../../../../lib/creativeGeneration/context";
import {
  generateCreativeConcepts,
  generateCreativeVariants,
  generateCreativeCopyBlocks,
  applyCreativeConstraints,
  summarizeCreativeGeneration,
}                                             from "../../../../lib/creativeGeneration/concepts";
import type {
  CreativeGenerationMode,
  CreativeGenerationConstraint,
  CreativeConcept,
  CreativeVariant,
}                                             from "../../../../types/creativeGeneration";
import type { CreativePerformanceSnapshot }   from "../../../../lib/creativelab/types";

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    clientAccountId,
    snapshot,
    mode           = "concepts",
    triggerType    = "manual",
    generationMode = "copy_variations",
    constraints    = [],
    roasGoal,
    cpaGoal,
    primaryGoalType,
  } = body as {
    clientAccountId:  string;
    snapshot:         CreativePerformanceSnapshot;
    mode?:            "concepts" | "variants" | "copy_blocks";
    triggerType?:     "fatigue" | "underperformance" | "opportunity" | "manual";
    generationMode?:  CreativeGenerationMode;
    constraints?:     CreativeGenerationConstraint[];
    roasGoal?:        number | null;
    cpaGoal?:         number | null;
    primaryGoalType?: string | null;
  };

  if (!clientAccountId) {
    return NextResponse.json({ ok: false, error: "clientAccountId is required" }, { status: 400 });
  }
  if (!snapshot || typeof snapshot !== "object") {
    return NextResponse.json({ ok: false, error: "snapshot is required" }, { status: 400 });
  }

  try {
    // Build enriched context from performance snapshot + learning memory
    const context = await buildCreativeGenerationContext({
      snapshot,
      triggerType,
      roasGoal,
      cpaGoal,
      primaryGoalType,
    });

    const contextMeta = {
      clientName:       context.clientName,
      evaluationStatus: context.evaluationStatus,
      fatigueStatus:    context.fatigueStatus,
      dataQuality:      context.dataQuality,
      triggerType:      context.triggerType,
      triggerRationale: context.triggerRationale,
      currentCtr:       context.currentCtr,
      currentRoas:      context.currentRoas,
      winningPatterns:  context.winningPatterns.length,
      losingPatterns:   context.losingPatterns.length,
      builtAt:          context.builtAt,
    };

    // ── copy_blocks mode ────────────────────────────────────────────────────
    if (mode === "copy_blocks") {
      const blocks = await generateCreativeCopyBlocks(context);
      const summary = summarizeCreativeGeneration([], [], context, "engine", ["copy_variations"], []);
      return NextResponse.json({ ok: true, copyBlocks: blocks, summary, warnings: [], contextMeta });
    }

    // ── variants mode ───────────────────────────────────────────────────────
    if (mode === "variants") {
      const rawVariants         = await generateCreativeVariants(context, generationMode);
      const { valid, warnings } = applyCreativeConstraints(rawVariants, constraints);
      const summary             = summarizeCreativeGeneration([], valid, context, "engine", [generationMode], warnings);
      return NextResponse.json({ ok: true, variants: valid, summary, warnings, contextMeta });
    }

    // ── concepts mode (default) ─────────────────────────────────────────────
    console.log("[creative-engine] Generating concepts for", context.clientName, "trigger:", context.triggerType);
    const concepts = await generateCreativeConcepts(context);
    console.log("[creative-engine] Generated", concepts.length, "concepts");

    // Build flat variants from concepts for constraint validation
    const allVariants: CreativeVariant[] = concepts.flatMap((c: CreativeConcept) => {
      const v: CreativeVariant[] = [];
      if (c.copyBlock) {
        v.push({
          id:                   c.copyBlock.id,
          conceptId:            c.id,
          variantType:          "copy",
          title:                c.title,
          hook:                 c.copyBlock.hook.text,
          body:                 c.copyBlock.body,
          callToAction:         c.copyBlock.callToAction,
          angle:                c.angle.name,
          performanceRationale: c.performanceRationale,
          status:               "generated",
          reviewDecision:       null,
          reviewNote:           null,
          editedCopy:           null,
          generatedAt:          new Date().toISOString(),
        });
      }
      if (c.imageBrief) {
        v.push({
          id:                   crypto.randomUUID(),
          conceptId:            c.id,
          variantType:          "image",
          title:                `${c.title} — Image Brief`,
          conceptSummary:       c.imageBrief.conceptSummary,
          visualChanges:        c.imageBrief.visualChanges,
          goal:                 c.imageBrief.goal,
          directResponseAngle:  c.imageBrief.directResponseAngle,
          angle:                c.angle.name,
          performanceRationale: c.performanceRationale,
          status:               "generated",
          reviewDecision:       null,
          reviewNote:           null,
          editedCopy:           null,
          generatedAt:          new Date().toISOString(),
        });
      }
      return v;
    });

    const { warnings } = applyCreativeConstraints(allVariants, constraints);
    const summary = summarizeCreativeGeneration(
      concepts,
      allVariants,
      context,
      "engine",
      ["full_refresh_package"],
      warnings,
    );

    return NextResponse.json({ ok: true, concepts, variants: allVariants, summary, warnings, contextMeta });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[creative-engine] generation error:", msg);
    return NextResponse.json({ ok: false, error: `Generation failed: ${msg}` }, { status: 500 });
  }
}
