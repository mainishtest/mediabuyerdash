// app/api/creative-lab/workspace/route.ts
// API for Creative Review Workspace actions.
//
// POST — approve/reject variants, create test drafts, update status.
// Data loading is handled server-side by the workspace page.tsx.

import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "../../../../lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body as { action: string };

  switch (action) {
    case "update_status": {
      const { itemId, status, note } = body as {
        itemId: string; status: string; note?: string;
      };
      await prisma.creativeLabWorkflowItem.update({
        where: { id: itemId },
        data: {
          status: reverseMapStatus(status),
          ...(note ? { notes: note } : {}),
        },
      });
      await prisma.creativeLabActivityLog.create({
        data: {
          itemId,
          action: `Status → ${status}`,
          fromStatus: "",
          toStatus:   reverseMapStatus(status),
          note:       note ?? null,
        },
      });
      return NextResponse.json({ ok: true });
    }

    case "approve_variant": {
      const { variantId, decision } = body as {
        variantId: string; decision: string;
      };
      await prisma.creativeDraftVariantRecord.update({
        where: { id: variantId },
        data: {
          reviewDecision: decision,
          reviewedAt:     new Date(),
        },
      });
      return NextResponse.json({ ok: true });
    }

    case "create_test_draft": {
      const { name, clientAccountId, campaignId, adId, adName } = body as {
        name: string; clientAccountId: string; campaignId?: string;
        adId?: string; adName?: string; combinationIds: string[];
      };
      const draft = await prisma.launchDraft.create({
        data: {
          clientAccountId,
          campaignId: campaignId ?? "unknown",
          baseAdId:   adId ?? "unknown",
          baseAdName: adName ?? "Ad",
          draftName:  name,
          source:     "generated_both",
          status:     "draft",
        },
      });
      return NextResponse.json({ ok: true, draftId: draft.id });
    }

    default:
      return NextResponse.json(
        { ok: false, error: "Unknown action" },
        { status: 400 },
      );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function reverseMapStatus(wsStatus: string): string {
  const map: Record<string, string> = {
    needs_review:      "queued",
    in_review:         "in_review",
    generating:        "in_review",
    comparing:         "in_review",
    approved:          "approved",
    test_created:      "approved",
    queued_for_launch: "approved",
    archived:          "archived",
  };
  return map[wsStatus] ?? "queued";
}
