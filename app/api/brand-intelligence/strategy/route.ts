// POST /api/brand-intelligence/strategy
// Generates creative strategy frame + prompts from brand context.

import { NextRequest, NextResponse } from "next/server";
import { getBrandContext }            from "../../../../lib/brandIntelligence/db";
import { buildCreativeStrategyFrame } from "../../../../lib/brandIntelligence/creativeStrategy";
import {
  buildPromptGenerationContext,
  generatePromptResult,
} from "../../../../lib/brandIntelligence/promptBuilder";
import type { VariationIntent } from "../../../../types/brandIntelligence";

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    clientAccountId?: string;
    intent?:          VariationIntent | null;
    mode?:            "copy" | "image" | "both";
    sourceAdContext?: string | null;
  };

  if (!body.clientAccountId) {
    return NextResponse.json({ error: "clientAccountId is required" }, { status: 400 });
  }

  const row = await getBrandContext(body.clientAccountId);
  if (!row) {
    return NextResponse.json(
      { error: "No brand context found. Please set up brand intelligence first." },
      { status: 404 },
    );
  }

  const memory = row.data;
  const strategy = buildCreativeStrategyFrame(memory, body.intent ?? null);
  const ctx = buildPromptGenerationContext(
    memory,
    strategy,
    body.sourceAdContext ?? null,
  );
  const result = generatePromptResult(ctx, body.mode ?? "both", 3);

  return NextResponse.json({ strategy, result });
}
