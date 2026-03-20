// app/api/goals/campaign/[campaignId]/route.ts
// GET  /api/goals/campaign/:campaignId  — returns CampaignGoal + resolved goal
// POST /api/goals/campaign/:campaignId  — upsert campaign-level goal override
//
// campaignId = externalCampaignId (Meta's campaign ID).
//
// GET requires clientId query param to load the client-level fallback.
// POST accepts clientId in body for the same reason.
//
// Response:
//   { goal: CampaignGoal | null, clientGoal: ClientGoal | null,
//     resolved: ResolvedGoal, source: GoalSource }

import { NextRequest, NextResponse }              from "next/server";
import { getCampaignGoal, upsertCampaignGoal,
         getClientGoal }                          from "../../../../../lib/goals/service";
import { resolveGoalForCampaign, getGoalSource }  from "../../../../../lib/goals/resolve";
import type { GoalInput }                         from "../../../../../lib/goals/types";

type RouteParams = { params: { campaignId: string } };

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { campaignId } = params;
  if (!campaignId) {
    return NextResponse.json({ error: "campaignId is required" }, { status: 400 });
  }

  const clientId = req.nextUrl.searchParams.get("clientId") ?? undefined;

  try {
    const [goal, clientGoal] = await Promise.all([
      getCampaignGoal(campaignId),
      clientId ? getClientGoal(clientId) : Promise.resolve(null),
    ]);

    const resolved = resolveGoalForCampaign(goal, clientGoal ?? null);
    const source   = getGoalSource(goal, clientGoal ?? null);

    return NextResponse.json({ goal, clientGoal: clientGoal ?? null, resolved, source });
  } catch (err) {
    console.error("[GET /api/goals/campaign]", err);
    return NextResponse.json({ error: "Failed to load goal" }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { campaignId } = params;
  if (!campaignId) {
    return NextResponse.json({ error: "campaignId is required" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const clientId = typeof body.clientId === "string" ? body.clientId : undefined;

  const input: GoalInput = {};
  const err = validateGoalFields(body, input);
  if (err) return NextResponse.json({ error: err }, { status: 422 });

  try {
    const [goal, clientGoal] = await Promise.all([
      upsertCampaignGoal(campaignId, input),
      clientId ? getClientGoal(clientId) : Promise.resolve(null),
    ]);

    const resolved = resolveGoalForCampaign(goal, clientGoal ?? null);
    const source   = getGoalSource(goal, clientGoal ?? null);

    return NextResponse.json({ goal, clientGoal: clientGoal ?? null, resolved, source });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to save goal";
    if (msg.includes("not found")) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    console.error("[POST /api/goals/campaign]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── Validation ────────────────────────────────────────────────────────────────

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
