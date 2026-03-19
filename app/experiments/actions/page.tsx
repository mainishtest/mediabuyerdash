// app/experiments/actions/page.tsx
// Outcome Actions Dashboard — shows all outstanding action recommendations
// across completed experiments, scoped to an optional client.
//
// Server component: loads completed experiments, computes recommendations,
// ranks by priority. Client interactions handled by OutcomeActionsPanel.

export const dynamic = "force-dynamic";

import Link                          from "next/link";
import {
  loadExperiments,
  loadExperimentById,
  buildEvaluationWindow,
}                                    from "../../../lib/experiments";
import {
  buildOutcomeActionRecommendations,
  summarizeOutcomeActions,
}                                    from "../../../lib/outcomeActions";
import {
  ACTION_PRIORITY_COLOR,
  ACTION_TYPE_LABEL,
  READINESS_LABEL,
  READINESS_COLOR,
}                                    from "../../../types/outcomeActions";
import type { ExperimentWithResult } from "../../../types/experiment";
import {
  PageHeader,
  SectionCard,
  StatCard,
  EmptyState,
}                                    from "../../../components/ui";
import { OutcomeActionsPanel }       from "../OutcomeActionsPanel";

export const metadata = {
  title: "Outcome Actions — Experiments",
};

type Props = {
  searchParams: Promise<{ clientAccountId?: string }>;
};

export default async function OutcomeActionsPage({ searchParams }: Props) {
  const params          = await searchParams;
  const clientAccountId = params.clientAccountId ?? undefined;

  // Load completed experiments
  const plans = await loadExperiments({ clientAccountId, status: "completed", limit: 30 }).catch(() => []);

  // Hydrate with result + learnings + evaluation window
  const experiments: ExperimentWithResult[] = await Promise.all(
    plans.map(async (plan) => {
      try {
        const full = await loadExperimentById(plan.id);
        return full ?? {
          ...plan,
          result: null,
          learnings: [],
          evaluationWindow: buildEvaluationWindow(plan.startedAt, plan.evaluationWindowDays, plan.evaluationEndsAt),
        };
      } catch {
        return {
          ...plan,
          result: null,
          learnings: [],
          evaluationWindow: buildEvaluationWindow(plan.startedAt, plan.evaluationWindowDays, plan.evaluationEndsAt),
        };
      }
    }),
  );

  // Build recommendations and summaries for each
  const experimentActions = experiments.map((exp) => {
    const recs    = buildOutcomeActionRecommendations(exp);
    const summary = summarizeOutcomeActions(exp.id, exp.name, exp.result?.outcome ?? "not_evaluated", recs);
    return { experiment: exp, recs, summary };
  });

  // Sort by urgency: urgent → high → medium → low
  const sorted = [...experimentActions].sort((a, b) => {
    const pOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    const ap = a.summary.topPriority ? pOrder[a.summary.topPriority] : 4;
    const bp = b.summary.topPriority ? pOrder[b.summary.topPriority] : 4;
    return ap - bp;
  });

  // Aggregate counts
  const totalUrgent      = experimentActions.reduce((s, ea) => s + ea.summary.urgentCount, 0);
  const totalHigh        = experimentActions.reduce((s, ea) => s + ea.summary.highCount, 0);
  const totalReady       = experimentActions.reduce((s, ea) => s + ea.summary.readyForApproval, 0);
  const totalBlocked     = experimentActions.reduce((s, ea) => s + ea.summary.blockedCount, 0);

  if (experimentActions.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Outcome Actions"
          description="Guarded next-step recommendations for completed experiments."
          actions={
            <Link
              href="/experiments"
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm
                font-medium text-slate-200 transition-colors hover:bg-slate-700"
            >
              ← Experiments
            </Link>
          }
        />
        <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/30 p-10">
          <EmptyState
            icon="◆"
            title="No completed experiments yet"
            description="Outcome action recommendations appear after an experiment has been evaluated. Run an evaluation from the Experiments page to generate next-step actions."
            action={
              <Link
                href="/experiments"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Go to Experiments
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <PageHeader
        title="Outcome Actions"
        description="Guarded next-step recommendations based on experiment results."
        actions={
          <Link
            href="/experiments"
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm
              font-medium text-slate-200 transition-colors hover:bg-slate-700"
          >
            ← Experiments
          </Link>
        }
      />

      {/* ── Stat bar ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Urgent Actions"        value={totalUrgent}  sub="need immediate review" />
        <StatCard label="High Priority"         value={totalHigh}    sub="act soon" />
        <StatCard label="Ready for Approval"    value={totalReady}   sub="awaiting sign-off" />
        <StatCard label="Blocked"               value={totalBlocked} sub="resolve first" />
      </div>

      {/* ── Action plan cards ── */}
      <div className="space-y-8">
        {sorted.map(({ experiment, recs, summary }) => {
          const topPriColor = summary.topPriority ? ACTION_PRIORITY_COLOR[summary.topPriority] : "text-slate-500";
          const topAction   = summary.topActionType ? ACTION_TYPE_LABEL[summary.topActionType] : "None";

          return (
            <SectionCard
              key={experiment.id}
              title={experiment.name}
              description={
                <span className="flex flex-wrap items-center gap-3">
                  <span className="text-xs text-slate-500">
                    {experiment.result?.outcome?.replace(/_/g, " ") ?? "Not evaluated"}
                  </span>
                  <span className={`text-xs font-semibold ${topPriColor}`}>
                    Top: {topAction}
                  </span>
                  <span className="text-xs text-slate-600">
                    {summary.totalActions} action{summary.totalActions !== 1 ? "s" : ""} · {summary.readyForApproval} ready
                  </span>
                </span>
              }
            >
              <div className="mb-3 flex gap-2">
                <Link
                  href={`/experiments`}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  ↗ View experiment
                </Link>
                {experiment.challengerPrepItemId && (
                  <Link
                    href="/creative-lab/publish-prep"
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    ↗ Publish Prep
                  </Link>
                )}
              </div>
              <OutcomeActionsPanel
                experimentId={experiment.id}
                recommendations={recs}
              />
            </SectionCard>
          );
        })}
      </div>

      {/* Footer nav */}
      <div className="flex flex-wrap gap-4 border-t border-slate-800/60 pt-4">
        <Link href="/experiments"                className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← Experiments</Link>
        <Link href="/creative-lab/publish-prep"  className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Publish Prep</Link>
        <Link href="/creative-lab/review"        className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Draft Review</Link>
        <Link href="/automation"                 className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Automation</Link>
      </div>
    </div>
  );
}
