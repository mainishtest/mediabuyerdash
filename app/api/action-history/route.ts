// app/api/action-history/route.ts
// API endpoint for action history timeline data.
//
// GET /api/action-history — Load unified action history with filters.
//
// Query params:
//   clientId, eventType, status, dateFrom, dateTo, limit

import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "../../../lib/auth";
import {
  buildActionHistoryTimeline,
  buildActionHistorySummary,
} from "../../../lib/actionHistory/aggregator";
import { linkActionHistoryToOutcomes } from "../../../lib/actionHistory/linker";
import type { ActionHistoryEventType, ActionHistoryStatus } from "../../../types/actionHistory";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = session.user.workspaceId ?? null;
  const { searchParams } = new URL(req.url);

  const clientId  = searchParams.get("clientId") ?? undefined;
  const eventType = (searchParams.get("eventType") ?? undefined) as ActionHistoryEventType | undefined;
  const status    = (searchParams.get("status") ?? undefined) as ActionHistoryStatus | undefined;
  const dateFrom  = searchParams.get("dateFrom") ?? undefined;
  const dateTo    = searchParams.get("dateTo") ?? undefined;
  const limit     = Math.min(parseInt(searchParams.get("limit") ?? "100", 10), 300);

  const entries = await buildActionHistoryTimeline({
    workspaceId,
    clientId,
    eventType: eventType ?? "",
    status:    status ?? "",
    dateFrom,
    dateTo,
    limit,
  });

  const linked  = await linkActionHistoryToOutcomes(entries);
  const summary = buildActionHistorySummary(linked);

  return NextResponse.json({ entries: linked, summary });
}
