// app/api/daily-brief/route.ts
// API endpoints for daily morning brief generation and retrieval.
//
// POST /api/daily-brief  — Trigger brief generation for a workspace
// GET  /api/daily-brief  — Load recent briefs for the current user's workspace
//
// Supports:
//   - force=true query param to bypass dedup (admin/testing)
//   - timezone query param (defaults to America/New_York)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "../../../lib/auth";
import { generateDailyBriefForAccount } from "../../../lib/dailyBrief/deliver";
import { loadRecentBriefs }          from "../../../lib/dailyBrief/scheduler";

// ── POST: Generate daily brief ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = session.user.workspaceId ?? null;
  const { searchParams } = new URL(req.url);
  const timezone = searchParams.get("timezone") ?? "America/New_York";
  const force = searchParams.get("force") === "true";

  const result = await generateDailyBriefForAccount({
    workspaceId,
    timezone,
    force,
  });

  if (result.skipped) {
    return NextResponse.json({
      status: "skipped",
      message: "Brief already generated for this date.",
    });
  }

  if (result.error) {
    return NextResponse.json(
      { status: "error", error: result.error },
      { status: 500 },
    );
  }

  // Return the full brief so the client can render it immediately
  return NextResponse.json({
    status: "generated",
    briefId: result.brief?.id,
    briefDate: result.brief?.briefDate,
    brief: result.brief ?? null,
  });
}

// ── GET: Load recent briefs ─────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = session.user.workspaceId ?? null;
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "30", 10), 100);

  const briefs = await loadRecentBriefs(workspaceId, limit);

  return NextResponse.json({ briefs });
}
