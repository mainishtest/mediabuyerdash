// app/page.tsx — redirect root to /dashboard
import { redirect } from "next/navigation";
export default function RootPage() { redirect("/dashboard"); }

// ── Legacy dashboard (kept for reference, unreachable after redirect) ─────────
export const dynamic = "force-dynamic";
// @ts-ignore — kept for reference only
import Link from "next/link";
import { DashboardCard } from "./components/DashboardCard";
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
  formatHour,
} from "../lib/metricUtils";
import {
  mockRawAccounts,
  mockRawCampaigns,
  mockRawAdSets,
  mockRawAds,
  mockRawCreatives,
  mockRawHourlyMetrics,
} from "../lib/mockRawData";
import {
  mapAllRawCampaigns,
  mapAllRawAds,
  mapAllRawHourlyMetrics,
  mapRawCampaignToCampaign,
} from "../lib/adapters";
import {
  aggregateByAccount,
  aggregateByCampaign,
  aggregateByDate,
} from "../lib/aggregations";
import { PageHeader }  from "../components/ui/PageHeader";
import { StatCard }    from "../components/ui/StatCard";
import { SectionCard } from "../components/ui/SectionCard";
import { Badge }       from "../components/ui/Badge";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function _LegacyPage() {
  const dbAccounts = await prisma.clientAccount
    .findMany({ include: { _count: { select: { campaigns: true } } } })
    .catch(() => []);

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
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-10">
      {/* Page header */}
      <PageHeader
        title="Dashboard"
        description="Manage client accounts, campaigns, and ad performance. Configure per-campaign optimization goals and inspect dayparting analysis."
        badge={<Badge variant="success">Live</Badge>}
      />

      {/* Performance snapshot */}
      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Performance Snapshot
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Spend"       value={formatCurrency(spend)} />
          <StatCard label="Total Conversions" value={String(conversions)} />
          <StatCard label="Avg CPA"           value={formatCurrency(cpa)} />
          <StatCard label="Avg ROAS"          value={formatRoas(roas)} />
        </div>
      </section>

      {/* Client Optimization Workspace */}
      <SectionCard
        title="Client Optimization Workspace"
        description="Select a client account to view their campaign hierarchy, performance data, and configure per-campaign ROAS and CPA optimization targets."
        actions={
          <Badge variant="success">
            {dbAccounts.length} account{dbAccounts.length !== 1 ? "s" : ""}
          </Badge>
        }
      >
        {dbAccounts.length === 0 ? (
          <p className="text-sm text-slate-500">
            No client accounts found. Add accounts via the database seed or
            Prisma Studio.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {dbAccounts.map((account) => (
              <Link
                key={account.id}
                href={`/clients/${account.id}`}
                className="group rounded-lg border border-slate-800 bg-slate-800/40 p-4
                  transition-colors hover:border-slate-600 hover:bg-slate-800/70"
              >
                <h3 className="font-semibold text-slate-100 group-hover:text-white">
                  {account.name}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {account.platform} · {account.currency} · {account.timezone}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {account._count.campaigns} campaign
                  {account._count.campaigns !== 1 ? "s" : ""}
                </p>
                <p className="mt-3 text-xs font-medium text-emerald-400 group-hover:text-emerald-300">
                  View Workspace →
                </p>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Entity overview cards */}
      <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <DashboardCard
          title="Account Overview"
          description={`${dbAccounts.length} client account${dbAccounts.length === 1 ? "" : "s"} tracked. Click a workspace card above to drill in.`}
        />
        <DashboardCard
          title="Campaign Performance"
          description={`Campaign metrics and insights will appear here. Currently tracking ${campaignCount} campaign${campaignCount === 1 ? "" : "s"}.`}
        />
        <DashboardCard
          title="Dayparting Analysis"
          description={`Hourly performance analysis and recommendations. Currently tracking ${creativeCount} creative${creativeCount === 1 ? "" : "s"}.`}
        />
      </section>

      {/* Hourly performance preview */}
      <SectionCard title="Hourly Performance Preview">
        <div className="grid grid-cols-4 gap-4 border-b border-slate-700 pb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
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
      </SectionCard>

      {/* Normalized data model */}
      <DataModelPreview
        counts={{
          accounts:      dbAccounts.length,
          campaigns:     campaigns.length,
          adSets:        adSets.length,
          ads:           ads.length,
          creatives:     creatives.length,
          hourlyMetrics: hourlyMetrics.length,
        }}
      />

      {/* Aggregated performance summaries */}
      <AggregatedPerformance
        accountSummaries={accountSummaries}
        campaignSummaries={campaignSummaries}
        dateSummaries={dateSummaries}
      />

      {/* Adapter ingestion preview */}
      <IngestionPreview
        rawCounts={{
          accounts:      mockRawAccounts.length,
          campaigns:     mockRawCampaigns.length,
          adSets:        mockRawAdSets.length,
          ads:           mockRawAds.length,
          creatives:     mockRawCreatives.length,
          hourlyMetrics: mockRawHourlyMetrics.length,
        }}
        mappedCounts={{
          campaigns:     mappedCampaigns.length,
          ads:           mappedAds.length,
          hourlyMetrics: mappedHourlyMetrics.length,
        }}
        rawCampaignSample={mockRawCampaigns[0]}
        mappedCampaignSample={mapRawCampaignToCampaign(mockRawCampaigns[0])}
      />

      {/* Filterable dayparting analysis + recommendations */}
      <FilterableAnalysis />
    </div>
  );
}
