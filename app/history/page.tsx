export const dynamic = "force-dynamic";

import { redirect }         from "next/navigation";
import { getServerSession }  from "next-auth";
import { authOptions }       from "../../lib/auth";
import { prisma }            from "../../lib/db";
import { buildActionHistoryTimeline } from "../../lib/actionHistory/aggregator";
import { linkActionHistoryToOutcomes } from "../../lib/actionHistory/linker";
import { HistoryView }       from "./HistoryView";

export async function generateMetadata() {
  return { title: "Action History — Media Buying Dashboard" };
}

export default async function HistoryPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const workspaceId = session.user.workspaceId ?? null;

  // Load timeline entries and clients in parallel
  const [entries, clients] = await Promise.all([
    buildActionHistoryTimeline({
      workspaceId,
      limit: 150,
    }),
    prisma.clientAccount.findMany({
      where: {
        status: "active",
        ...(workspaceId ? { workspaceId } : {}),
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Link entries to outcomes (best-effort)
  const linked = await linkActionHistoryToOutcomes(entries);

  return (
    <HistoryView
      entries={linked}
      clients={clients.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
