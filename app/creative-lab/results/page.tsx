// app/creative-lab/results/page.tsx
// Creative Lab — Creative Test Results
//
// Accepts ?clientAccountId=xxx (optional) to scope the list.
// Server component — loads all test results and summary from DB.
// Passes to CreativeTestResultsView (client orchestrator).

export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  loadCreativeTestResults,
  buildCreativeTestResultDbSummary,
} from "../../../lib/creativeTestResults";
import { PageHeader, Badge, EmptyState } from "../../../components/ui";
import { CreativeTestResultsView } from "./CreativeTestResultsView";

export const metadata = {
  title: "Test Results — Creative Lab",
};

type Props = {
  searchParams: Promise<{ clientAccountId?: string }>;
};

export default async function CreativeTestResultsPage({ searchParams }: Props) {
  const params          = await searchParams;
  const clientAccountId = params.clientAccountId ?? undefined;

  const [results, summary] = await Promise.all([
    loadCreativeTestResults({ clientAccountId, limit: 100 }).catch(() => []),
    buildCreativeTestResultDbSummary(clientAccountId).catch(() => ({
      total: 0, pendingLaunch: 0, active: 0, evaluating: 0,
      completed: 0, stale: 0, blocked: 0,
      challengerWins: 0, controlHolds: 0, noWinner: 0,
    })),
  ]);

  if (results.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Test Results"
          description="Ingest performance data, compare control vs challenger, and track creative test outcomes."
          badge={<Badge variant="neutral">Creative Lab</Badge>}
          actions={
            <Link
              href="/creative-lab/launch"
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm
                font-medium text-slate-200 transition-colors hover:bg-slate-700"
            >
              ← Launch Plans
            </Link>
          }
        />

        <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/30 p-10">
          <EmptyState
            icon="◎"
            title="No test results yet"
            description="Create a test result from an experiment launch plan to start tracking creative performance. Once created, use Ingest to pull Meta delivery and CRM outcome data."
            action={
              <Link
                href="/creative-lab/launch"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Go to Launch Plans
              </Link>
            }
          />
        </div>

        <div className="flex flex-wrap gap-4 border-t border-slate-800/60 pt-4">
          <Link href="/creative-lab"              className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← Creative Lab</Link>
          <Link href="/creative-lab/publish-prep" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Publish Prep</Link>
          <Link href="/creative-lab/launch"       className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Launch Plans</Link>
          <Link href="/experiments"               className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Experiments →</Link>
        </div>
      </div>
    );
  }

  return (
    <CreativeTestResultsView
      initialResults={results}
      initialSummary={summary}
      clientAccountId={clientAccountId}
    />
  );
}
