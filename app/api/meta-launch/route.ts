// app/api/meta-launch/route.ts
// POST — execute a Meta launch from an approved publish prep item
// GET  — list launch records with optional filters
//
// POST body:
//   prepItemId       (required) — PublishPrepRecord.id
//   clientAccountId  (required) — client context
//   executionMode    (optional) — "manual_publish" | "guarded_publish" (default: guarded_publish)
//   variantRole      (optional) — "control" | "challenger" | "backup_candidate" (default: challenger)
//   controlAdExternalId      (optional) — for auto-experiment wiring
//   controlAdSetExternalId   (optional)
//   controlCampaignExternalId (optional)
//   controlCreativeId        (optional)
//   controlLabel             (optional)
//   experimentId    (optional) — link to existing experiment
//   launchPlanId    (optional) — link to existing launch plan

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { executeMetaLaunch, summarizeMetaLaunchResult } from "../../../lib/metaLaunch/executor";
import { loadLaunchRecords, buildLaunchSummary } from "../../../lib/metaLaunch/db";
import type { MetaLaunchRequest } from "../../../lib/metaLaunch/types";

export const maxDuration = 60;

// ---------------------------------------------------------------------------
// GET — list launches
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const clientAccountId = searchParams.get("clientAccountId") ?? undefined;
  const status          = searchParams.get("status") as never ?? undefined;
  const prepItemId      = searchParams.get("prepItemId") ?? undefined;
  const experimentId    = searchParams.get("experimentId") ?? undefined;

  try {
    const [records, summary] = await Promise.all([
      loadLaunchRecords({ clientAccountId, status, prepItemId, experimentId }),
      buildLaunchSummary(clientAccountId),
    ]);
    return NextResponse.json({ ok: true, records, summary });
  } catch (err) {
    console.error("[meta-launch GET]", err);
    return NextResponse.json({ ok: false, error: "Failed to load launch records." }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — execute launch
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { prepItemId, clientAccountId } = body;

  if (!prepItemId || typeof prepItemId !== "string") {
    return NextResponse.json({ error: "prepItemId is required." }, { status: 400 });
  }
  if (!clientAccountId || typeof clientAccountId !== "string") {
    return NextResponse.json({ error: "clientAccountId is required." }, { status: 400 });
  }

  const request: MetaLaunchRequest = {
    prepItemId,
    clientAccountId,
    executionMode:   ((body.executionMode as string) ?? "guarded_publish") as "manual_publish" | "guarded_publish",
    variantRole:     ((body.variantRole as string) ?? "challenger") as "control" | "challenger" | "backup_candidate",
    workspaceId:     (body.workspaceId as string) ?? null,
    experimentId:    (body.experimentId as string) ?? null,
    launchPlanId:    (body.launchPlanId as string) ?? null,
    briefId:         (body.briefId as string) ?? null,
    variantId:       (body.variantId as string) ?? null,
    controlAdExternalId:       (body.controlAdExternalId as string) ?? null,
    controlAdSetExternalId:    (body.controlAdSetExternalId as string) ?? null,
    controlCampaignExternalId: (body.controlCampaignExternalId as string) ?? null,
    controlCreativeId:         (body.controlCreativeId as string) ?? null,
    controlLabel:              (body.controlLabel as string) ?? "Control",
  };

  console.log(`[meta-launch POST] Executing launch for prep ${prepItemId}, client ${clientAccountId}`);

  const result = await executeMetaLaunch(request);
  const summary = summarizeMetaLaunchResult(result);
  console.log(`[meta-launch POST] ${summary}`);

  if (result.success) {
    return NextResponse.json({
      ok:              true,
      launchRecordId:  result.launchRecordId,
      status:          result.status,
      message:         result.message,
      metaCreativeId:  result.metaCreativeId ?? null,
      metaAdId:        result.metaAdId ?? null,
      experimentId:    result.experimentId ?? null,
    });
  } else {
    const httpStatus = result.errorCode === "POLICY_BLOCKED" ? 403
      : result.errorCode === "NOT_APPROVED" ? 422
      : result.errorCode === "DUPLICATE_LAUNCH" ? 409
      : 422;

    return NextResponse.json({
      ok:             false,
      launchRecordId: result.launchRecordId || null,
      status:         result.status,
      error:          result.message,
      errorCode:      result.errorCode ?? null,
      errorDetail:    result.errorDetail ?? null,
    }, { status: httpStatus });
  }
}
