// app/creative-lab/outcomes/page.tsx
// Creative Lab — Creative Outcome Routing
//
// Accepts ?clientAccountId=xxx (optional) to scope the list.
// Server component — loads routes + summary from DB.
// Passes to CreativeOutcomeRoutingView (client orchestrator).

export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  loadCreativeOutcomeRoutes,
  buildCreativeOutcomeRoutingSummary,
} from "../../../lib/creativeOutcomeRouting";
import { PageHeader, Badge, EmptyState } from "../../../components/ui";
import { CreativeOutcomeRoutingView } from "./CreativeOutcomeRoutingView";

export const metadata = {
  title: "Outcome Routing — Creative Lab",
};

type Props = {
  searchParams: Promise<{ clientAccountId?: string }>;
};

export default async function CreativeOutcomesPage({ searchParams }: Props) {
  const params          = await searchParams;
  const clientAccountId = params.clientAccountId ?? undefined;

  const [routes, summary] = await Promise.all([
    loadCreativeOutcomeRoutes({ clientAccountId, limit: 100 }).catch(() => []),
    buildCreativeOutcomeRoutingSummary(clientAccountId).catch(() => ({
      total: 0, pendingAction: 0, actioned: 0, archived: 0,
      learningCaptured: 0, winnerRoutes: 0, loserRoutes: 0,
      mixedRoutes: 0, monitorRoutes: 0,
    })),
  ]);

  if (routes.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Outcome Routing"
          description="Route test results to the right next workflow — scale, iterate, follow-up, or monitor."
          badge={<Badge variant="neutral">Creative Lab</Badge>}
          actions={
            <Link
              href="/creative-lab/results"
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm
                font-medium text-slate-200 transition-colors hover:bg-slate-700"
            >
              ← Test Results
            </Link>
          }
        />

        <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/30 p-10">
          <EmptyState
            icon="⇢"
            title="No outcome routes yet"
            description="Ingest a completed test result and use the Route button to generate a routing decision. Routes capture where a test result should go next — scale review, creative iteration, follow-up test, or monitoring."
            action={
              <Link
                href="/creative-lab/results"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Go to Test Results
              </Link>
            }
          />
        </div>

        <div className="flex flex-wrap gap-4 border-t border-slate-800/60 pt-4">
          <Link href="/creative-lab"         className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← Creative Lab</Link>
          <Link href="/creative-lab/results" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Test Results</Link>
          <Link href="/creative-lab/launch"  className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Launch Plans</Link>
          <Link href="/experiments"          className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Experiments →</Link>
        </div>
      </div>
    );
  }

  return (
    <CreativeOutcomeRoutingView
      initialRoutes={routes}
      initialSummary={summary}
      clientAccountId={clientAccountId}
    />
  );
}
