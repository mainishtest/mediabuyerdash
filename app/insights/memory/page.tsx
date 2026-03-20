export const dynamic = "force-dynamic";

import { redirect }         from "next/navigation";
import { getServerSession }  from "next-auth";
import { authOptions }       from "../../../lib/auth";
import { queryLearningMemory, buildLearningSummary } from "../../../lib/learningMemory/aggregator";
import { prisma }            from "../../../lib/db";
import { LearningMemoryView } from "./LearningMemoryView";

type PageProps = {
  searchParams: {
    clientId?:    string;
    from?:        string;
    to?:          string;
    sourceType?:  string;
    category?:    string;
    confidence?:  string;
  };
};

export async function generateMetadata() {
  return { title: "Learning Memory — Media Buying Dashboard" };
}

export default async function LearningMemoryPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const today         = new Date().toISOString().slice(0, 10);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);

  const [entries, clients] = await Promise.all([
    queryLearningMemory({
      clientId:    searchParams.clientId,
      dateFrom:    searchParams.from       ?? ninetyDaysAgo,
      dateTo:      searchParams.to         ?? today,
      sourceType:  searchParams.sourceType as never ?? undefined,
      category:    searchParams.category   as never ?? undefined,
      confidence:  searchParams.confidence as never ?? undefined,
      limit:       300,
    }).catch(() => []),
    prisma.clientAccount.findMany({
      where:   { status: "active" },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }).catch(() => []),
  ]);

  const summary = buildLearningSummary(entries, clients);

  return (
    <LearningMemoryView
      entries={entries}
      summary={summary}
      clients={clients}
      dateRange={{ from: searchParams.from ?? ninetyDaysAgo, to: searchParams.to ?? today }}
      selectedClientId={searchParams.clientId ?? ""}
    />
  );
}
