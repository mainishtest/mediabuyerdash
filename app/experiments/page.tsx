// app/experiments/page.tsx
// Experiment Results — closed-loop winner detection and learnings.
// Server component — loads experiments for the client from DB.

export const dynamic = "force-dynamic";

import Link                              from "next/link";
import {
  loadExperiments,
  loadExperimentById,
  buildExperimentSummary,
  buildEvaluationWindow,
}                                        from "../../lib/experiments";
import type { ExperimentWithResult }     from "../../types/experiment";
import {
  PageHeader,
  EmptyState,
}                                        from "../../components/ui";
import { ExperimentsView }              from "./ExperimentsView";

export const metadata = {
  title: "Experiment Results",
};

type Props = {
  searchParams: Promise<{ clientAccountId?: string }>;
};

export default async function ExperimentsPage({ searchParams }: Props) {
  const params          = await searchParams;
  const clientAccountId = params.clientAccountId ?? undefined;

  // Load plan list then hydrate each with result + learnings
  const [plans, summary] = await Promise.all([
    loadExperiments({ clientAccountId, limit: 40 }).catch(() => []),
    buildExperimentSummary(clientAccountId).catch(() => ({
      total: 0, active: 0, completed: 0, challengerWins: 0,
      controlHolds: 0, noWinner: 0, insufficient: 0,
    })),
  ]);

  // Hydrate each plan with result + learnings + evaluation window
  const experiments: ExperimentWithResult[] = await Promise.all(
    plans.map(async (plan) => {
      try {
        const full = await loadExperimentById(plan.id);
        return full ?? {
          ...plan,
          result:  null,
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

  if (experiments.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Experiment Results"
          description="Ingest performance data, detect winners, and capture learnings."
          actions={
            <Link
              href="/creative-lab/publish-prep"
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm
                font-medium text-slate-200 transition-colors hover:bg-slate-700"
            >
              ← Publish Prep
            </Link>
          }
        />
        <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/30 p-10">
          <EmptyState
            icon="⬡"
            title="No experiments yet"
            description="Experiments are created after launching a creative draft from the publish preparation workflow. Once a challenger creative is live, create an experiment to track control vs challenger performance."
            action={
              <Link
                href="/creative-lab/publish-prep"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Go to Publish Prep
              </Link>
            }
          />
        </div>
        <div className="flex flex-wrap gap-4 border-t border-slate-800/60 pt-4">
          <Link href="/creative-lab"              className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← Creative Lab</Link>
          <Link href="/creative-lab/publish-prep" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Publish Prep</Link>
          <Link href="/creative-lab/review"       className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Draft Review</Link>
        </div>
      </div>
    );
  }

  return (
    <ExperimentsView
      initialExperiments={experiments}
      initialSummary={summary}
      clientAccountId={clientAccountId}
    />
  );
}
