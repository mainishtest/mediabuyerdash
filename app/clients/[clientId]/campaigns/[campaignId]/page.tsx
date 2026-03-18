export const dynamic = "force-dynamic";

import { notFound }  from "next/navigation";
import { prisma }    from "../../../../../lib/db";
import { CampaignDrillDownView } from "./CampaignDrillDownView";

type PageProps = {
  params: { clientId: string; campaignId: string };
};

export async function generateMetadata({ params }: PageProps) {
  const campaign = await prisma.metaSyncedCampaign.findUnique({
    where:  { externalCampaignId: params.campaignId },
    select: { name: true },
  });
  return {
    title: campaign
      ? `${campaign.name} — Ads — Media Buying Dashboard`
      : "Campaign Ads",
  };
}

export default async function CampaignDrillDownPage({ params }: PageProps) {
  const { clientId, campaignId } = params;

  // Verify client exists
  const account = await prisma.clientAccount.findUnique({
    where:  { id: clientId },
    select: { id: true, name: true },
  });
  if (!account) notFound();

  // Campaign info
  const campaign = await prisma.metaSyncedCampaign.findUnique({
    where: { externalCampaignId: campaignId },
  });
  if (!campaign) notFound();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const since = thirtyDaysAgo.toISOString().slice(0, 10);

  // Ad sets, ads, and insights in parallel
  const [adSets, ads, adSetInsights, adInsights] = await Promise.all([
    prisma.metaSyncedAdSet.findMany({
      where:   { externalCampaignId: campaignId },
      orderBy: { name: "asc" },
    }),
    prisma.metaSyncedAd.findMany({
      where:   { externalCampaignId: campaignId },
      orderBy: { name: "asc" },
    }),
    // Adset-level insights
    prisma.metaSyncedInsight.groupBy({
      by:    ["externalAdSetId"],
      where: {
        externalCampaignId: campaignId,
        level:              "adset",
        dateStart:          { gte: since },
        externalAdSetId:    { not: "" },
      },
      _sum: { spend: true, impressions: true, clicks: true },
    }),
    // Ad-level insights
    prisma.metaSyncedInsight.groupBy({
      by:    ["externalAdId"],
      where: {
        externalCampaignId: campaignId,
        level:              "ad",
        dateStart:          { gte: since },
        externalAdId:       { not: "" },
      },
      _sum: { spend: true, impressions: true, clicks: true },
    }),
  ]);

  // Build insight maps
  const adSetMetrics = new Map(
    adSetInsights.map((r) => [
      r.externalAdSetId,
      {
        spend:       r._sum.spend       ?? 0,
        impressions: r._sum.impressions ?? 0,
        clicks:      r._sum.clicks      ?? 0,
      },
    ])
  );
  const adMetrics = new Map(
    adInsights.map((r) => [
      r.externalAdId,
      {
        spend:       r._sum.spend       ?? 0,
        impressions: r._sum.impressions ?? 0,
        clicks:      r._sum.clicks      ?? 0,
      },
    ])
  );

  // Serialise for client component
  const adSetRows = adSets.map((as) => {
    const m = adSetMetrics.get(as.externalAdSetId) ?? { spend: 0, impressions: 0, clicks: 0 };
    return {
      id:             as.id,
      externalAdSetId: as.externalAdSetId,
      name:           as.name,
      status:         as.status,
      spend:          m.spend,
      impressions:    m.impressions,
      clicks:         m.clicks,
      updatedAt:      as.updatedAt.toISOString(),
    };
  });

  const adRows = ads.map((ad) => {
    const m = adMetrics.get(ad.externalAdId) ?? { spend: 0, impressions: 0, clicks: 0 };
    return {
      id:              ad.id,
      externalAdId:    ad.externalAdId,
      externalAdSetId: ad.externalAdSetId,
      name:            ad.name,
      status:          ad.status,
      spend:           m.spend,
      impressions:     m.impressions,
      clicks:          m.clicks,
      updatedAt:       ad.updatedAt.toISOString(),
    };
  });

  return (
    <CampaignDrillDownView
      clientId={clientId}
      clientName={account.name}
      campaign={{
        externalCampaignId: campaign.externalCampaignId,
        name:               campaign.name,
        status:             campaign.status,
        objective:          campaign.objective ?? null,
        updatedAt:          campaign.updatedAt.toISOString(),
      }}
      adSets={adSetRows}
      ads={adRows}
    />
  );
}
