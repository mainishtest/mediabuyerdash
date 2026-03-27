"use client";

import { useState } from "react";
import type {
  MetaConnectionSession,
  MetaAccessibleAdAccount,
  MetaSyncStatus
} from "../../types/metaConnection";
import {
  getSelectedAccounts,
  summarizeConnection,
  getSyncStatus,
  syncStatusLabel
} from "../../lib/metaConnectionUtils";
import { formatCurrency } from "../../lib/metricUtils";

// --- Types -------------------------------------------------------------------

type Props = {
  session:            MetaConnectionSession;
  accessibleAccounts: MetaAccessibleAdAccount[];
  initialSelectedIds: string[];
  syncStatuses:       MetaSyncStatus[];
};

// --- Style helpers -----------------------------------------------------------

const accountStatusBadge = (status: MetaAccessibleAdAccount["accountStatus"]) => {
  if (status === "active")    return null; // no badge needed
  if (status === "disabled")  return <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">disabled</span>;
  return <span className="rounded-full bg-amber-900/60 px-2 py-0.5 text-xs text-amber-300">unsettled</span>;
};

// --- Component ---------------------------------------------------------------

export function MetaConnectionFlow({
  session,
  accessibleAccounts,
  initialSelectedIds,
  syncStatuses
}: Props) {
  const [isConnected, setIsConnected] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(initialSelectedIds)
  );
  const [isSyncing,    setIsSyncing]    = useState(false);
  const [syncComplete, setSyncComplete] = useState(false);

  // --- Actions ---------------------------------------------------------------

  function toggleAccount(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSyncComplete(false);
  }

  function handleConnect() {
    setIsConnected(true);
    setSyncComplete(false);
  }

  function handleDisconnect() {
    setIsConnected(false);
    setSelectedIds(new Set());
    setSyncComplete(false);
    setIsSyncing(false);
  }

  function handleSync() {
    if (selectedIds.size === 0 || isSyncing) return;
    setIsSyncing(true);
    setSyncComplete(false);
    // Simulate a 1.5 s sync job — replaced with real API call in production.
    setTimeout(() => {
      setIsSyncing(false);
      setSyncComplete(true);
    }, 1500);
  }

  // --- Derived values --------------------------------------------------------

  const selectedAccounts = getSelectedAccounts(accessibleAccounts, selectedIds);
  const summary          = summarizeConnection(isConnected, session, accessibleAccounts, selectedIds);

  // --- Render ----------------------------------------------------------------

  return (
    <div className="flex flex-col gap-6">

      {/* ── Summary bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-3">
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
            isConnected ? "bg-emerald-400" : "bg-slate-500"
          }`}
        />
        <span className="text-sm text-slate-300">{summary}</span>
      </div>

      {/* ── 1. Connection Status Card ─────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm shadow-slate-900/40">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Connection Status
        </h3>

        {isConnected ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-medium text-slate-50">{session.userName}</p>
              <p className="mt-0.5 text-sm text-slate-400">{session.userEmail}</p>
              <p className="mt-1 text-xs text-slate-500">
                Connected {session.connectedAt} · Token expires {session.expiresAt}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-emerald-900/60 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
                Connected
              </span>
              <button
                onClick={handleDisconnect}
                className="rounded-lg border border-slate-700 px-4 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
              >
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-400">No Meta account connected.</p>
              <p className="mt-1 text-xs text-slate-500">
                In the full flow, clicking Connect will open a Facebook OAuth window,
                return a user access token, and fetch accessible ad accounts.
              </p>
            </div>
            <button
              onClick={handleConnect}
              className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-600"
            >
              Connect Meta (Mock)
            </button>
          </div>
        )}
      </div>

      {/* ── 2. Accessible Ad Accounts ────────────────────────────────────── */}
      {isConnected && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm shadow-slate-900/40">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Accessible Ad Accounts{" "}
            <span className="normal-case font-normal text-slate-500">
              ({accessibleAccounts.length} found via connected user)
            </span>
          </h3>

          <div className="flex flex-col gap-2">
            {accessibleAccounts.map((account) => {
              const selected = selectedIds.has(account.id);
              const inactive = account.accountStatus !== "active";
              return (
                <div
                  key={account.id}
                  className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                    inactive
                      ? "border-slate-800/40 opacity-50"
                      : selected
                      ? "border-emerald-700/50 bg-emerald-950/20"
                      : "border-slate-800"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200">{account.name}</p>
                    <p className="text-xs text-slate-500">
                      {account.id} · {account.currency} · {account.timezone}
                      {account.businessName ? ` · ${account.businessName}` : ""}
                    </p>
                  </div>

                  {accountStatusBadge(account.accountStatus)}

                  <span className="text-xs text-slate-500">
                    {formatCurrency(account.lifetimeSpend)} lifetime
                  </span>

                  {!inactive && (
                    <button
                      onClick={() => toggleAccount(account.id)}
                      className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                        selected
                          ? "border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                          : "bg-slate-700 text-slate-100 hover:bg-slate-600"
                      }`}
                    >
                      {selected ? "Remove" : "Add to Dashboard"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 3. Selected Accounts + Sync ──────────────────────────────────── */}
      {isConnected && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm shadow-slate-900/40">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Selected for Dashboard Sync{" "}
            <span className="normal-case font-normal text-slate-500">
              ({selectedIds.size} selected)
            </span>
          </h3>

          {selectedAccounts.length === 0 ? (
            <p className="mb-4 text-sm text-slate-500">
              No accounts selected. Add accounts above to include them in dashboard sync.
            </p>
          ) : (
            <div className="mb-4 flex flex-col gap-2">
              {selectedAccounts.map((account) => {
                const sync = getSyncStatus(syncStatuses, account.id);
                const statusValue = isSyncing ? "syncing" : syncComplete ? "completed" : (sync?.status ?? "idle");
                const isOk = statusValue === "completed";

                return (
                  <div
                    key={account.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 px-4 py-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200">{account.name}</p>
                      <p className="text-xs text-slate-500">{account.id}</p>
                    </div>

                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        isSyncing
                          ? "bg-amber-900/60 text-amber-300"
                          : isOk
                          ? "bg-emerald-900/60 text-emerald-300"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {syncStatusLabel(statusValue)}
                    </span>

                    {!isSyncing && sync?.recordsSynced != null && (
                      <span className="text-xs text-slate-500">
                        {sync.recordsSynced} records
                      </span>
                    )}

                    {!isSyncing && !syncComplete && sync?.lastSuccessAt && (
                      <span className="text-xs text-slate-500">
                        Last: {sync.lastSuccessAt.split("T")[0]}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Sync button row */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleSync}
              disabled={selectedIds.size === 0 || isSyncing}
              className={`rounded-lg px-5 py-2 text-sm font-medium transition-colors ${
                selectedIds.size === 0
                  ? "cursor-not-allowed border border-slate-800 text-slate-600"
                  : isSyncing
                  ? "cursor-wait bg-slate-700 text-slate-300"
                  : "bg-emerald-800 text-emerald-100 hover:bg-emerald-700"
              }`}
            >
              {isSyncing ? "Syncing…" : "Sync Selected Accounts (Mock)"}
            </button>

            {syncComplete && !isSyncing && (
              <span className="text-sm text-emerald-400">
                ✓ Sync complete — {selectedIds.size} account{selectedIds.size !== 1 ? "s" : ""} updated
              </span>
            )}
          </div>

          <p className="mt-3 text-xs text-slate-600">
            In the full flow, sync will call the Meta Graph API to fetch
            campaigns, ad sets, ads, and hourly metrics for each selected
            account and write them to the normalized data store.
          </p>
        </div>
      )}
    </div>
  );
}
