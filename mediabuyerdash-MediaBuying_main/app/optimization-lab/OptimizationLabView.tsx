"use client";

import { useState } from "react";
import Link from "next/link";
import type {
  OptimizationRule,
  RuleEvaluationContext,
  RuleEvaluationResult,
  RuleRecommendation,
  RuleActionType,
  EntityLevel
} from "../../types/optimizationRules";

// ── Style maps ────────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<RuleActionType, string> = {
  increase_budget:          "Increase Budget",
  decrease_budget:          "Decrease Budget",
  pause_ad:                 "Pause Ad",
  mark_creative_fatigue:    "Mark Fatigued",
  send_alert:               "Send Alert",
  recommend_creative_refresh: "Refresh Creative"
};

const ACTION_STYLES: Record<RuleActionType, string> = {
  increase_budget:          "bg-emerald-900/60 text-emerald-300",
  decrease_budget:          "bg-rose-900/60 text-rose-300",
  pause_ad:                 "bg-rose-900/60 text-rose-300",
  mark_creative_fatigue:    "bg-orange-900/60 text-orange-300",
  send_alert:               "bg-amber-900/60 text-amber-300",
  recommend_creative_refresh: "bg-violet-900/60 text-violet-300"
};

const CONFIDENCE_STYLES: Record<string, string> = {
  high:   "bg-emerald-900/60 text-emerald-300",
  medium: "bg-amber-900/60 text-amber-300",
  low:    "bg-slate-700 text-slate-400"
};

const ENTITY_LEVEL_STYLES: Record<EntityLevel, string> = {
  campaign: "bg-blue-900/60 text-blue-300",
  adset:    "bg-violet-900/60 text-violet-300",
  ad:       "bg-slate-700 text-slate-300"
};

const ENTITY_LEVEL_LABELS: Record<EntityLevel, string> = {
  campaign: "Campaign",
  adset:    "Ad Set",
  ad:       "Ad"
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCurrency(n: number) { return `$${n.toFixed(2)}`; }
function fmtPct(n: number)      { return `${n.toFixed(1)}%`; }
function fmtRoas(n: number)     { return `${n.toFixed(2)}x`; }

function Badge({ label, style }: { label: string; style: string }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}

// ── Recommendation Card ───────────────────────────────────────────────────────

function RecommendationCard({ rec }: { rec: RuleRecommendation }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge label={ENTITY_LEVEL_LABELS[rec.entityLevel]} style={ENTITY_LEVEL_STYLES[rec.entityLevel]} />
        <Badge label={ACTION_LABELS[rec.recommendationType]} style={ACTION_STYLES[rec.recommendationType]} />
        <Badge label={rec.confidence.charAt(0).toUpperCase() + rec.confidence.slice(1)} style={CONFIDENCE_STYLES[rec.confidence]} />
      </div>
      <p className="text-sm font-semibold text-slate-100">{rec.entityName}</p>
      <p className="mt-1 text-sm font-medium text-slate-300">{rec.suggestedAction}</p>
      <p className="mt-1 text-xs text-slate-400">{rec.message}</p>
      <p className="mt-2 text-xs text-slate-500">Rule: {rec.ruleName}</p>
    </div>
  );
}

// ── Rule Config Panel ─────────────────────────────────────────────────────────

