// app/api/goals/client/[clientId]/route.ts
// GET  /api/goals/client/:clientId  — returns current ClientGoal + resolved goal
// POST /api/goals/client/:clientId  — upsert client-level goal defaults
//
// Request body (POST):
//   { targetRoas?, targetCpa?, targetCtr?, targetCvr?, maxDailySpend? }
//   All fields optional; null clears the stored value.
//
// Response (both):
//   { goal: ClientGoal | null, resolved: ResolvedGoal }

import { NextRequest, NextResponse }     from "next/server";
import { getClientGoal, upsertClientGoal } from "../../../../../lib/goals/service";
import { resolveGoalForCampaign }          from "../../../../../lib/goals/resolve";
import { getSystemDefaultGoal }            from "../../../../../lib/goals/defaults";
import type { GoalInput }                  from "../../../../../lib/goals/types";

type RouteParams = { params: { clientId: string } };

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { clientId } = params;
  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  try {
    const goal     = await getClientGoal(clientId);
    // Without a specific campaign override, the resolved goal is client → system default.
    const resolved = resolveGoalForCampaign(null, goal) ?? getSystemDefaultGoal();
    return NextResponse.json({ goal, resolved });
  } catch (err) {
    console.error("[GET /api/goals/client]", err);
    return NextResponse.json({ error: "Failed to load goal" }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { clientId } = params;
  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate each field
  const input: GoalInput = {};
  const err = validateGoalFields(body, input);
  if (err) return NextResponse.json({ error: err }, { status: 422 });

  try {
    const goal     = await upsertClientGoal(clientId, input);
    const resolved = resolveGoalForCampaign(null, goal) ?? getSystemDefaultGoal();
    return NextResponse.json({ goal, resolved });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to save goal";
    if (msg.includes("not found")) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    console.error("[POST /api/goals/client]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── Shared validation ─────────────────────────────────────────────────────────

type GoalCheckEntry = { key: keyof GoalInput; label: string; min: number; max: number };

const GOAL_FIELD_CHECKS: GoalCheckEntry[] = [
  { key: "targetRoas",    label: "targetRoas",    min: 0.01,  max: 1000       },
  { key: "targetCpa",     label: "targetCpa",     min: 0.01,  max: 1_000_000  },
  { key: "targetCtr",     label: "targetCtr",     min: 0.001, max: 100        },
  { key: "targetCvr",     label: "targetCvr",     min: 0.001, max: 100        },
  { key: "maxDailySpend", label: "maxDailySpend", min: 1,     max: 10_000_000 },
];

function validateGoalFields(
  body: Record<string, unknown>,
  out:  GoalInput
): string | null {
  for (const { key, label, min, max } of GOAL_FIELD_CHECKS) {
    if (!(key in body)) continue;
    const raw = body[key];
    if (raw === null) { out[key] = null; continue; }
    const n = Number(raw);
    if (!Number.isFinite(n)) return `${label} must be a finite number or null`;
    if (n < min || n > max)  return `${label} must be between ${min} and ${max}`;
    out[key] = n;
  }
  return null;
}
