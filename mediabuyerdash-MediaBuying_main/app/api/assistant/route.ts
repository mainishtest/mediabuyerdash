// ─── API Route — /api/assistant ───────────────────────────────────────────────
//
// POST: receives a question + filter context, assembles data context,
// classifies intent, builds grounded response.

import { NextRequest, NextResponse }                from "next/server";
import { getServerSession }                         from "next-auth";
import { authOptions }                              from "../../../lib/auth";
import { buildOptimizationAssistantContext }        from "../../../lib/optimizationAssistant/contextAssembler";
import { classifyOptimizationAssistantIntent }      from "../../../lib/optimizationAssistant/intentClassifier";
import { buildOptimizationAssistantResponse }       from "../../../lib/optimizationAssistant/responseBuilder";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { question?: string; clientId?: string; dateFrom?: string; dateTo?: string };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { question, clientId, dateFrom, dateTo } = body;

  if (!question || typeof question !== "string" || question.trim().length === 0) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  try {
    const [ctx, intent] = await Promise.all([
      buildOptimizationAssistantContext({ clientId, dateFrom, dateTo }),
      Promise.resolve(classifyOptimizationAssistantIntent(question)),
    ]);

    const response = await buildOptimizationAssistantResponse(ctx, intent, question.trim());

    return NextResponse.json(response);
  } catch (err) {
    console.error("[api/assistant]", err);
    return NextResponse.json({ error: "Failed to generate assistant response" }, { status: 500 });
  }
}