function RuleConfigPanel({ rules }: { rules: OptimizationRule[] }) {
  return (
    <section className="mb-10 rounded-xl border border-slate-800 bg-slate-900/60">
      <div className="border-b border-slate-800 px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-50">Active Rules</h2>
        <p className="mt-0.5 text-sm text-slate-400">
          Configured optimization rules. These produce recommendations only — no automatic execution.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-800/40">
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-widest text-slate-400">Rule</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-widest text-slate-400">Level</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-widest text-slate-400">Condition</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-widest text-slate-400">Lookback</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-widest text-slate-400">Action</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => {
              const { metric, operator, thresholdValue, lookbackWindowDays } = rule.condition;
              const thresholdLabel = thresholdValue === "goal" ? "goal" : String(thresholdValue);
              const operatorLabel = operator.replace(/_/g, " ");
              return (
                <tr key={rule.id} className="border-b border-slate-800 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-200">{rule.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{rule.description}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      label={rule.entityLevel === "any" ? "Any" : ENTITY_LEVEL_LABELS[rule.entityLevel as EntityLevel]}
                      style={rule.entityLevel === "any" ? "bg-slate-700 text-slate-300" : ENTITY_LEVEL_STYLES[rule.entityLevel as EntityLevel]}
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-300">
                    {metric.toUpperCase()} {operatorLabel} {thresholdLabel}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {lookbackWindowDays ? `${lookbackWindowDays}d` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      label={`${ACTION_LABELS[rule.actionType]}${rule.actionValue ? ` ${rule.actionValue}%` : ""}`}
                      style={ACTION_STYLES[rule.actionType]}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── Entity Evaluation Card ────────────────────────────────────────────────────

function EntityEvaluationCard({
  ctx,
  results
}: {
  ctx: RuleEvaluationContext;
  results: RuleEvaluationResult[];
}) {
  const triggeredResults = results.filter((r) => r.triggered);
  const { metrics, goals } = ctx;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60">
      <div className="border-b border-slate-800 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge label={ENTITY_LEVEL_LABELS[ctx.entityLevel]} style={ENTITY_LEVEL_STYLES[ctx.entityLevel]} />
          {triggeredResults.length > 0 && (
            <Badge label={`${triggeredResults.length} rule${triggeredResults.length > 1 ? "s" : ""} triggered`} style="bg-rose-900/60 text-rose-300" />
          )}
          {triggeredResults.length === 0 && (
            <Badge label="No issues" style="bg-emerald-900/60 text-emerald-300" />
          )}
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-100">{ctx.entityName}</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3 border-b border-slate-800 p-4 sm:grid-cols-6">
        <div>
          <p className="text-xs text-slate-500">CPA</p>
          <p className={`mt-0.5 text-sm font-semibold ${metrics.cpa > goals.cpaGoalValue ? "text-rose-400" : "text-emerald-400"}`}>
            {fmtCurrency(metrics.cpa)}
          </p>
          <p className="text-xs text-slate-600">goal {fmtCurrency(goals.cpaGoalValue)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">ROAS</p>
          <p className={`mt-0.5 text-sm font-semibold ${metrics.roas >= goals.roasGoalValue ? "text-emerald-400" : "text-rose-400"}`}>
            {fmtRoas(metrics.roas)}
          </p>
          <p className="text-xs text-slate-600">goal {fmtRoas(goals.roasGoalValue)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Spend</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-300">{fmtCurrency(metrics.spend)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Freq</p>
          <p className={`mt-0.5 text-sm font-semibold ${metrics.frequency > 4 ? "text-amber-400" : "text-slate-300"}`}>
            {metrics.frequency.toFixed(1)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">CTR</p>
          <p className={`mt-0.5 text-sm font-semibold ${metrics.ctr < 0.8 ? "text-amber-400" : "text-slate-300"}`}>
            {fmtPct(metrics.ctr)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Conv.</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-300">{metrics.conversions}</p>
        </div>
      </div>

      {/* Rule evaluation summary */}
      <div className="divide-y divide-slate-800">
        {results.map((r) => (
          <div key={r.ruleId} className="flex items-start gap-3 px-4 py-2.5">
            <span className={`mt-0.5 flex-shrink-0 text-xs font-medium ${r.triggered ? "text-rose-400" : "text-slate-600"}`}>
              {r.triggered ? "▲" : "–"}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-xs font-medium ${r.triggered ? "text-slate-200" : "text-slate-500"}`}>
                {r.ruleName}
              </p>
              {r.triggered && (
                <p className="mt-0.5 text-xs text-slate-400">
                  {r.conditionResult.actualValue.toFixed(2)} vs threshold {r.conditionResult.resolvedThreshold.toFixed(2)}
                  {r.conditionResult.daysTriggered > 0 && r.conditionResult.daysTriggered < 10 &&
                    ` — ${r.conditionResult.daysTriggered} day(s)`}
                </p>
              )}
            </div>
            {r.triggered && (
              <Badge label="Triggered" style="bg-rose-900/60 text-rose-300 flex-shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

type Props = {
  rules:           OptimizationRule[];
  contexts:        RuleEvaluationContext[];
  results:         RuleEvaluationResult[];
  recommendations: RuleRecommendation[];
};

const ALL_LEVELS = ["all", "campaign", "adset", "ad"] as const;
type LevelFilter = (typeof ALL_LEVELS)[number];

export function OptimizationLabView({ rules, contexts, results, recommendations }: Props) {
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");

  const filteredContexts = levelFilter === "all"
    ? contexts
    : contexts.filter((c) => c.entityLevel === levelFilter);

  const filteredRecommendations = levelFilter === "all"
    ? recommendations
    : recommendations.filter((r) => r.entityLevel === levelFilter);

  const totalTriggered = recommendations.length;
  const byType = recommendations.reduce<Partial<Record<RuleActionType, number>>>((acc, r) => {
    acc[r.recommendationType] = (acc[r.recommendationType] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      {/* Header */}
      <header className="mb-10">
        <Link href="/" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200">
          ← Back to Dashboard
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-50">
          Optimization Lab
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">
          Rule-based optimization engine. Evaluates performance metrics against configured rules and
          surfaces actionable recommendations. All outputs are recommendations only — no automatic execution.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <div className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs text-slate-400">
            {rules.length} rules configured
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs text-slate-400">
            {contexts.length} entities evaluated
          </div>
          <div className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${totalTriggered > 0 ? "border-rose-800/60 bg-rose-950/30 text-rose-300" : "border-emerald-800/60 bg-emerald-950/30 text-emerald-300"}`}>
            {totalTriggered} recommendation{totalTriggered !== 1 ? "s" : ""} generated
          </div>
        </div>
      </header>

      {/* Summary by action type */}
      {totalTriggered > 0 && (
        <section className="mb-8 flex flex-wrap gap-3">
          {(Object.entries(byType) as [RuleActionType, number][]).map(([type, count]) => (
            <div key={type} className={`flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2`}>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_STYLES[type]}`}>
                {ACTION_LABELS[type]}
              </span>
              <span className="text-sm font-semibold text-slate-200">{count}</span>
            </div>
          ))}
        </section>
      )}

      {/* Recommendations */}
      <section className="mb-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-50">Recommendations</h2>
          <div className="flex gap-2">
            {ALL_LEVELS.map((l) => (
              <button
                key={l}
                onClick={() => setLevelFilter(l)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  levelFilter === l
                    ? "bg-slate-700 text-slate-100"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {l.charAt(0).toUpperCase() + l.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {filteredRecommendations.length === 0 ? (
          <p className="rounded-xl border border-slate-800 bg-slate-900/60 px-6 py-8 text-center text-sm text-slate-500">
            No recommendations for this filter.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredRecommendations.map((rec, i) => (
              <RecommendationCard key={`${rec.ruleId}_${rec.entityId}_${i}`} rec={rec} />
            ))}
          </div>
        )}
      </section>

      {/* Rule configuration */}
      <RuleConfigPanel rules={rules} />

      {/* Entity evaluations */}
      <section>
        <h2 className="mb-4 text-xl font-semibold text-slate-50">Entity Evaluations</h2>
        <p className="mb-4 text-sm text-slate-400">
          Performance metrics, goal comparison, and per-rule evaluation results for each entity.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredContexts.map((ctx) => {
            const entityResults = results.filter(
              (r) => r.entityId === ctx.entityId
            );
            return (
              <EntityEvaluationCard
                key={ctx.entityId}
                ctx={ctx}
                results={entityResults}
              />
            );
          })}
        </div>
      </section>

      {/* Footer note */}
      <section className="mt-10 rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Architecture note</p>
        <p className="mt-1 text-sm text-slate-400">
          The rule engine is pure and deterministic — it takes performance context in and returns
          recommendations out. No side effects. Rules are configurable per client and extendable
          for automatic execution in a future version.
        </p>
      </section>
    </>
  );
}
