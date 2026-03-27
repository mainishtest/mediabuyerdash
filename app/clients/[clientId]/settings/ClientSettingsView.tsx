"use client";

// app/clients/[clientId]/settings/ClientSettingsView.tsx
// Client settings page — Campaign Goal Defaults.
//
// Mobile:  stacked form → coverage summary → apply action, each section full-width.
// Desktop: defaults form and coverage summary side-by-side (lg: 2-col grid),
//          apply action spans full width below.

import { useState, useTransition } from "react";
import Link                        from "next/link";
import { GoalSourceBadge, GoalSourceLegend } from "../../../../components/ui/GoalSourceBadge";
import type { ClientDefaultsRecord, ClientGoalCoverageSummary } from "../../../../lib/clientGoalDefaults/service";

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  clientId:            string;
  clientName:          string;
  defaults:            ClientDefaultsRecord | null;
  coverage:            ClientGoalCoverageSummary;
  copywritingPrompt?:  string | null;
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
  copywritingPrompt: initialPrompt,
}: Props) {
  // Copywriting prompt state
  const [promptValue, setPromptValue]     = useState(initialPrompt ?? "");
  const [promptSaving, setPromptSaving]   = useState(false);
  const [promptSaved, setPromptSaved]     = useState(false);
  const [promptError, setPromptError]     = useState<string | null>(null);
  // Form state — seeded from server-loaded defaults
  const [roasValue,     setRoasValue]     = useState(defaults ? String(defaults.defaultRoasGoalValue) : "");
  const [cpaValue,      setCpaValue]      = useState(defaults ? String(defaults.defaultCpaGoalValue)  : "");
  const defaultsExt = defaults as unknown as Record<string, number | null | undefined>;
  const [ctrValue,      setCtrValue]      = useState(defaultsExt?.targetCtr     != null ? String(defaultsExt.targetCtr)     : "");
  const [cvrValue,      setCvrValue]      = useState(defaultsExt?.targetCvr     != null ? String(defaultsExt.targetCvr)     : "");
  const [maxSpendValue, setMaxSpendValue] = useState(defaultsExt?.maxDailySpend != null ? String(defaultsExt.maxDailySpend) : "");
  const [showAdvanced,  setShowAdvanced]  = useState(false);

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

  function parseOpt(s: string): number | null {
    const n = parseFloat(s.trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveErr(null);
    setSaved(false);

    const roas = parseOpt(roasValue);
    const cpa  = parseOpt(cpaValue);

    if (!roas) {
      setSaveErr("Default ROAS must be a positive number (e.g. 2.5)");
      return;
    }

    setSaving(true);
    try {
      // POST to new goals API — writes all 5 fields + keeps legacy fields in sync.
      const res = await fetch(`/api/goals/client/${clientId}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          targetRoas:    roas,
          targetCpa:     cpa,
          targetCtr:     parseOpt(ctrValue),
          targetCvr:     parseOpt(cvrValue),
          maxDailySpend: parseOpt(maxSpendValue),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveErr((data as { error?: string }).error ?? "Failed to save");
        return;
      }
      setSaved(true);
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
  const hasUnsavedForm = roasValue !== "";

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
            <div className="mb-5 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-slate-100">
                  Campaign Goal Defaults
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Fallback targets for campaigns without explicit goals.
                </p>
              </div>
              <GoalSourceBadge source="client" />
            </div>

            <form onSubmit={handleSave} className="space-y-4">

              {/* Primary: ROAS + CPA */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={LABEL_CLS}>
                    Target ROAS
                    <span className="ml-1 text-slate-600 font-normal">(aim to exceed)</span>
                  </label>
                  <input
                    type="number" step="0.01" min="0.01" placeholder="e.g. 2.50"
                    value={roasValue}
                    onChange={(e) => { setRoasValue(e.target.value); setSaved(false); }}
                    className={INPUT_CLS} disabled={saving}
                  />
                </div>
                <div>
                  <label className={LABEL_CLS}>
                    Target CPA ($)
                    <span className="ml-1 text-slate-600 font-normal">(stay under)</span>
                  </label>
                  <input
                    type="number" step="0.01" min="0.01" placeholder="e.g. 45.00"
                    value={cpaValue}
                    onChange={(e) => { setCpaValue(e.target.value); setSaved(false); }}
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
                      <label className={LABEL_CLS}>Target CTR (%)</label>
                      <input
                        type="number" step="0.01" min="0.001" max="100"
                        placeholder="e.g. 1.50"
                        value={ctrValue}
                        onChange={(e) => { setCtrValue(e.target.value); setSaved(false); }}
                        className={INPUT_CLS} disabled={saving}
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Target CVR (%)</label>
                      <input
                        type="number" step="0.01" min="0.001" max="100"
                        placeholder="e.g. 2.00"
                        value={cvrValue}
                        onChange={(e) => { setCvrValue(e.target.value); setSaved(false); }}
                        className={INPUT_CLS} disabled={saving}
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Max Daily Spend ($)</label>
                      <input
                        type="number" step="1" min="1"
                        placeholder="e.g. 500"
                        value={maxSpendValue}
                        onChange={(e) => { setMaxSpendValue(e.target.value); setSaved(false); }}
                        className={INPUT_CLS} disabled={saving}
                      />
                    </div>
                  </div>
                )}
              </div>

              {saveErr && <p className="text-xs text-rose-400">{saveErr}</p>}
              {saved && (
                <p className="text-xs text-emerald-400">
                  Defaults saved. Campaigns without explicit goals will use these targets.
                </p>
              )}

              <button
                type="submit"
                disabled={saving || !hasUnsavedForm}
                className="w-full rounded-lg bg-emerald-700 py-3 text-sm font-semibold text-white
                           transition-colors hover:bg-emerald-600 disabled:opacity-40 min-h-[44px]"
              >
                {saving ? "Saving…" : defaults ? "Update defaults" : "Save defaults"}
              </button>
            </form>

            {/* Current defaults display */}
            {defaults && !saved && (
              <div className="mt-5 rounded-lg bg-slate-800/40 px-4 py-3 space-y-1.5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
                  Current defaults
                </p>
                {[
                  { label: "ROAS", value: `${defaults.defaultRoasGoalValue.toFixed(2)}×` },
                  { label: "CPA",  value: `$${defaults.defaultCpaGoalValue.toFixed(2)}` },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">{label}</span>
                    <span className="text-sm font-medium text-slate-200">{value}</span>
                  </div>
                ))}
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
            <div className="mt-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
                Resolution order
              </p>
              <GoalSourceLegend />
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

        {/* ── Copywriting Prompt ────────────────────────────────────────────── */}
        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-100">
              AI Copywriting Prompt
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Custom instructions that auto-fill into every AI copy generation for this client.
              Include tone, voice, audience context, product details, words to avoid, and any rules
              the AI should follow when writing ad copy.
            </p>
          </div>

          <textarea
            value={promptValue}
            onChange={(e) => { setPromptValue(e.target.value); setPromptSaved(false); }}
            placeholder={`Example:\n\nTone: Warm, faith-based, testimonial-driven. Speak like a trusted neighbor, not a marketer.\n\nAudience: Women 45-65 dealing with joint pain, fatigue, and inflammation. Many have tried everything.\n\nProduct: Biblical herb tincture. Natural ingredients, backed by scripture references. Not FDA-evaluated.\n\nRules:\n- Never use "miracle" or "cure"\n- Always include a personal story angle\n- Keep hooks under 20 words\n- Reference biblical ingredients naturally\n- CTA should feel like an invitation, not a hard sell`}
            rows={10}
            className={`${INPUT_CLS} resize-y`}
          />

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              disabled={promptSaving}
              onClick={async () => {
                setPromptSaving(true);
                setPromptError(null);
                setPromptSaved(false);
                try {
                  const res = await fetch(`/api/clients/${clientId}/copywriting-prompt`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ copywritingPrompt: promptValue }),
                  });
                  if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    setPromptError((data as { error?: string }).error ?? "Save failed");
                  } else {
                    setPromptSaved(true);
                  }
                } catch {
                  setPromptError("Network error");
                } finally {
                  setPromptSaving(false);
                }
              }}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white
                transition-colors hover:bg-indigo-500 disabled:opacity-50"
            >
              {promptSaving ? "Saving..." : "Save Prompt"}
            </button>
            {promptSaved && (
              <span className="text-xs text-emerald-400">Saved — this prompt will be used for all AI copy generation for this client.</span>
            )}
            {promptError && (
              <span className="text-xs text-rose-400">{promptError}</span>
            )}
          </div>
        </div>

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
