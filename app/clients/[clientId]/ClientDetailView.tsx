"use client";

import { useState } from "react";
import Link from "next/link";
import type { ClientAccount, Campaign, AdSet, Ad } from "../../../types/media";
import type { CampaignSummary } from "../../../lib/aggregations";
import { formatCurrency, formatRoas } from "../../../lib/metricUtils";

type GoalOverride = {
  roasGoalType: "high" | "low";
  roasGoalValue: number;
  cpaGoalType: "high" | "low";
  cpaGoalValue: number;
};

type ActiveTab = "campaigns" | "adsets" | "ads";

type Props = {
  account: ClientAccount;
  campaigns: Campaign[];
  adSets: AdSet[];
  ads: Ad[];
  campaignSummaries: CampaignSummary[];
};

const TH = "px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400";
const TD = "px-4 py-3 text-sm text-slate-300";

const statusBadge = (status: string) =>
  `rounded-full px-2 py-0.5 text-xs font-medium ${
    status === "active"
      ? "bg-emerald-900/60 text-emerald-300"
      : "bg-slate-800 text-slate-400"
  }`;

export function ClientDetailView({
  account,
  campaigns,
  adSets,
  ads,
  campaignSummaries
}: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("campaigns");

  const [goalOverrides, setGoalOverrides] = useState<Record<string, GoalOverride>>(
    Object.fromEntries(
      campaigns.map((c) => [
        c.id,
        {
          roasGoalType:  c.roasGoalType,
          roasGoalValue: c.roasGoalValue,
          cpaGoalType:   c.cpaGoalType,
          cpaGoalValue:  c.cpaGoalValue
        }
      ])
    )
  );

  function updateGoal<K extends keyof GoalOverride>(
    campaignId: string,
    field: K,
    value: GoalOverride[K]
  ) {
    setGoalOverrides((prev) => ({
      ...prev,
      [campaignId]: { ...prev[campaignId], [field]: value }
    }));
  }

  const summaryMap = Object.fromEntries(
    campaignSummaries.map((s) => [s.campaignId, s])
  );

  const tabs: { id: ActiveTab; label: string; count: number }[] = [
    { id: "campaigns", label: "Campaigns", count: campaigns.length },
    { id: "adsets",    label: "Ad Sets",   count: adSets.length },
    { id: "ads",       label: "Ads",       count: ads.length }
  ];

  return (
    <>
      {/* Back link */}
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200"
      >
        ← Back to Dashboard
      </Link>

      {/* Account header */}
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
          {account.name}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300">
            {account.platform}
          </span>
          <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300">
            {account.currency}
          </span>
          <span className="text-xs text-slate-500">ID: {account.id}</span>
        </div>
      </header>

      {/* Campaign Goals */}
      <section className="mb-10">
        <h2 className="mb-1 text-lg font-semibold text-slate-50">
          Campaign Goals
        </h2>
        <p className="mb-4 text-sm text-slate-400">
          Per-campaign optimization targets. Changes here are local only until
          persistence is added.
        </p>
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm shadow-slate-900/40">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className={TH}>Campaign</th>
                <th className={TH}>ROAS Goal Type</th>
                <th className={TH}>ROAS Target</th>
                <th className={TH}>CPA Goal Type</th>
                <th className={TH}>CPA Target ($)</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c, i) => {
                const g = goalOverrides[c.id];
                return (
                  <tr
                    key={c.id}
                    className={i < campaigns.length - 1 ? "border-b border-slate-800" : ""}
                  >
                    <td className={`${TD} font-medium text-slate-200`}>{c.name}</td>
                    <td className={TD}>
                      <select
                        value={g.roasGoalType}
                        onChange={(e) =>
                          updateGoal(c.id, "roasGoalType", e.target.value as "high" | "low")
                        }
                        className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-500"
                      >
                        <option value="high">High</option>
                        <option value="low">Low</option>
                      </select>
                    </td>
                    <td className={TD}>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={g.roasGoalValue}
                        onChange={(e) =>
                          updateGoal(c.id, "roasGoalValue", parseFloat(e.target.value) || 0)
                        }
                        className="w-20 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-500"
                      />
                    </td>
                    <td className={TD}>
                      <select
                        value={g.cpaGoalType}
                        onChange={(e) =>
                          updateGoal(c.id, "cpaGoalType", e.target.value as "high" | "low")
                        }
                        className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-500"
                      >
                        <option value="low">Low</option>
                        <option value="high">High</option>
                      </select>
                    </td>
                    <td className={TD}>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={g.cpaGoalValue}
                        onChange={(e) =>
                          updateGoal(c.id, "cpaGoalValue", parseFloat(e.target.value) || 0)
                        }
                        className="w-24 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-500"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Level tabs */}
      <section>
        <div className="mb-4 flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-slate-700 text-slate-50"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              {tab.label}{" "}
              <span className="ml-1 text-xs opacity-60">({tab.count})</span>
            </button>
          ))}
        </div>

        {/* Campaigns tab */}
        {activeTab === "campaigns" && (
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm shadow-slate-900/40">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  {["Campaign", "Objective", "Status", "Budget", "Spend", "Conversions", "CPA", "ROAS"].map(
                    (h) => <th key={h} className={TH}>{h}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c, i) => {
                  const s = summaryMap[c.id];
                  return (
                    <tr
                      key={c.id}
                      className={i < campaigns.length - 1 ? "border-b border-slate-800" : ""}
                    >
                      <td className={`${TD} font-medium text-slate-200`}>{c.name}</td>
                      <td className={TD}>{c.objective}</td>
                      <td className={TD}>
                        <span className={statusBadge(c.status)}>{c.status}</span>
                      </td>
                      <td className={TD}>${c.dailyBudget}/day</td>
                      <td className={TD}>{s ? formatCurrency(s.spend) : "—"}</td>
                      <td className={TD}>{s ? s.conversions : "—"}</td>
                      <td className={TD}>{s ? formatCurrency(s.cpa) : "—"}</td>
                      <td className={TD}>{s ? formatRoas(s.roas) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Ad Sets tab */}
        {activeTab === "adsets" && (
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm shadow-slate-900/40">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  {["Ad Set", "Campaign", "Status", "Daily Budget", "Targeting"].map(
                    (h) => <th key={h} className={TH}>{h}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {adSets.map((as, i) => {
                  const campaign = campaigns.find((c) => c.id === as.campaignId);
                  return (
                    <tr
                      key={as.id}
                      className={i < adSets.length - 1 ? "border-b border-slate-800" : ""}
                    >
                      <td className={`${TD} font-medium text-slate-200`}>{as.name}</td>
                      <td className={TD}>{campaign?.name ?? as.campaignId}</td>
                      <td className={TD}>
                        <span className={statusBadge(as.status)}>{as.status}</span>
                      </td>
                      <td className={TD}>${as.dailyBudget}/day</td>
                      <td className={`${TD} max-w-xs truncate`}>{as.targeting}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Ads tab */}
        {activeTab === "ads" && (
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm shadow-slate-900/40">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  {["Ad", "Ad Set", "Creative", "Status", "Created"].map(
                    (h) => <th key={h} className={TH}>{h}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {ads.map((ad, i) => {
                  const adSet = adSets.find((as) => as.id === ad.adSetId);
                  return (
                    <tr
                      key={ad.id}
                      className={i < ads.length - 1 ? "border-b border-slate-800" : ""}
                    >
                      <td className={`${TD} font-medium text-slate-200`}>{ad.name}</td>
                      <td className={TD}>{adSet?.name ?? ad.adSetId}</td>
                      <td className={TD}>{ad.creativeId}</td>
                      <td className={TD}>
                        <span className={statusBadge(ad.status)}>{ad.status}</span>
                      </td>
                      <td className={TD}>{ad.createdAt}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
