"use client";

// app/clients/[clientId]/campaigns/CampaignGoalPanel.tsx
// Self-contained panel for viewing and editing a campaign-level goal override.
//
// Features:
//   - Shows the current resolved goal with source indicator
//   - Override toggle: when off, campaign inherits client/default goal
//   - All 5 goal fields (ROAS, CPA, CTR, CVR, max daily spend)
//   - Advanced fields (CTR, CVR, max spend) in a collapsible section
//   - Saves to POST /api/goals/campaign/:campaignId
//
// Mobile:  single-column form, collapsible advanced section
// Desktop: 2-col grid for primary fields, 3-col for advanced

import { useState }          from "react";
import { GoalSourceBadge }   from "../../../../components/ui/GoalSourceBadge";
import type { ResolvedGoal, GoalSource } from "../../../../lib/goals/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GoalValues = {
  targetRoas:    string;
  targetCpa:     string;
  targetCtr:     string;
  targetCvr:     string;
  maxDailySpend: string;
};

type Props = {
  campaignId:   string;  // externalCampaignId
  clientId:     string;
  resolvedGoal: ResolvedGoal;
  hasOverride:  boolean;  // whether this campaign already has an explicit goal
  onSaved?:     (resolved: ResolvedGoal, source: GoalSource) => void;
};

// ---------------------------------------------------------------------------
// Style constants
// ---------------------------------------------------------------------------

const INPUT_CLS =
  "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 " +
  "text-sm text-slate-100 placeholder-slate-500 focus:outline-none " +
  "focus:ring-1 focus:ring-emerald-500 min-h-[44px] disabled:opacity-40";

const LABEL_CLS = "block text-xs font-medium text-slate-400 mb-1";

// ---------------------------------------------------------------------------
// CampaignGoalPanel
// ---------------------------------------------------------------------------

