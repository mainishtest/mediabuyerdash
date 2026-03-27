"use client";

// app/automation/policies/PoliciesView.tsx
// Autonomy Modes & Action Safety Policy — client component.
//
// Layout:
//  Mobile  — compact scope cards, single-column, expandable action lists,
//            mode badge prominent, thumb-friendly controls
//  Desktop — multi-column summary row + inheritance table + full permission matrix
//
// Features:
//  - View effective autonomy mode per client scope
//  - Set client autonomy mode inline (PUT /api/policies/client/:id)
//  - View allowed / approval-gated / auto-executable / blocked action types
//  - See which scope provided each policy (client / system default)
//  - Expandable per-client policy detail
//  - System default explanation panel

import { useState, useTransition } from "react";
import type {
  ActionSafetySummary,
  ActionSafetyPolicyRecord,
  AutonomyMode,
  ActionType,
} from "../../../lib/policy/types";
import {
  AUTONOMY_MODE_LABELS,
  AUTONOMY_MODE_DESCRIPTIONS,
  ACTION_TYPE_LABELS,
  ACTION_TYPE_RISK,
  ALL_ACTION_TYPES,
  NEVER_AUTO_EXECUTE,
  AUTO_EXECUTE_ELIGIBLE,
} from "../../../lib/policy/defaults";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ClientSummary = {
  client:  { id: string; name: string };
  policy:  ActionSafetyPolicyRecord;
  summary: ActionSafetySummary;
};

interface Props {
  workspaceId:     string;
  clientSummaries: ClientSummary[];
  allPolicies:     ActionSafetyPolicyRecord[];
  stats: {
    totalClients:   number;
    policiesSet:    number;
    usingDefault:   number;
    overrideScopes: number;
  };
}

// ---------------------------------------------------------------------------
// Mode badge
// ---------------------------------------------------------------------------

const MODE_COLORS: Record<AutonomyMode, string> = {
  restricted:           "bg-rose-900/60 text-rose-300 border-rose-800",
  recommend_only:       "bg-slate-700/60 text-slate-300 border-slate-600",
  prepare_only:         "bg-amber-900/40 text-amber-300 border-amber-800",
  approval_required:    "bg-blue-900/50 text-blue-300 border-blue-800",
  guarded_auto_execute: "bg-emerald-900/50 text-emerald-300 border-emerald-800",
};

function ModeBadge({ mode }: { mode: AutonomyMode }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${MODE_COLORS[mode]}`}
    >
      {AUTONOMY_MODE_LABELS[mode]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Permission state badge
// ---------------------------------------------------------------------------

function PermBadge({ perm }: { perm: string }) {
  const map: Record<string, string> = {
    allowed:              "bg-emerald-900/40 text-emerald-300",
    approval_required:    "bg-blue-900/40 text-blue-300",
    guarded_auto_execute: "bg-purple-900/40 text-purple-300",
    blocked:              "bg-rose-900/40 text-rose-400",
    restricted:           "bg-slate-800 text-slate-500",
  };
  const labels: Record<string, string> = {
    allowed:              "Allowed",
    approval_required:    "Approval Required",
    guarded_auto_execute: "Auto-Execute",
    blocked:              "Blocked",
    restricted:           "Restricted",
  };
  return (
    <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${map[perm] ?? "bg-slate-700 text-slate-400"}`}>
      {labels[perm] ?? perm}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Risk badge
// ---------------------------------------------------------------------------

function RiskBadge({ risk }: { risk: "high" | "medium" | "low" }) {
  const map = {
    high:   "text-rose-500",
    medium: "text-amber-500",
    low:    "text-slate-500",
  };
  return <span className={`text-xs ${map[risk]}`}>{risk}</span>;
}

// ---------------------------------------------------------------------------
// Source badge
// ---------------------------------------------------------------------------

