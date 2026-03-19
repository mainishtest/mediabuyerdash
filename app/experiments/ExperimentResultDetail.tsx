"use client";

// app/experiments/ExperimentResultDetail.tsx
// Full detail panel for a single experiment.
// Sections: outcome header | comparison table | window progress |
//           outcome reasons | guardrail breaches | learnings | action controls
//
// Responsive:
//   Mobile:  stacked — outcome → comparison → reasons → learnings → actions
//   Desktop: used inside sticky right panel

import { useState } from "react";
import Link         from "next/link";
import type { ExperimentWithResult } from "../../types/experiment";
import {
  OUTCOME_LABEL,
  OUTCOME_COLOR,
  OUTCOME_BG,
  PRIMARY_METRIC_LABEL,
}                                    from "../../types/experiment";
import { SectionCard, Badge }        from "../../components/ui";

// ---------------------------------------------------------------------------
// Metric comparison table
// ---------------------------------------------------------------------------

function MetricRow({ label, control, challenger, higherIsBetter = true }: {
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
    <div className="grid grid-cols-3 items-center gap-2 border-t border-slate-800/50 py-2 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="text-center font-mono text-slate-300">{control.toFixed(2)}</span>
      <div className="flex items-center justify-end gap-1.5">
        <span className="font-mono text-slate-300">{challenger.toFixed(2)}</span>
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
// Snapshot metrics card
// ---------------------------------------------------------------------------

function SnapshotCard({ experiment }: { experiment: ExperimentWithResult }) {
  const r   = experiment.result;
  const ctl = r?.controlSnapshot;
  const chl = r?.challengerSnapshot;

  if (!ctl || !chl) return (
    <div className="rounded-xl border border-dashed border-slate-800 px-4 py-4">
      <p className="text-xs text-slate-600">Performance data not yet loaded — click &ldquo;Evaluate Now&rdquo; to run ingestion.</p>
    </div>
  );

  return (
    <div className="rounded-xl border border-slate-800 overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-3 gap-2 border-b border-slate-800 bg-slate-900/60 px-3 py-2 text-xs">
        <span className="text-slate-600">Metric</span>
        <span className="text-center text-slate-500">{ctl.variantLabel}</span>
        <span className="text-right text-slate-500">{chl.variantLabel}</span>
      </div>
      <div className="px-3">
        <MetricRow label="ROAS (CRM)"    control={ctl.roas}        challenger={chl.roas}        higherIsBetter />
        <MetricRow label="CPA ($)"       control={ctl.cpa}         challenger={chl.cpa}         higherIsBetter={false} />
        <MetricRow label="Orders"        control={ctl.orders}      challenger={chl.orders}      higherIsBetter />
        <MetricRow label="Revenue ($)"   control={ctl.revenue}     challenger={chl.revenue}     higherIsBetter />
        <MetricRow label="CTR"           control={ctl.ctr}         challenger={chl.ctr}         higherIsBetter />
        <MetricRow label="Spend ($)"     control={ctl.spend}       challenger={chl.spend}       higherIsBetter />
        <MetricRow label="Impressions"   control={ctl.impressions} challenger={chl.impressions} higherIsBetter />
      </div>
      {/* Data source note */}
      <div className="border-t border-slate-800/50 px-3 py-2">
        <p className="text-xs text-slate-700">
          CRM data source: {ctl.dataSource} · {chl.dataSource}
        </p>
        {(ctl.missingFields.length > 0 || chl.missingFields.length > 0) && (
          <p className="text-xs text-amber-600">
            Incomplete fields — {[...ctl.missingFields, ...chl.missingFields].join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Learnings list
// ---------------------------------------------------------------------------

function LearningsPanel({ experiment }: { experiment: ExperimentWithResult }) {
  const [expanded, setExpanded] = useState(false);
  const ls = experiment.learnings;

  if (ls.length === 0) return (
    <div className="rounded-xl border border-dashed border-slate-800 px-4 py-3">
      <p className="text-xs text-slate-600">No learnings captured yet. Run evaluation to generate learnings.</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {ls.map((l, i) => (
        <div key={l.id ?? i} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-medium text-slate-300">{l.outcomeLabel}</p>
            <div className="flex shrink-0 gap-1">
              {l.usableForBriefs  && <span className="rounded bg-indigo-900/40 px-1.5 py-0.5 text-xs text-indigo-300">briefs</span>}
              {l.usableForScoring && <span className="rounded bg-sky-900/40 px-1.5 py-0.5 text-xs text-sky-300">scoring</span>}
            </div>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">{l.insightText}</p>
          {l.winningPattern && (
            <p className="mt-1.5 text-xs text-slate-600">
              Pattern: <span className="text-slate-400">{l.winningPattern.replace(/_/g, " ")}</span>
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Evaluation window bar
// ---------------------------------------------------------------------------

function WindowProgress({ experiment }: { experiment: ExperimentWithResult }) {
  const w = experiment.evaluationWindow;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs text-slate-500">Evaluation window ({w.windowDays} days)</span>
        <span className={`text-xs ${w.isComplete ? "text-emerald-400" : "text-slate-500"}`}>
          {w.isComplete ? "Complete" : `${w.daysRemaining}d remaining (${w.progressPct}%)`}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-800">
        <div
          className={`h-2 rounded-full transition-all ${w.isComplete ? "bg-emerald-600" : "bg-indigo-500"}`}
          style={{ width: `${w.progressPct}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs text-slate-700">
        <span>{w.startedAt}</span>
        <span>{w.endsAt}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props and main component
// ---------------------------------------------------------------------------

type Props = {
  experiment:     ExperimentWithResult;
  onEvaluate:     () => void;
  onArchive:      () => void;
  actionPending?: boolean;
};

export function ExperimentResultDetail({ experiment, onEvaluate, onArchive, actionPending = false }: Props) {
  const r       = experiment.result;
  const outcome = r?.outcome;
  const outcomeColor = outcome ? OUTCOME_COLOR[outcome] : "text-slate-400";
  const outcomeBg    = outcome ? OUTCOME_BG[outcome]    : "border-slate-800 bg-slate-900/40";
  const outcomeText  = outcome ? OUTCOME_LABEL[outcome] : "Not evaluated";

  const isArchived  = experiment.status === "archived";
  const isCompleted = experiment.status === "completed";
  const lift        = r?.primaryMetricLift;
  const liftPct     = lift !== null && lift !== undefined ? (lift * 100).toFixed(1) : null;

  return (
    <div className="space-y-5">

      {/* ── Outcome header ── */}
      <div className={`rounded-xl border p-4 ${outcomeBg}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={`text-base font-bold ${outcomeColor}`}>{outcomeText}</p>
            {r?.winningVariant && (
              <p className="mt-0.5 text-xs text-slate-400">
                Winner: <span className="font-medium text-slate-200">
                  {r.winningVariant === "challenger" ? experiment.challengerLabel : experiment.controlLabel}
                </span>
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            {liftPct && (
              <p className={`text-lg font-bold ${(lift ?? 0) > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {(lift ?? 0) > 0 ? "+" : ""}{liftPct}%
              </p>
            )}
            {r && (
              <p className="text-xs text-slate-600">
                {Math.round(r.confidence * 100)}% confidence
              </p>
            )}
          </div>
        </div>
        {r?.recommendedNote && (
          <p className="mt-3 text-xs leading-relaxed text-slate-400 border-t border-slate-800/50 pt-3">
            {r.recommendedNote}
          </p>
        )}
        {r?.evaluatedAt && (
          <p className="mt-1.5 text-xs text-slate-700">
            Evaluated {new Date(r.evaluatedAt).toLocaleString()}
          </p>
        )}
      </div>

      {/* ── Evaluation window ── */}
      <SectionCard title="Evaluation Window">
        <WindowProgress experiment={experiment} />
      </SectionCard>

      {/* ── Outcome reasons ── */}
      {r?.outcomeReasons && r.outcomeReasons.length > 0 && (
        <SectionCard title="Outcome Reasoning">
          <ul className="space-y-2">
            {r.outcomeReasons.map((reason, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                <span className="mt-0.5 shrink-0 text-slate-600">•</span>
                <span className="leading-relaxed">{reason}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* ── Guardrail breaches ── */}
      {r?.guardrailBreaches && r.guardrailBreaches.length > 0 && (
        <div className="rounded-xl border border-rose-800/40 bg-rose-950/20 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-rose-500">
            Guardrail Warnings ({r.guardrailBreaches.length})
          </p>
          <ul className="space-y-1.5">
            {r.guardrailBreaches.map((b, i) => (
              <li key={i} className="text-xs text-rose-300">⚠ {b}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Control vs Challenger ── */}
      <SectionCard
        title="Control vs Challenger"
        description={`Primary metric: ${PRIMARY_METRIC_LABEL[experiment.primaryMetric] ?? experiment.primaryMetric}`}
      >
        <SnapshotCard experiment={experiment} />
      </SectionCard>

      {/* ── Learnings ── */}
      <SectionCard title="Experiment Learnings" description="Tagged for reuse in Creative Lab and brief generation.">
        <LearningsPanel experiment={experiment} />
      </SectionCard>

      {/* ── Experiment details ── */}
      <SectionCard title="Experiment Details">
        <div className="space-y-2">
          {[
            { label: "Mode",         value: experiment.comparisonMode },
            { label: "Window",       value: `${experiment.evaluationWindowDays} days` },
            { label: "Min spend",    value: `$${experiment.minSpendPerVariant} per variant` },
            { label: "Min orders",   value: `${experiment.minConversionsPerVariant} per variant` },
            { label: "Threshold",    value: `${(experiment.successThreshold * 100).toFixed(0)}% lift` },
            { label: "Started",      value: new Date(experiment.startedAt).toLocaleDateString() },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-baseline gap-3">
              <span className="w-24 shrink-0 text-xs text-slate-600">{label}</span>
              <span className="text-xs capitalize text-slate-300">{value}</span>
            </div>
          ))}
        </div>
        {experiment.challengerPrepItemId && (
          <div className="mt-3">
            <Link
              href="/creative-lab/publish-prep"
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              ↗ Open Publish Prep
            </Link>
          </div>
        )}
      </SectionCard>

      {/* ── Action controls ── */}
      {!isArchived && (
        <SectionCard title="Actions">
          <div className="space-y-2">
            {/* Evaluate */}
            {!isCompleted && (
              <button
                onClick={onEvaluate}
                disabled={actionPending}
                className="w-full rounded-xl border border-indigo-700/50 bg-indigo-950/30 px-3 py-3.5
                  text-xs font-medium text-indigo-200 hover:bg-indigo-950/50
                  active:scale-95 transition-all disabled:opacity-40"
              >
                {actionPending ? "Evaluating…" : "Evaluate Now"}
              </button>
            )}
            {isCompleted && (
              <button
                onClick={onEvaluate}
                disabled={actionPending}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3
                  text-xs font-medium text-slate-300 hover:bg-slate-700
                  active:scale-95 transition-all disabled:opacity-40"
              >
                {actionPending ? "Re-evaluating…" : "Re-evaluate"}
              </button>
            )}

            {/* Winner actions — only after evaluation */}
            {r?.winningVariant === "challenger" && (
              <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/20 px-3 py-3">
                <p className="mb-1.5 text-xs font-medium text-emerald-300">Challenger won</p>
                <div className="flex gap-2 flex-wrap">
                  <Link
                    href="/creative-lab/publish-prep"
                    className="rounded-lg border border-emerald-700/40 px-3 py-1.5 text-xs
                      text-emerald-300 hover:bg-emerald-950/40 transition-colors"
                  >
                    Open Winning Creative
                  </Link>
                  <Link
                    href="/creative-lab/briefs"
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs
                      text-slate-400 hover:bg-slate-800 transition-colors"
                  >
                    Create Follow-up Test
                  </Link>
                </div>
              </div>
            )}

            {r?.winningVariant === "control" && (
              <div className="rounded-xl border border-sky-700/40 bg-sky-950/20 px-3 py-3">
                <p className="mb-1.5 text-xs font-medium text-sky-300">Control held</p>
                <Link
                  href="/creative-lab/review"
                  className="rounded-lg border border-sky-700/40 px-3 py-1.5 text-xs
                    text-sky-300 hover:bg-sky-950/40 transition-colors"
                >
                  Return Challenger to Review
                </Link>
              </div>
            )}

            {/* Archive */}
            <button
              onClick={onArchive}
              disabled={actionPending}
              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5
                text-xs text-slate-600 hover:text-slate-400 hover:border-slate-700
                active:scale-95 transition-all disabled:opacity-40"
            >
              Archive Experiment
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-700">
            No campaign mutations are made without separate approval. Actions here only affect this experiment record.
          </p>
        </SectionCard>
      )}

      {isArchived && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 text-center">
          <p className="text-xs text-slate-600">This experiment has been archived.</p>
        </div>
      )}
    </div>
  );
}
