export const dynamic = "force-dynamic";

// app/automation/history/page.tsx
// Automation Audit History — server component.
// Loads combined audit data (native + bridged) and passes to HistoryView.

import { getServerSession }         from "next-auth";
import { authOptions }              from "../../../lib/auth";
import { prisma }                   from "../../../lib/db";
import { loadCombinedAuditHistory } from "../../../lib/auditLog";
import { summarizeAutomationHistory } from "../../../lib/auditLog";
import { HistoryView }              from "./HistoryView";

export async function generateMetadata() {
  return { title: "Audit History — Media Buying Dashboard" };
}

export default async function AuditHistoryPage() {
  const session     = await getServerSession(authOptions);
  const workspaceId = session?.user?.workspaceId ?? null;

  const [entries, clients] = await Promise.all([
    loadCombinedAuditHistory({ workspaceId, limit: 120 }).catch(() => []),
    prisma.clientAccount.findMany({
      where:   workspaceId ? { workspaceId } : {},
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }).catch(() => []),
  ]);

  const summary = summarizeAutomationHistory(entries);

  return (
    <HistoryView
      entries={entries}
      summary={summary}
      clients={clients}
    />
  );
}
