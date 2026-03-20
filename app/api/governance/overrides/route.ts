// app/api/governance/overrides/route.ts
// GET  — list all active overrides for the workspace.
// POST — apply a new operator override.

import { NextResponse }     from "next/server";
import { getServerSession } from "next-auth";
import { authOptions }      from "../../../../lib/auth";
import {
  loadActiveOverrides,
  applyAutomationOverride,
} from "../../../../lib/governance";
import type { OverrideType, EmergencyStopScope } from "../../../../lib/governance";

export const dynamic = "force-dynamic";

const VALID_TYPES  = new Set<string>(["pause_scope", "require_approval_all", "defer_action", "override_block", "resume_scope"]);
const VALID_SCOPES = new Set<string>(["global", "client", "ad_account", "campaign", "action_type"]);

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = session.user.workspaceId ?? null;
  if (!workspaceId) return NextResponse.json({ overrides: [] });

  const overrides = await loadActiveOverrides(workspaceId);
  return NextResponse.json({ overrides });
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

  const { overrideType, scope, scopeId, reason, expiresAt, metadata } =
    body as Record<string, unknown>;

  if (!overrideType || !VALID_TYPES.has(overrideType as string)) {
    return NextResponse.json(
      { error: "overrideType is required: pause_scope | require_approval_all | defer_action | override_block | resume_scope" },
      { status: 400 }
    );
  }
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

  const override = await applyAutomationOverride({
    workspaceId,
    overrideType: overrideType as OverrideType,
    scope:        scope as EmergencyStopScope,
    scopeId:      scopeId,
    reason:       reason.trim(),
    appliedBy:    session.user.id,
    expiresAt:    expiresAt ? new Date(expiresAt as string) : undefined,
    metadata:     (metadata as Record<string, unknown>) ?? {},
  });

  return NextResponse.json({ ok: true, override });
}
