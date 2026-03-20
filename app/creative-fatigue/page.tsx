// app/creative-fatigue/page.tsx
// Server component — loads creative performance data, runs fatigue detection,
// and passes results to the CreativeFatigueView client component.

export const dynamic = "force-dynamic";

import { getServerSession }                 from "next-auth";
import { authOptions }                      from "../../lib/auth";
import {
  loadCreativePerformanceData,
  buildCreativePerformanceSnapshots,
}                                           from "../../lib/creativelab/performance";
import {
  buildCreativeFatigueReport,
  getOverallHealthCounts,
}                                           from "../../lib/creativeFatigue";
import { CreativeFatigueView }              from "./CreativeFatigueView";

export async function generateMetadata() {
  return { title: "Creative Fatigue — Media Buying Dashboard" };
}

export default async function CreativeFatiguePage() {
  const session     = await getServerSession(authOptions);
  const workspaceId = session?.user?.workspaceId ?? null;

  // Reuse existing data loading pipeline — no duplication
  const data = await loadCreativePerformanceData(workspaceId).catch(() => null);

  if (!data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-500 text-sm">
        Creative fatigue data could not be loaded. Please try refreshing.
      </div>
    );
  }

  const snapshots = buildCreativePerformanceSnapshots(data);
  const summaries = buildCreativeFatigueReport(snapshots);
  const counts    = getOverallHealthCounts(summaries);

  return (
    <CreativeFatigueView
      summaries={summaries}
      counts={counts}
    />
  );
}
