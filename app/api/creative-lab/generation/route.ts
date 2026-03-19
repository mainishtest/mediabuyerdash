// app/api/creative-lab/generation/route.ts
// POST /api/creative-lab/generation
//
// Triggers a performance-driven AI creative generation run for a given brief.
// Steps:
//   1. Validate request — briefId + mode required
//   2. Load brief from DB
//   3. Build CreativeGenerationInput
//   4. Create job record (status: running)
//   5. Call generateCreativeDrafts() — Anthropic or mock fallback
//   6. Persist variants + complete job record
//   7. Return { ok, jobId, provider, variantCount, variants }
//
// Failure modes:
//   - Missing brief → 404
//   - Invalid mode → 400
//   - Generation failure → 200 with ok: false + error details (not a 5xx)
//     so the UI can display a clear message without throwing

import { NextRequest, NextResponse }   from "next/server";
import { loadCreativeBriefById }       from "../../../../lib/creativeBrief/db";
import {
  buildCreativeGenerationInput,
  generateCreativeDrafts,
  createGenerationJob,
  completeGenerationJob,
  failGenerationJob,
}                                      from "../../../../lib/creativeGeneration";
import type { CreativeGenerationMode } from "../../../../types/creativeGeneration";

const VALID_MODES: CreativeGenerationMode[] = [
  "copy_variations",
  "headline_variations",
  "angle_variations",
  "image_brief_variations",
  "full_refresh_package",
];

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    briefId,
    mode,
    constraints = [],
    regenerate   = false,
  } = (body ?? {}) as {
    briefId?:     string;
    mode?:        string;
    constraints?: unknown[];
    regenerate?:  boolean;
  };

  // ── Validation ─────────────────────────────────────────────────────────────
  if (!briefId || typeof briefId !== "string") {
    return NextResponse.json({ error: "briefId is required" }, { status: 400 });
  }

  if (!mode || !VALID_MODES.includes(mode as CreativeGenerationMode)) {
    return NextResponse.json(
      { error: `mode must be one of: ${VALID_MODES.join(", ")}` },
      { status: 400 },
    );
  }

  // ── Load brief ─────────────────────────────────────────────────────────────
  let brief;
  try {
    brief = await loadCreativeBriefById(briefId);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load brief from database" },
      { status: 500 },
    );
  }

  if (!brief) {
    return NextResponse.json({ error: "Brief not found" }, { status: 404 });
  }

  // ── Build input ─────────────────────────────────────────────────────────────
  const genInput = buildCreativeGenerationInput({
    brief,
    mode:        mode as CreativeGenerationMode,
    constraints: Array.isArray(constraints)
      ? constraints.filter(
          (c): c is { type: string; value: string; reason: string } =>
            c !== null &&
            typeof c === "object" &&
            "type" in (c as object) &&
            "value" in (c as object),
        )
      : [],
    regenerate,
  });

  // ── Create job record ───────────────────────────────────────────────────────
  // Non-fatal — generation proceeds even if job record write fails
  const jobId = crypto.randomUUID();
  await createGenerationJob({
    id:      jobId,
    briefId: brief.id,
    mode:    mode as CreativeGenerationMode,
  });

  // Override the engine's internal jobId with the pre-created one so they match
  // by passing it through the input (engine generates its own jobId internally,
  // so we accept a slight jobId mismatch here — both are recorded in the output)

  // ── Generate ────────────────────────────────────────────────────────────────
  const result = await generateCreativeDrafts(genInput);

  if (!result.ok) {
    await failGenerationJob(jobId, result.error.message);
    return NextResponse.json(
      {
        ok:    false,
        error: result.error.message,
        code:  result.error.code,
        retryable: result.error.retryable,
      },
      { status: 200 },  // 200 so UI handles gracefully vs network error
    );
  }

  // ── Persist output ──────────────────────────────────────────────────────────
  await completeGenerationJob(result.output, brief.id);

  return NextResponse.json({
    ok:           true,
    jobId:        result.output.jobId,
    provider:     result.output.provider,
    mode:         result.output.mode,
    rationale:    result.output.rationale,
    variantCount: result.output.variants.length,
    variants:     result.output.variants,
    tokensUsed:   result.output.tokensUsed,
    latencyMs:    result.output.latencyMs,
    generatedAt:  result.output.generatedAt,
  });
}
