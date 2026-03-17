export const dynamic = "force-dynamic";

import { getServerSession }  from "next-auth";
import { authOptions }       from "../../../../lib/auth";
import { getMetaConnection } from "../../../../lib/meta/db";
import { getLatestSyncLog, getSyncedDataSummary } from "../../../../lib/meta/syncDb";
import { MetaSyncView, type SyncPageProps }       from "./MetaSyncView";

export const metadata = { title: "Meta Sync — Media Buying Dashboard" };

export default async function MetaSyncPage() {
  const [session, connection] = await Promise.all([
    getServerSession(authOptions).catch(() => null),
    getMetaConnection().catch(() => null),
  ]);

  const workspaceId = session?.user?.workspaceId ?? null;

  const selectedAccountIds: string[] = connection
    ? connection.accessibleAccounts
        .filter((a) => a.selectedAccount !== null)
        .map((a) => a.externalAdAccountId)
    : [];

  const [lastSyncLog, dataSummary] = await Promise.all([
    connection
      ? getLatestSyncLog(connection.id).catch(() => null)
      : Promise.resolve(null),
    selectedAccountIds.length > 0
      ? getSyncedDataSummary(selectedAccountIds, workspaceId).catch(() => null)
      : Promise.resolve(null),
  ]);

  const selectedAccounts = connection
    ? connection.accessibleAccounts
        .filter((a) => a.selectedAccount !== null)
        .map((a) => ({
          id:                  a.id,
          externalAdAccountId: a.externalAdAccountId,
          accountName:         a.accountName,
          currency:            a.currency,
          timezoneName:        a.timezoneName,
        }))
    : [];

  const props: SyncPageProps = {
    isConnected:      connection !== null,
    selectedAccounts,
    lastSyncLog: lastSyncLog
      ? {
          status:           lastSyncLog.status,
          accountsProcessed: lastSyncLog.accountsProcessed,
          campaignsSynced:   lastSyncLog.campaignsSynced,
          adSetsSynced:      lastSyncLog.adSetsSynced,
          adsSynced:         lastSyncLog.adsSynced,
          creativesSynced:   lastSyncLog.creativesSynced,
          insightRowsSynced: lastSyncLog.insightRowsSynced,
          errorMessages:     lastSyncLog.errorMessages ?? null,
          completedAt:       lastSyncLog.completedAt?.toISOString() ?? null,
          startedAt:         lastSyncLog.startedAt.toISOString(),
        }
      : null,
    counts: dataSummary
      ? {
          campaigns: dataSummary.campaignCount,
          adSets:    dataSummary.adSetCount,
          ads:       dataSummary.adCount,
          creatives: dataSummary.creativeCount,
          insights:  dataSummary.insightCount,
        }
      : null,
    topCampaigns: (dataSummary?.topCampaigns ?? []).map((c) => ({
      externalCampaignId:  c.externalCampaignId,
      name:                c.name,
      status:              c.status,
      objective:           c.objective ?? "—",
      externalAdAccountId: c.externalAdAccountId,
    })),
    topAdSets: (dataSummary?.topAdSets ?? []).map((a) => ({
      externalAdSetId:    a.externalAdSetId,
      externalCampaignId: a.externalCampaignId,
      name:               a.name,
      status:             a.status,
    })),
    topAds: (dataSummary?.topAds ?? []).map((a) => ({
      externalAdId:    a.externalAdId,
      externalAdSetId: a.externalAdSetId,
      name:            a.name,
      status:          a.status,
    })),
    topInsights: (dataSummary?.topInsights ?? []).map((i) => ({
      externalAdId:  i.externalAdId,
      dateStart:     i.dateStart,
      spend:         i.spend,
      impressions:   i.impressions,
      clicks:        i.clicks,
      ctr:           i.ctr   ?? null,
      cpm:           i.cpm   ?? null,
    })),
  };

  return <MetaSyncView {...props} />;
}
