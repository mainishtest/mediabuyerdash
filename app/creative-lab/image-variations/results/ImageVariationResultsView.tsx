"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { PageHeader }   from "../../../../components/ui/PageHeader";
import { SectionCard }  from "../../../../components/ui/SectionCard";
import { Badge }        from "../../../../components/ui/Badge";
import { ActionButton } from "../../../../components/ui/ActionButton";
import { StatCard }     from "../../../../components/ui/StatCard";
import { ingestAllResultsAction } from "../actions";
import type { ImageVariationTestResult, ImageVariationResultSummary } from "../../../../lib/imageVariation/resultsTypes";
import {
  IMAGE_VARIATION_OUTCOME_LABEL,
  IMAGE_VARIATION_OUTCOME_BG,
  IMAGE_VARIATION_TRACKING_LABEL,
} from "../../../../lib/imageVariation/resultsTypes";

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

function outcomeBadge(outcome: string) {
  const label = IMAGE_VARIATION_OUTCOME_LABEL[outcome as keyof typeof IMAGE_VARIATION_OUTCOME_LABEL] ?? outcome;
  const variantMap: Record<string, "success" | "warning" | "danger" | "neutral"> = {
    challenger_wins: "success", control_holds: "danger", in_progress: "neutral",
    no_clear_winner: "warning", mixed_result: "warning", insufficient_data: "neutral",
    failed_test: "danger", archived: "neutral",
  };
  return <Badge variant={variantMap[outcome] ?? "neutral"}>{label}</Badge>;
}

function confidenceBadge(level: string, value: number) {
  const v: Record<string, "success" | "warning" | "neutral"> = {
    high: "success", medium: "warning", low: "neutral",
  };
  return <Badge variant={v[level] ?? "neutral"}>{(value * 100).toFixed(0)}% confidence</Badge>;
}

