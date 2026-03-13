import Link from "next/link";
import { DashboardCard } from "./components/DashboardCard";
import { MetricStat } from "./components/MetricStat";
import { HourlyRow } from "./components/HourlyRow";
import { FilterableAnalysis } from "./components/FilterableAnalysis";
import { DataModelPreview } from "./components/DataModelPreview";
import { IngestionPreview } from "./components/IngestionPreview";
import { AggregatedPerformance } from "./components/AggregatedPerformance";
import { prisma } from "../lib/db";
import { campaigns, adSets, ads, creatives } from "../lib/sampleData";
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
import {
  mockRawAccounts,
  mockRawCampaigns,
  mockRawAdSets,
  mockRawAds,
  mockRawCreatives,
  mockRawHourlyMetrics
} from "../lib/mockRawData";
import {
  mapAllRawCampaigns,
  mapAllRawAds,
  mapAllRawHourlyMetrics,
  mapRawCampaignToCampaign
} from "../lib/adapters";
import {
  aggregateByAccount,
  aggregateByCampaign,
  aggregateByDate
} from "../lib/aggregations";

export default async function Page() {
  // Database-backed: client accounts and campaign counts
  const dbAccounts = await prisma.clientAccount.findMany({
    include: { _count: { select: { campaigns: true } } }
  });

  const campaignCount = campaigns.length;
  const creativeCount = creatives.length;

  const spend       = totalSpend(dailyMetrics);
  const conversions = totalConversions(dailyMetrics);
  const cpa         = averageCpa(dailyMetrics);
  const roas        = averageRoas(dailyMetrics);

  const mappedCampaigns     = mapAllRawCampaigns(mockRawCampaigns);
  const mappedAds           = mapAllRawAds(mockRawAds);
  const mappedHourlyMetrics = mapAllRawHourlyMetrics(mockRawHourlyMetrics);

  const accountSummaries  = aggregateByAccount(hourlyMetrics);
  const campaignSummaries = aggregateByCampaign(hourlyMetrics);
  const dateSummaries     = aggregateByDate(hourlyMetrics);

  return (
    <>
      {/* Page header */}
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
          Media Buying Dashboard
        </h1>
        <p className="mt-2 max-w-xl text-sm text-slate-300">
          Manage client accounts, campaigns, ad sets, and ads. Configure
          per-campaign optimization goals and inspect dayparting performance.
        </p>
      </header>

      {/* Client Optimization Workspace — data from database */}
      <section className="mb-10">
        <h2 className="mb-1 text-xl font-semibold text-slate-50">
          Client Optimization Workspace
        </h2>
        <p className="mb-5 text-sm text-slate-400">
          Select a client account to view their campaign hierarchy, performance
          data, and configure per-campaign ROAS and CPA optimization targets.
        </p>
        <div className="mb-4 inline-flex items-center gap-2 rounded-lg border border-emerald-800/60 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300">
          <span aria-hidden>●</span>
          <span>Data loaded from database (Prisma + SQLite)</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {dbAccounts.map((account) => (
            <Link
              key={account.id}
              href={`/clients/${account.id}`}
              className="group rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm shadow-slate-900/40 transition-colors hover:border-slate-600"
            >
              <h3 className="font-semibold text-slate-50 group-hover:text-white">
                {account.name}
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                {account.platform} · {account.currency} · {account.timezone}
              </p>
              <p className="mt-2 text-sm text-slate-400">
                {account._count.campaigns} campaign
                {account._count.campaigns !== 1 ? "s" : ""}
              </p>
              <p className="mt-3 text-xs font-medium text-emerald-400 group-hover:text-emerald-300">
                View Workspace →
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Entity overview cards */}
      <section className="mb-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <DashboardCard
          title="Account Overview"
          description={`${dbAccounts.length} client account${dbAccounts.length === 1 ? "" : "s"} tracked (from database). Click a workspace card above to drill in.`}
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

      {/* Hourly performance preview */}
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

      {/* Normalized data model entity counts (accounts from DB, rest from sample data) */}
      <div className="mb-10">
        <DataModelPreview
          counts={{
            accounts:      dbAccounts.length,
            campaigns:     campaigns.length,
            adSets:        adSets.length,
            ads:           ads.length,
            creatives:     creatives.length,
            hourlyMetrics: hourlyMetrics.length
          }}
        />
      </div>

      {/* Aggregated performance summaries */}
      <div className="mb-10">
        <AggregatedPerformance
          accountSummaries={accountSummaries}
          campaignSummaries={campaignSummaries}
          dateSummaries={dateSummaries}
        />
      </div>

      {/* Adapter ingestion preview */}
      <div className="mb-10">
        <IngestionPreview
          rawCounts={{
            accounts:      mockRawAccounts.length,
            campaigns:     mockRawCampaigns.length,
            adSets:        mockRawAdSets.length,
            ads:           mockRawAds.length,
            creatives:     mockRawCreatives.length,
            hourlyMetrics: mockRawHourlyMetrics.length
          }}
          mappedCounts={{
            campaigns:     mappedCampaigns.length,
            ads:           mappedAds.length,
            hourlyMetrics: mappedHourlyMetrics.length
          }}
          rawCampaignSample={mockRawCampaigns[0]}
          mappedCampaignSample={mapRawCampaignToCampaign(mockRawCampaigns[0])}
        />
      </div>

      {/* Filterable dayparting analysis + recommendations */}
      <FilterableAnalysis />
    </>
  );
}
