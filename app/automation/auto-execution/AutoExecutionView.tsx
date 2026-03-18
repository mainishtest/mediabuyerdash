"use client";

// app/automation/auto-execution/AutoExecutionView.tsx
// Client component for the Guarded Auto-Execution settings page.
//
// Sections:
//   1. Safety disclaimer banner (always visible)
//   2. Per-client settings cards with opt-in toggles
//   3. "Run Now" button → calls POST /api/auto-execution/run
//   4. Execution history table (desktop) / cards (mobile)

import { useState, useTransition } from "react";
import type {
  AutoExecutionSettingsRow,
  AutoExecutionLogRow,
} from "../../../lib/autoExecution/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ClientSetting = AutoExecutionSettingsRow & { clientName: string };

interface Props {
  clientSettings: ClientSetting[];
  history:        AutoExecutionLogRow[];
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    success:           "bg-emerald-900/50 text-emerald-300 border-emerald-800",
    failed:            "bg-rose-900/50 text-rose-300 border-rose-800",
    skipped:           "bg-slate-700/50 text-slate-400 border-slate-600",
    guardrail_blocked: "bg-amber-900/50 text-amber-300 border-amber-800",
    pending:           "bg-blue-900/50 text-blue-300 border-blue-800",
  };
  const cls = map[status] ?? "bg-slate-700/50 text-slate-400 border-slate-600";
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Toggle
// ---------------------------------------------------------------------------

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked:  boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50 ${
        checked ? "bg-emerald-600" : "bg-slate-700"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Safety banner
// ---------------------------------------------------------------------------

function SafetyBanner() {
  return (
    <div className="rounded-lg border border-amber-700/60 bg-amber-950/40 p-4">
      <div className="flex gap-3">
        <div className="mt-0.5 shrink-0 text-amber-400 text-base">&#9888;</div>
        <div>
          <p className="text-sm font-semibold text-amber-300">
            Guarded Auto-Execution — v1 Safety Notice
          </p>
          <p className="mt-1 text-xs text-amber-200/80">
            Auto-execution takes real actions against live Meta campaigns. Only{" "}
            <strong>run_sync</strong> and <strong>pause_campaign</strong> are
            eligible in v1. All other action types require human approval.
          </p>
          <ul className="mt-2 list-disc pl-4 space-y-0.5 text-xs text-amber-200/70">
            <li>Auto-execution is <strong>off by default</strong> for every client.</li>
            <li>Pause actions require approved proposed actions with ROAS ≤ 40% of goal and spend ≥ threshold.</li>
            <li>A daily execution cap prevents runaway automation.</li>
            <li>Every attempt is logged — whether it succeeded, was blocked, or was skipped.</li>
            <li>Pausing a campaign here writes to Meta Ads Manager immediately.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-client settings card
// ---------------------------------------------------------------------------

function ClientSettingsCard({ setting }: { setting: ClientSetting }) {
  const [local, setLocal]     = useState(setting);
  const [saving, setSaving]   = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save(updates: Partial<AutoExecutionSettingsRow>) {
    const next = { ...local, ...updates };
    setLocal(next);
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(
        `/api/auto-execution/settings/${setting.clientAccountId}`,
        {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(updates),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Save failed");
      setMessage("Saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-100">{setting.clientName}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {local.enabled ? "Auto-execution enabled" : "Auto-execution disabled"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-slate-500">Saving…</span>}
          {message && (
            <span className={`text-xs ${message === "Saved." ? "text-emerald-400" : "text-rose-400"}`}>
              {message}
            </span>
          )}
          <Toggle
            checked={local.enabled}
            onChange={(val) => save({ enabled: val })}
            disabled={saving}
          />
        </div>
      </div>

      {/* Settings — only shown when enabled */}
      {local.enabled && (
        <div className="mt-4 space-y-3 border-t border-slate-800 pt-3">
          {/* Allow run_sync */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-300">Allow run_sync</p>
              <p className="text-xs text-slate-500">Automatically trigger data syncs</p>
            </div>
            <Toggle
              checked={local.allowRunSync}
              onChange={(val) => save({ allowRunSync: val })}
              disabled={saving}
            />
          </div>

          {/* Allow pause_campaign */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-300">Allow pause_campaign</p>
              <p className="text-xs text-slate-500 text-rose-400/80">
                Caution — writes to Meta Ads Manager
              </p>
            </div>
            <Toggle
              checked={local.allowPauseCampaign}
              onChange={(val) => save({ allowPauseCampaign: val })}
              disabled={saving}
            />
          </div>

          {/* Thresholds grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-1">
            <label className="block">
              <span className="text-xs text-slate-400">Daily execution cap</span>
              <input
                type="number"
                min={1}
                max={50}
                defaultValue={local.maxDailyExecutions}
                onBlur={(e) => save({ maxDailyExecutions: Number(e.target.value) })}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-400">Min spend to pause (USD)</span>
              <input
                type="number"
                min={0}
                step={50}
                defaultValue={local.maxSpendThreshold}
                onBlur={(e) => save({ maxSpendThreshold: Number(e.target.value) })}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-400">Max ROAS factor for pause</span>
              <input
                type="number"
                min={0.1}
                max={1.0}
                step={0.05}
                defaultValue={local.minRoasThreshold}
                onBlur={(e) => save({ minRoasThreshold: Number(e.target.value) })}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
              <p className="mt-0.5 text-xs text-slate-600">
                Pause if ROAS ≤ goal × this factor
              </p>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// History — mobile card
// ---------------------------------------------------------------------------

function HistoryCard({ log }: { log: AutoExecutionLogRow }) {
  const ts = new Date(log.executedAt).toLocaleString();

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-200">{log.entityName}</p>
          <p className="text-xs text-slate-500">{log.actionType} · {ts}</p>
        </div>
        <StatusBadge status={log.status} />
      </div>
      {log.decisionReason && (
        <p className="mt-1.5 text-xs text-slate-500">{log.decisionReason}</p>
      )}
      {log.errorMessage && (
        <p className="mt-1 text-xs text-rose-400">{log.errorMessage}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AutoExecutionView({ clientSettings, history }: Props) {
  const [isPending, startTransition] = useTransition();
  const [runResult, setRunResult]    = useState<string | null>(null);

  function handleRunNow() {
    startTransition(async () => {
      setRunResult(null);
      try {
        const res  = await fetch("/api/auto-execution/run", { method: "POST" });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setRunResult(`Error: ${data.error ?? "Unknown error"}`);
          return;
        }
        const s = data.summary;
        setRunResult(
          `Run complete — ${s.executed} executed · ${s.guardrailsBlocked} blocked · ${s.skipped} skipped · ${s.failed} failed`
        );
      } catch (err) {
        setRunResult(err instanceof Error ? err.message : "Run failed");
      }
    });
  }

  const enabledCount = clientSettings.filter((s) => s.enabled).length;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Auto-Execution</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Guarded automation for approved actions. {enabledCount}/{clientSettings.length} client
            {clientSettings.length !== 1 ? "s" : ""} enabled.
          </p>
        </div>
        <button
          onClick={handleRunNow}
          disabled={isPending || enabledCount === 0}
          className="flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
        >
          {isPending ? "Running…" : "Run Now"}
        </button>
      </div>

      {/* Safety banner */}
      <div className="mb-6">
        <SafetyBanner />
      </div>

      {/* Run result */}
      {runResult && (
        <div
          className={`mb-4 rounded-lg border px-4 py-2.5 text-sm ${
            runResult.startsWith("Error")
              ? "border-rose-800 bg-rose-950/40 text-rose-300"
              : "border-emerald-800 bg-emerald-950/40 text-emerald-300"
          }`}
        >
          {runResult}
        </div>
      )}

      {/* Client settings */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
          Per-Client Settings
        </h2>

        {clientSettings.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-8 text-center">
            <p className="text-sm text-slate-400">No clients found in this workspace.</p>
            <p className="mt-1 text-xs text-slate-600">
              Add clients in the Clients section before configuring auto-execution.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {clientSettings.map((s) => (
              <ClientSettingsCard key={s.clientAccountId} setting={s} />
            ))}
          </div>
        )}
      </section>

      {/* Execution history */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
          Execution History
        </h2>

        {history.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-8 text-center">
            <p className="text-sm text-slate-400">No executions yet.</p>
            <p className="mt-1 text-xs text-slate-600">
              Enable auto-execution for a client and click &ldquo;Run Now&rdquo; to see results here.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-2 lg:hidden">
              {history.map((log) => (
                <HistoryCard key={log.id} log={log} />
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/80">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Action
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Entity
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Decision Reason
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Duration
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-900">
                  {history.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">
                        {new Date(log.executedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded border border-slate-700 px-1.5 py-0.5 text-xs text-slate-300">
                          {log.actionType}
                        </span>
                      </td>
                      <td className="max-w-[200px] px-4 py-3">
                        <p className="truncate text-xs text-slate-200">{log.entityName}</p>
                        <p className="truncate text-xs text-slate-600">{log.entityId}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={log.status} />
                      </td>
                      <td className="max-w-[280px] px-4 py-3 text-xs text-slate-400">
                        <p className="line-clamp-2">{log.decisionReason}</p>
                        {log.errorMessage && (
                          <p className="mt-0.5 text-rose-400 line-clamp-1">{log.errorMessage}</p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-slate-500">
                        {log.durationMs != null ? `${log.durationMs}ms` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
