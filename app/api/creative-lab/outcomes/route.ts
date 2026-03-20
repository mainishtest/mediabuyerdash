// app/api/creative-lab/outcomes/route.ts
// GET  /api/creative-lab/outcomes  — list routes + summary
// POST /api/creative-lab/outcomes  — create/refresh route from a testResultId

import { NextRequest, NextResponse } from "next/server";
import {
  loadCreativeOutcomeRoutes,
  buildCreativeOutcomeRoutingSummary,
  saveCreativeOutcomeRoute,
  loadCreativeOutcomeRouteByTestResultId,
} from "../../../../lib/creativeOutcomeRouting";
import { buildCreativeOutcomeRoute } from "../../../../lib/creativeOutcomeRouting/router";
import { loadCreativeTestResultById } from "../../../../lib/creativeTestResults/db";

// ---------------------------------------------------------------------------
// GET — list
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const clientAccountId = searchParams.get("clientAccountId") ?? undefined;
  const readinessState  = searchParams.get("readinessState") as
    | "pending_action" | "actioned" | "archived" | "learning_captured" | undefined;
  const limit  = parseInt(searchParams.get("limit")  ?? "100", 10);
  const offset = parseInt(searchParams.get("offset") ?? "0",   10);

  try {
    const [routes, summary] = await Promise.all([
      loadCreativeOutcomeRoutes({ clientAccountId, readinessState, limit, offset }),
      buildCreativeOutcomeRoutingSummary(clientAccountId),
    ]);
    return NextResponse.json({ routes, summary });
  } catch (err) {
    console.error("[GET /api/creative-lab/outcomes]", err);
    return NextResponse.json({ error: "Failed to load outcome routes" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — create or refresh route from testResultId
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  let body: { testResultId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { testResultId } = body;
  if (!testResultId) {
    return NextResponse.json({ error: "testResultId is required" }, { status: 400 });
  }

  try {
    const result = await loadCreativeTestResultById(testResultId);
    if (!result) {
      return NextResponse.json({ error: "CreativeTestResult not found" }, { status: 404 });
    }

    const route    = buildCreativeOutcomeRoute(result);
    const saved    = await saveCreativeOutcomeRoute(route);
    return NextResponse.json({ route: saved }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/creative-lab/outcomes]", err);
    return NextResponse.json({ error: "Failed to create outcome route" }, { status: 500 });
  }
}
