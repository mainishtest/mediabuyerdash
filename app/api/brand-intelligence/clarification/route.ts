// POST /api/brand-intelligence/clarification
// Returns smart clarification questions based on current brand context state.

import { NextRequest, NextResponse } from "next/server";
import { getBrandContext }                    from "../../../../lib/brandIntelligence/db";
import { summarizeBrandPromptSystem }         from "../../../../lib/brandIntelligence/brandContext";
import { generateClarificationQuestions }     from "../../../../lib/brandIntelligence/clarification";

export async function POST(req: NextRequest) {
  const body = await req.json() as { clientAccountId?: string };

  if (!body.clientAccountId) {
    return NextResponse.json({ error: "clientAccountId is required" }, { status: 400 });
  }

  const row = await getBrandContext(body.clientAccountId);
  const memory = row?.data ?? null;
  const summary = summarizeBrandPromptSystem(memory);
  const questions = generateClarificationQuestions(memory, summary);

  return NextResponse.json({ questions, summary });
}
