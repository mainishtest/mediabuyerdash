export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "../../../lib/db";
import { campaigns, adSets, ads } from "../../../lib/sampleData";
import { hourlyMetrics } from "../../../lib/sampleMetrics";
import { adSetPerformance, adPerformance } from "../../../lib/data/index";
import {
  getCampaignsByAccountId,
  getAdSetsByCampaignId,
  getAdsByAdSetId
} from "../../../lib/selectors";
import { aggregateByCampaign } from "../../../lib/aggregations";
import { ClientDetailView }              from "./ClientDetailView";
import { getClientIntegrationStatus }   from "../../../lib/clientIntegrations";
import { getClientReadiness }           from "../../../lib/clientSync/readiness";
import { getClientSyncStatusSummary }   from "../../../lib/clientSync/db";
import { getClientMetaData }            from "../../../lib/meta/clientMetaService";
import { getServerSession }             from "next-auth";
import { authOptions }                  from "../../../lib/auth";

type PageProps = {
  params: { clientId: string };
};

export async function generateMetadata({ params }: PageProps) {
  const { clientId } = params;
  const account = await prisma.clientAccount.findUnique({
    where: { id: clientId }
  });
  return {
    title: account ? `${account.name} — Media Buying Dashboard` : "Client Not Found"
  };
}

export default async function ClientDetailPage({ params }: PageProps) {
  const { clientId } = params;
  const dbAccount = await prisma.clientAccount.findUnique({
    where: { id: clientId }
  });

  // Map Prisma model to the shape ClientDetailView expects
  const account = dbAccount
    ? {
        id:        dbAccount.id,
        name:      dbAccount.name,
        brandName: dbAccount.brandName ?? null,
        status:    dbAccount.status ?? "active",
        notes:     dbAccount.notes ?? null,
        platform:  dbAccount.platform as "facebook",
        currency:  dbAccount.currency,
        timezone:  dbAccount.timezone,
        createdAt: dbAccount.createdAt.toISOString().slice(0, 10),
      }
    : null;

  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-lg text-slate-300">Client account not found.</p>
        <Link
          href="/clients"
          className="mt-4 text-sm text-slate-400 hover:text-slate-200"
        >
          ← Back to Clients
        </Link>
      </div>
    );
  }

  // Fetch session for workspaceId scoping
  const session = await getServerSession(authOptions);
  const workspaceId = session?.user?.workspaceId ?? null;

  // Fetch integration mapping status (Meta ad accounts + Shopify connections)
  const [integrations, readiness, syncStatus, clientMetaData] = await Promise.all([
    getClientIntegrationStatus(clientId),
    getClientReadiness(clientId),
    getClientSyncStatusSummary(clientId),
    getClientMetaData(clientId, workspaceId),
  ]);

  const clientCampaigns = getCampaignsByAccountId(campaigns, clientId);
  const clientAdSets    = clientCampaigns.flatMap((c) =>
    getAdSetsByCampaignId(adSets, c.id)
  );
  const clientAds       = clientAdSets.flatMap((as) =>
    getAdsByAdSetId(ads, as.id)
  );

  const campaignSummaries = aggregateByCampaign(
    hourlyMetrics.filter((m) => m.accountId === clientId)
  );

  // Filter performance summaries to only entities belonging to this client.
  const clientAdSetIds = new Set(clientAdSets.map((as) => as.id));
  const clientAdIds    = new Set(clientAds.map((ad) => ad.id));

  const clientAdSetPerformance = adSetPerformance.filter((s) =>
    clientAdSetIds.has(s.adSetId)
  );
  const clientAdPerformance = adPerformance.filter((s) =>
    clientAdIds.has(s.adId)
  );

  return (
    <ClientDetailView
      account={account}
      campaigns={clientCampaigns}
      adSets={clientAdSets}
      ads={clientAds}
      campaignSummaries={campaignSummaries}
      adSetSummaries={clientAdSetPerformance}
      adSummaries={clientAdPerformance}
      integrations={integrations}
      readiness={readiness}
      syncStatus={syncStatus}
      clientMetaData={clientMetaData}
    />
  );
}
