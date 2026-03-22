// app/api/meta-launch/[id]/route.ts
// GET   — load a single launch record with full detail
// PATCH — actions: retry, approve, block

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { loadLaunchRecordById, updateLaunchStatus } from "../../../../lib/metaLaunch/db";
import { retryMetaLaunch, summarizeMetaLaunchResult } from "../../../../lib/metaLaunch/executor";

// ---------------------------------------------------------------------------
// GET — detail
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const record = await loadLaunchRecordById(id);
    if (!record) return NextResponse.json({ error: "Launch record not found." }, { status: 404 });
    return NextResponse.json({ ok: true, record });
  } catch (err) {
    console.error("[meta-launch/[id] GET]", err);
    return NextResponse.json({ error: "Failed to load launch record." }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH — actions
// ---------------------------------------------------------------------------

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { action } = body;
  if (!action || typeof action !== "string") {
    return NextResponse.json({ error: "action is required." }, { status: 400 });
  }

  const record = await loadLaunchRecordById(id);
  if (!record) return NextResponse.json({ error: "Launch record not found." }, { status: 404 });

  // ── retry — re-execute a failed/blocked launch ─────────────────────────────
  if (action === "retry") {
    if (record.status !== "failed" && record.status !== "blocked") {
      return NextResponse.json({
        error: `Cannot retry a launch in status "${record.status}". Only failed or blocked launches can be retried.`,
      }, { status: 400 });
    }

    console.log(`[meta-launch PATCH] Retrying launch ${id}`);
    const result = await retryMetaLaunch(id);
    const summary = summarizeMetaLaunchResult(result);
    console.log(`[meta-launch PATCH] Retry result: ${summary}`);

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
      return NextResponse.json({
        ok:          false,
        error:       result.message,
        errorCode:   result.errorCode ?? null,
        errorDetail: result.errorDetail ?? null,
      }, { status: 422 });
    }
  }

  // ── approve — move from draft/ready_for_approval to approved ───────────────
  if (action === "approve") {
    if (record.status !== "draft" && record.status !== "ready_for_approval") {
      return NextResponse.json({
        error: `Cannot approve a launch in status "${record.status}".`,
      }, { status: 400 });
    }

    await updateLaunchStatus(id, "approved");
    return NextResponse.json({ ok: true, id, status: "approved" });
  }

  // ── block — manually block a launch ────────────────────────────────────────
  if (action === "block") {
    const reason = (body.reason as string) ?? "Manually blocked by operator.";
    await updateLaunchStatus(id, "blocked", {
      launchMessage: reason,
      errorCode:     "MANUAL_BLOCK",
      errorDetail:   reason,
    });
    return NextResponse.json({ ok: true, id, status: "blocked" });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
