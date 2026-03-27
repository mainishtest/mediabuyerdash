// app/api/creative-lab/items/[id]/route.ts
// PATCH — persist a workflow state transition or notes update for a
//         Creative Lab item. The item ID is a deterministic string built
//         from (clientAccountId, creativeId, campaignId) — see
//         lib/creativelab/db.ts buildWorkflowItemId().
//
// Body (JSON):
//   { action: "status", toStatus: CreativeLabStatus, fromStatus?: string, note?: string }
//   { action: "notes",  notes: string }

import { NextRequest, NextResponse } from "next/server";
import {
  upsertWorkflowItemStatus,
  upsertWorkflowItemNotes,
}                                    from "../../../../../lib/creativelab/db";
import type { CreativeLabStatus }    from "../../../../../types/creativeLab";

const VALID_STATUSES = new Set<string>([
  "draft", "queued", "in_review", "approved",
  "rejected", "needs_revision", "blocked", "archived",
]);

type Params = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Params) {
  const id = params.id;
  if (!id) {
    return NextResponse.json({ error: "Missing item id" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = body.action as string | undefined;

  // ── Status transition ──────────────────────────────────────────────────────
  if (action === "status") {
    const toStatus  = body.toStatus  as string | undefined;
    const fromStatus = body.fromStatus as string | undefined;
    const note      = body.note      as string | undefined;
    const clientAccountId = body.clientAccountId as string | undefined;

    if (!toStatus || !VALID_STATUSES.has(toStatus)) {
      return NextResponse.json({ error: `Invalid toStatus: ${toStatus}` }, { status: 400 });
    }
    if (!clientAccountId) {
      return NextResponse.json({ error: "Missing clientAccountId" }, { status: 400 });
    }

    await upsertWorkflowItemStatus({
      id,
      clientAccountId,
      fromStatus: fromStatus ?? null,
      toStatus:   toStatus as CreativeLabStatus,
      note,
    }).catch((err) => {
      console.error("[creative-lab/items PATCH status]", err);
      throw err;
    });

    return NextResponse.json({ ok: true, id, status: toStatus });
  }

  // ── Notes update ───────────────────────────────────────────────────────────
  if (action === "notes") {
    const notes           = body.notes           as string | undefined;
    const clientAccountId = body.clientAccountId as string | undefined;

    if (notes === undefined) {
      return NextResponse.json({ error: "Missing notes" }, { status: 400 });
    }
    if (!clientAccountId) {
      return NextResponse.json({ error: "Missing clientAccountId" }, { status: 400 });
    }

    await upsertWorkflowItemNotes({
      id,
      clientAccountId,
      notes,
    }).catch((err) => {
      console.error("[creative-lab/items PATCH notes]", err);
      throw err;
    });

    return NextResponse.json({ ok: true, id });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
