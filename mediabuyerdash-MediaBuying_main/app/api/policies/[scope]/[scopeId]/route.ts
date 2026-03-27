// app/api/policies/[scope]/[scopeId]/route.ts
// GET  — load the policy record for a specific (scope, scopeId) pair.
//         Returns the system default if no explicit record exists.
// PUT  — create or update the policy record for the given scope.

import { NextResponse }     from "next/server";
import { getServerSession } from "next-auth";
import { authOptions }      from "../../../../../lib/auth";
import {
  loadScopePolicy,
  upsertScopePolicy,
  buildSystemDefaultPolicy,
  buildActionSafetySummaryFromPolicies,
  loadPoliciesForContext,
} from "../../../../../lib/policy";
import type {
  ActionSafetyScope,
  AutonomyMode,
  ActionType,
  ActionConstraint,
} from "../../../../../lib/policy";

export const dynamic = "force-dynamic";

const VALID_SCOPES = new Set<string>(["client", "ad_account", "campaign"]);

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: { scope: string; scopeId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!VALID_SCOPES.has(params.scope)) {
    return NextResponse.json(
      { error: `Invalid scope "${params.scope}". Must be: client | ad_account | campaign` },
      { status: 400 }
    );
  }

  const workspaceId = session.user.workspaceId ?? null;
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace found" }, { status: 400 });
  }

  const scope   = params.scope as ActionSafetyScope;
  const scopeId = params.scopeId;

  const policy = await loadScopePolicy(workspaceId, scope, scopeId);

  // Build permission summary for the scope
  const ctxBase = { workspaceId, actionType: "pause_entity" as ActionType };
  const ctx =
    scope === "client"     ? { ...ctxBase, clientId: scopeId } :
    scope === "ad_account" ? { ...ctxBase, adAccountId: scopeId } :
                             { ...ctxBase, campaignId: scopeId };

  const policies = await loadPoliciesForContext(ctx);
  const summary  = buildActionSafetySummaryFromPolicies(
    { workspaceId,
      clientId:    scope === "client"     ? scopeId : undefined,
      adAccountId: scope === "ad_account" ? scopeId : undefined,
      campaignId:  scope === "campaign"   ? scopeId : undefined,
    },
    policies
  );

  return NextResponse.json({
    policy:  policy ?? buildSystemDefaultPolicy(workspaceId),
    summary,
  });
}

// ── PUT ──────────────────────────────────────────────────────────────────────

export async function PUT(
  req: Request,
  { params }: { params: { scope: string; scopeId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!VALID_SCOPES.has(params.scope)) {
    return NextResponse.json(
      { error: `Invalid scope "${params.scope}"` },
      { status: 400 }
    );
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

  // Validate autonomy mode
  const validModes = new Set([
    "recommend_only", "prepare_only", "approval_required",
    "guarded_auto_execute", "restricted",
  ]);
  if (!body.autonomyMode || !validModes.has(body.autonomyMode as string)) {
    return NextResponse.json(
      { error: "autonomyMode is required and must be a valid AutonomyMode value" },
      { status: 400 }
    );
  }

  const policy = await upsertScopePolicy({
    workspaceId,
    scope:              params.scope as ActionSafetyScope,
    scopeId:            params.scopeId,
    autonomyMode:       body.autonomyMode as AutonomyMode,
    allowedActionTypes: (body.allowedActionTypes as ActionType[]) ?? [],
    blockedActionTypes: (body.blockedActionTypes as ActionType[]) ?? [],
    approvalRequired:   (body.approvalRequired   as ActionType[]) ?? [],
    constraints:        (body.constraints        as ActionConstraint[]) ?? [],
    notes:              typeof body.notes === "string" ? body.notes : undefined,
  });

  return NextResponse.json({ ok: true, policy });
}
