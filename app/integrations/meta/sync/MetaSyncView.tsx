"use client";

import { useState, useTransition } from "react";
import { PageHeader }   from "../../../../components/ui/PageHeader";
import { SectionCard }  from "../../../../components/ui/SectionCard";
import { StatCard }     from "../../../../components/ui/StatCard";
import { Badge }        from "../../../../components/ui/Badge";
import { ActionButton } from "../../../../components/ui/ActionButton";
import { EmptyState }   from "../../../../components/ui/EmptyState";
import { runMetaSyncAction } from "./actions";
import type { SyncSummary } from "../../../../lib/meta/sync";

// ── Prop types ────────────────────────────────────────────────────────────────

interface SelectedAccount {
  id: string; externalAdAccountId: string; accountName: string;
  currency: string; timezoneName: string;
}
interface SyncLogProps {
  status: string; accountsProcessed: number; campaignsSynced: number;
  adSetsSynced: number; adsSynced: number; creativesSynced: number;
  insightRowsSynced: number; errorMessages: string | null;
  completedAt: string | null; startedAt: string;
}
interface CampaignRow  { externalCampaignId: string; name: string; status: string; objective: string; externalAdAccountId: string; }
interface AdSetRow     { externalAdSetId: string; externalCampaignId: string; name: string; status: string; }
interface AdRow        { externalAdId: string; externalAdSetId: string; name: string; status: string; }
interface InsightRow   { externalAdId: string; dateStart: string; spend: number; impressions: number; clicks: number; ctr: number | null; cpm: number | null; }

