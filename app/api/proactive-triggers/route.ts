// app/api/proactive-triggers/route.ts
// POST: Evaluate proactive triggers and upsert alerts.
// GET:  Load current proactive alerts.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "../../../lib/auth";
import { evaluateProactiveTriggers } from "../../../lib/proactiveTriggers/evaluator";
import { buildProactiveAlertDrafts, mapAlertToProactiveAlert, summarizeProactiveAlerts } from "../../../lib/proactiveTriggers/alertBuilder";
import { upsertAlerts, loadAlerts }  from "../../../lib/alerts/persist";

// ── POST: Run trigger evaluation ────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = session.user.workspaceId ?? null;

  try {
    // 1. Evaluate triggers
    const result = await evaluateProactiveTriggers({ workspaceId });

    // 2. Convert to AlertEventDrafts
    const drafts = buildProactiveAlertDrafts(result, workspaceId);

    // 3. Upsert into AlertEvent pipeline
    await upsertAlerts(drafts);

    return NextResponse.json({
      triggersFound: result.triggers.length,
      alertsUpserted: drafts.length,
      inputSources: result.inputSources,
      warnings: result.warnings,
      evaluatedAt: result.evaluatedAt,
    });
  } catch (err) {
    console.error("[proactive-triggers] Evaluation failed:", err);
    return NextResponse.json({ error: "Trigger evaluation failed" }, { status: 500 });
  }
}

// ── GET: Load proactive alerts ──────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = session.user.workspaceId ?? null;

  const alerts = await loadAlerts(workspaceId, { status: ["open", "acknowledged"], limit: 100 });

  const proactiveAlerts = alerts
    .map(mapAlertToProactiveAlert)
    .filter((a): a is NonNullable<typeof a> => a !== null);

  const summary = summarizeProactiveAlerts(proactiveAlerts);

  return NextResponse.json({ alerts: proactiveAlerts, summary });
}
