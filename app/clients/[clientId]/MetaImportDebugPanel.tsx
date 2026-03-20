"use client";

// app/clients/[clientId]/MetaImportDebugPanel.tsx
// Collapsible debug panel showing every stage of the Meta import pipeline.
// Surfaces exactly where the chain is broken so issues are obvious without
// needing to read logs or query the DB manually.
//
// Stages checked:
//   1 → Meta workspace connection active?
//   2 → Ad accounts accessible in workspace?
//   3 → Ad accounts selected?
//   4 → Selected accounts mapped to this client?
//   5 → Sync has run and succeeded?
//   6 → Campaigns/AdSets/Ads/Insights in DB for mapped accounts?
//   7 → Dashboard query returns campaigns?

import { useState } from "react";
import type { MetaImportStatus } from "../../../lib/meta/metaImportStatus";

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month:  "short",
    day:    "numeric",
    hour:   "numeric",
    minute: "2-digit",
  });
}

// ── Stage row ──────────────────────────────────────────────────────────────────

function StageRow({
  num,
  label,
  ok,
  detail,
  warn,
}: {
  num:    number;
  label:  string;
  ok:     boolean;
  detail: string;
  warn?:  boolean;
}) {
  const iconBg  = ok ? "bg-emerald-700 text-emerald-100" : warn ? "bg-amber-700 text-amber-100" : "bg-rose-800 text-rose-200";
  const textCol = ok ? "text-slate-200" : warn ? "text-amber-300" : "text-rose-300";

  return (
    <div className="flex items-start gap-3">
      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${iconBg}`}>
        {ok ? "✓" : num}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${textCol}`}>{label}</p>
        <p className="text-xs text-slate-500 leading-relaxed">{detail}</p>
      </div>
    </div>
  );
}

// ── Selected accounts mini-table ───────────────────────────────────────────────

