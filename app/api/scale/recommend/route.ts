// app/api/scale/recommend/route.ts
// GET — fetch scale recommendation for a specific campaign.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "../../../../lib/auth";
import { getScaleRecommendation }    from "../../../../lib/scale/aggregator";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientAccountId    = req.nextUrl.searchParams.get("clientAccountId");
  const externalCampaignId = req.nextUrl.searchParams.get("externalCampaignId");

  if (!clientAccountId || !externalCampaignId) {
    return NextResponse.json(
      { error: "clientAccountId and externalCampaignId are required" },
      { status: 400 },
    );
  }

  try {
    const recommendation = await getScaleRecommendation(clientAccountId, externalCampaignId);
    return NextResponse.json(recommendation);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
