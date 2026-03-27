"use client";

import Link  from "next/link";
import { useState, useMemo } from "react";
import { Badge } from "../../../../../components/ui/Badge";
import type { BadgeVariant } from "../../../../../components/ui/Badge";
import { CampaignGoalEditor } from "./CampaignGoalEditor";
import type { GoalData }       from "./CampaignGoalEditor";
import { TrendChart } from "../../../../../components/charts/TrendChart";
import type { DailyPoint } from "../../../../../lib/charts/dataService";

// ── Types ─────────────────────────────────────────────────────────────────────

type CampaignInfo = {
  externalCampaignId: string;
  name:               string;
  status:             string;
  objective:          string | null;
  updatedAt:          string;
};

type AdSetRow = {
  id:              string;
  externalAdSetId: string;
  name:            string;
  status:          string;
  spend:           number;
  impressions:     number;
  clicks:          number;
  updatedAt:       string;
};

type AdRow = {
  id:              string;
  externalAdId:    string;
  externalAdSetId: string;
  name:            string;
  status:          string;
  spend:           number;
  impressions:     number;
  clicks:          number;
  updatedAt:       string;
};

type Props = {
  clientId:     string;
  clientName:   string;
  campaign:     CampaignInfo;
  adSets:       AdSetRow[];
  ads:          AdRow[];
  goal:         GoalData | null;
  dailyMetrics: DailyPoint[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCurrency(n: number) {
  if (n === 0) return "—";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtCompact(n: number) {
  if (n === 0) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "k";
  return n.toLocaleString();
}

function fmtCtr(impressions: number, clicks: number) {
  if (!impressions) return "—";
  return ((clicks / impressions) * 100).toFixed(2) + "%";
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function statusVariant(s: string): BadgeVariant {
  const u = s.toUpperCase();
  if (u === "ACTIVE")                    return "success";
  if (u === "PAUSED" || u === "PENDING") return "warning";
  return "neutral";
}

function statusLabel(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// ── Shared table styles ───────────────────────────────────────────────────────

const TH = "px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400 whitespace-nowrap";
const TD = "px-4 py-3 text-sm text-slate-300 align-top";

// ── Summary stat strip ────────────────────────────────────────────────────────

function SummaryStrip({
  adSetCount,
  adCount,
  totalSpend,
  totalImpressions,
  totalClicks,
}: {
  adSetCount:       number;
  adCount:          number;
  totalSpend:       number;
  totalImpressions: number;
  totalClicks:      number;
}) {
  const items = [
    { label: "Ad Sets",     value: String(adSetCount) },
    { label: "Ads",         value: String(adCount) },
    { label: "Spend (30d)", value: fmtCurrency(totalSpend) },
    { label: "Impressions", value: fmtCompact(totalImpressions) },
    { label: "Clicks",      value: fmtCompact(totalClicks) },
    { label: "CTR",         value: fmtCtr(totalImpressions, totalClicks) },
  ];
  return (
    <div className="mb-8 grid grid-cols-3 gap-3 sm:grid-cols-6">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <p className="text-xs text-slate-500">{item.label}</p>
          <p className="mt-1 text-base font-semibold text-slate-200">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Ad Sets table ─────────────────────────────────────────────────────────────

function AdSetsTable({
  adSets,
  selectedAdSetId,
  onSelect,
}: {
  adSets:          AdSetRow[];
  selectedAdSetId: string | null;
  onSelect:        (id: string | null) => void;
}) {
  if (adSets.length === 0) {
    return (
      <p className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-6 text-center text-sm text-slate-500">
        No ad sets found for this campaign.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700 bg-slate-900/60">
            <th className={TH}>Ad Set</th>
            <th className={TH}>Status</th>
            <th className={`${TH} text-right`}>Spend (30d)</th>
            <th className={`${TH} text-right`}>Impressions</th>
            <th className={`${TH} text-right`}>Clicks</th>
            <th className={`${TH} text-right`}>CTR</th>
            <th className={TH}>Updated</th>
          </tr>
        </thead>
        <tbody>
          {adSets.map((as, i) => {
            const isSelected = selectedAdSetId === as.externalAdSetId;
            return (
              <tr
                key={as.id}
                onClick={() => onSelect(isSelected ? null : as.externalAdSetId)}
                className={`cursor-pointer transition-colors ${
                  i < adSets.length - 1 ? "border-b border-slate-800" : ""
                } ${isSelected ? "bg-slate-700/40" : "hover:bg-slate-800/30"}`}
              >
                <td className={`${TD} max-w-xs`}>
                  <p className="font-medium text-slate-100 truncate" title={as.name}>
                    {as.name}
                  </p>
                  <p className="text-xs font-mono text-slate-600 truncate">{as.externalAdSetId}</p>
                </td>
                <td className={TD}>
                  <Badge variant={statusVariant(as.status)}>{statusLabel(as.status)}</Badge>
                </td>
                <td className={`${TD} text-right font-medium`}>{fmtCurrency(as.spend)}</td>
                <td className={`${TD} text-right`}>{fmtCompact(as.impressions)}</td>
                <td className={`${TD} text-right`}>{fmtCompact(as.clicks)}</td>
                <td className={`${TD} text-right`}>{fmtCtr(as.impressions, as.clicks)}</td>
                <td className={`${TD} text-slate-500`}>{fmtDate(as.updatedAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Ads table ─────────────────────────────────────────────────────────────────

function AdsTable({
  ads,
  adSets,
}: {
  ads:    AdRow[];
  adSets: AdSetRow[];
}) {
  const adSetNameMap = useMemo(
    () => new Map(adSets.map((as) => [as.externalAdSetId, as.name])),
    [adSets]
  );

  if (ads.length === 0) {
    return (
      <p className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-6 text-center text-sm text-slate-500">
        No ads found for this campaign.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700 bg-slate-900/60">
            <th className={TH}>Ad</th>
            <th className={TH}>Ad Set</th>
            <th className={TH}>Status</th>
            <th className={`${TH} text-right`}>Spend (30d)</th>
            <th className={`${TH} text-right`}>Impressions</th>
            <th className={`${TH} text-right`}>Clicks</th>
            <th className={`${TH} text-right`}>CTR</th>
            <th className={TH}>Updated</th>
          </tr>
        </thead>
        <tbody>
          {ads.map((ad, i) => (
            <tr
              key={ad.id}
              className={`transition-colors hover:bg-slate-800/30 ${
                i < ads.length - 1 ? "border-b border-slate-800" : ""
              }`}
            >
              <td className={`${TD} max-w-xs`}>
                <p className="font-medium text-slate-100 truncate" title={ad.name}>
                  {ad.name}
                </p>
                <p className="text-xs font-mono text-slate-600 truncate">{ad.externalAdId}</p>
              </td>
              <td className={`${TD} max-w-[160px]`}>
                <p className="truncate text-slate-400 text-xs" title={adSetNameMap.get(ad.externalAdSetId)}>
                  {adSetNameMap.get(ad.externalAdSetId) ?? ad.externalAdSetId}
                </p>
              </td>
              <td className={TD}>
                <Badge variant={statusVariant(ad.status)}>{statusLabel(ad.status)}</Badge>
              </td>
              <td className={`${TD} text-right font-medium`}>{fmtCurrency(ad.spend)}</td>
              <td className={`${TD} text-right`}>{fmtCompact(ad.impressions)}</td>
              <td className={`${TD} text-right`}>{fmtCompact(ad.clicks)}</td>
              <td className={`${TD} text-right`}>{fmtCtr(ad.impressions, ad.clicks)}</td>
              <td className={`${TD} text-slate-500`}>{fmtDate(ad.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CampaignDrillDownView({
  clientId,
  clientName,
  campaign,
  adSets,
  ads,
  goal,
  dailyMetrics,
}: Props) {
  const [selectedAdSetId, setSelectedAdSetId] = useState<string | null>(null);

  // When an ad set row is clicked, filter the ads table to just that ad set
  const visibleAds = useMemo(
    () => selectedAdSetId
      ? ads.filter((a) => a.externalAdSetId === selectedAdSetId)
      : ads,
    [ads, selectedAdSetId]
  );

  const totalSpend       = adSets.reduce((s, a) => s + a.spend,       0);
  const totalImpressions = adSets.reduce((s, a) => s + a.impressions, 0);
  const totalClicks      = adSets.reduce((s, a) => s + a.clicks,      0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">

      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-2 text-xs text-slate-500">
        <Link href={`/clients/${clientId}`} className="hover:text-slate-300">
          {clientName}
        </Link>
        <span>/</span>
        <Link href={`/clients/${clientId}/campaigns`} className="hover:text-slate-300">
          Campaigns
        </Link>
        <span>/</span>
        <span className="text-slate-400 truncate max-w-[240px]">{campaign.name}</span>
      </nav>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50 break-all">
              {campaign.name}
            </h1>
            <Badge variant={statusVariant(campaign.status)}>
              {statusLabel(campaign.status)}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {campaign.objective ?? "No objective"} · ID {campaign.externalCampaignId} · Updated {fmtDate(campaign.updatedAt)}
          </p>
        </div>
        <Link
          href={`/clients/${clientId}/campaigns`}
          className="text-xs text-slate-500 hover:text-slate-300"
        >
          ← All campaigns
        </Link>
      </div>

      {/* Summary stats */}
      <SummaryStrip
        adSetCount={adSets.length}
        adCount={ads.length}
        totalSpend={totalSpend}
        totalImpressions={totalImpressions}
        totalClicks={totalClicks}
      />

      {/* 30-day trend chart */}
      {dailyMetrics.some((d) => d.spend > 0 || d.revenue > 0) && (
        <section className="mb-8">
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-500">
              30-Day Trend
            </p>
            <p className="mb-4 text-xs text-slate-600">
              Spend (indigo) · CRM revenue (green) · ROAS (amber dashed)
            </p>
            <TrendChart data={dailyMetrics} height={220} />
          </div>
        </section>
      )}

      {/* Campaign Goals — goal editor section */}
      <section className="mb-8">
        <CampaignGoalEditor
          externalCampaignId={campaign.externalCampaignId}
          initialGoal={goal}
        />
      </section>

      {/* Ad Sets */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-200">Ad Sets</h2>
          {selectedAdSetId && (
            <button
              onClick={() => setSelectedAdSetId(null)}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              Clear filter ×
            </button>
          )}
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Click an ad set row to filter the ads table below.
        </p>
        <AdSetsTable
          adSets={adSets}
          selectedAdSetId={selectedAdSetId}
          onSelect={setSelectedAdSetId}
        />
      </section>

      {/* Ads */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-base font-semibold text-slate-200">Ads</h2>
          {selectedAdSetId && (
            <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300">
              {visibleAds.length} of {ads.length}
            </span>
          )}
        </div>
        <AdsTable ads={visibleAds} adSets={adSets} />
        <p className="mt-3 text-xs text-slate-600">
          Spend and metrics cover the last 30 days.
        </p>
      </section>
    </div>
  );
}
