// app/api/creative-lab/results/route.ts
// GET  /api/creative-lab/results — list creative test results
// POST /api/creative-lab/results — create a new test result record

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  loadCreativeTestResults,
  buildCreativeTestResultDbSummary,
  saveCreativeTestResult,
} from "../../../../lib/creativeTestResults";
import type { CreateCreativeTestResultInput } from "../../../../types/creativeTestResults";

// ---------------------------------------------------------------------------
// GET — list results with optional filters
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const clientAccountId = req.nextUrl.searchParams.get("clientAccountId") ?? undefined;

    const [results, summary] = await Promise.all([
      loadCreativeTestResults({ clientAccountId, limit: 50 }),
      buildCreativeTestResultDbSummary(clientAccountId),
    ]);

    return NextResponse.json({ ok: true, results, summary });
  } catch (err) {
    console.error("[results/GET]", err);
    return NextResponse.json({ ok: false, error: "Failed to load test results." }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — create a new test result record
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<CreateCreativeTestResultInput>;

    if (!body.clientAccountId) {
      return NextResponse.json({ ok: false, error: "clientAccountId is required." }, { status: 400 });
    }
    if (!body.name?.trim()) {
      return NextResponse.json({ ok: false, error: "name is required." }, { status: 400 });
    }

    const id = randomUUID();
    await saveCreativeTestResult({ id, ...(body as CreateCreativeTestResultInput) });

    const [results, summary] = await Promise.all([
      loadCreativeTestResults({ clientAccountId: body.clientAccountId, limit: 50 }),
      buildCreativeTestResultDbSummary(body.clientAccountId),
    ]);

    return NextResponse.json({ ok: true, id, results, summary }, { status: 201 });
  } catch (err) {
    console.error("[results/POST]", err);
    return NextResponse.json({ ok: false, error: "Failed to create test result." }, { status: 500 });
  }
}
