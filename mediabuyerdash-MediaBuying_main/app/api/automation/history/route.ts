// app/api/automation/history/route.ts
// GET — returns combined automation audit history for the workspace.
//
// Query params (all optional):
//   clientId           — filter by client account ID
//   eventType          — filter by AutomationEventType
//   actionType         — filter by action type string
//   rollbackReadiness  — filter by RollbackReadinessState
//   dateFrom           — YYYY-MM-DD inclusive start
//   dateTo             — YYYY-MM-DD inclusive end
//   limit              — max entries to return (default 80, max 200)
//   offset             — pagination offset (default 0)
//
// Returns: { entries: AutomationAuditEntry[], summary: AutomationAuditSummary }

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse }     from "next/server";
import { getServerSession }              from "next-auth";
import { authOptions }                   from "../../../../lib/auth";
import {
  loadCombinedAuditHistory,
  summarizeAutomationHistory,
}                                        from "../../../../lib/auditLog";
import type {
  AutomationEventType,
  RollbackReadinessState,
}                                        from "../../../../lib/auditLog/types";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = session.user.workspaceId ?? null;
  const { searchParams } = req.nextUrl;

  const rawLimit  = parseInt(searchParams.get("limit")  ?? "80",  10);
  const rawOffset = parseInt(searchParams.get("offset") ?? "0",   10);

  const limit  = Number.isFinite(rawLimit)  ? Math.min(rawLimit,  200) : 80;
  const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0)   : 0;

  const clientId          = searchParams.get("clientId")          ?? undefined;
  const eventType         = searchParams.get("eventType")         ?? undefined;
  const actionType        = searchParams.get("actionType")        ?? undefined;
  const rollbackReadiness = searchParams.get("rollbackReadiness") ?? undefined;
  const dateFrom          = searchParams.get("dateFrom")          ?? undefined;
  const dateTo            = searchParams.get("dateTo")            ?? undefined;

  try {
    const entries = await loadCombinedAuditHistory({
      workspaceId,
      clientId,
      eventType:         eventType         as AutomationEventType   | undefined,
      actionType,
      rollbackReadiness: rollbackReadiness as RollbackReadinessState | undefined,
      dateFrom,
      dateTo,
      limit,
      offset,
    });

    const summary = summarizeAutomationHistory(entries);

    return NextResponse.json({ entries, summary });
  } catch (err) {
    console.error("[automation/history]", err);
    return NextResponse.json(
      { error: "Failed to load audit history" },
      { status: 500 }
    );
  }
}
