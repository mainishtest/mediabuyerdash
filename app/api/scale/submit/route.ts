// app/api/scale/submit/route.ts
// POST — submit a scale plan to the governance approval queue.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "../../../../lib/auth";
import { getScaleRecommendation, submitScalePlan } from "../../../../lib/scale/aggregator";
import { validateScaleReadiness } from "../../../../lib/scale/detect";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    clientAccountId:    string;
    clientName:         string;
    campaignId:         string;
    externalCampaignId: string;
    campaignName:       string;
    increasePct:        number;
    strategy:           "increase_budget" | "duplicate_adset";
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { clientAccountId, clientName, campaignId, externalCampaignId, campaignName, increasePct, strategy } = body;

  if (!clientAccountId || !externalCampaignId || !campaignName) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    // Re-fetch recommendation server-side to prevent stale client-side data
    const recommendation = await getScaleRecommendation(clientAccountId, externalCampaignId);

    // Validate
    const validation = validateScaleReadiness({ increasePct, recommendation });
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.errors.join(" ") },
        { status: 422 },
      );
    }

    // Submit to approval queue
    const { actionId } = await submitScalePlan({
      clientAccountId,
      clientName,
      campaignId,
      externalCampaignId,
      campaignName,
      increasePct,
      strategy,
      recommendation,
      userId:      session.user.id,
      workspaceId: session.user.workspaceId ?? null,
    });

    return NextResponse.json({ actionId, status: "proposed" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
