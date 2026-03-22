export const dynamic = "force-dynamic";

import { redirect }         from "next/navigation";
import { getServerSession }  from "next-auth";
import { authOptions }       from "../../lib/auth";
import { loadRecentBriefs }  from "../../lib/dailyBrief/scheduler";
import { BriefView }         from "./BriefView";
import type { DailyMorningBrief } from "../../types/dailyBrief";

export async function generateMetadata() {
  return { title: "Morning Brief — Media Buying Dashboard" };
}

export default async function BriefsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const workspaceId = session.user.workspaceId ?? null;
  const archive = await loadRecentBriefs(workspaceId, 30);

  // Parse the most recent brief
  let latestBrief: DailyMorningBrief | null = null;
  if (archive.length > 0) {
    try {
      latestBrief = JSON.parse(archive[0].briefJson) as DailyMorningBrief;
    } catch {
      // Malformed JSON — treat as no brief
    }
  }

  return <BriefView latestBrief={latestBrief} archive={archive} />;
}
