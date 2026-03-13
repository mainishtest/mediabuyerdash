import Link from "next/link";
import { clientAccounts, campaigns, adSets, ads } from "../../../lib/sampleData";
import { hourlyMetrics } from "../../../lib/sampleMetrics";
import {
  getCampaignsByAccountId,
  getAdSetsByCampaignId,
  getAdsByAdSetId
} from "../../../lib/selectors";
import { aggregateByCampaign } from "../../../lib/aggregations";
import { ClientDetailView } from "./ClientDetailView";

type PageProps = {
  params: { clientId: string };
};

export function generateMetadata({ params }: PageProps) {
  const account = clientAccounts.find((a) => a.id === params.clientId);
  return {
    title: account ? `${account.name} — Media Buying Dashboard` : "Client Not Found"
  };
}

export default function ClientDetailPage({ params }: PageProps) {
  const { clientId } = params;
  const account = clientAccounts.find((a) => a.id === clientId);

  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-lg text-slate-300">Client account not found.</p>
        <Link
          href="/"
          className="mt-4 text-sm text-slate-400 hover:text-slate-200"
        >
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

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

  return (
    <ClientDetailView
      account={account}
      campaigns={clientCampaigns}
      adSets={clientAdSets}
      ads={clientAds}
      campaignSummaries={campaignSummaries}
    />
  );
}
