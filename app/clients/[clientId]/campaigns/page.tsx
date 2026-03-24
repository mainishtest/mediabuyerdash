export const dynamic = "force-dynamic";

import { notFound }                          from "next/navigation";
import { prisma }                            from "../../../../lib/db";
import { buildCampaignPerformanceSnapshots } from "../../../../lib/campaignPerformance/aggregator";
import { getCampaignSparklines, getClientDailyMetrics } from "../../../../lib/charts/dataService";
import { CampaignPerformanceView }           from "./CampaignPerformanceView";

type PageProps = {
  params: { clientId: string };
};

export async function generateMetadata({ params }: PageProps) {
  const account = await prisma.clientAccount.findUnique({
    where:  { id: params.clientId },
    select: { name: true },
  });
  return {
    title: account
      ? `Campaigns — ${account.name} — Media Buying Dashboard`
      : "Campaign Performance",
  };
}

export default async function CampaignPerformancePage({ params }: PageProps) {
  const { clientId } = params;

  const account = await prisma.clientAccount.findUnique({
    where:  { id: clientId },
    select: { id: true, name: true, currency: true, timezone: true },
  });

  if (!account) notFound();

  const tz = account.timezone || "America/New_York";
  const [snapshots, sparklines, clientDaily] = await Promise.all([
    buildCampaignPerformanceSnapshots(clientId),
    getCampaignSparklines(clientId, 30, undefined, undefined, tz),
    getClientDailyMetrics(clientId, 30, undefined, undefined, tz),
  ]);

  return (
    <CampaignPerformanceView
      clientId={account.id}
      clientName={account.name}
      currency={account.currency}
      snapshots={snapshots}
      sparklines={sparklines}
      clientDaily={clientDaily}
    />
  );
}
