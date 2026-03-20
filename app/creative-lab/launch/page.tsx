// app/creative-lab/launch/page.tsx
// Creative Lab — Experiment Launch Wiring
//
// Accepts ?clientAccountId=xxx (optional) to scope the list.
// Server component — loads all launch plans for the client from DB.
// Passes to LaunchWiringView (client orchestrator).

export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  loadExperimentLaunchPlans,
  buildExperimentLaunchPlanSummary,
} from "../../../lib/experimentLaunch";
import { PageHeader, Badge, EmptyState } from "../../../components/ui";
import { LaunchWiringView } from "./LaunchWiringView";

export const metadata = {
  title: "Experiment Launch Wiring — Creative Lab",
};

type Props = {
  searchParams: Promise<{ clientAccountId?: string }>;
};

export default async function LaunchWiringPage({ searchParams }: Props) {
  const params          = await searchParams;
  const clientAccountId = params.clientAccountId ?? undefined;

  const [plans, summary] = await Promise.all([
    loadExperimentLaunchPlans({ clientAccountId, limit: 50 }).catch(() => []),
    buildExperimentLaunchPlanSummary(clientAccountId).catch(() => ({
      total: 0, draft: 0, needsMapping: 0, needsApproval: 0,
      readyForLaunch: 0, blocked: 0, launched: 0,
    })),
  ]);

  if (plans.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Experiment Launch Wiring"
          description="Wire approved creative drafts into structured test plans with control/challenger mapping, success criteria, and guardrails."
          badge={<Badge variant="neutral">Creative Lab</Badge>}
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
            title="No experiment launch plans yet"
            description="Approve and publish-prep a creative draft first, then create an experiment launch plan here to wire it against a control creative with success criteria and guardrails."
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
          <Link href="/creative-lab/review"       className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Draft Review</Link>
          <Link href="/creative-lab/publish-prep" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Publish Prep</Link>
          <Link href="/experiments"               className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Experiments →</Link>
        </div>
      </div>
    );
  }

  return (
    <LaunchWiringView
      initialPlans={plans}
      initialSummary={summary}
      clientAccountId={clientAccountId}
    />
  );
}
