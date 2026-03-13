import { MetricStat } from "./MetricStat";

export interface EntityCounts {
  accounts: number;
  campaigns: number;
  adSets: number;
  ads: number;
  creatives: number;
  hourlyMetrics: number;
}

type DataModelPreviewProps = {
  counts: EntityCounts;
};

export function DataModelPreview({ counts }: DataModelPreviewProps) {
  return (
    <section>
      <h2 className="mb-1 text-xl font-semibold text-slate-50">
        Data Model Preview
      </h2>
      <p className="mb-5 text-sm text-slate-400">
        Entity counts from the normalized sample data layer. This structure
        mirrors the schema that will be populated from Meta Ads in a future
        step.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricStat label="Ad Accounts"       value={String(counts.accounts)} />
        <MetricStat label="Campaigns"         value={String(counts.campaigns)} />
        <MetricStat label="Ad Sets"           value={String(counts.adSets)} />
        <MetricStat label="Ads"               value={String(counts.ads)} />
        <MetricStat label="Creatives"         value={String(counts.creatives)} />
        <MetricStat label="Hourly Metric Rows" value={String(counts.hourlyMetrics)} />
      </div>
    </section>
  );
}