function SelectedAccountsTable({
  accounts,
  clientId,
}: {
  accounts: MetaImportStatus["selectedAccounts"];
  clientId: string;
}) {
  if (accounts.length === 0) {
    return <p className="text-xs text-slate-500">No selected accounts found.</p>;
  }

  return (
    <>
      {/* Mobile: cards */}
      <div className="space-y-2 sm:hidden">
        {accounts.map((a) => {
          const mapped = a.clientAccountId === clientId;
          const other  = a.clientAccountId !== null && !mapped;
          return (
            <div
              key={a.id}
              className={`rounded-lg border px-3 py-2 text-xs ${
                mapped ? "border-emerald-800/50 bg-emerald-950/20" :
                other  ? "border-amber-800/30 bg-amber-950/10 opacity-70" :
                         "border-slate-800 bg-slate-800/30"
              }`}
            >
              <p className="font-medium text-slate-200 truncate">{a.accountName}</p>
              <p className="font-mono text-slate-500">{a.externalAdAccountId}</p>
              <p className={`mt-1 ${mapped ? "text-emerald-400" : other ? "text-amber-400" : "text-slate-500"}`}>
                {mapped ? "✓ Mapped to this client" : other ? `Mapped to other client: ${a.clientAccountId}` : "Unmapped"}
              </p>
            </div>
          );
        })}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto rounded-lg border border-slate-800 sm:block">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-900/50">
              <th className="px-3 py-2 text-left font-medium uppercase tracking-wider text-slate-500">Account</th>
              <th className="px-3 py-2 text-left font-medium uppercase tracking-wider text-slate-500">Meta ID</th>
              <th className="px-3 py-2 text-left font-medium uppercase tracking-wider text-slate-500">Client Mapping</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a, i) => {
              const mapped = a.clientAccountId === clientId;
              const other  = a.clientAccountId !== null && !mapped;
              return (
                <tr
                  key={a.id}
                  className={`${i < accounts.length - 1 ? "border-b border-slate-800" : ""} ${
                    mapped ? "bg-emerald-950/10" : other ? "bg-amber-950/10 opacity-70" : ""
                  }`}
                >
                  <td className="px-3 py-2 font-medium text-slate-200">{a.accountName}</td>
                  <td className="px-3 py-2 font-mono text-slate-400">{a.externalAdAccountId}</td>
                  <td className={`px-3 py-2 ${mapped ? "text-emerald-400" : other ? "text-amber-400" : "text-slate-500"}`}>
                    {mapped ? "✓ This client" : other ? `Other: ${a.clientAccountId?.slice(0, 8)}…` : "Unmapped"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Sync log detail ────────────────────────────────────────────────────────────

function SyncLogDetail({ sync }: { sync: MetaImportStatus["lastSync"] }) {
  if (!sync) {
    return <p className="text-xs text-slate-500">No sync log found. Run a Meta Sync from the Sync Status section above.</p>;
  }

  const statusColor =
    sync.status === "completed" ? "text-emerald-400" :
    sync.status === "partial"   ? "text-amber-400" :
    "text-rose-400";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className={`font-semibold capitalize ${statusColor}`}>{sync.status}</span>
        <span className="text-slate-500">Started: {fmtDate(sync.startedAt)}</span>
        <span className="text-slate-500">Completed: {fmtDate(sync.completedAt)}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { label: "Campaigns",   value: sync.campaignsSynced },
          { label: "Ad Sets",     value: sync.adSetsSynced },
          { label: "Ads",         value: sync.adsSynced },
          { label: "Insight rows", value: sync.insightRows },
        ].map((s) => (
          <span
            key={s.label}
            className={`rounded-md px-2 py-0.5 text-xs ${
              s.value > 0 ? "bg-emerald-900/30 text-emerald-300" : "bg-slate-700/60 text-slate-400"
            }`}
          >
            {s.value} {s.label}
          </span>
        ))}
      </div>

      {sync.errorMessages && (
        <div className="rounded-md border border-rose-800/40 bg-rose-950/20 px-3 py-2">
          <p className="text-xs font-medium text-rose-400">Errors:</p>
          <pre className="mt-1 whitespace-pre-wrap break-all text-xs text-rose-500">
            {(() => {
              try { return JSON.parse(sync.errorMessages).join("\n"); }
              catch { return sync.errorMessages; }
            })()}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Count row ──────────────────────────────────────────────────────────────────

function CountGrid({ status }: { status: MetaImportStatus }) {
  const items = [
    { label: "Campaigns in DB",   value: status.syncedCampaigns },
    { label: "Ad Sets in DB",     value: status.syncedAdSets },
    { label: "Ads in DB",         value: status.syncedAds },
    { label: "Insight rows in DB", value: status.syncedInsights },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className={`rounded-lg border px-3 py-2 ${
            item.value > 0
              ? "border-emerald-800/40 bg-emerald-950/20"
              : "border-slate-800 bg-slate-800/30"
          }`}
        >
          <p className="text-xs text-slate-500">{item.label}</p>
          <p className={`mt-0.5 text-lg font-semibold ${item.value > 0 ? "text-emerald-400" : "text-slate-500"}`}>
            {item.value.toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────

export function MetaImportDebugPanel({
  clientId,
  status,
}: {
  clientId: string;
  status:   MetaImportStatus;
}) {
  const [open, setOpen] = useState(false);

  // Build stage results
  const stages = [
    {
      num:    1,
      label:  "Meta connection active",
      ok:     status.connectionOk,
      detail: status.connectionOk
        ? `Connected as ${status.userDisplayName ?? "unknown"} (status: ${status.connectionStatus})`
        : status.connectionStatus
        ? `Connection status is "${status.connectionStatus}". Go to Integrations → Meta to reconnect.`
        : "No Meta connection found. Go to Integrations → Meta to connect.",
    },
    {
      num:    2,
      label:  "Ad accounts accessible in workspace",
      ok:     status.accessibleCount > 0,
      detail: status.accessibleCount > 0
        ? `${status.accessibleCount} account${status.accessibleCount !== 1 ? "s" : ""} accessible.`
        : "No accessible accounts. Click Refresh Accounts on the Meta integration page.",
    },
    {
      num:    3,
      label:  "Ad accounts selected",
      ok:     status.selectedAccounts.length > 0,
      detail: status.selectedAccounts.length > 0
        ? `${status.selectedAccounts.length} account${status.selectedAccounts.length !== 1 ? "s" : ""} selected.`
        : "No accounts selected. Visit Integrations → Meta and tick the accounts to include.",
    },
    {
      num:    4,
      label:  "Accounts mapped to this client",
      ok:     status.mappedAccounts.length > 0,
      detail: status.mappedAccounts.length > 0
        ? `${status.mappedAccounts.length} account${status.mappedAccounts.length !== 1 ? "s" : ""} mapped: ${status.mappedAccounts.map((a) => a.accountName).join(", ")}`
        : "No accounts mapped. Use the Meta Ad Accounts card above to assign an account to this client.",
    },
    {
      num:    5,
      label:  "Sync has run",
      ok:     status.lastSync !== null && ["completed", "partial"].includes(status.lastSync.status),
      warn:   status.lastSync?.status === "partial",
      detail: status.lastSync
        ? `Last sync: ${status.lastSync.status} at ${fmtDate(status.lastSync.startedAt)}`
        : "No sync run found. Click Run Meta Sync in the Sync Status section above.",
    },
    {
      num:    6,
      label:  "Campaigns in DB for mapped accounts",
      ok:     status.syncedCampaigns > 0,
      detail: status.syncedCampaigns > 0
        ? `${status.syncedCampaigns} campaigns, ${status.syncedAdSets} ad sets, ${status.syncedAds} ads, ${status.syncedInsights} insight rows.`
        : "Zero campaigns found for this client's mapped accounts. Run a sync — or check that the mapped ad account ID matches what Meta returned.",
    },
    {
      num:    7,
      label:  "Dashboard query returns campaigns",
      ok:     status.dashboardHasSynced,
      detail: status.dashboardHasSynced
        ? "Live Meta Campaigns section below will show data."
        : !status.dashboardHasMapping
        ? "Dashboard shows 'No Meta accounts mapped' — fix stage 4 first."
        : "Dashboard shows 'No synced campaigns' — fix stages 5 and 6 first.",
    },
  ];

  const allOk     = stages.every((s) => s.ok);
  const firstFail = stages.find((s) => !s.ok);

  return (
    <section className="mb-10">
      {/* Collapsed header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40
          px-5 py-4 text-left transition-colors hover:border-slate-700 hover:bg-slate-900/60"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              allOk ? "bg-emerald-700 text-emerald-100" : "bg-rose-800 text-rose-200"
            }`}
          >
            {allOk ? "✓" : "!"}
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-200">Meta Import Pipeline Debug</p>
            <p className="text-xs text-slate-500">
              {allOk
                ? "All 7 stages passing — pipeline is healthy."
                : `Stage ${firstFail?.num} failing: ${firstFail?.label}`}
            </p>
          </div>
        </div>
        <span className="text-xs text-slate-500">{open ? "▲ Hide" : "▼ Show"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-6 rounded-xl border border-slate-800 bg-slate-900/30 p-5">
          {/* Stage checklist */}
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Pipeline Stages
            </p>
            <div className="space-y-3">
              {stages.map((s) => (
                <StageRow
                  key={s.num}
                  num={s.num}
                  label={s.label}
                  ok={s.ok}
                  detail={s.detail}
                  warn={s.warn}
                />
              ))}
            </div>
          </div>

          {/* Selected accounts detail */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Selected Ad Accounts in Workspace
            </p>
            <SelectedAccountsTable accounts={status.selectedAccounts} clientId={clientId} />
          </div>

          {/* DB entity counts */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Synced Entity Counts (this client&apos;s mapped accounts)
            </p>
            <CountGrid status={status} />
          </div>

          {/* Last sync log */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Last Sync Log
            </p>
            <SyncLogDetail sync={status.lastSync} />
          </div>

          {/* Help text */}
          <div className="rounded-lg border border-slate-800 bg-slate-800/20 px-4 py-3">
            <p className="text-xs font-medium text-slate-400">How the pipeline works</p>
            <ol className="mt-2 space-y-1 text-xs text-slate-500 list-decimal list-inside">
              <li>Connect Meta at Integrations → Meta (OAuth)</li>
              <li>Select ad accounts to include in the workspace</li>
              <li>Assign an account to this client using the Meta Ad Accounts card above</li>
              <li>Run a Meta Sync from the Sync Status section</li>
              <li>Campaign data appears in Live Meta Campaigns below</li>
            </ol>
            <p className="mt-2 text-xs text-slate-600">
              If you re-save account selections on the integration page, existing client mappings are preserved.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
