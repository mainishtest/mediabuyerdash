// Loads active ads with their creative copy for a client.
// Used by Quick Generate to pull existing ad copy for iteration.

import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "../../../../../lib/db";

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("clientId");

  if (!clientId) {
    return NextResponse.json({ ok: false, error: "clientId required" }, { status: 400 });
  }

  // Get the client's ad account IDs
  const selectedAccounts = await prisma.metaSelectedAdAccount.findMany({
    where: { clientAccountId: clientId },
    include: { accessibleAdAccount: true },
  });

  const adAccountIds = selectedAccounts
    .map((s: { accessibleAdAccount: { externalAdAccountId: string } }) => s.accessibleAdAccount.externalAdAccountId)
    .filter(Boolean);

  if (adAccountIds.length === 0) {
    return NextResponse.json({ ok: true, ads: [] });
  }

  // Load ads with their creatives
  const ads = await prisma.metaSyncedAd.findMany({
    where: {
      externalAdAccountId: { in: adAccountIds },
      status: "ACTIVE",
    },
    select: {
      externalAdId: true,
      name: true,
      externalCreativeId: true,
      externalCampaignId: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  // Load creatives for these ads
  const creativeIds = ads
    .map((a: { externalCreativeId: string | null }) => a.externalCreativeId)
    .filter((id: string | null): id is string => !!id);

  const creatives = creativeIds.length > 0
    ? await prisma.metaSyncedCreative.findMany({
        where: { externalCreativeId: { in: creativeIds } },
        select: {
          externalCreativeId: true,
          name: true,
          title: true,
          body: true,
          callToAction: true,
          thumbnailUrl: true,
          imageUrl: true,
        },
      })
    : [];

  const creativeMap = new Map(creatives.map((c: { externalCreativeId: string; name: string | null; title: string | null; body: string | null; callToAction: string | null; thumbnailUrl: string | null; imageUrl: string | null }) => [c.externalCreativeId, c]));

  // Load campaign names
  const campaignIds = [...new Set(ads.map((a) => a.externalCampaignId))];
  const campaigns = await prisma.metaSyncedCampaign.findMany({
    where: { externalCampaignId: { in: campaignIds } },
    select: { externalCampaignId: true, name: true },
  });
  const campaignMap = new Map(campaigns.map((c) => [c.externalCampaignId, c.name]));

  // Build response
  const result = ads.map((ad) => {
    const creative = ad.externalCreativeId ? creativeMap.get(ad.externalCreativeId) : null;
    const body = creative?.body ?? "";
    const lines = body.split("\n").filter((l: string) => l.trim());
    const hook = lines[0] ?? "";
    const bodyText = lines.slice(1).join("\n").trim() || body;

    return {
      adId:         ad.externalAdId,
      adName:       ad.name,
      campaignName: campaignMap.get(ad.externalCampaignId) ?? "",
      hook,
      body:         bodyText,
      cta:          creative?.callToAction ?? "",
      imageUrl:     creative?.imageUrl ?? creative?.thumbnailUrl ?? null,
      creativeName: creative?.name ?? null,
    };
  });

  return NextResponse.json({ ok: true, ads: result });
}