export interface SyncPageProps {
  isConnected:      boolean;
  selectedAccounts: SelectedAccount[];
  lastSyncLog:      SyncLogProps | null;
  counts:           { campaigns: number; adSets: number; ads: number; creatives: number; insights: number } | null;
  topCampaigns:     CampaignRow[];
  topAdSets:        AdSetRow[];
  topAds:           AdRow[];
  topInsights:      InsightRow[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusVariant(s: string): "success" | "warning" | "danger" | "neutral" {
  if (["ACTIVE", "active", "completed"].includes(s)) return "success";
  if (["PAUSED", "paused", "partial"].includes(s))   return "warning";
  if (["ARCHIVED", "archived", "failed"].includes(s)) return "danger";
  return "neutral";
}

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("en-US", { maximumFractionDigits: decimals });
}

function fmtCurrency(n: number) {
  return `$${fmt(n)}`;
}

const TH = "pb-3 pr-4 text-left text-xs font-semibold uppercase tracking-widest text-slate-500";
const TD = "py-3 pr-4 text-sm text-slate-300";

// ── Component ─────────────────────────────────────────────────────────────────

export function MetaSyncView({
  isConnected,
  selectedAccounts,
  lastSyncLog,
  counts,
  topCampaigns,
  topAdSets,
  topAds,
  topInsights,
}: SyncPageProps) {
  const [isPending, startTransition] = useTransition();
  const [syncResult, setSyncResult]  = useState<SyncSummary | null>(null);

  function handleSync() {
    setSyncResult(null);
    startTransition(async () => {
      const result = await runMetaSyncAction();
      setSyncResult(result);
    });
  }

  const hasSyncedData =
    (counts?.campaigns ?? 0) + (counts?.adSets ?? 0) + (counts?.ads ?? 0) > 0;

  const latestLog = syncResult
    ? {
        status:            syncResult.status,
        accountsProcessed: syncResult.accountsProcessed,
        campaignsSynced:   syncResult.campaignsSynced,
        adSetsSynced:      syncResult.adSetsSynced,
        adsSynced:         syncResult.adsSynced,
        creativesSynced:   syncResult.creativesSynced,
        insightRowsSynced: syncResult.insightRowsSynced,
        errorMessages:     syncResult.errors.length > 0 ? JSON.stringify(syncResult.errors) : null,
        completedAt:       syncResult.completedAt,
        startedAt:         syncResult.startedAt,
      }
    : lastSyncLog;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-8">
      <PageHeader
        title="Meta Sync"
        description="Read-only sync of campaigns, ad sets, ads, creatives, and insights from your selected Meta ad accounts."
        badge={
          isConnected
            ? <Badge variant="success">Connected</Badge>
            : <Badge variant="neutral">Not Connected</Badge>
        }
      />

      {/* Not connected guard */}
      {!isConnected && (
        <SectionCard>
          <EmptyState
            title="Meta account not connected"
            description="Connect a Meta account and select ad accounts on the Meta Integration page before running a sync."
            action={
              <a href="/integrations/meta">
                <ActionButton variant="primary">Go to Meta Integration</ActionButton>
              </a>
            }
            icon="○"
          />
        </SectionCard>
      )}

      {isConnected && (
        <>
          {/* Stat strip */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: "Campaigns",    value: counts?.campaigns ?? 0 },
              { label: "Ad Sets",      value: counts?.adSets    ?? 0 },
              { label: "Ads",          value: counts?.ads       ?? 0 },
              { label: "Creatives",    value: counts?.creatives ?? 0 },
              { label: "Insight Rows", value: counts?.insights  ?? 0 },
            ].map((s) => (
              <StatCard key={s.label} label={s.label} value={s.value.toLocaleString()} />
            ))}
          </div>

          {/* Sync control */}
          <SectionCard
            title="Sync Control"
            description={`${selectedAccounts.length} ad account${selectedAccounts.length !== 1 ? "s" : ""} selected. Syncs campaigns, ad sets, ads, creatives, and last 7 days of insights.`}
            actions={
              <ActionButton
                variant="primary"
                disabled={isPending || selectedAccounts.length === 0}
                onClick={handleSync}
              >
                {isPending ? "Syncing…" : "Run Sync"}
              </ActionButton>
            }
          >
            {selectedAccounts.length === 0 ? (
              <p className="text-sm text-slate-500">
                No ad accounts selected.{" "}
                <a href="/integrations/meta" className="text-emerald-400 hover:underline">
                  Select accounts →
                </a>
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selectedAccounts.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2 text-xs"
                  >
                    <p className="font-medium text-white">{a.accountName}</p>
                    <p className="text-slate-500">{a.externalAdAccountId} · {a.currency}</p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Last sync log */}
          {latestLog && (
            <SectionCard title="Last Sync Result">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant={statusVariant(latestLog.status)}>
                    {latestLog.status}
                  </Badge>
                  <span className="text-xs text-slate-500">
                    {latestLog.completedAt
                      ? new Date(latestLog.completedAt).toLocaleString()
                      : "In progress"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 text-center">
                  {[
                    { label: "Accounts",  v: latestLog.accountsProcessed },
                    { label: "Campaigns", v: latestLog.campaignsSynced   },
                    { label: "Ad Sets",   v: latestLog.adSetsSynced      },
                    { label: "Ads",       v: latestLog.adsSynced         },
                    { label: "Creatives", v: latestLog.creativesSynced   },
                    { label: "Insights",  v: latestLog.insightRowsSynced },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg bg-slate-800/40 px-3 py-2">
                      <p className="text-lg font-semibold text-white">{s.v}</p>
                      <p className="text-xs text-slate-500">{s.label}</p>
                    </div>
                  ))}
                </div>
                {latestLog.errorMessages && (
                  <div className="rounded-lg border border-rose-800/40 bg-rose-950/30 px-4 py-3 text-xs text-rose-300">
                    {(JSON.parse(latestLog.errorMessages) as string[]).map((e, i) => (
                      <p key={i}>{e}</p>
                    ))}
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {/* Synced data tables */}
          {!hasSyncedData && !isPending && (
            <SectionCard>
              <EmptyState
                title="No synced data yet"
                description="Run a sync to pull campaigns, ad sets, ads, and insights from your selected Meta accounts."
                icon="◌"
              />
            </SectionCard>
          )}

          {topCampaigns.length > 0 && (
            <SectionCard title={`Campaigns (${counts?.campaigns ?? topCampaigns.length})`} flush>
              <div className="overflow-x-auto p-5">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      {["Campaign", "ID", "Status", "Objective"].map((h) => (
                        <th key={h} className={TH}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {topCampaigns.map((c) => (
                      <tr key={c.externalCampaignId} className="hover:bg-slate-800/20 transition-colors">
                        <td className={`${TD} font-medium text-white`}>{c.name}</td>
                        <td className={`${TD} font-mono text-xs text-slate-500`}>{c.externalCampaignId}</td>
                        <td className={TD}><Badge variant={statusVariant(c.status)}>{c.status}</Badge></td>
                        <td className={TD}>{c.objective}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {topAdSets.length > 0 && (
            <SectionCard title={`Ad Sets (${counts?.adSets ?? topAdSets.length})`} flush>
              <div className="overflow-x-auto p-5">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      {["Ad Set", "Campaign ID", "Status"].map((h) => (
                        <th key={h} className={TH}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {topAdSets.map((a) => (
                      <tr key={a.externalAdSetId} className="hover:bg-slate-800/20 transition-colors">
                        <td className={`${TD} font-medium text-white`}>{a.name}</td>
                        <td className={`${TD} font-mono text-xs text-slate-500`}>{a.externalCampaignId}</td>
                        <td className={TD}><Badge variant={statusVariant(a.status)}>{a.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {topAds.length > 0 && (
            <SectionCard title={`Ads (${counts?.ads ?? topAds.length})`} flush>
              <div className="overflow-x-auto p-5">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      {["Ad", "Ad Set ID", "Status"].map((h) => (
                        <th key={h} className={TH}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {topAds.map((a) => (
                      <tr key={a.externalAdId} className="hover:bg-slate-800/20 transition-colors">
                        <td className={`${TD} font-medium text-white`}>{a.name}</td>
                        <td className={`${TD} font-mono text-xs text-slate-500`}>{a.externalAdSetId}</td>
                        <td className={TD}><Badge variant={statusVariant(a.status)}>{a.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {topInsights.length > 0 && (
            <SectionCard
              title={`Top Insights by Spend (${counts?.insights ?? 0} total rows)`}
              description="Last 7 days · Ad level · Delivery metrics from Meta"
              flush
            >
              <div className="overflow-x-auto p-5">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      {["Ad ID", "Date", "Spend", "Impressions", "Clicks", "CTR", "CPM"].map((h) => (
                        <th key={h} className={TH}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {topInsights.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                        <td className={`${TD} font-mono text-xs text-slate-500`}>{r.externalAdId || "—"}</td>
                        <td className={TD}>{r.dateStart}</td>
                        <td className={`${TD} text-emerald-400 font-medium`}>{fmtCurrency(r.spend)}</td>
                        <td className={TD}>{r.impressions.toLocaleString()}</td>
                        <td className={TD}>{r.clicks.toLocaleString()}</td>
                        <td className={TD}>{r.ctr != null ? `${fmt(r.ctr, 2)}%` : "—"}</td>
                        <td className={TD}>{r.cpm != null ? fmtCurrency(r.cpm) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
}