export function CampaignGoalPanel({
  campaignId,
  clientId,
  resolvedGoal,
  hasOverride,
  onSaved,
}: Props) {
  const [overrideOn, setOverrideOn] = useState(hasOverride);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [saved, setSaved]   = useState(false);

  // Form state — seeded from resolved goal
  const [vals, setVals] = useState<GoalValues>({
    targetRoas:    resolvedGoal.targetRoas    != null ? String(resolvedGoal.targetRoas)    : "",
    targetCpa:     resolvedGoal.targetCpa     != null ? String(resolvedGoal.targetCpa)     : "",
    targetCtr:     resolvedGoal.targetCtr     != null ? String(resolvedGoal.targetCtr)     : "",
    targetCvr:     resolvedGoal.targetCvr     != null ? String(resolvedGoal.targetCvr)     : "",
    maxDailySpend: resolvedGoal.maxDailySpend != null ? String(resolvedGoal.maxDailySpend) : "",
  });

  function set(key: keyof GoalValues, v: string) {
    setVals(p => ({ ...p, [key]: v }));
    setSaved(false);
    setError(null);
  }

  function parseOptional(s: string): number | null {
    const n = parseFloat(s.trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const body = {
      clientId,
      targetRoas:    parseOptional(vals.targetRoas),
      targetCpa:     parseOptional(vals.targetCpa),
      targetCtr:     parseOptional(vals.targetCtr),
      targetCvr:     parseOptional(vals.targetCvr),
      maxDailySpend: parseOptional(vals.maxDailySpend),
    };

    setSaving(true);
    try {
      const res  = await fetch(`/api/goals/campaign/${encodeURIComponent(campaignId)}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;

      if (!res.ok) {
        setError((data.error as string | undefined) ?? "Failed to save");
        return;
      }

      setSaved(true);
      setOverrideOn(true);
      if (onSaved) {
        onSaved(
          data.resolved as ResolvedGoal,
          data.source   as GoalSource
        );
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      {/* Header: title + source badge */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Campaign Goal</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Set a target for this campaign. Leave blank to inherit from client defaults.
          </p>
        </div>
        <GoalSourceBadge source={overrideOn ? "campaign" : resolvedGoal.source} />
      </div>

      {/* Override toggle */}
      <label className="mb-4 flex cursor-pointer items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={overrideOn}
          onClick={() => { setOverrideOn(v => !v); setSaved(false); }}
          className={`relative h-6 w-11 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
            overrideOn ? "bg-emerald-700" : "bg-slate-700"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              overrideOn ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
        <span className="text-sm text-slate-300">
          {overrideOn ? "Campaign override active" : "Using inherited goal"}
        </span>
      </label>

      {/* Current resolved values (read-only when override is off) */}
      {!overrideOn && (
        <div className="mb-4 rounded-lg bg-slate-800/40 px-4 py-3 space-y-1.5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
            Active goal ({resolvedGoal.source === "client" ? "client default" : "system default"})
          </p>
          {[
            { label: "ROAS",          v: resolvedGoal.targetRoas,    fmt: (n: number) => `${n.toFixed(2)}×` },
            { label: "CPA",           v: resolvedGoal.targetCpa,     fmt: (n: number) => `$${n.toFixed(2)}` },
            { label: "CTR",           v: resolvedGoal.targetCtr,     fmt: (n: number) => `${n.toFixed(2)}%` },
            { label: "CVR",           v: resolvedGoal.targetCvr,     fmt: (n: number) => `${n.toFixed(2)}%` },
            { label: "Max daily spend", v: resolvedGoal.maxDailySpend, fmt: (n: number) => `$${n.toLocaleString()}` },
          ].filter(r => r.v != null).map(r => (
            <div key={r.label} className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{r.label}</span>
              <span className="text-sm font-medium text-slate-200">
                {r.fmt(r.v as number)}
              </span>
            </div>
          ))}
          {resolvedGoal.targetRoas == null &&
           resolvedGoal.targetCpa  == null &&
           resolvedGoal.targetCtr  == null && (
            <p className="text-xs text-slate-600 italic">No targets configured.</p>
          )}
        </div>
      )}

      {/* Edit form (shown when override is on) */}
      {overrideOn && (
        <form onSubmit={handleSave} className="space-y-4">

          {/* Primary fields: ROAS + CPA */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL_CLS}>
                Target ROAS <span className="text-slate-600 font-normal">(aim to exceed)</span>
              </label>
              <input
                type="number" step="0.01" min="0.01" placeholder={`e.g. ${resolvedGoal.targetRoas?.toFixed(2) ?? "2.00"}`}
                value={vals.targetRoas}
                onChange={e => set("targetRoas", e.target.value)}
                className={INPUT_CLS} disabled={saving}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>
                Target CPA ($) <span className="text-slate-600 font-normal">(stay under)</span>
              </label>
              <input
                type="number" step="0.01" min="0.01" placeholder="e.g. 45.00"
                value={vals.targetCpa}
                onChange={e => set("targetCpa", e.target.value)}
                className={INPUT_CLS} disabled={saving}
              />
            </div>
          </div>

          {/* Advanced: CTR, CVR, max spend */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(v => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
            >
              <span>{showAdvanced ? "▲" : "▼"}</span>
              Advanced targets
              <span className="text-slate-600 font-normal">(CTR, CVR, budget cap)</span>
            </button>

            {showAdvanced && (
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className={LABEL_CLS}>
                    Target CTR (%)
                  </label>
                  <input
                    type="number" step="0.01" min="0.001" max="100"
                    placeholder="e.g. 1.50"
                    value={vals.targetCtr}
                    onChange={e => set("targetCtr", e.target.value)}
                    className={INPUT_CLS} disabled={saving}
                  />
                </div>
                <div>
                  <label className={LABEL_CLS}>
                    Target CVR (%)
                  </label>
                  <input
                    type="number" step="0.01" min="0.001" max="100"
                    placeholder="e.g. 2.00"
                    value={vals.targetCvr}
                    onChange={e => set("targetCvr", e.target.value)}
                    className={INPUT_CLS} disabled={saving}
                  />
                </div>
                <div>
                  <label className={LABEL_CLS}>
                    Max Daily Spend ($)
                  </label>
                  <input
                    type="number" step="1" min="1"
                    placeholder="e.g. 500"
                    value={vals.maxDailySpend}
                    onChange={e => set("maxDailySpend", e.target.value)}
                    className={INPUT_CLS} disabled={saving}
                  />
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-xs text-rose-400">{error}</p>}
          {saved  && (
            <p className="text-xs text-emerald-400">
              Campaign goal saved. This campaign will now be evaluated against these targets.
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-emerald-700 py-2.5 text-sm font-semibold text-white
                       transition-colors hover:bg-emerald-600 disabled:opacity-40 min-h-[44px]"
          >
            {saving ? "Saving…" : "Save campaign goal"}
          </button>
        </form>
      )}
    </div>
  );
}
