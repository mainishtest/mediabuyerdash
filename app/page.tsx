import { DashboardCard } from "./components/DashboardCard";
import { MetricStat } from "./components/MetricStat";
import { HourlyRow } from "./components/HourlyRow";
import { FilterableAnalysis } from "./components/FilterableAnalysis";
import { DataModelPreview } from "./components/DataModelPreview";
import { adAccounts, campaigns, adSets, ads, creatives } from "../lib/sampleData";
import { dailyMetrics, hourlyMetrics } from "../lib/sampleMetrics";
import {
  totalSpend,
  totalConversions,
  averageCpa,
  averageRoas,
  formatCurrency,
  formatRoas,
  formatHour
} from "../lib/metricUtils";

export default function Page() {
  const accountCount  = adAccounts.length;
  const campaignCount = campaigns.length;
  const creativeCount = creatives.length;

  const spend       = totalSpend(dailyMetrics);
  const conversions = totalConversions(dailyMetrics);
  const cpa         = averageCpa(dailyMetrics);
  const roas        = averageRoas(dailyMetrics);

  return (
    <>
      {/* Page header */}
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
          Media Buying Dashboard
        </h1>
        <p className="mt-2 max-w-xl text-sm text-slate-300">
          Foundation overview of ad accounts, campaigns, creatives, performance
          metrics, dayparting analysis, and rule-based optimization
          recommendations.
        </p>
      </header>

      {/* Entity overview cards */}
      <section className="mb-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <DashboardCard
          title="Account Overview"
          description={`Summary of connected ad accounts will appear here. Currently tracking ${accountCount} account${accountCount === 1 ? "" : "s"}.`}
        />
        <DashboardCard
          title="Campaign Performance"
          description={`Campaign metrics and performance insights will appear here. Currently tracking ${campaignCount} campaign${campaignCount === 1 ? "" : "s"}.`}
        />
        <DashboardCard
          title="Dayparting Analysis"
          description={`Hourly performance analysis and optimization recommendations will appear here. Currently tracking ${creativeCount} creative${creativeCount === 1 ? "" : "s"}.`}
        />
      </section>

      {/* Performance snapshot */}
      <section className="mb-10">
        <h2 className="mb-4 text-xl font-semibold text-slate-50">
          Performance Snapshot
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricStat label="Total Spend"       value={formatCurrency(spend)} />
          <MetricStat label="Total Conversions" value={String(conversions)} />
          <MetricStat label="Avg CPA"           value={formatCurrency(cpa)} />
          <MetricStat label="Avg ROAS"          value={formatRoas(roas)} />
        </div>
      </section>

      {/* Hourly performance preview (static — first 5 rows of sample) */}
      <section className="mb-10">
        <h2 className="mb-4 text-xl font-semibold text-slate-50">
          Hourly Performance Preview
        </h2>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm shadow-slate-900/40">
          <div className="grid grid-cols-4 gap-4 border-b border-slate-700 pb-3 text-xs font-medium uppercase tracking-widest text-slate-400">
            <span>Hour</span>
            <span>Spend</span>
            <span>Conversions</span>
            <span>ROAS</span>
          </div>
          {hourlyMetrics.slice(0, 5).map((m) => (
            <HourlyRow
              key={m.id}
              hour={formatHour(m.hour)}
              spend={formatCurrency(m.spend)}
              conversions={m.conversions}
              roas={formatRoas(m.roas)}
            />
          ))}
        </div>
      </section>

      {/* Normalized data model entity counts */}
      <div className="mb-10">
        <DataModelPreview
          counts={{
            accounts:     adAccounts.length,
            campaigns:    campaigns.length,
            adSets:       adSets.length,
            ads:          ads.length,
            creatives:    creatives.length,
            hourlyMetrics: hourlyMetrics.length
          }}
        />
      </div>

      {/* Filterable dayparting analysis + recommendations (client component) */}
      <FilterableAnalysis />
    </>
  );
}
