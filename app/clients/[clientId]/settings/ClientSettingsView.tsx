"use client";

// app/clients/[clientId]/settings/ClientSettingsView.tsx
// Client settings page — Campaign Goal Defaults.
//
// Mobile:  stacked form → coverage summary → apply action, each section full-width.
// Desktop: defaults form and coverage summary side-by-side (lg: 2-col grid),
//          apply action spans full width below.

import { useState, useTransition, useEffect } from "react";
import Link                        from "next/link";
import { GoalSourceBadge, GoalSourceLegend } from "../../../../components/ui/GoalSourceBadge";
import type { ClientDefaultsRecord, ClientGoalCoverageSummary } from "../../../../lib/clientGoalDefaults/service";

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  clientId:            string;
  clientName:          string;
  defaults:            ClientDefaultsRecord | null;
  coverage:            ClientGoalCoverageSummary;
  copywritingPrompt?:           string | null;
  initialImagePromptDirections?: string | null;
  initialProductImageUrl?:      string | null;
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
  initialImagePromptDirections,
  initialProductImageUrl,
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

        {/* ── Image Prompt Directions ──────────────────────────────────────────── */}
        <ImagePromptSection clientId={clientId} initialValue={initialImagePromptDirections ?? ""} />

        {/* ── Product Reference Image ─────────────────────────────────────────── */}
        <ProductImageSection clientId={clientId} initialUrl={initialProductImageUrl ?? ""} />

        {/* ── Campaign Launch Defaults ───────────────────────────────────────── */}
        <CampaignDefaultsSection clientId={clientId} />

        {/* ── Image Library ────────────────────────────────────────────────────── */}
        <ImageLibrarySection clientId={clientId} />

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

// ---------------------------------------------------------------------------
// Campaign Launch Defaults
// ---------------------------------------------------------------------------

