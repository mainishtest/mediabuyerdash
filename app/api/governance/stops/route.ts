// app/api/governance/stops/route.ts
// GET  — list all active emergency stops for the workspace.
// POST — create a new emergency stop.

import { NextResponse }     from "next/server";
import { getServerSession } from "next-auth";
import { authOptions }      from "../../../../lib/auth";
import {
  loadActiveStops,
  setEmergencyStopState,
} from "../../../../lib/governance";
import type { EmergencyStopScope } from "../../../../lib/governance";

export const dynamic = "force-dynamic";

const VALID_SCOPES = new Set<string>([
  "global", "client", "ad_account", "campaign", "action_type",
]);

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = session.user.workspaceId ?? null;
  if (!workspaceId) return NextResponse.json({ stops: [] });

  const stops = await loadActiveStops(workspaceId);
  return NextResponse.json({ stops });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = session.user.workspaceId ?? null;
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace found" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { scope, scopeId, reason, expiresAt } = body as Record<string, unknown>;

  if (!scope || !VALID_SCOPES.has(scope as string)) {
    return NextResponse.json(
      { error: "scope is required: global | client | ad_account | campaign | action_type" },
      { status: 400 }
    );
  }
  if (!scopeId || typeof scopeId !== "string") {
    return NextResponse.json({ error: "scopeId is required" }, { status: 400 });
  }
  if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
    return NextResponse.json({ error: "reason is required" }, { status: 400 });
  }

  const stop = await setEmergencyStopState({
    workspaceId,
    scope:     scope as EmergencyStopScope,
    scopeId:   scopeId,
    reason:    reason.trim(),
    stoppedBy: session.user.id,
    expiresAt: expiresAt ? new Date(expiresAt as string) : undefined,
  });

  return NextResponse.json({ ok: true, stop });
}
