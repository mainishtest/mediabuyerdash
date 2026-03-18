// app/automation/auto-execution/page.tsx
// Server component — loads client settings and execution history, then renders
// the AutoExecutionView client component.

import { redirect }             from "next/navigation";
import { getServerSession }     from "next-auth";
import { authOptions }          from "../../../lib/auth";
import { prisma }               from "../../../lib/db";
import {
  getOrCreateAutoExecutionSettings,
  loadAutoExecutionHistory,
}                               from "../../../lib/autoExecution";
import { AutoExecutionView }    from "./AutoExecutionView";

export const dynamic = "force-dynamic";

export default async function AutoExecutionPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const workspaceId = session.user.workspaceId ?? null;

  // Load all client accounts for this workspace
  const clients = await prisma.clientAccount.findMany({
    where:   workspaceId ? { workspaceId } : {},
    orderBy: { name: "asc" },
    select:  { id: true, name: true },
  });

  // Load auto-execution settings for each client (creates defaults if missing)
  const settingsList = await Promise.all(
    clients.map((c) => getOrCreateAutoExecutionSettings(c.id, workspaceId))
  );

  // Merge client name into settings for display
  const clientSettings = settingsList.map((s) => ({
    ...s,
    clientName: clients.find((c) => c.id === s.clientAccountId)?.name ?? "Unknown",
  }));

  // Recent execution history
  const history = await loadAutoExecutionHistory(workspaceId, 50);

  return (
    <AutoExecutionView
      clientSettings={clientSettings}
      history={history}
    />
  );
}
