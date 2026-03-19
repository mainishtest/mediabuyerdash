"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge, PageContainer, SectionCard } from "../../../components/ui";
import type { ClientAccount, Campaign, AdSet, Ad } from "../../../types/media";
import type { CampaignSummary } from "../../../lib/aggregations";
import type { AdSetPerformanceSummary } from "../../../lib/data/adSetPerformance";
import type { AdPerformanceSummary } from "../../../lib/data/adPerformance";
import { evaluateEntity } from "../../../lib/evaluationUtils";
import { generateOpportunities } from "../../../lib/optimizationUtils";
import { EvaluationTable } from "../../components/EvaluationTable";
import { OpportunityList } from "../../components/OpportunityList";
import { formatCurrency, formatRoas } from "../../../lib/metricUtils";
import type { ClientIntegrationStatus } from "../../../lib/clientIntegrations";
import type { ClientReadiness }         from "../../../lib/clientSync/readiness";
import type { ClientSyncStatusSummary } from "../../../lib/clientSync/types";
import type { ClientMetaData }          from "../../../lib/meta/clientMetaService";
import type { MetaImportStatus }        from "../../../lib/meta/metaImportStatus";
import type { ClientMetaValidation }    from "../../../lib/meta/clientMetaValidation";
import type { ReconciledCampaignPerformance } from "@prisma/client";
import { ClientIntegrationsSection }    from "./ClientIntegrationsSection";
import { SyncStatusSection }            from "./SyncStatusSection";
import { LiveMetaCampaignsSection }     from "./LiveMetaCampaignsSection";
import { MetaImportDebugPanel }         from "./MetaImportDebugPanel";
import { MetaVerificationSection }      from "./MetaVerificationSection";
import { SourceOfTruthSection }         from "./SourceOfTruthSection";

// --- Local types -------------------------------------------------------------

type GoalOverride = {
  roasGoalType: "high" | "low";
  roasGoalValue: number;
  cpaGoalType: "high" | "low";
  cpaGoalValue: number;
};

type ActiveTab = "campaigns" | "adsets" | "ads";

// Extended account type with fields from the new auth/client management layer
type ClientAccountDetail = ClientAccount & {
  brandName: string | null;
  status:    string;
  notes:     string | null;
};

type BadgeVariant = "success" | "warning" | "neutral";
function clientStatusVariant(status: string): BadgeVariant {
  if (status === "active")   return "success";
  if (status === "paused")   return "warning";
  return "neutral";
}

