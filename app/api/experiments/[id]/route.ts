// app/api/experiments/[id]/route.ts
// GET  — load a single experiment with result and learnings
// PATCH — actions: archive, set_status

import { NextRequest, NextResponse }    from "next/server";
import {
  loadExperimentById,
  updateExperimentStatus,
}                                       from "../../../../lib/experiments";

// ---------------------------------------------------------------------------
// GET — detail
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const experiment = await loadExperimentById(id);
    if (!experiment) return NextResponse.json({ error: "Experiment not found." }, { status: 404 });
    return NextResponse.json({ ok: true, experiment });
  } catch (err) {
    console.error("[experiments/[id] GET]", err);
    return NextResponse.json({ error: "Failed to load experiment." }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH — actions
// ---------------------------------------------------------------------------

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { action } = (body ?? {}) as { action?: string };
  if (!action) return NextResponse.json({ error: "action is required." }, { status: 400 });

  const experiment = await loadExperimentById(id).catch(() => null);
  if (!experiment) return NextResponse.json({ error: "Experiment not found." }, { status: 404 });

  if (action === "archive") {
    await updateExperimentStatus(id, "archived");
    return NextResponse.json({ ok: true, id, status: "archived" });
  }

  if (action === "set_status") {
    const { status } = body as { status?: string };
    if (!status) return NextResponse.json({ error: "status is required." }, { status: 400 });
    await updateExperimentStatus(id, status as never);
    return NextResponse.json({ ok: true, id, status });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
