// app/api/creative-lab/launch/route.ts
// GET  /api/creative-lab/launch — list experiment launch plans
// POST /api/creative-lab/launch — create a new experiment launch plan

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  loadExperimentLaunchPlans,
  buildExperimentLaunchPlanSummary,
  saveExperimentLaunchPlan,
  buildCreativeExperimentLaunchPlan,
} from "../../../../lib/experimentLaunch";
import type { CreateExperimentLaunchPlanInput } from "../../../../types/experimentLaunch";

// ---------------------------------------------------------------------------
// GET — list plans with optional clientAccountId filter
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const clientAccountId = req.nextUrl.searchParams.get("clientAccountId") ?? undefined;

    const [plans, summary] = await Promise.all([
      loadExperimentLaunchPlans({ clientAccountId, limit: 50 }),
      buildExperimentLaunchPlanSummary(clientAccountId),
    ]);

    return NextResponse.json({ ok: true, plans, summary });
  } catch (err) {
    console.error("[launch/GET]", err);
    return NextResponse.json({ ok: false, error: "Failed to load launch plans." }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — create a new plan
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<CreateExperimentLaunchPlanInput>;

    if (!body.clientAccountId) {
      return NextResponse.json(
        { ok: false, error: "clientAccountId is required." },
        { status: 400 },
      );
    }
    if (!body.name?.trim()) {
      return NextResponse.json(
        { ok: false, error: "name is required." },
        { status: 400 },
      );
    }

    const id   = randomUUID();
    const plan = buildCreativeExperimentLaunchPlan({
      id,
      input: body as CreateExperimentLaunchPlanInput,
    });

    await saveExperimentLaunchPlan(plan);

    return NextResponse.json({ ok: true, plan }, { status: 201 });
  } catch (err) {
    console.error("[launch/POST]", err);
    return NextResponse.json({ ok: false, error: "Failed to create launch plan." }, { status: 500 });
  }
}
