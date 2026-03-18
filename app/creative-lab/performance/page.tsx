export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions }      from "../../../lib/auth";
import {
  loadCreativePerformanceData,
  buildCreativePerformanceSnapshots,
  diagnoseCreative,
  buildCreativeOpportunities,
} from "../../../lib/creativelab/performance";
import { PerformanceView } from "./PerformanceView";

export async function generateMetadata() {
  return { title: "Creative Performance — Media Buying Dashboard" };
}

export default async function CreativePerformancePage() {
  const session     = await getServerSession(authOptions);
  const workspaceId = session?.user?.workspaceId ?? null;

  const data         = await loadCreativePerformanceData(workspaceId);
  const snapshots    = buildCreativePerformanceSnapshots(data);
  const diagnostics  = snapshots.map((s) => diagnoseCreative(s));
  const opportunities = buildCreativeOpportunities(snapshots);

  return (
    <PerformanceView
      snapshots={snapshots}
      diagnostics={diagnostics}
      opportunities={opportunities}
    />
  );
}
