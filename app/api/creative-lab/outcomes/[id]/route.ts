// app/api/creative-lab/outcomes/[id]/route.ts
// GET   /api/creative-lab/outcomes/:id  — single route record
// PATCH /api/creative-lab/outcomes/:id  — update action state

import { NextRequest, NextResponse } from "next/server";
import {
  loadCreativeOutcomeRouteById,
  updateCreativeOutcomeRouteState,
} from "../../../../../lib/creativeOutcomeRouting";
import type { CreativeOutcomeReadinessState } from "../../../../../types/creativeOutcomeRouting";

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const route = await loadCreativeOutcomeRouteById(id);
    if (!route) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ route });
  } catch (err) {
    console.error("[GET /api/creative-lab/outcomes/:id]", err);
    return NextResponse.json({ error: "Failed to load outcome route" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH — update readiness state / action fields
// ---------------------------------------------------------------------------

const VALID_STATES: CreativeOutcomeReadinessState[] = [
  "pending_action",
  "actioned",
  "archived",
  "learning_captured",
];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: {
    readinessState?: string;
    actionedBy?:     string;
    actionNote?:     string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate readinessState if provided
  if (body.readinessState && !VALID_STATES.includes(body.readinessState as CreativeOutcomeReadinessState)) {
    return NextResponse.json(
      { error: `Invalid readinessState. Valid: ${VALID_STATES.join(", ")}` },
      { status: 400 },
    );
  }

  try {
    const now = new Date().toISOString();
    const patch: Parameters<typeof updateCreativeOutcomeRouteState>[1] = {};

    if (body.readinessState) {
      patch.readinessState = body.readinessState as CreativeOutcomeReadinessState;
    }
    if (body.actionedBy !== undefined) {
      patch.actionedBy = body.actionedBy;
      patch.actionedAt = now;
    }
    if (body.actionNote !== undefined) {
      patch.actionNote = body.actionNote;
    }
    if (body.readinessState === "archived") {
      patch.archivedAt = now;
    }

    const updated = await updateCreativeOutcomeRouteState(id, patch);
    return NextResponse.json({ route: updated });
  } catch (err) {
    console.error("[PATCH /api/creative-lab/outcomes/:id]", err);
    return NextResponse.json({ error: "Failed to update outcome route" }, { status: 500 });
  }
}