function fmt(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function fmtDollar(n: number): string {
  return `$${n.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ImageVariationResultsView() {
  const [results, setResults] = useState<ImageVariationTestResult[]>([]);
  const [summary, setSummary] = useState<ImageVariationResultSummary | null>(null);
  const [loading, startLoad] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function loadResults() {
    startLoad(async () => {
      const data = await ingestAllResultsAction();
      setResults(data.results);
      setSummary(data.summary);
    });
  }

  useEffect(() => { loadResults(); }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6 sm:px-6 sm:py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/creative-lab" className="hover:text-slate-300">Creative Lab</Link>
        <span>/</span>
        <Link href="/creative-lab/image-variations" className="hover:text-slate-300">Image Variations</Link>
        <span>/</span>
        <span className="text-slate-400">Results</span>
      </nav>

      <PageHeader
        title="Image Variation Test Results"
        description="Track outcomes of launched image variation experiments. CRM is the source of truth for ROAS and CPA with a 7-day attribution window."
      />

      {/* Refresh */}
      <div className="flex items-center gap-3">
        <ActionButton variant="secondary" size="sm" disabled={loading} onClick={loadResults}>
          {loading ? "Loading..." : "Refresh Results"}
        </ActionButton>
      </div>

      {/* Summary stats */}
      {summary && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          <StatCard label="Total Tests"       value={String(summary.totalTests)} />
          <StatCard label="In Progress"       value={String(summary.inProgress)} />
          <StatCard label="Completed"         value={String(summary.completed)} />
          <StatCard label="Challenger Wins"   value={String(summary.challengerWins)} />
          <StatCard label="Control Holds"     value={String(summary.controlHolds)} />
          <StatCard label="No Winner"         value={String(summary.noClearWinner)} />
          <StatCard label="Insufficient"      value={String(summary.insufficientData)} />
          <StatCard label="Avg Confidence"    value={fmtPct(summary.averageConfidence)} />
        </section>
      )}

      {/* Loading */}
      {loading && results.length === 0 && (
        <SectionCard>
          <div className="py-10 text-center">
            <p className="text-sm text-slate-400">Loading test results...</p>
          </div>
        </SectionCard>
      )}

      {/* Empty */}
      {!loading && results.length === 0 && (
        <SectionCard>
          <div className="py-10 text-center">
            <p className="text-sm text-slate-500">No image variation test results yet.</p>
            <p className="mt-2 text-xs text-slate-600">
              Launch experiments from the{" "}
              <Link href="/creative-lab/image-variations/launch" className="text-emerald-500 hover:text-emerald-400">
                launch page
              </Link>{" "}to start tracking results.
            </p>
          </div>
        </SectionCard>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          {results.map((result) => (
            <ResultCard
              key={result.planId}
              result={result}
              expanded={expandedId === result.planId}
              onToggle={() => setExpandedId(expandedId === result.planId ? null : result.planId)}
            />
          ))}
        </div>
      )}

      {/* Navigation */}
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/creative-lab/image-variations/insights" className="text-xs text-emerald-500 hover:text-emerald-400">
          Learning Insights →
        </Link>
        <Link href="/creative-lab/image-variations/launch" className="text-xs text-slate-500 hover:text-slate-300">
          ← Launch Plans
        </Link>
        <Link href="/creative-lab/image-variations/selection" className="text-xs text-slate-500 hover:text-slate-300">
          ← Selection
        </Link>
        <Link href="/experiments" className="text-xs text-slate-500 hover:text-slate-300">
          All Experiments →
        </Link>
        <Link href="/creative-lab" className="ml-auto text-xs text-slate-500 hover:text-slate-300">
          ← Creative Lab
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result card
// ---------------------------------------------------------------------------

function ResultCard({
  result,
  expanded,
  onToggle,
}: {
  result:   ImageVariationTestResult;
  expanded: boolean;
  onToggle: () => void;
}) {
  const bgClass = IMAGE_VARIATION_OUTCOME_BG[result.outcome] ?? "border-slate-800 bg-slate-900/40";

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${bgClass}`}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white leading-tight">{result.planName}</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {IMAGE_VARIATION_TRACKING_LABEL[result.trackingState]} ·{" "}
            {new Date(result.evaluatedAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          {outcomeBadge(result.outcome)}
          {confidenceBadge(result.confidence.level, result.confidence.value)}
        </div>
      </div>

      {/* Evaluation window progress */}
      {result.evaluationWindow && (
        <div>
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Evaluation: {result.evaluationWindow.windowDays}d window</span>
            <span>{result.evaluationWindow.isComplete ? "Complete" : `${result.evaluationWindow.daysRemaining}d remaining`}</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
            <div
              className={`h-full rounded-full ${result.evaluationWindow.isComplete ? "bg-emerald-500" : "bg-sky-500"}`}
              style={{ width: `${Math.min(result.evaluationWindow.progressPct, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Control vs Challenger comparison */}
      {result.controlSnapshot && result.challengerSnapshot && (
        <div className="grid gap-3 sm:grid-cols-2">
          <VariantCard label="Control" snapshot={result.controlSnapshot} />
          <VariantCard label="Challenger" snapshot={result.challengerSnapshot} isChallenger />
        </div>
      )}

      {/* Primary metric delta */}
      {result.comparison && (
        <div className="rounded-lg bg-slate-800/40 px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">{result.comparison.primaryMetric} lift</span>
            <span className={`text-sm font-bold ${
              result.comparison.primaryLift > 0 ? "text-emerald-400" :
              result.comparison.primaryLift < 0 ? "text-rose-400" : "text-slate-400"
            }`}>
              {result.comparison.primaryLift > 0 ? "+" : ""}{fmtPct(result.comparison.primaryLift)}
            </span>
          </div>
          {result.comparison.guardrailBreaches.length > 0 && (
            <p className="mt-1 text-xs text-amber-400">
              Guardrail breaches: {result.comparison.guardrailBreaches.join(", ")}
            </p>
          )}
        </div>
      )}

      {/* Recommended action */}
      <p className="text-xs text-slate-400">{result.recommendedAction}</p>

      {/* Expanded details */}
      {expanded && (
        <>
          {/* Outcome reasons */}
          {result.outcomeReasons.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-400">Outcome Reasons</p>
              {result.outcomeReasons.map((r, i) => (
                <p key={i} className="text-xs text-slate-500">• {r}</p>
              ))}
            </div>
          )}

          {/* Confidence reasons */}
          {result.confidence.reasons.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-400">Confidence Notes</p>
              {result.confidence.reasons.map((r, i) => (
                <p key={i} className="text-xs text-slate-500">• {r}</p>
              ))}
            </div>
          )}

          {/* Secondary deltas */}
          {result.comparison && Object.keys(result.comparison.secondaryDeltas).length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-400 mb-1">Secondary Metrics</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Object.entries(result.comparison.secondaryDeltas).map(([metric, d]) => (
                  <div key={metric} className="rounded-lg bg-slate-800/30 px-2 py-1.5">
                    <p className="text-xs text-slate-600">{metric}</p>
                    <p className={`text-xs font-medium ${d.lift > 0 ? "text-emerald-400" : d.lift < 0 ? "text-rose-400" : "text-slate-400"}`}>
                      {d.lift > 0 ? "+" : ""}{fmtPct(d.lift)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Source linkage */}
          <div className="rounded-lg bg-slate-800/30 px-3 py-2">
            <p className="text-xs font-medium text-slate-400 mb-1">Source</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div>
                <dt className="text-slate-600">Intent</dt>
                <dd className="text-slate-300">{result.variationIntent ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-600">Plan ID</dt>
                <dd className="text-slate-400 truncate">{result.planId}</dd>
              </div>
            </dl>
          </div>

          {result.recommendedNote && (
            <p className="text-xs text-slate-500 italic">{result.recommendedNote}</p>
          )}
        </>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onToggle} className="text-xs text-emerald-500 hover:text-emerald-400">
          {expanded ? "Hide details" : "Show details"}
        </button>
        <Link href="/creative-lab/image-variations/launch" className="text-xs text-slate-500 hover:text-slate-300">
          Open Launch Plan
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variant snapshot card
// ---------------------------------------------------------------------------

function VariantCard({
  label,
  snapshot,
  isChallenger,
}: {
  label:         string;
  snapshot:      ImageVariationTestResult["controlSnapshot"];
  isChallenger?: boolean;
}) {
  if (!snapshot) return null;

  return (
    <div className={`rounded-lg border px-3 py-2 ${
      isChallenger ? "border-emerald-800/40 bg-emerald-950/20" : "border-slate-700 bg-slate-800/40"
    }`}>
      <p className={`text-xs font-medium mb-1.5 ${isChallenger ? "text-emerald-500" : "text-slate-500"}`}>
        {label}
      </p>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <div>
          <dt className="text-slate-600">Spend</dt>
          <dd className="text-slate-300">{fmtDollar(snapshot.spend)}</dd>
        </div>
        <div>
          <dt className="text-slate-600">Revenue</dt>
          <dd className="text-slate-300">{fmtDollar(snapshot.revenue)}</dd>
        </div>
        <div>
          <dt className="text-slate-600">ROAS</dt>
          <dd className="text-slate-300 font-medium">{fmt(snapshot.roas)}x</dd>
        </div>
        <div>
          <dt className="text-slate-600">CPA</dt>
          <dd className="text-slate-300">{fmtDollar(snapshot.cpa)}</dd>
        </div>
        <div>
          <dt className="text-slate-600">Orders</dt>
          <dd className="text-slate-300">{snapshot.orders}</dd>
        </div>
        <div>
          <dt className="text-slate-600">CTR</dt>
          <dd className="text-slate-300">{fmtPct(snapshot.ctr)}</dd>
        </div>
      </dl>
    </div>
  );
}
