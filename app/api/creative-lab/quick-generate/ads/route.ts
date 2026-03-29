// Loads ads with their creative copy for a client.
// Used by Quick Generate to pull existing ad copy for iteration.

import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "../../../../../lib/db";

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("clientId");
  const search   = req.nextUrl.searchParams.get("search")?.toLowerCase().trim() ?? "";

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

  // Load ALL ads (not just active) so user can iterate on paused/archived ads too
  const ads = await prisma.metaSyncedAd.findMany({
    where: {
      externalAdAccountId: { in: adAccountIds },
      ...(search ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { externalAdId: { contains: search } },
        ],
      } : {}),
    },
    select: {
      externalAdId: true,
      name: true,
      status: true,
      externalCreativeId: true,
      externalCampaignId: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
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

  const creativeMap = new Map(
    creatives.map((c: { externalCreativeId: string; name: string | null; title: string | null; body: string | null; callToAction: string | null; thumbnailUrl: string | null; imageUrl: string | null }) =>
      [c.externalCreativeId, c]
    )
  );

  // Load campaign names
  const campaignIds = [...new Set(ads.map((a: { externalCampaignId: string }) => a.externalCampaignId))];
  const campaigns = await prisma.metaSyncedCampaign.findMany({
    where: { externalCampaignId: { in: campaignIds } },
    select: { externalCampaignId: true, name: true },
  });
  const campaignMap = new Map(
    campaigns.map((c: { externalCampaignId: string; name: string }) => [c.externalCampaignId, c.name])
  );

  // Build response — prioritize ads that have copy
  const result = ads.map((ad: { externalAdId: string; name: string; status: string; externalCreativeId: string | null; externalCampaignId: string }) => {
    const creative = ad.externalCreativeId ? creativeMap.get(ad.externalCreativeId) : null;
    const rawBody = (creative as { body?: string | null } | undefined)?.body ?? "";
    const lines = rawBody.split("\n").filter((l: string) => l.trim());
    const hook = lines[0] ?? "";
    const bodyText = lines.slice(1).join("\n").trim() || rawBody;

    return {
      adId:         ad.externalAdId,
      adName:       ad.name,
      status:       ad.status,
      campaignName: campaignMap.get(ad.externalCampaignId) ?? "",
      hook,
      body:         bodyText,
      hasCopy:      !!rawBody,
      cta:          (creative as { callToAction?: string | null } | undefined)?.callToAction ?? "",
      imageUrl:     (creative as { imageUrl?: string | null; thumbnailUrl?: string | null } | undefined)?.imageUrl ??
                    (creative as { thumbnailUrl?: string | null } | undefined)?.thumbnailUrl ?? null,
      creativeName: (creative as { name?: string | null } | undefined)?.name ?? null,
    };
  });

  // Sort: ads with copy first, then by name
  result.sort((a: { hasCopy: boolean; adName: string }, b: { hasCopy: boolean; adName: string }) => {
    if (a.hasCopy && !b.hasCopy) return -1;
    if (!a.hasCopy && b.hasCopy) return 1;
    return a.adName.localeCompare(b.adName);
  });

  return NextResponse.json({ ok: true, ads: result });
}
