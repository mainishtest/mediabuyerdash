// app/api/clients/[clientId]/goal-defaults/apply/route.ts
// POST — applies client default goals to campaigns that have no explicit goal.
//
// Only creates MetaCampaignGoal rows for campaigns that are missing one.
// Campaigns with existing explicit goals are never modified.
// Requires client defaults to be set — returns 422 if none exist.

import { NextRequest, NextResponse } from "next/server";
import { applyClientDefaultsToCampaigns } from "../../../../../../lib/clientGoalDefaults/service";

type RouteParams = { params: { clientId: string } };

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const { clientId } = params;
  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  try {
    const result = await applyClientDefaultsToCampaigns(clientId);
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith("No default goals set")) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error("[goal-defaults/apply POST]", err);
    return NextResponse.json({ error: "Failed to apply defaults" }, { status: 500 });
  }
}
