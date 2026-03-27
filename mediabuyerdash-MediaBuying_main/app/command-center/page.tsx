export const dynamic = "force-dynamic";

import { redirect }        from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions }      from "../../lib/auth";
import { buildCommandCenterPayload } from "../../lib/commandCenter/aggregator";
import { queryLearningMemory, buildLearningSummary } from "../../lib/learningMemory/aggregator";
import { CommandCenterView } from "./CommandCenterView";

type PageProps = {
  searchParams: {
    clientId?: string;
    from?: string;
    to?: string;
  };
};

export async function generateMetadata() {
  return { title: "Command Center — Media Buying Dashboard" };
}

export default async function CommandCenterPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const today         = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);

  const [payload, learningEntries] = await Promise.all([
    buildCommandCenterPayload({
      clientId: searchParams.clientId,
      dateFrom: searchParams.from ?? thirtyDaysAgo,
      dateTo:   searchParams.to   ?? today,
    }),
    queryLearningMemory({
      clientId: searchParams.clientId,
      dateFrom: thirtyDaysAgo,
      dateTo:   today,
      confidence: "high",
      limit: 10,
    }),
  ]);

  const learningSummary = buildLearningSummary(learningEntries, payload.clients);

  return (
    <CommandCenterView
      payload={payload}
      learningInsight={learningSummary.topInsight}
    />
  );
}
