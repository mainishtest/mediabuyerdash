// app/api/creative-lab/quick-launch/route.ts
// POST /api/creative-lab/quick-launch
//
// Creates an experiment launch plan from a QuickLaunchDraft.
// This is the simplified one-step launch endpoint that bypasses
// the brief → score → publish-prep → launch pipeline.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { randomUUID } from "crypto";
import {
  buildCreativeExperimentLaunchPlan,
  saveExperimentLaunchPlan,
} from "../../../../lib/experimentLaunch";
import type { QuickLaunchDraft } from "../../../../types/creativeWorkflow";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let draft: QuickLaunchDraft;
  try {
    draft = (await req.json()) as QuickLaunchDraft;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!draft.clientAccountId || !draft.controlCreativeId || !draft.challengerVariantId) {
    return NextResponse.json(
      { ok: false, error: "clientAccountId, controlCreativeId, and challengerVariantId are required" },
      { status: 400 },
    );
  }

  try {
    const id = randomUUID();
    const plan = buildCreativeExperimentLaunchPlan({
      id,
      input: {
        clientAccountId:       draft.clientAccountId,
        name:                  draft.suggestedName,
        hypothesis:            `${draft.challengerTitle} will outperform control on ${draft.primaryMetric}`,
        variantId:              draft.challengerVariantId,
        challengerVariantTitle: draft.challengerTitle,
        challengerVariantType: draft.challengerType === "image_brief" ? "image" : "copy",
        primaryMetric:         draft.primaryMetric,
        evaluationWindowDays:  draft.evaluationWindowDays,
      },
    });

    await saveExperimentLaunchPlan(plan);

    return NextResponse.json({ ok: true, plan }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[quick-launch] error:", msg);
    return NextResponse.json({ ok: false, error: `Failed to create launch plan: ${msg}` }, { status: 500 });
  }
}