function CampaignDefaultsSection({ clientId }: { clientId: string }) {
  const [d, setD] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`/api/clients/${clientId}/campaign-defaults`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.defaults) {
          const vals: Record<string, string> = {};
          for (const [k, v] of Object.entries(data.defaults)) {
            if (v != null) vals[k] = String(v);
          }
          setD(vals);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [clientId]);

  function set(key: string, val: string) {
    setD((prev) => ({ ...prev, [key]: val }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/clients/${clientId}/campaign-defaults`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(d),
    });
    setSaving(false);
    setSaved(true);
  }

  const I = INPUT_CLS;
  const L = LABEL_CLS;

  if (!loaded) return null;

  return (
    <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-100">Campaign Launch Defaults</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Saved values auto-fill when launching ad tests. Override any field per launch.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={L}>Ad Account ID</label>
          <input className={I} value={d.defaultAdAccountId ?? ""} onChange={(e) => set("defaultAdAccountId", e.target.value)} placeholder="act_2218192095198501" /></div>
        <div><label className={L}>Facebook Page ID</label>
          <input className={I} value={d.defaultPageId ?? ""} onChange={(e) => set("defaultPageId", e.target.value)} placeholder="100078685202224" /></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={L}>Pixel ID</label>
          <input className={I} value={d.defaultPixelId ?? ""} onChange={(e) => set("defaultPixelId", e.target.value)} placeholder="91036334748..." /></div>
      </div>

      <div><label className={L}>Default Destination URL</label>
        <input className={I} value={d.defaultDestinationUrl ?? ""} onChange={(e) => set("defaultDestinationUrl", e.target.value)} placeholder="https://yoursite.com/landing-page" /></div>

      <div><label className={L}>Default Ad Headline</label>
        <input className={I} value={d.defaultHeadline ?? ""} onChange={(e) => set("defaultHeadline", e.target.value)} placeholder="Headline shown below image in link ads" />
        <p className="mt-1 text-xs text-slate-600">This appears below the ad image in the link preview area.</p></div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div><label className={L}>Daily Budget ($)</label>
          <input type="number" className={I} value={d.defaultDailyBudget ?? ""} onChange={(e) => set("defaultDailyBudget", e.target.value)} placeholder="50" /></div>
        <div><label className={L}>Objective</label>
          <select className={I} value={d.defaultObjective ?? ""} onChange={(e) => set("defaultObjective", e.target.value)}>
            <option value="">Select...</option>
            <option value="OUTCOME_TRAFFIC">Traffic</option>
            <option value="OUTCOME_SALES">Sales</option>
            <option value="OUTCOME_ENGAGEMENT">Engagement</option>
            <option value="OUTCOME_LEADS">Leads</option>
          </select></div>
        <div><label className={L}>Optimization Goal</label>
          <select className={I} value={d.defaultOptGoal ?? ""} onChange={(e) => set("defaultOptGoal", e.target.value)}>
            <option value="">Select...</option>
            <option value="LINK_CLICKS">Link Clicks</option>
            <option value="LANDING_PAGE_VIEWS">Landing Page Views</option>
            <option value="OFFSITE_CONVERSIONS">Conversions</option>
            <option value="IMPRESSIONS">Impressions</option>
          </select></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div><label className={L}>Countries</label>
          <input className={I} value={d.defaultTargetCountries ?? ""} onChange={(e) => set("defaultTargetCountries", e.target.value)} placeholder="US" /></div>
        <div><label className={L}>Age Min</label>
          <input type="number" className={I} value={d.defaultAgeMin ?? ""} onChange={(e) => set("defaultAgeMin", e.target.value)} placeholder="18" /></div>
        <div><label className={L}>Age Max</label>
          <input type="number" className={I} value={d.defaultAgeMax ?? ""} onChange={(e) => set("defaultAgeMax", e.target.value)} placeholder="65" /></div>
        <div><label className={L}>Gender</label>
          <select className={I} value={d.defaultGender ?? ""} onChange={(e) => set("defaultGender", e.target.value)}>
            <option value="0">All</option>
            <option value="1">Male</option>
            <option value="2">Female</option>
          </select></div>
      </div>

      {/* UTM defaults */}
      <div>
        <p className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-widest">UTM Parameters</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label className={L}>utm_source</label>
            <input className={I} value={d.defaultUtmSource ?? ""} onChange={(e) => set("defaultUtmSource", e.target.value)} placeholder="facebook" /></div>
          <div><label className={L}>utm_medium</label>
            <input className={I} value={d.defaultUtmMedium ?? ""} onChange={(e) => set("defaultUtmMedium", e.target.value)} placeholder="paid" /></div>
          <div><label className={L}>utm_campaign</label>
            <input className={I} value={d.defaultUtmCampaign ?? ""} onChange={(e) => set("defaultUtmCampaign", e.target.value)} placeholder="{{campaign.name}}" /></div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div><label className={L}>utm_content</label>
            <input className={I} value={d.defaultUtmContent ?? ""} onChange={(e) => set("defaultUtmContent", e.target.value)} placeholder="{{ad.name}}" /></div>
          <div><label className={L}>utm_term</label>
            <input className={I} value={d.defaultUtmTerm ?? ""} onChange={(e) => set("defaultUtmTerm", e.target.value)} placeholder="optional" /></div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
          {saving ? "Saving..." : "Save Defaults"}
        </button>
        {saved && <span className="text-xs text-emerald-400">Saved</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Image Library
// ---------------------------------------------------------------------------

function ImageLibrarySection({ clientId }: { clientId: string }) {
  const [images, setImages] = useState<Array<{
    id: string; label: string; imageUrl: string; tags: string | null; createdAt: string;
  }>>([]);
  const [label, setLabel]     = useState("");
  const [url, setUrl]         = useState("");
  const [tags, setTags]       = useState("");
  const [saving, setSaving]   = useState(false);
  const [loaded, setLoaded]   = useState(false);

  useEffect(() => {
    fetch(`/api/clients/${clientId}/images`)
      .then((r) => r.json())
      .then((data) => { if (data.ok) setImages(data.images ?? []); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [clientId]);

  async function handleAdd() {
    if (!label || !url) return;
    setSaving(true);
    const res = await fetch(`/api/clients/${clientId}/images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, imageUrl: url, tags }),
    });
    const data = await res.json();
    if (data.ok) {
      setImages((prev) => [data.image, ...prev]);
      setLabel(""); setUrl(""); setTags("");
    }
    setSaving(false);
  }

  async function handleDelete(imageId: string) {
    await fetch(`/api/clients/${clientId}/images`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageId }),
    });
    setImages((prev) => prev.filter((i) => i.id !== imageId));
  }

  if (!loaded) return null;

  return (
    <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-100">Image Library</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Save ad images here. Select from the library when launching tests instead of pasting URLs.
        </p>
      </div>

      {/* Add image form */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label className={LABEL_CLS}>Label</label>
          <input className={INPUT_CLS} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Hero Product Shot" /></div>
        <div><label className={LABEL_CLS}>Image URL</label>
          <input className={INPUT_CLS} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." /></div>
        <div><label className={LABEL_CLS}>Tags (optional)</label>
          <input className={INPUT_CLS} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="product,lifestyle" /></div>
      </div>
      <button onClick={handleAdd} disabled={saving || !label || !url}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
        {saving ? "Adding..." : "+ Add Image"}
      </button>

      {/* Image grid */}
      {images.length > 0 && (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img) => (
            <div key={img.id} className="rounded-xl border border-slate-700 bg-slate-800/40 overflow-hidden group relative">
              <div className="aspect-square bg-slate-800">
                <img src={img.imageUrl} alt={img.label} className="h-full w-full object-cover" />
              </div>
              <div className="p-2">
                <p className="text-xs font-medium text-slate-200 truncate">{img.label}</p>
                {img.tags && <p className="text-[10px] text-slate-600 truncate">{img.tags}</p>}
              </div>
              <button
                onClick={() => handleDelete(img.id)}
                className="absolute top-1 right-1 rounded-md bg-slate-900/80 px-1.5 py-0.5 text-xs text-rose-400
                  opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {images.length === 0 && (
        <p className="text-xs text-slate-600">No images saved yet. Add your first ad image above.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Image Prompt Directions
// ---------------------------------------------------------------------------

function ImagePromptSection({ clientId, initialValue }: { clientId: string; initialValue: string }) {
  const [value, setValue]   = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/copywriting-prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagePromptDirections: value || null }),
      });
      if (!res.ok) setError("Save failed");
      else setSaved(true);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-100">AI Image Prompt Directions</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Custom instructions for AI image generation. Describe your brand&apos;s visual style,
          product placement rules, mood, and anything the AI should always include or avoid when
          generating ad images for this client.
        </p>
      </div>

      <textarea
        value={value}
        onChange={(e) => { setValue(e.target.value); setSaved(false); }}
        placeholder={`Example:\n\nProduct: Amber glass tincture bottle with gold cap, label reads "Wisdom Nutrition" with list of 8 biblical ingredients.\n\nStyle: Warm, premium, faith-inspired. Think ancient meets modern — biblical herbs with clean product photography.\n\nAlways include:\n- The actual Wisdom Nutrition bottle as the focal point\n- Warm earth tones (gold, amber, cream, deep brown)\n- Natural ingredients visible (cinnamon sticks, frankincense, herbs)\n\nNever include:\n- People's faces (use hands/silhouettes only)\n- Medical imagery or doctor settings\n- Bright neon colors or tech aesthetics\n- Competitor products or generic supplement bottles`}
        rows={8}
        className={INPUT_CLS + " resize-y"}
      />

      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
          {saving ? "Saving..." : "Save Image Directions"}
        </button>
        {saved && <span className="text-xs text-emerald-400">Saved — these directions will guide all AI image generation for this client.</span>}
        {error && <span className="text-xs text-rose-400">{error}</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Product Reference Image
// ---------------------------------------------------------------------------

function ProductImageSection({ clientId, initialUrl }: { clientId: string; initialUrl: string }) {
  const [url, setUrl]       = useState(initialUrl);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/clients/${clientId}/copywriting-prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productImageUrl: url || null }),
    });
    setSaving(false);
    setSaved(true);
  }

  return (
    <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-100">Product Reference Image</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Upload your actual product image. AI image generation will use this as a reference to keep
          your product looking consistent across all generated ad creatives.
        </p>
      </div>

      <div className="flex items-start gap-4">
        {url && (
          <div className="h-24 w-24 shrink-0 rounded-xl border border-slate-600 overflow-hidden bg-slate-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="Product reference" className="h-full w-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>
        )}
        <div className="flex-1 space-y-2">
          <input
            type="url"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setSaved(false); }}
            placeholder="https://... (direct URL to your product image)"
            className={INPUT_CLS}
          />
          <p className="text-xs text-slate-600">
            Use a clear, high-quality product photo on a plain background. This image will be used as the
            reference for all AI-generated ad image variations.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
          {saving ? "Saving..." : "Save Product Image"}
        </button>
        {saved && <span className="text-xs text-emerald-400">Saved</span>}
      </div>
    </div>
  );
}
