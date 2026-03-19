export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "../../../lib/db";
import { ClientDetailView }              from "./ClientDetailView";
import { getClientIntegrationStatus }   from "../../../lib/clientIntegrations";
import { getClientReadiness }           from "../../../lib/clientSync/readiness";
import { getClientSyncStatusSummary }   from "../../../lib/clientSync/db";
import { getClientMetaData }            from "../../../lib/meta/clientMetaService";
import { getMetaImportStatus }         from "../../../lib/meta/metaImportStatus";
import { getClientMetaValidation }     from "../../../lib/meta/clientMetaValidation";
import { loadCampaignPerformance }      from "../../../lib/reconciliation/persist";
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
  const [integrations, readiness, syncStatus, clientMetaData, metaImportStatus, metaValidation, reconciledCampaigns] = await Promise.all([
    getClientIntegrationStatus(clientId),
    getClientReadiness(clientId),
    getClientSyncStatusSummary(clientId),
    getClientMetaData(clientId, workspaceId),
    getMetaImportStatus(clientId, workspaceId),
    getClientMetaValidation(clientId, workspaceId),
    loadCampaignPerformance(clientId),
  ]);

  // Legacy mock campaign/adset/ad data has been removed.
  // These props are kept for backwards-compat with ClientDetailView but are
  // empty — the view falls back to the real DB-backed sections for all data.
  const clientCampaigns        = [] as import("../../../types/media").Campaign[];
  const clientAdSets           = [] as import("../../../types/media").AdSet[];
  const clientAds              = [] as import("../../../types/media").Ad[];
  const campaignSummaries      = [] as import("../../../lib/aggregations").CampaignSummary[];
  const clientAdSetPerformance = [] as import("../../../lib/data/adSetPerformance").AdSetPerformanceSummary[];
  const clientAdPerformance    = [] as import("../../../lib/data/adPerformance").AdPerformanceSummary[];

  // Derive date range from the reconciled rows (all share the same dateFrom/dateTo).
  const reconciledDateFrom = reconciledCampaigns[0]?.dateFrom ?? null;
  const reconciledDateTo   = reconciledCampaigns[0]?.dateTo   ?? null;

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
      metaImportStatus={metaImportStatus}
      metaValidation={metaValidation}
      reconciledCampaigns={reconciledCampaigns}
      reconciledDateFrom={reconciledDateFrom}
      reconciledDateTo={reconciledDateTo}
    />
  );
}
