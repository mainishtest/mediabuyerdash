"use client";

import { useState } from "react";
import Link from "next/link";
import type { ClientAccount, Campaign, AdSet, Ad } from "../../../types/media";
import type { CampaignSummary } from "../../../lib/aggregations";
import type { AdSetPerformanceSummary } from "../../../lib/data/adSetPerformance";
import type { AdPerformanceSummary } from "../../../lib/data/adPerformance";
import { evaluateEntity } from "../../../lib/evaluationUtils";
import { EvaluationTable } from "../../components/EvaluationTable";
import { formatCurrency, formatRoas } from "../../../lib/metricUtils";

// --- Local types -------------------------------------------------------------

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
  adSetSummaries: AdSetPerformanceSummary[];
  adSummaries: AdPerformanceSummary[];
};

// --- Style constants ---------------------------------------------------------

const TH = "px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400";
const TD = "px-4 py-3 text-sm text-slate-300";

const entityStatusBadge = (status: string) =>
  `rounded-full px-2 py-0.5 text-xs font-medium ${
    status === "active"
      ? "bg-emerald-900/60 text-emerald-300"
      : "bg-slate-800 text-slate-400"
  }`;

// --- Component ---------------------------------------------------------------

export function ClientDetailView({
  account,
  campaigns,
  adSets,
  ads,
  campaignSummaries,
  adSetSummaries,
  adSummaries
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

  // --- Derive evaluations from current goalOverrides (reactive) --------------

  const campaignSummaryMap = Object.fromEntries(
    campaignSummaries.map((s) => [s.campaignId, s])
  );

  const campaignEvaluations = campaigns.map((c) => {
    const g = goalOverrides[c.id] ?? {
      roasGoalType: c.roasGoalType, roasGoalValue: c.roasGoalValue,
      cpaGoalType: c.cpaGoalType,   cpaGoalValue: c.cpaGoalValue
    };
    const s = campaignSummaryMap[c.id];
    return evaluateEntity({
      entityId:     c.id,
      entityName:   c.name,
      actualRoas:   s?.roas ?? 0,
      actualCpa:    s?.cpa  ?? 0,
      roasGoalType:  g.roasGoalType,
      roasGoalValue: g.roasGoalValue,
      cpaGoalType:   g.cpaGoalType,
      cpaGoalValue:  g.cpaGoalValue
    });
  });

  const adSetEvaluations = adSets.map((as) => {
    const campaign = campaigns.find((c) => c.id === as.campaignId);
    const g = campaign
      ? goalOverrides[campaign.id] ?? {
          roasGoalType: campaign.roasGoalType, roasGoalValue: campaign.roasGoalValue,
          cpaGoalType: campaign.cpaGoalType,   cpaGoalValue: campaign.cpaGoalValue
        }
      : { roasGoalType: "high" as const, roasGoalValue: 0, cpaGoalType: "low" as const, cpaGoalValue: 0 };
    const s = adSetSummaries.find((p) => p.adSetId === as.id);
    return evaluateEntity({
      entityId:           as.id,
      entityName:         as.name,
      parentCampaignId:   campaign?.id,
      parentCampaignName: campaign?.name,
      actualRoas:         s?.roas ?? 0,
      actualCpa:          s?.cpa  ?? 0,
      roasGoalType:        g.roasGoalType,
      roasGoalValue:       g.roasGoalValue,
      cpaGoalType:         g.cpaGoalType,
      cpaGoalValue:        g.cpaGoalValue
    });
  });

  const adEvaluations = ads.map((ad) => {
    const adSet   = adSets.find((as) => as.id === ad.adSetId);
    const campaign = campaigns.find((c) => c.id === adSet?.campaignId);
    const g = campaign
      ? goalOverrides[campaign.id] ?? {
          roasGoalType: campaign.roasGoalType, roasGoalValue: campaign.roasGoalValue,
          cpaGoalType: campaign.cpaGoalType,   cpaGoalValue: campaign.cpaGoalValue
        }
      : { roasGoalType: "high" as const, roasGoalValue: 0, cpaGoalType: "low" as const, cpaGoalValue: 0 };
    const s = adSummaries.find((p) => p.adId === ad.id);
    return evaluateEntity({
      entityId:           ad.id,
      entityName:         ad.name,
      parentCampaignId:   campaign?.id,
      parentCampaignName: campaign?.name,
      actualRoas:         s?.roas ?? 0,
      actualCpa:          s?.cpa  ?? 0,
      roasGoalType:        g.roasGoalType,
      roasGoalValue:       g.roasGoalValue,
      cpaGoalType:         g.cpaGoalType,
      cpaGoalValue:        g.cpaGoalValue
    });
  });

  // --- Tab definitions -------------------------------------------------------

  const tabs: { id: ActiveTab; label: string; count: number }[] = [
    { id: "campaigns", label: "Campaign Evaluation", count: campaigns.length },
    { id: "adsets",    label: "Ad Set Evaluation",   count: adSets.length },
    { id: "ads",       label: "Ad Evaluation",       count: ads.length }
  ];

  // --- Render ----------------------------------------------------------------

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

      {/* Campaign Goals editor */}
      <section className="mb-10">
        <h2 className="mb-1 text-lg font-semibold text-slate-50">Campaign Goals</h2>
        <p className="mb-4 text-sm text-slate-400">
          Edit targets below — evaluation results update instantly. Ad sets and ads
          inherit their parent campaign goals.
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

      {/* Evaluation tabs */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-50">
          Performance Evaluation
        </h2>

        <div className="mb-4 flex flex-wrap gap-2">
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

        {activeTab === "campaigns" && (
          <EvaluationTable evaluations={campaignEvaluations} showParent={false} />
        )}

        {activeTab === "adsets" && (
          <EvaluationTable evaluations={adSetEvaluations} showParent />
        )}

        {activeTab === "ads" && (
          <EvaluationTable evaluations={adEvaluations} showParent />
        )}
      </section>

      {/* Quick entity reference — collapsed into a simple summary row */}
      <section className="mt-10">
        <h2 className="mb-4 text-lg font-semibold text-slate-50">Entity Summary</h2>
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
                const s = campaignSummaryMap[c.id];
                return (
                  <tr
                    key={c.id}
                    className={i < campaigns.length - 1 ? "border-b border-slate-800" : ""}
                  >
                    <td className={`${TD} font-medium text-slate-200`}>{c.name}</td>
                    <td className={TD}>{c.objective}</td>
                    <td className={TD}>
                      <span className={entityStatusBadge(c.status)}>{c.status}</span>
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
      </section>
    </>
  );
}
