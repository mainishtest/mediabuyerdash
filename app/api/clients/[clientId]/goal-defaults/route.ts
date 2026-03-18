// app/api/clients/[clientId]/goal-defaults/route.ts
// REST endpoint for client-level default campaign goals.
//
// GET  → returns current defaults or { defaults: null }
// POST → upserts defaults, returns saved record
//
// Defaults apply to campaigns that have no explicit MetaCampaignGoal.
// They are stored in ClientGoalDefaults — never written back to Meta.

import { NextRequest, NextResponse } from "next/server";
import {
  getClientGoalDefaults,
  upsertClientGoalDefaults,
} from "../../../../../lib/clientGoalDefaults/service";

type RouteParams = { params: { clientId: string } };

// ── GET /api/clients/[clientId]/goal-defaults ─────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { clientId } = params;
  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  try {
    const defaults = await getClientGoalDefaults(clientId);
    return NextResponse.json({ defaults });
  } catch (err) {
    console.error("[goal-defaults GET]", err);
    return NextResponse.json({ error: "Failed to load defaults" }, { status: 500 });
  }
}

// ── POST /api/clients/[clientId]/goal-defaults ────────────────────────────────

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { clientId } = params;
  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    defaultRoasGoalType,
    defaultRoasGoalValue,
    defaultCpaGoalType,
    defaultCpaGoalValue,
  } = (body ?? {}) as Record<string, unknown>;

  if (defaultRoasGoalType !== "high" && defaultRoasGoalType !== "low") {
    return NextResponse.json(
      { error: "defaultRoasGoalType must be 'high' or 'low'" },
      { status: 422 }
    );
  }
  if (defaultCpaGoalType !== "high" && defaultCpaGoalType !== "low") {
    return NextResponse.json(
      { error: "defaultCpaGoalType must be 'high' or 'low'" },
      { status: 422 }
    );
  }

  const roasVal = Number(defaultRoasGoalValue);
  const cpaVal  = Number(defaultCpaGoalValue);

  if (!isFinite(roasVal) || roasVal <= 0) {
    return NextResponse.json(
      { error: "defaultRoasGoalValue must be a positive number" },
      { status: 422 }
    );
  }
  if (!isFinite(cpaVal) || cpaVal <= 0) {
    return NextResponse.json(
      { error: "defaultCpaGoalValue must be a positive number" },
      { status: 422 }
    );
  }

  try {
    const defaults = await upsertClientGoalDefaults(clientId, {
      defaultRoasGoalType:  defaultRoasGoalType as "high" | "low",
      defaultRoasGoalValue: roasVal,
      defaultCpaGoalType:   defaultCpaGoalType as "high" | "low",
      defaultCpaGoalValue:  cpaVal,
    });
    return NextResponse.json({ defaults }, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith("Client not found")) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error("[goal-defaults POST]", err);
    return NextResponse.json({ error: "Failed to save defaults" }, { status: 500 });
  }
}
