"use client";

// app/creative-lab/results/CreativeTestResultDetail.tsx
// Full detail panel for one creative test result.
//
// Responsive:
//   Mobile:  stacked — outcome header → metrics → window → reasons → actions
//   Desktop: same sections in a sticky right panel with richer comparison table

import { useState } from "react";
import type { CreativeTestResult, CreativeTestMetricSnapshot } from "../../../types/creativeTestResults";
import {
  TEST_OUTCOME_LABEL,
  TEST_OUTCOME_COLOR,
  TEST_OUTCOME_BG,
  CONFIDENCE_LEVEL_COLOR,
} from "../../../types/creativeTestResults";
import { SectionCard } from "../../../components/ui/SectionCard";
import { ActionButton } from "../../../components/ui/ActionButton";

type Props = {
  result:     CreativeTestResult;
  onUpdate:   (id: string, patch: Record<string, unknown>) => Promise<void>;
  onIngest:   (id: string) => Promise<void>;
  pending?:   boolean;
};

// ---------------------------------------------------------------------------
// Metric comparison row
// ---------------------------------------------------------------------------

function MetricRow({
  label,
  control,
  challenger,
  higherIsBetter = true,
}: {
  label:           string;
  control:         number;
  challenger:      number;
  higherIsBetter?: boolean;
}) {
  const lift   = control > 0 ? (challenger - control) / control : 0;
  const pct    = (lift * 100).toFixed(1);
  const better = higherIsBetter ? challenger >= control : challenger <= control;
  const sign   = lift > 0 ? "+" : "";

  return (
    <div className="grid grid-cols-3 items-center gap-2 border-t border-slate-800/40 py-2 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="text-center font-mono text-slate-300">
        {label.includes("$") || label.includes("ROAS") || label.includes("CPA")
          ? control.toFixed(2) : control.toFixed(0)}
      </span>
      <div className="flex items-center justify-end gap-1.5">
        <span className="font-mono text-slate-300">
          {label.includes("$") || label.includes("ROAS") || label.includes("CPA")
            ? challenger.toFixed(2) : challenger.toFixed(0)}
        </span>
        {lift !== 0 && (
          <span className={`text-xs font-medium ${better ? "text-emerald-400" : "text-rose-400"}`}>
            {sign}{pct}%
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metrics comparison table
// ---------------------------------------------------------------------------

function MetricsTable({ control, challenger }: {
  control:    CreativeTestMetricSnapshot;
  challenger: CreativeTestMetricSnapshot;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-800">
      {/* Header */}
      <div className="grid grid-cols-3 gap-2 border-b border-slate-800 bg-slate-900/60 px-3 py-2 text-xs">
        <span className="text-slate-600">Metric</span>
        <span className="text-center text-sky-400">{control.label}</span>
        <span className="text-right text-emerald-400">{challenger.label}</span>
      </div>
      <div className="px-3">
        <MetricRow label="ROAS (CRM 7d)"  control={control.roas}        challenger={challenger.roas}        higherIsBetter />
        <MetricRow label="CPA ($)"        control={control.cpa}         challenger={challenger.cpa}         higherIsBetter={false} />
        <MetricRow label="Orders"         control={control.orders}      challenger={challenger.orders}      higherIsBetter />
        <MetricRow label="Revenue ($)"    control={control.revenue}     challenger={challenger.revenue}     higherIsBetter />
        <MetricRow label="CTR"            control={control.ctr}         challenger={challenger.ctr}         higherIsBetter />
        <MetricRow label="CPM ($)"        control={control.cpm}         challenger={challenger.cpm}         higherIsBetter={false} />
        <MetricRow label="Spend ($)"      control={control.spend}       challenger={challenger.spend}       higherIsBetter />
        <MetricRow label="Impressions"    control={control.impressions} challenger={challenger.impressions} higherIsBetter />
      </div>
      {/* Data source note */}
      <div className="border-t border-slate-800/40 px-3 py-2">
        <p className="text-xs text-slate-700">
          Data: control={control.dataSource} · challenger={challenger.dataSource}
        </p>
        {(control.missingFields.length > 0 || challenger.missingFields.length > 0) && (
          <p className="text-xs text-amber-600">
            Incomplete: {[...control.missingFields, ...challenger.missingFields].join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main detail panel
// ---------------------------------------------------------------------------

export function CreativeTestResultDetail({ result, onUpdate, onIngest, pending = false }: Props) {
  const [metricsOpen,  setMetricsOpen]  = useState(true);
  const [reasonsOpen,  setReasonsOpen]  = useState(false);
  const [windowOpen,   setWindowOpen]   = useState(false);

  const { outcome, confidence, comparison, evaluationWindow, outcomeReasons, guardrailBreaches } = result;

  const outcomeBadge = outcome
    ? { bg: TEST_OUTCOME_BG[outcome], color: TEST_OUTCOME_COLOR[outcome], label: TEST_OUTCOME_LABEL[outcome] }
    : { bg: "border-slate-700 bg-slate-800", color: "text-slate-400", label: "Not yet evaluated" };

  const canIngest = !pending && result.trackingState !== "stale" && result.trackingState !== "blocked";
  const isCompleted = result.trackingState === "completed";

  return (
    <div className="space-y-5">
      {/* Header: outcome + confidence */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-white">{result.name}</h2>
          <p className="mt-1 text-xs text-slate-500">
            {result.clientName ?? result.clientAccountId}
            {result.campaignName ? ` · ${result.campaignName}` : ""}
            {result.adSetName    ? ` / ${result.adSetName}` : ""}
          </p>
        </div>
        <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${outcomeBadge.bg} ${outcomeBadge.color}`}>
          {outcomeBadge.label}
        </span>
      </div>

      {/* Confidence bar */}
      {confidence && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Confidence</p>
            <span className={`text-sm font-semibold ${CONFIDENCE_LEVEL_COLOR[confidence.level]}`}>
              {confidence.label} ({(confidence.score * 100).toFixed(0)}%)
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800">
            <div
              className="h-1.5 rounded-full bg-emerald-500"
              style={{ width: `${(confidence.score * 100).toFixed(0)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-400">{confidence.rationale}</p>
          {!confidence.isWindowComplete && (
            <p className="mt-1 text-xs text-amber-400">
              Preliminary — window not yet complete.
            </p>
          )}
        </div>
      )}

      {/* Recommended next step */}
      {result.recommendedNextStep && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Next Step</p>
          <p className="text-sm text-slate-300">→ {result.recommendedNextStep}</p>
        </div>
      )}

      {/* Control vs Challenger mapping — stacked mobile, side-by-side sm+ */}
      <SectionCard title="Control vs Challenger">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-sky-800/30 bg-sky-950/20 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-400">Control</p>
            <p className="mt-1 text-sm text-white">
              {result.controlCreativeName ?? result.controlCreativeId ?? "Not assigned"}
            </p>
            {result.controlAdExternalId && (
              <p className="mt-0.5 font-mono text-xs text-slate-500">{result.controlAdExternalId}</p>
            )}
          </div>
          <div className="rounded-xl border border-emerald-800/30 bg-emerald-950/20 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">Challenger</p>
            <p className="mt-1 text-sm text-white">
              {result.challengerVariantTitle ?? "Not assigned"}
            </p>
            {result.challengerAdExternalId && (
              <p className="mt-0.5 font-mono text-xs text-slate-500">{result.challengerAdExternalId}</p>
            )}
          </div>
        </div>
        {result.winningVariant && (
          <div className={`mt-3 rounded-lg border px-3 py-2 text-sm font-medium
            ${result.winningVariant === "challenger"
              ? "border-emerald-700/40 bg-emerald-950/20 text-emerald-400"
              : "border-sky-700/40 bg-sky-950/20 text-sky-400"
            }`}>
            ◆ {result.winningVariant === "challenger" ? "Challenger" : "Control"} is the winner
            {comparison?.primaryLift != null && (
              <span className="ml-2 text-xs">
                ({comparison.primaryLift > 0 ? "+" : ""}{(comparison.primaryLift * 100).toFixed(1)}% {result.primaryMetric})
              </span>
            )}
          </div>
        )}
      </SectionCard>

      {/* Metrics comparison — collapsible on mobile */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60">
        <button
          type="button"
          onClick={() => setMetricsOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
        >
          <div>
            <h2 className="text-sm font-semibold text-white">Performance Metrics</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {result.primaryMetric} ·
              {comparison?.primaryLift != null
                ? ` ${comparison.primaryLift > 0 ? "+" : ""}${(comparison.primaryLift * 100).toFixed(1)}% lift`
                : " No data yet"}
            </p>
          </div>
          <span className="shrink-0 text-slate-500">{metricsOpen ? "▲" : "▼"}</span>
        </button>
        {metricsOpen && (
          <div className="border-t border-slate-800/60 px-5 py-4">
            {result.controlSnapshot && result.challengerSnapshot ? (
              <MetricsTable
                control={result.controlSnapshot}
                challenger={result.challengerSnapshot}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-slate-800 px-4 py-6 text-center">
                <p className="text-sm text-slate-500">No performance data yet.</p>
                <p className="mt-1 text-xs text-slate-600">Click &ldquo;Run Ingestion&rdquo; to load data.</p>
              </div>
            )}

            {/* Guardrail breaches */}
            {guardrailBreaches.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-700/30 bg-amber-950/10 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-400 mb-1.5">
                  Guardrail Breaches
                </p>
                {guardrailBreaches.map((b, i) => (
                  <p key={i} className="text-xs text-amber-300">• {b}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Evaluation window — collapsible */}
      {evaluationWindow && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60">
          <button
            type="button"
            onClick={() => setWindowOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
          >
            <div>
              <h2 className="text-sm font-semibold text-white">Evaluation Window</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {evaluationWindow.isComplete
                  ? "Window complete"
                  : `${evaluationWindow.progressPct}% complete · ${evaluationWindow.daysRemaining}d remaining`
                }
              </p>
            </div>
            <span className="shrink-0 text-slate-500">{windowOpen ? "▲" : "▼"}</span>
          </button>
          {windowOpen && (
            <div className="border-t border-slate-800/60 px-5 py-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">{evaluationWindow.startedAt}</span>
                <span className="text-slate-500">{evaluationWindow.endsAt}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all ${
                    evaluationWindow.isComplete ? "bg-emerald-500" : "bg-sky-500"
                  }`}
                  style={{ width: `${evaluationWindow.progressPct}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-slate-500 uppercase tracking-wide">Window</p>
                  <p className="mt-1 text-white">{evaluationWindow.windowDays} days</p>
                </div>
                <div>
                  <p className="text-slate-500 uppercase tracking-wide">Status</p>
                  <p className={`mt-1 ${evaluationWindow.isComplete ? "text-emerald-400" : "text-sky-400"}`}>
                    {evaluationWindow.isComplete ? "Complete" : `${evaluationWindow.daysRemaining}d left`}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Outcome reasons — collapsible */}
      {outcomeReasons.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60">
          <button
            type="button"
            onClick={() => setReasonsOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
          >
            <div>
              <h2 className="text-sm font-semibold text-white">Outcome Reasons</h2>
              <p className="mt-0.5 text-xs text-slate-500">{outcomeReasons.length} factor{outcomeReasons.length !== 1 ? "s" : ""}</p>
            </div>
            <span className="shrink-0 text-slate-500">{reasonsOpen ? "▲" : "▼"}</span>
          </button>
          {reasonsOpen && (
            <div className="border-t border-slate-800/60 px-5 py-4 space-y-2">
              {outcomeReasons.map((r) => (
                <p key={r.key} className="text-sm text-slate-300">• {r.description}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action buttons — thumb-friendly min-h-[44px] */}
      <SectionCard title="Actions">
        <div className="flex flex-wrap gap-3">
          {canIngest && (
            <ActionButton
              variant="primary"
              size="md"
              disabled={pending}
              onClick={() => onIngest(result.id)}
            >
              Run Ingestion
            </ActionButton>
          )}

          {isCompleted && result.winningVariant === "challenger" && (
            <ActionButton
              variant="secondary"
              size="md"
              disabled={pending}
              onClick={() => onUpdate(result.id, { markForReview: true })}
            >
              Mark Ready for Winner Review
            </ActionButton>
          )}

          {isCompleted && result.winningVariant === "control" && result.prepItemId && (
            <a
              href="/creative-lab"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-700
                bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700"
            >
              Return Losing Creative to Creative Lab
            </a>
          )}

          {!result.archivedAt && (
            <ActionButton
              variant="ghost"
              size="md"
              disabled={pending}
              onClick={() => onUpdate(result.id, { archive: true })}
            >
              Archive Test
            </ActionButton>
          )}
        </div>
      </SectionCard>

      {/* Lineage trail */}
      <div className="flex flex-wrap gap-3 border-t border-slate-800/40 pt-4 text-xs text-slate-500">
        {result.launchPlanId && (
          <a href="/creative-lab/launch" className="hover:text-slate-300 transition-colors">
            ← Launch Plan
          </a>
        )}
        {result.prepItemId && (
          <a href="/creative-lab/publish-prep" className="hover:text-slate-300 transition-colors">
            Source Draft
          </a>
        )}
        {result.experimentId && (
          <a href="/experiments" className="hover:text-slate-300 transition-colors">
            Experiment Results →
          </a>
        )}
        {result.targetCampaignExternalId && (
          <a
            href={`https://www.facebook.com/adsmanager/manage/campaigns?act=${result.externalAdAccountId ?? ""}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-300 transition-colors"
          >
            Open Campaign ↗
          </a>
        )}
      </div>
    </div>
  );
}
