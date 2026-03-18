"use client";

// app/clients/[clientId]/settings/ClientSettingsView.tsx
// Client settings page — currently shows Campaign Goal Defaults.
//
// Mobile:  stacked form → coverage summary → apply action, each section full-width.
// Desktop: defaults form and coverage summary side-by-side (lg: 2-col grid),
//          apply action spans full width below.

import { useState, useTransition } from "react";
import Link from "next/link";
import type { ClientDefaultsRecord, ClientGoalCoverageSummary } from "../../../../lib/clientGoalDefaults/service";

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  clientId:   string;
  clientName: string;
  defaults:   ClientDefaultsRecord | null;
  coverage:   ClientGoalCoverageSummary;
};

// ── Styles ────────────────────────────────────────────────────────────────────

const INPUT_CLS =
  "w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm " +
  "text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 " +
  "focus:ring-emerald-500 min-h-[44px]";

const LABEL_CLS = "block text-xs font-medium text-slate-400 mb-1.5";

// ── Coverage stat chip ────────────────────────────────────────────────────────

function CoverageStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "emerald" | "indigo" | "amber" | "slate";
}) {
  const colors = {
    emerald: "bg-emerald-900/30 text-emerald-300 border-emerald-900/50",
    indigo:  "bg-indigo-900/30  text-indigo-300  border-indigo-900/50",
    amber:   "bg-amber-900/30   text-amber-300   border-amber-900/50",
    slate:   "bg-slate-800/60   text-slate-400   border-slate-700",
  };
  return (
    <div className={`rounded-xl border px-4 py-3 ${colors[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-0.5 text-xs opacity-80">{label}</p>
    </div>
  );
}

// ── Confirmation modal ────────────────────────────────────────────────────────

function ConfirmApplyModal({
  count,
  onConfirm,
  onCancel,
  applying,
}: {
  count:     number;
  onConfirm: () => void;
  onCancel:  () => void;
  applying:  boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <h2 className="text-base font-semibold text-slate-100">
          Apply defaults to {count} campaign{count !== 1 ? "s" : ""}?
        </h2>
        <p className="mt-2 text-sm text-slate-400 leading-relaxed">
          This will create explicit goals for every campaign that doesn&apos;t have one yet.
          Campaigns with existing goals will not be changed.
        </p>
        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={onConfirm}
            disabled={applying}
            className="flex-1 rounded-lg bg-emerald-700 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50 min-h-[44px]"
          >
            {applying ? "Applying…" : "Confirm"}
          </button>
          <button
            onClick={onCancel}
            disabled={applying}
            className="flex-1 rounded-lg border border-slate-700 py-2.5 text-sm text-slate-300 hover:text-slate-100 transition-colors min-h-[44px]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ClientSettingsView({
  clientId,
  clientName,
  defaults,
  coverage: initialCoverage,
}: Props) {
  // Form state — seeded from server-loaded defaults
  const [roasValue, setRoasValue] = useState(
    defaults ? String(defaults.defaultRoasGoalValue) : ""
  );
  const [cpaValue, setCpaValue] = useState(
    defaults ? String(defaults.defaultCpaGoalValue) : ""
  );

  const [saving,  setSaving]  = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saved,   setSaved]   = useState(false);

  // Coverage — updated optimistically after apply
  const [coverage, setCoverage] = useState(initialCoverage);

  // Apply defaults flow
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [applying,     setApplying]     = useState(false);
  const [applyResult,  setApplyResult]  = useState<{ applied: number; skipped: number } | null>(null);
  const [applyErr,     setApplyErr]     = useState<string | null>(null);

  const [, startTransition] = useTransition();

  // ── Save defaults ──────────────────────────────────────────────────────────

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveErr(null);
    setSaved(false);

    const roas = parseFloat(roasValue);
    const cpa  = parseFloat(cpaValue);

    if (!isFinite(roas) || roas <= 0) {
      setSaveErr("Default ROAS must be a positive number (e.g. 2.5)");
      return;
    }
    if (!isFinite(cpa) || cpa <= 0) {
      setSaveErr("Default CPA must be a positive number (e.g. 45.00)");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/goal-defaults`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          defaultRoasGoalType:  "high",
          defaultRoasGoalValue: roas,
          defaultCpaGoalType:   "low",
          defaultCpaGoalValue:  cpa,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveErr((data as { error?: string }).error ?? "Failed to save");
        return;
      }
      setSaved(true);
      // Update coverage to reflect defaults now exist
      startTransition(() =>
        setCoverage((prev) => ({
          ...prev,
          hasClientDefaults: true,
          usingDefault:      prev.totalCampaigns - prev.explicitGoals,
          missingGoals:      0,
        }))
      );
    } catch {
      setSaveErr("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  // ── Apply defaults to campaigns ────────────────────────────────────────────

  async function handleApplyConfirmed() {
    setApplyErr(null);
    setApplying(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/goal-defaults/apply`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      if (!res.ok) {
        setApplyErr((data.error as string | undefined) ?? "Apply failed");
        return;
      }
      const applied  = (data.applied  as number) ?? 0;
      const skipped  = (data.skipped  as number) ?? 0;
      setApplyResult({ applied, skipped });
      // Update coverage optimistically
      startTransition(() =>
        setCoverage((prev) => ({
          ...prev,
          explicitGoals: prev.explicitGoals + applied,
          usingDefault:  0,
          missingGoals:  0,
        }))
      );
    } catch {
      setApplyErr("Network error — please try again");
    } finally {
      setApplying(false);
      setShowConfirm(false);
    }
  }

  const campaignsNeedingDefault = coverage.totalCampaigns - coverage.explicitGoals;
  const hasUnsavedForm = roasValue !== "" || cpaValue !== "";

  return (
    <>
      {showConfirm && (
        <ConfirmApplyModal
          count={campaignsNeedingDefault}
          onConfirm={handleApplyConfirmed}
          onCancel={() => setShowConfirm(false)}
          applying={applying}
        />
      )}

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">

        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/clients/${clientId}/campaigns`}
            className="mb-3 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200"
          >
            ← Back to campaigns
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
            {clientName} — Settings
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Default goals apply to campaigns that don&apos;t have explicit targets set.
          </p>
        </div>

        {/* Main grid: form + coverage (side-by-side on lg+) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* ── Default Goals Form ─────────────────────────────────────── */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="mb-1 text-base font-semibold text-slate-100">
              Campaign Goal Defaults
            </h2>
            <p className="mb-5 text-xs text-slate-500">
              Set a fallback ROAS and CPA target for all campaigns. Campaigns with
              explicit goals always take priority.
            </p>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className={LABEL_CLS}>
                  Default ROAS Target
                  <span className="ml-1 text-slate-600 font-normal">(aim to exceed)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="e.g. 2.50"
                  value={roasValue}
                  onChange={(e) => { setRoasValue(e.target.value); setSaved(false); }}
                  className={INPUT_CLS}
                  disabled={saving}
                />
              </div>

              <div>
                <label className={LABEL_CLS}>
                  Default CPA Target ($)
                  <span className="ml-1 text-slate-600 font-normal">(stay under)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="e.g. 45.00"
                  value={cpaValue}
                  onChange={(e) => { setCpaValue(e.target.value); setSaved(false); }}
                  className={INPUT_CLS}
                  disabled={saving}
                />
              </div>

              {saveErr && (
                <p className="text-xs text-rose-400">{saveErr}</p>
              )}

              {saved && (
                <p className="text-xs text-emerald-400">
                  Defaults saved. Campaigns without explicit goals will now use these targets.
                </p>
              )}

              <button
                type="submit"
                disabled={saving || !hasUnsavedForm}
                className="w-full rounded-lg bg-emerald-700 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 disabled:opacity-40 min-h-[44px]"
              >
                {saving
                  ? "Saving…"
                  : defaults
                  ? "Update defaults"
                  : "Save defaults"}
              </button>
            </form>

            {/* Current defaults display */}
            {defaults && !saved && (
              <div className="mt-5 rounded-lg bg-slate-800/40 px-4 py-3 space-y-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
                  Current defaults
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">ROAS</span>
                  <span className="text-sm font-medium text-slate-200">
                    {defaults.defaultRoasGoalValue.toFixed(2)}x (exceed)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">CPA</span>
                  <span className="text-sm font-medium text-slate-200">
                    ${defaults.defaultCpaGoalValue.toFixed(2)} (stay under)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ── Coverage Summary ───────────────────────────────────────── */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="mb-1 text-base font-semibold text-slate-100">
              Goal Coverage
            </h2>
            <p className="mb-5 text-xs text-slate-500">
              How goals are assigned across this client&apos;s campaigns.
            </p>

            {coverage.totalCampaigns === 0 ? (
              <div className="rounded-lg bg-slate-800/40 px-4 py-6 text-center">
                <p className="text-sm text-slate-500">No campaigns synced yet.</p>
                <Link
                  href={`/clients/${clientId}`}
                  className="mt-2 inline-block text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2"
                >
                  Run a Meta sync →
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <CoverageStat
                  label="Total campaigns"
                  value={coverage.totalCampaigns}
                  color="slate"
                />
                <CoverageStat
                  label="Explicit goals"
                  value={coverage.explicitGoals}
                  color="emerald"
                />
                <CoverageStat
                  label="Using client default"
                  value={coverage.usingDefault}
                  color="indigo"
                />
                <CoverageStat
                  label="Missing goals"
                  value={coverage.missingGoals}
                  color="amber"
                />
              </div>
            )}

            {/* Legend */}
            <div className="mt-5 space-y-1.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
                Resolution order
              </p>
              {[
                { color: "bg-emerald-600", label: "Explicit goal", desc: "Set directly on the campaign" },
                { color: "bg-indigo-600",  label: "Client default", desc: "No explicit goal — uses these defaults" },
                { color: "bg-amber-600",   label: "Missing",        desc: "No explicit goal, no defaults set" },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-2">
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.color}`} />
                  <div>
                    <span className="text-xs font-medium text-slate-300">{item.label}</span>
                    <span className="text-xs text-slate-600"> — {item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Apply Defaults Action ──────────────────────────────────────────── */}
        {coverage.hasClientDefaults && campaignsNeedingDefault > 0 && !applyResult && (
          <div className="mt-6 rounded-2xl border border-indigo-900/60 bg-indigo-950/30 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-indigo-200">
                  Apply defaults to {campaignsNeedingDefault} campaign{campaignsNeedingDefault !== 1 ? "s" : ""}
                </p>
                <p className="mt-0.5 text-xs text-indigo-400/70">
                  Creates explicit goals for campaigns that don&apos;t have one yet.
                  Existing goals are never overwritten.
                </p>
                {applyErr && (
                  <p className="mt-1.5 text-xs text-rose-400">{applyErr}</p>
                )}
              </div>
              <button
                onClick={() => setShowConfirm(true)}
                disabled={applying}
                className="rounded-lg bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-600 disabled:opacity-50 min-h-[44px] whitespace-nowrap"
              >
                Apply to campaigns →
              </button>
            </div>
          </div>
        )}

        {/* Apply success state */}
        {applyResult && (
          <div className="mt-6 rounded-2xl border border-emerald-900/50 bg-emerald-950/20 p-5">
            <p className="text-sm font-semibold text-emerald-300">
              Done — {applyResult.applied} campaign{applyResult.applied !== 1 ? "s" : ""} updated
            </p>
            <p className="mt-0.5 text-xs text-emerald-600">
              {applyResult.skipped} already had explicit goals and were not changed.
            </p>
            <Link
              href={`/clients/${clientId}/campaigns`}
              className="mt-3 inline-block text-xs text-emerald-400 hover:text-emerald-200 underline underline-offset-2"
            >
              View campaign performance →
            </Link>
          </div>
        )}

        {/* No campaigns yet — no apply action shown */}
        {coverage.totalCampaigns === 0 && (
          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/30 p-5 text-center">
            <p className="text-sm text-slate-500">
              Defaults are saved and will apply automatically once campaigns are synced.
            </p>
          </div>
        )}

        {/* Nav footer */}
        <div className="mt-8 flex flex-wrap gap-4 text-xs text-slate-600">
          <Link href={`/clients/${clientId}/campaigns`} className="hover:text-slate-300 transition-colors">
            Campaign Performance →
          </Link>
          <Link href={`/clients/${clientId}`} className="hover:text-slate-300 transition-colors">
            Client Overview →
          </Link>
        </div>
      </div>
    </>
  );
}
