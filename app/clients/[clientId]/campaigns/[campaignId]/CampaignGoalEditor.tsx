"use client";

// app/clients/[clientId]/campaigns/[campaignId]/CampaignGoalEditor.tsx
// Inline goal editor for an imported Meta campaign.
//
// Shows current ROAS + CPA goals with an edit button.
// Clicking Edit opens an inline form; Save calls POST /api/campaigns/[id]/goal.
// Goals are stored in MetaCampaignGoal — never written to Meta Ads Manager.
//
// Responsive:
//   Mobile  — full-width stacked inputs, thumb-friendly min-height buttons
//   Desktop — 2-column grid for ROAS / CPA side by side

import { useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type GoalData = {
  roasGoalType:  "high" | "low";
  roasGoalValue: number;
  cpaGoalType:   "high" | "low";
  cpaGoalValue:  number;
};

type Props = {
  externalCampaignId: string;
  initialGoal:        GoalData | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const LABEL = "block text-xs font-medium text-slate-400 mb-1";
const INPUT =
  "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 " +
  "text-sm text-slate-200 placeholder:text-slate-600 " +
  "focus:outline-none focus:ring-1 focus:ring-emerald-600 min-h-[44px]";
const SELECT =
  "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 " +
  "text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600 min-h-[44px]";

function GoalTypeLabel({ type }: { type: "high" | "low" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        type === "high"
          ? "bg-emerald-900/50 text-emerald-300"
          : "bg-slate-800 text-slate-400"
      }`}
    >
      {type === "high" ? "↑ Aim high" : "↓ Aim low"}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function CampaignGoalEditor({ externalCampaignId, initialGoal }: Props) {
  const [goal,    setGoal]    = useState<GoalData | null>(initialGoal);
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Edit form state
  const [roasType,  setRoasType]  = useState<"high" | "low">(goal?.roasGoalType  ?? "high");
  const [roasValue, setRoasValue] = useState(String(goal?.roasGoalValue ?? ""));
  const [cpaType,   setCpaType]   = useState<"high" | "low">(goal?.cpaGoalType   ?? "low");
  const [cpaValue,  setCpaValue]  = useState(String(goal?.cpaGoalValue  ?? ""));

  function openEditor() {
    // Reset form to current saved values (or defaults for new goal)
    setRoasType(goal?.roasGoalType  ?? "high");
    setRoasValue(goal ? String(goal.roasGoalValue) : "");
    setCpaType(goal?.cpaGoalType    ?? "low");
    setCpaValue(goal ? String(goal.cpaGoalValue)   : "");
    setError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setError(null);
  }

  async function saveGoal() {
    const roasVal = parseFloat(roasValue);
    const cpaVal  = parseFloat(cpaValue);

    if (!isFinite(roasVal) || roasVal <= 0) {
      setError("ROAS goal must be a positive number (e.g. 2.5)");
      return;
    }
    if (!isFinite(cpaVal) || cpaVal <= 0) {
      setError("CPA goal must be a positive number (e.g. 45)");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/campaigns/${externalCampaignId}/goal`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          roasGoalType:  roasType,
          roasGoalValue: roasVal,
          cpaGoalType:   cpaType,
          cpaGoalValue:  cpaVal,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Failed to save goal. Please try again.");
        return;
      }

      const data = (await res.json()) as { goal: GoalData };
      setGoal(data.goal);
      setEditing(false);
    } catch {
      setError("Network error — please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  // ── Display mode ──────────────────────────────────────────────────────────

  if (!editing) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/60 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Campaign Goals</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Internal targets for evaluation — not synced to Meta
            </p>
          </div>
          <button
            onClick={openEditor}
            className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-600 transition-colors min-h-[36px]"
          >
            {goal ? "Edit Goals" : "Add Goals"}
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {goal ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* ROAS Goal */}
              <div className="rounded-lg bg-slate-800/40 px-4 py-3">
                <p className="text-xs text-slate-500 mb-1">ROAS Goal</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-semibold text-slate-100">
                    {goal.roasGoalValue.toFixed(2)}x
                  </span>
                  <GoalTypeLabel type={goal.roasGoalType} />
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  {goal.roasGoalType === "high"
                    ? "Higher ROAS = better performance"
                    : "Lower ROAS threshold acceptable"}
                </p>
              </div>

              {/* CPA Goal */}
              <div className="rounded-lg bg-slate-800/40 px-4 py-3">
                <p className="text-xs text-slate-500 mb-1">CPA Goal</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-semibold text-slate-100">
                    ${goal.cpaGoalValue.toFixed(2)}
                  </span>
                  <GoalTypeLabel type={goal.cpaGoalType} />
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  {goal.cpaGoalType === "low"
                    ? "Lower CPA = better performance"
                    : "Higher CPA threshold acceptable"}
                </p>
              </div>
            </div>
          ) : (
            /* No goal yet */
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="mb-3 text-3xl text-slate-700">◎</div>
              <p className="text-sm font-medium text-slate-400">No goal set yet</p>
              <p className="mt-1 max-w-xs text-xs text-slate-600">
                Add ROAS and CPA targets to enable health scoring and
                recommendations for this campaign.
              </p>
              <button
                onClick={openEditor}
                className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 transition-colors min-h-[44px]"
              >
                Add Goal
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Edit mode ─────────────────────────────────────────────────────────────

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/80">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700/60 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-white">
            {goal ? "Edit Campaign Goals" : "Set Campaign Goals"}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            ROAS and CPA targets · stored in this app only
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="p-5 space-y-5">
        {/* 2-column on desktop, stacked on mobile */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

          {/* ROAS goal */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              ROAS Goal
            </p>
            <div>
              <label className={LABEL}>Goal Type</label>
              <select
                value={roasType}
                onChange={(e) => setRoasType(e.target.value as "high" | "low")}
                className={SELECT}
              >
                <option value="high">High — aim for maximum ROAS</option>
                <option value="low">Low — minimum acceptable ROAS</option>
              </select>
              <p className="mt-1 text-xs text-slate-600">
                {roasType === "high"
                  ? "Campaign must exceed this ROAS to pass."
                  : "Campaign must stay above this minimum ROAS."}
              </p>
            </div>
            <div>
              <label className={LABEL}>Target Value (x)</label>
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                placeholder="e.g. 2.50"
                value={roasValue}
                onChange={(e) => setRoasValue(e.target.value)}
                className={INPUT}
              />
              <p className="mt-1 text-xs text-slate-600">
                Example: 2.50 means $2.50 revenue per $1 spent
              </p>
            </div>
          </div>

          {/* CPA goal */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              CPA Goal
            </p>
            <div>
              <label className={LABEL}>Goal Type</label>
              <select
                value={cpaType}
                onChange={(e) => setCpaType(e.target.value as "high" | "low")}
                className={SELECT}
              >
                <option value="low">Low — minimize cost per acquisition</option>
                <option value="high">High — maximum acceptable CPA</option>
              </select>
              <p className="mt-1 text-xs text-slate-600">
                {cpaType === "low"
                  ? "Campaign must stay below this CPA to pass."
                  : "Campaign must exceed this CPA threshold."}
              </p>
            </div>
            <div>
              <label className={LABEL}>Target Value ($)</label>
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                placeholder="e.g. 45.00"
                value={cpaValue}
                onChange={(e) => setCpaValue(e.target.value)}
                className={INPUT}
              />
              <p className="mt-1 text-xs text-slate-600">
                Example: 45.00 means max $45 cost per order
              </p>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-rose-900/50 bg-rose-950/30 px-4 py-2.5">
            <p className="text-sm text-rose-400">{error}</p>
          </div>
        )}

        {/* Actions — stacked on mobile, row on desktop */}
        <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
          <button
            onClick={cancelEdit}
            disabled={saving}
            className="order-2 sm:order-1 rounded-lg border border-slate-700 bg-transparent px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors min-h-[44px] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={saveGoal}
            disabled={saving}
            className="order-1 sm:order-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-600 transition-colors min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : "Save Goals"}
          </button>
        </div>
      </div>
    </div>
  );
}