function SourceBadge({ scope }: { scope: string }) {
  const map: Record<string, string> = {
    client:     "bg-indigo-900/40 text-indigo-300",
    ad_account: "bg-violet-900/40 text-violet-300",
    campaign:   "bg-teal-900/40 text-teal-300",
    system:     "bg-slate-800 text-slate-500",
  };
  const labels: Record<string, string> = {
    client:     "Client",
    ad_account: "Ad Account",
    campaign:   "Campaign",
    system:     "System Default",
  };
  return (
    <span className={`inline-flex rounded px-1.5 py-0.5 text-xs ${map[scope] ?? "bg-slate-800 text-slate-400"}`}>
      {labels[scope] ?? scope}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Mode selector dropdown
// ---------------------------------------------------------------------------

function ModeSelector({
  value,
  onChange,
  disabled,
}: {
  value:    AutonomyMode;
  onChange: (m: AutonomyMode) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as AutonomyMode)}
      className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs
                 text-slate-200 transition-colors hover:border-slate-600 focus:outline-none
                 focus:ring-1 focus:ring-emerald-600 disabled:opacity-50"
    >
      {MODE_OPTIONS.map((m) => (
        <option key={m} value={m}>
          {AUTONOMY_MODE_LABELS[m]}
        </option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// Action type row (permission matrix)
// ---------------------------------------------------------------------------

function ActionTypeRow({
  actionType,
  permission,
  isDesktop,
}: {
  actionType:  ActionType;
  permission:  string;
  isDesktop:   boolean;
}) {
  const risk    = ACTION_TYPE_RISK[actionType];
  const isNever = NEVER_AUTO_EXECUTE.has(actionType);
  const isAuto  = AUTO_EXECUTE_ELIGIBLE.has(actionType);

  if (isDesktop) {
    return (
      <tr className="border-t border-slate-800/60 hover:bg-slate-800/20">
        <td className="py-2 pl-4 pr-2">
          <span className="text-sm text-slate-200">{ACTION_TYPE_LABELS[actionType]}</span>
          <span className="ml-2 font-mono text-xs text-slate-600">{actionType}</span>
        </td>
        <td className="px-2 py-2">
          <RiskBadge risk={risk} />
        </td>
        <td className="px-2 py-2">
          {isNever ? (
            <span className="text-xs text-slate-600">Never</span>
          ) : isAuto ? (
            <span className="text-xs text-emerald-600">Eligible</span>
          ) : (
            <span className="text-xs text-slate-600">—</span>
          )}
        </td>
        <td className="px-2 py-2 pr-4">
          <PermBadge perm={permission} />
        </td>
      </tr>
    );
  }

  // Mobile: compact row
  return (
    <div className="flex items-center justify-between py-1.5">
      <div>
        <span className="text-sm text-slate-200">{ACTION_TYPE_LABELS[actionType]}</span>
        <RiskBadge risk={risk} />
      </div>
      <PermBadge perm={permission} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Client policy card (mobile: card / desktop: table row)
// ---------------------------------------------------------------------------

function ClientPolicyCard({
  cs,
  onModeChange,
  saving,
}: {
  cs:           ClientSummary;
  onModeChange: (clientId: string, mode: AutonomyMode) => void;
  saving:       boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const { client, policy, summary } = cs;
  const isDefault = policy.id === "system_default";

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-100 text-sm">{client.name}</span>
            <ModeBadge mode={summary.effectiveMode} />
            <SourceBadge scope={isDefault ? "system" : policy.scope} />
          </div>
          {/* Quick counts — mobile-first scannable summary */}
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
            {summary.autoExecutable.length > 0 && (
              <span className="text-purple-400">
                {summary.autoExecutable.length} auto-executable
              </span>
            )}
            {summary.approvalGated.length > 0 && (
              <span className="text-blue-400">
                {summary.approvalGated.length} approval-gated
              </span>
            )}
            {summary.blocked.length > 0 && (
              <span className="text-rose-400">
                {summary.blocked.length} blocked
              </span>
            )}
          </div>
        </div>

        {/* Mode selector */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          <ModeSelector
            value={policy.autonomyMode}
            onChange={(m) => onModeChange(client.id, m)}
            disabled={saving}
          />
          <button
            onClick={() => setExpanded((x) => !x)}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            {expanded ? "Hide details ↑" : "View details ↓"}
          </button>
        </div>
      </div>

      {/* Expanded permission list — mobile: simple list, desktop: table */}
      {expanded && (
        <div className="border-t border-slate-800 px-4 pb-4 pt-3">
          {/* Mode description */}
          <p className="mb-3 rounded-lg bg-slate-800/50 px-3 py-2 text-xs text-slate-400">
            {AUTONOMY_MODE_DESCRIPTIONS[summary.effectiveMode]}
          </p>

          {/* Desktop permission table */}
          <div className="hidden overflow-hidden rounded-lg border border-slate-800 lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-800/40">
                  <th className="py-2 pl-4 pr-2 text-left text-xs font-medium text-slate-500">
                    Action Type
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-slate-500">
                    Risk
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-slate-500">
                    Auto-Execute
                  </th>
                  <th className="px-2 py-2 pr-4 text-left text-xs font-medium text-slate-500">
                    Permission
                  </th>
                </tr>
              </thead>
              <tbody>
                {ALL_ACTION_TYPES.map((at) => (
                  <ActionTypeRow
                    key={at}
                    actionType={at}
                    permission={summary.decisions[at]?.permission ?? "approval_required"}
                    isDesktop
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile permission list */}
          <div className="divide-y divide-slate-800 lg:hidden">
            {ALL_ACTION_TYPES.map((at) => (
              <ActionTypeRow
                key={at}
                actionType={at}
                permission={summary.decisions[at]?.permission ?? "approval_required"}
                isDesktop={false}
              />
            ))}
          </div>

          {/* Constraints */}
          {policy.constraints.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-xs font-medium text-slate-500">Constraints</p>
              <ul className="space-y-1">
                {policy.constraints.map((c, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-slate-400">
                    <span className="mt-0.5 shrink-0 text-amber-600">▸</span>
                    <span>{c.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {policy.notes && (
            <p className="mt-3 rounded bg-slate-800/50 px-3 py-2 text-xs italic text-slate-500">
              {policy.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// System default info panel
// ---------------------------------------------------------------------------

function SystemDefaultPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-4 py-3">
      <button
        onClick={() => setOpen((x) => !x)}
        className="flex w-full items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            System Default
          </span>
          <ModeBadge mode="approval_required" />
        </div>
        <span className="text-xs text-slate-600">{open ? "↑" : "↓"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-2 text-xs text-slate-400">
          <p>
            When no explicit client policy exists, the system falls back to{" "}
            <strong className="text-slate-300">Approval Required</strong> mode.
            All actions must be manually approved before execution.
          </p>
          <ul className="space-y-1">
            <li className="flex gap-2">
              <span className="text-rose-500">●</span>
              <span>
                <strong className="text-slate-300">publish_creative</strong> and{" "}
                <strong className="text-slate-300">launch_experiment</strong> are
                explicitly blocked — must be unlocked per client.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-400">●</span>
              <span>All other action types default to approval-required.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-slate-600">●</span>
              <span>
                Set a client-level policy above to override these defaults for
                specific clients.
              </span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stats row
// ---------------------------------------------------------------------------

function StatsRow({ stats }: { stats: Props["stats"] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[
        { label: "Total Clients", value: stats.totalClients, color: "text-slate-200" },
        { label: "Explicit Policies", value: stats.policiesSet, color: "text-emerald-400" },
        { label: "Using Default", value: stats.usingDefault, color: "text-amber-400" },
        { label: "Override Scopes", value: stats.overrideScopes, color: "text-violet-400" },
      ].map(({ label, value, color }) => (
        <div key={label} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
          <p className={`text-2xl font-semibold ${color}`}>{value}</p>
          <p className="mt-0.5 text-xs text-slate-500">{label}</p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Desktop: inheritance guide
// ---------------------------------------------------------------------------

function InheritanceGuide() {
  return (
    <div className="hidden rounded-xl border border-slate-800 bg-slate-900 p-4 lg:block">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Policy Inheritance
      </p>
      <div className="flex items-center gap-2 text-xs text-slate-400">
        {["Campaign Override", "Ad Account Policy", "Client Policy", "System Default"].map(
          (label, i, arr) => (
            <>
              <span
                key={label}
                className="rounded border border-slate-700 bg-slate-800 px-2 py-1 font-medium text-slate-300"
              >
                {label}
              </span>
              {i < arr.length - 1 && (
                <span key={`arrow-${i}`} className="text-slate-600">→</span>
              )}
            </>
          )
        )}
      </div>
      <p className="mt-2 text-xs text-slate-600">
        Most specific scope wins. Blocking is additive — any scope can block an action.
        The system default applies when no explicit policy record exists for a scope.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function PoliciesView({
  workspaceId,
  clientSummaries,
  allPolicies,
  stats,
}: Props) {
  const [summaries, setSummaries] = useState(clientSummaries);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingId, setSavingId]   = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleModeChange(clientId: string, mode: AutonomyMode) {
    setSavingId(clientId);
    setSaveError(null);

    // Determine existing policy (or build minimal input from current state)
    const existing = allPolicies.find(
      (p) => p.scope === "client" && p.scopeId === clientId
    );

    const body = {
      autonomyMode:       mode,
      allowedActionTypes: existing?.allowedActionTypes  ?? [],
      blockedActionTypes: existing?.blockedActionTypes  ?? [],
      approvalRequired:   existing?.approvalRequired    ?? [],
      constraints:        existing?.constraints         ?? [],
      notes:              existing?.notes               ?? undefined,
    };

    try {
      const res = await fetch(`/api/policies/client/${clientId}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.error ?? "Failed to save policy.");
        return;
      }

      const data = await res.json();

      // Update local state optimistically
      startTransition(() => {
        setSummaries((prev) =>
          prev.map((cs) =>
            cs.client.id === clientId
              ? { ...cs, policy: { ...cs.policy, ...data.policy, autonomyMode: mode } }
              : cs
          )
        );
      });
    } catch {
      setSaveError("Network error — please try again.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-100">
          Autonomy Modes &amp; Action Safety Policy
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Define what the system is allowed to recommend, prepare, require approval for,
          or auto-execute. Policies inherit from campaign → ad account → client → system default.
        </p>
      </div>

      {/* Stats */}
      <StatsRow stats={stats} />

      {/* Inheritance guide (desktop only) */}
      <div className="mt-4">
        <InheritanceGuide />
      </div>

      {/* System default panel */}
      <div className="mt-4">
        <SystemDefaultPanel />
      </div>

      {/* Save error */}
      {saveError && (
        <div className="mt-4 rounded-lg border border-rose-800 bg-rose-900/30 px-4 py-3 text-sm text-rose-300">
          {saveError}
        </div>
      )}

      {/* Client policies */}
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-300">Client-Level Policies</h2>
          <span className="text-xs text-slate-600">
            Set the autonomy mode for each client. Use &quot;View details&quot; for full permission matrix.
          </span>
        </div>

        {clientSummaries.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
            <p className="text-sm text-slate-500">
              No clients found. Add a client to configure its autonomy policy.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {summaries.map((cs) => (
              <ClientPolicyCard
                key={cs.client.id}
                cs={cs}
                onModeChange={handleModeChange}
                saving={savingId === cs.client.id || isPending}
              />
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-8 rounded-xl border border-slate-800/60 bg-slate-900/40 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
          Autonomy Mode Reference
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {MODE_OPTIONS.map((mode) => (
            <div key={mode} className="flex items-start gap-2">
              <ModeBadge mode={mode} />
              <p className="mt-0.5 text-xs text-slate-500 leading-snug">
                {AUTONOMY_MODE_DESCRIPTIONS[mode]}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Auto-execute eligible reference */}
      <div className="mt-4 rounded-xl border border-slate-800/60 bg-slate-900/40 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
          Auto-Execute Eligibility
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-medium text-emerald-600">Eligible (with guardrails)</p>
            <ul className="space-y-0.5">
              {ALL_ACTION_TYPES.filter((a) => AUTO_EXECUTE_ELIGIBLE.has(a)).map((a) => (
                <li key={a} className="text-xs text-slate-400">
                  ▸ {ACTION_TYPE_LABELS[a]}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-rose-600">Never auto-execute</p>
            <ul className="space-y-0.5">
              {ALL_ACTION_TYPES.filter((a) => NEVER_AUTO_EXECUTE.has(a)).map((a) => (
                <li key={a} className="text-xs text-slate-400">
                  ▸ {ACTION_TYPE_LABELS[a]}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Docs link */}
      <p className="mt-6 text-xs text-slate-600">
        See <code className="rounded bg-slate-800 px-1 py-0.5 text-slate-400">docs/autonomy-modes.md</code>{" "}
        for full documentation on modes, inheritance, and limitations.
      </p>
    </div>
  );
}

const MODE_OPTIONS: AutonomyMode[] = [
  "restricted",
  "recommend_only",
  "prepare_only",
  "approval_required",
  "guarded_auto_execute",
];
