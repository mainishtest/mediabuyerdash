import type { RawCampaign } from "../../types/rawPlatform";
import type { Campaign } from "../../types/media";

interface RawCounts {
  accounts: number;
  campaigns: number;
  adSets: number;
  ads: number;
  creatives: number;
  hourlyMetrics: number;
}

interface MappedCounts {
  campaigns: number;
  ads: number;
  hourlyMetrics: number;
}

type IngestionPreviewProps = {
  rawCounts: RawCounts;
  mappedCounts: MappedCounts;
  rawCampaignSample: RawCampaign;
  mappedCampaignSample: Campaign;
};

function KVRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 border-b border-slate-800 py-2 last:border-none">
      <span className="w-44 shrink-0 text-xs text-slate-500">{label}</span>
      <span className="break-all text-xs text-slate-200">{value}</span>
    </div>
  );
}

export function IngestionPreview({
  rawCounts,
  mappedCounts,
  rawCampaignSample,
  mappedCampaignSample
}: IngestionPreviewProps) {
  return (
    <section>
      <h2 className="mb-1 text-xl font-semibold text-slate-50">
        Ingestion Preview
      </h2>
      <p className="mb-6 text-sm text-slate-400">
        Mock raw platform payload loaded and transformed via the adapter layer.
        This previews how Meta Ads data will flow into internal normalized
        models when live ingestion is connected.
      </p>

      {/* Raw vs mapped entity counts */}
      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm shadow-slate-900/40">
          <h3 className="mb-4 text-xs font-medium uppercase tracking-widest text-amber-400">
            Raw Payload
          </h3>
          <ul className="space-y-2">
            {(
              [
                ["Accounts",        rawCounts.accounts],
                ["Campaigns",       rawCounts.campaigns],
                ["Ad Sets",         rawCounts.adSets],
                ["Ads",             rawCounts.ads],
                ["Creatives",       rawCounts.creatives],
                ["Hourly Metrics",  rawCounts.hourlyMetrics]
              ] as [string, number][]
            ).map(([label, count]) => (
              <li key={label} className="flex justify-between text-sm">
                <span className="text-slate-400">{label}</span>
                <span className="font-semibold text-slate-100">{count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm shadow-slate-900/40">
          <h3 className="mb-4 text-xs font-medium uppercase tracking-widest text-emerald-400">
            Mapped Entities
          </h3>
          <ul className="space-y-2">
            {(
              [
                ["Campaigns",      mappedCounts.campaigns],
                ["Ads",            mappedCounts.ads],
                ["Hourly Metrics", mappedCounts.hourlyMetrics]
              ] as [string, number][]
            ).map(([label, count]) => (
              <li key={label} className="flex justify-between text-sm">
                <span className="text-slate-400">{label}</span>
                <span className="font-semibold text-emerald-400">{count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Side-by-side campaign transformation sample */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-slate-300">
          Campaign Transformation Sample
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {/* Raw platform payload */}
          <div className="rounded-xl border border-amber-900/40 bg-slate-900/60 p-5 shadow-sm shadow-slate-900/40">
            <p className="mb-4 text-xs font-medium uppercase tracking-widest text-amber-400">
              Raw Platform Payload
            </p>
            <KVRow label="external_id"          value={rawCampaignSample.external_id} />
            <KVRow label="account_external_id"  value={rawCampaignSample.account_external_id} />
            <KVRow label="campaign_name"        value={rawCampaignSample.campaign_name} />
            <KVRow label="campaign_objective"   value={rawCampaignSample.campaign_objective} />
            <KVRow label="campaign_status"      value={rawCampaignSample.campaign_status} />
            <KVRow label="daily_budget_cents"   value={String(rawCampaignSample.daily_budget_cents)} />
            <KVRow label="created_time"         value={rawCampaignSample.created_time} />
          </div>

          {/* Mapped internal model */}
          <div className="rounded-xl border border-emerald-900/40 bg-slate-900/60 p-5 shadow-sm shadow-slate-900/40">
            <p className="mb-4 text-xs font-medium uppercase tracking-widest text-emerald-400">
              Mapped Internal Model
            </p>
            <KVRow label="id"          value={mappedCampaignSample.id} />
            <KVRow label="accountId"   value={mappedCampaignSample.accountId} />
            <KVRow label="name"        value={mappedCampaignSample.name} />
            <KVRow label="objective"   value={mappedCampaignSample.objective} />
            <KVRow label="status"      value={mappedCampaignSample.status} />
            <KVRow label="dailyBudget" value={`$${mappedCampaignSample.dailyBudget.toFixed(2)}`} />
            <KVRow label="createdAt"   value={mappedCampaignSample.createdAt} />
          </div>
        </div>
      </div>
    </section>
  );
}
