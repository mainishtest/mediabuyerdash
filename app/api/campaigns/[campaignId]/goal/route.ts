// app/api/campaigns/[campaignId]/goal/route.ts
// REST endpoint for campaign goal management.
// campaignId = externalCampaignId (Meta's campaign ID).
//
// GET  → returns current goal or { goal: null }
// POST → upserts goal, returns saved record
//
// Goals are stored in MetaCampaignGoal — never written back to Meta.
// Protected by NextAuth middleware (all /api routes require auth).

import { NextRequest, NextResponse } from "next/server";
import { getCampaignGoal, upsertCampaignGoal } from "../../../../../lib/campaignGoals/service";

type RouteParams = { params: { campaignId: string } };

// ── GET /api/campaigns/[campaignId]/goal ──────────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { campaignId } = params;

  if (!campaignId) {
    return NextResponse.json({ error: "campaignId is required" }, { status: 400 });
  }

  try {
    const goal = await getCampaignGoal(campaignId);
    return NextResponse.json({ goal });
  } catch (err) {
    console.error("[campaign-goal GET]", err);
    return NextResponse.json({ error: "Failed to load goal" }, { status: 500 });
  }
}

// ── POST /api/campaigns/[campaignId]/goal ─────────────────────────────────────

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { campaignId } = params;

  if (!campaignId) {
    return NextResponse.json({ error: "campaignId is required" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate shape
  const { roasGoalType, roasGoalValue, cpaGoalType, cpaGoalValue } =
    (body ?? {}) as Record<string, unknown>;

  if (roasGoalType !== "high" && roasGoalType !== "low") {
    return NextResponse.json(
      { error: "roasGoalType must be 'high' or 'low'" },
      { status: 422 }
    );
  }
  if (cpaGoalType !== "high" && cpaGoalType !== "low") {
    return NextResponse.json(
      { error: "cpaGoalType must be 'high' or 'low'" },
      { status: 422 }
    );
  }

  const roasVal = Number(roasGoalValue);
  const cpaVal  = Number(cpaGoalValue);

  if (!isFinite(roasVal) || roasVal <= 0) {
    return NextResponse.json(
      { error: "roasGoalValue must be a positive number" },
      { status: 422 }
    );
  }
  if (!isFinite(cpaVal) || cpaVal <= 0) {
    return NextResponse.json(
      { error: "cpaGoalValue must be a positive number" },
      { status: 422 }
    );
  }

  try {
    const goal = await upsertCampaignGoal(campaignId, {
      roasGoalType:  roasGoalType as "high" | "low",
      roasGoalValue: roasVal,
      cpaGoalType:   cpaGoalType  as "high" | "low",
      cpaGoalValue:  cpaVal,
    });
    return NextResponse.json({ goal }, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith("Campaign not found")) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error("[campaign-goal POST]", err);
    return NextResponse.json({ error: "Failed to save goal" }, { status: 500 });
  }
}
