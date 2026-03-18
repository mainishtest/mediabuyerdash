// app/api/notifications/preferences/route.ts
// GET  — load preferences + history for the current user
// POST — save preferences for the current user

import { NextRequest, NextResponse }     from "next/server";
import { getServerSession }              from "next-auth";
import { authOptions }                   from "../../../../lib/auth";
import {
  getOrCreatePreferences,
  updatePreferences,
  loadNotificationHistory,
}                                        from "../../../../lib/notifications";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [preferences, history] = await Promise.all([
    getOrCreatePreferences(session.user.id),
    loadNotificationHistory(session.user.id, 50),
  ]);

  return NextResponse.json({ preferences, history });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* ignore */ }

  const allowed = [
    "emailEnabled", "immediateAlerts", "dailyDigest",
    "alertHighPriority", "alertSyncFailure", "alertPacing",
    "alertBelowGoal", "alertMissingGoals",
  ];

  const updates: Record<string, boolean> = {};
  for (const key of allowed) {
    if (typeof body[key] === "boolean") updates[key] = body[key] as boolean;
  }

  const preferences = await updatePreferences(session.user.id, updates);
  return NextResponse.json({ preferences });
}
