// app/api/creative-lab/results/[id]/route.ts
// GET   /api/creative-lab/results/[id] — fetch a single test result
// PATCH /api/creative-lab/results/[id] — update review state, archive, link experiment

import { NextRequest, NextResponse } from "next/server";
import {
  loadCreativeTestResultById,
  updateCreativeTestResult,
} from "../../../../../lib/creativeTestResults";

// ---------------------------------------------------------------------------
// GET — fetch single test result
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await loadCreativeTestResultById(id);
    if (!result) {
      return NextResponse.json({ ok: false, error: "Test result not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("[results/[id]/GET]", err);
    return NextResponse.json({ ok: false, error: "Failed to fetch result." }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH — partial update
//
// Accepted actions:
//   markForReview: boolean
//   archive: boolean
//   linkExperiment: string (experimentId)
//   linkLaunchPlan: string (launchPlanId)
// ---------------------------------------------------------------------------

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const result = await loadCreativeTestResultById(id);
    if (!result) {
      return NextResponse.json({ ok: false, error: "Test result not found." }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patch: Record<string, any> = {};

    if (body.markForReview !== undefined) patch.markedForReview = !!body.markForReview;
    if (body.archive === true)            patch.archivedAt      = new Date();
    if (body.unarchive === true)          patch.archivedAt      = null;
    if (body.linkExperiment)             patch.experimentId    = body.linkExperiment;
    if (body.linkLaunchPlan)             patch.launchPlanId    = body.linkLaunchPlan;
    if (body.trackingState)              patch.trackingState   = body.trackingState;
    if (body.outcome)                    patch.outcome         = body.outcome;

    await updateCreativeTestResult(id, patch);

    const updated = await loadCreativeTestResultById(id);
    return NextResponse.json({ ok: true, result: updated });
  } catch (err) {
    console.error("[results/[id]/PATCH]", err);
    return NextResponse.json({ ok: false, error: "Failed to update result." }, { status: 500 });
  }
}