type Props = {
  account:              ClientAccountDetail;
  campaigns:            Campaign[];
  adSets:               AdSet[];
  ads:                  Ad[];
  campaignSummaries:    CampaignSummary[];
  adSetSummaries:       AdSetPerformanceSummary[];
  adSummaries:          AdPerformanceSummary[];
  integrations:         ClientIntegrationStatus;
  readiness:            ClientReadiness;
  syncStatus:           ClientSyncStatusSummary;
  clientMetaData:       ClientMetaData;
  metaImportStatus:     MetaImportStatus;
  metaValidation:       ClientMetaValidation;
  reconciledCampaigns:  ReconciledCampaignPerformance[];
  reconciledDateFrom:   string | null;
  reconciledDateTo:     string | null;
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
  adSummaries,
  integrations,
  readiness,
  syncStatus,
  clientMetaData,
  metaImportStatus,
  metaValidation,
  reconciledCampaigns,
  reconciledDateFrom,
  reconciledDateTo,
}: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("campaigns");
  const [portalLink, setPortalLink] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalCopied, setPortalCopied] = useState(false);

  // Portal password state
  const [portalPassword,        setPortalPassword]        = useState("");
  const [portalPasswordSaving,  setPortalPasswordSaving]  = useState(false);
  const [portalPasswordMsg,     setPortalPasswordMsg]     = useState<string | null>(null);
  const [portalPasswordSet,     setPortalPasswordSet]     = useState(
    !!(account as { clientPortalPasswordHash?: string | null }).clientPortalPasswordHash
  );

  async function generatePortalLink() {
    setPortalLoading(true);
    try {
      const res = await fetch(`/api/clients/${account.id}/portal-token`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      const { token } = await res.json();
      const url = `${window.location.origin}/portal/${token}`;
      setPortalLink(url);
    } catch {
      // silently ignore — user can retry
    } finally {
      setPortalLoading(false);
    }
  }

  function copyPortalLink() {
    if (!portalLink) return;
    navigator.clipboard.writeText(portalLink);
    setPortalCopied(true);
    setTimeout(() => setPortalCopied(false), 2000);
  }

  async function savePortalPassword() {
    if (!portalPassword.trim()) return;
    setPortalPasswordSaving(true);
    setPortalPasswordMsg(null);
    try {
      const res = await fetch(`/api/clients/${account.id}/portal-password`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ password: portalPassword.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      setPortalPasswordSet(true);
      setPortalPassword("");
      setPortalPasswordMsg("Password set — share it with your client alongside the link.");
      setTimeout(() => setPortalPasswordMsg(null), 4000);
    } catch {
      setPortalPasswordMsg("Failed to save password.");
    } finally {
      setPortalPasswordSaving(false);
    }
  }

  async function clearPortalPassword() {
    setPortalPasswordSaving(true);
    setPortalPasswordMsg(null);
    try {
      await fetch(`/api/clients/${account.id}/portal-password`, { method: "DELETE" });
      setPortalPasswordSet(false);
      setPortalPassword("");
      setPortalPasswordMsg("Password removed — portal is now open to anyone with the link.");
      setTimeout(() => setPortalPasswordMsg(null), 4000);
    } catch {
      setPortalPasswordMsg("Failed to remove password.");
    } finally {
      setPortalPasswordSaving(false);
    }
  }

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

  // --- Derive optimization opportunities (reactive with goalOverrides) -------

  const allOpportunities = [
    ...generateOpportunities(campaignEvaluations, "campaign"),
    ...generateOpportunities(adSetEvaluations, "adSet"),
    ...generateOpportunities(adEvaluations, "ad")
  ];

  // --- Tab definitions -------------------------------------------------------

  const tabs: { id: ActiveTab; label: string; count: number }[] = [
    { id: "campaigns", label: "Campaign Evaluation", count: campaigns.length },
    { id: "adsets",    label: "Ad Set Evaluation",   count: adSets.length },
    { id: "ads",       label: "Ad Evaluation",       count: ads.length }
  ];

  // --- Render ----------------------------------------------------------------

  return (
    <PageContainer>
      {/* Back link */}
      <Link
        href="/clients"
        className="mb-6 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200"
      >
        ← Back to Clients
      </Link>

      {/* Account header */}
      <header className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
              {account.name}
            </h1>
            {account.brandName && (
              <p className="mt-1 text-sm text-slate-400">{account.brandName}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={clientStatusVariant(account.status)}>
              {account.status.charAt(0).toUpperCase() + account.status.slice(1)}
            </Badge>
            <button
              onClick={generatePortalLink}
              disabled={portalLoading}
              className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs
                font-medium text-slate-300 transition-colors hover:border-emerald-600
                hover:bg-emerald-900/30 hover:text-emerald-300 disabled:opacity-50"
            >
              {portalLoading ? "Generating…" : "Share with Client"}
            </button>
          </div>
        </div>

        {/* Portal link panel */}
        {portalLink && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-800/50 bg-emerald-900/20 px-3 py-2">
            <span className="flex-1 truncate text-xs text-emerald-300">{portalLink}</span>
            <button
              onClick={copyPortalLink}
              className="shrink-0 rounded-md border border-emerald-700 px-2.5 py-1 text-xs
                font-medium text-emerald-400 transition-colors hover:bg-emerald-900/40"
            >
              {portalCopied ? "Copied!" : "Copy link"}
            </button>
            <a
              href={portalLink}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-md border border-slate-700 px-2.5 py-1 text-xs
                text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-200"
            >
              Preview
            </a>
          </div>
        )}

        {/* Portal password management */}
        <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900/40 px-4 py-3">
          <div className="mb-2 flex items-center gap-2">
            <p className="text-xs font-semibold text-slate-400">Portal Password</p>
            {portalPasswordSet && (
              <span className="rounded-full bg-emerald-900/50 px-2 py-0.5 text-xs font-medium text-emerald-400">
                Active
              </span>
            )}
          </div>
          {portalPasswordSet ? (
            <div className="flex items-center gap-2">
              <p className="flex-1 text-xs text-slate-500">
                A password is required to view the portal. Change it below or remove it.
              </p>
              <button
                onClick={clearPortalPassword}
                disabled={portalPasswordSaving}
                className="shrink-0 rounded-md border border-slate-600 px-2.5 py-1 text-xs
                  text-slate-400 transition-colors hover:border-red-700 hover:text-red-400 disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              No password set — anyone with the link can view the portal.
            </p>
          )}
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={portalPassword}
              onChange={e => setPortalPassword(e.target.value)}
              placeholder={portalPasswordSet ? "Set a new password…" : "Set a password…"}
              className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5
                text-xs text-slate-200 placeholder-slate-600 outline-none
                focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            />
            <button
              onClick={savePortalPassword}
              disabled={portalPasswordSaving || !portalPassword.trim()}
              className="shrink-0 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium
                text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
            >
              {portalPasswordSaving ? "Saving…" : "Save"}
            </button>
          </div>
          {portalPasswordMsg && (
            <p className="mt-1.5 text-xs text-emerald-400">{portalPasswordMsg}</p>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300">
            {account.currency}
          </span>
          <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300">
            {account.timezone}
          </span>
          <span className="text-xs text-slate-500">Added {account.createdAt}</span>
        </div>
        {account.notes && (
          <p className="mt-3 max-w-xl text-sm text-slate-400">{account.notes}</p>
        )}
      </header>

      {/* Client Integrations — Meta + Shopify mapping */}
      <ClientIntegrationsSection
        clientId={account.id}
        integrations={integrations}
      />

      {/* Sync Status — readiness, last sync, and action buttons */}
      <SyncStatusSection
        clientId={account.id}
        readiness={readiness}
        syncStatus={syncStatus}
      />

      {/* Meta Data Verification — always-visible user-facing status section */}
      <MetaVerificationSection
        clientId={account.id}
        validation={metaValidation}
      />

      {/* Meta Import Pipeline Debug — collapsible developer diagnostic panel */}
      <div id="debug">
        <MetaImportDebugPanel
          clientId={account.id}
          status={metaImportStatus}
        />
      </div>

      {/* Live Meta Campaigns — synced campaign data for mapped accounts */}
      <LiveMetaCampaignsSection
        clientId={account.id}
        data={clientMetaData}
      />

      {/* Source-of-Truth Performance — CRM-verified ROAS/CPA from reconciliation */}
      <SourceOfTruthSection
        clientId={account.id}
        rows={reconciledCampaigns}
        dateFrom={reconciledDateFrom}
        dateTo={reconciledDateTo}
      />

      {/* Campaign Performance — link to dedicated campaigns route */}
      <section className="mb-10">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Campaign Performance</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Live ROAS, CPA, and goal evaluation for all synced campaigns.
              CRM is source of truth. 7-day attribution window.
            </p>
          </div>
          <Link
            href={`/clients/${account.id}/campaigns`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800
              px-4 py-2 text-sm font-medium text-slate-200 transition-colors
              hover:bg-slate-700 hover:text-white"
          >
            View Campaigns →
          </Link>
        </div>
      </section>

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

      {/* Optimization Opportunities */}
      <section className="mt-10">
        <h2 className="mb-1 text-lg font-semibold text-slate-50">
          Optimization Opportunities
        </h2>
        <p className="mb-4 text-sm text-slate-400">
          Deterministic actions derived from current goal evaluation. Updates
          instantly when you change campaign goals above.
        </p>
        <OpportunityList opportunities={allOpportunities} />
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
    </PageContainer>
  );
}
