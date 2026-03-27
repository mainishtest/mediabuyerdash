export const dynamic = "force-dynamic";

// app/dashboard/page.tsx
// Operator dashboard — entry point after login.
// If the workspace has no clients yet, redirects to /onboarding.

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { prisma } from "../../lib/db";
import { DashboardView } from "./DashboardView";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const workspaceId = session?.user?.workspaceId ?? null;

  // ── Fetch workspace stats in parallel ────────────────────────────────────────
  const [clientCount, metaCount, shopifyCount, lastSyncLog, recentClients] =
    await Promise.all([
      workspaceId
        ? prisma.clientAccount.count({ where: { workspaceId } })
        : Promise.resolve(0),

      workspaceId
        ? prisma.metaSelectedAdAccount.count({
            where: { clientAccount: { workspaceId } },
          })
        : Promise.resolve(0),

      workspaceId
        ? prisma.shopifyConnection.count({
            where: { clientAccount: { workspaceId } },
          })
        : Promise.resolve(0),

      // MetaSyncLog is connection-scoped, not workspace-scoped — shows global last sync time
      prisma.metaSyncLog.findFirst({
        where: { completedAt: { not: null } },
        orderBy: { completedAt: "desc" },
      }),

      workspaceId
        ? prisma.clientAccount.findMany({
            where: { workspaceId },
            orderBy: { createdAt: "desc" },
            take: 6,
          })
        : Promise.resolve([]),
    ]);

  // First-time user: no clients → guided onboarding
  if (workspaceId && clientCount === 0) {
    redirect("/onboarding");
  }

  return (
    <DashboardView
      workspaceName={session?.user?.workspaceName ?? "Your Workspace"}
      userEmail={session?.user?.email ?? ""}
      stats={{
        clientCount,
        metaCount,
        shopifyCount,
        lastSyncAt: lastSyncLog?.completedAt?.toISOString() ?? null,
      }}
      recentClients={recentClients.map((c) => ({
        id:        c.id,
        name:      c.name,
        brandName: c.brandName ?? null,
        status:    c.status,
        createdAt: c.createdAt.toISOString(),
      }))}
    />
  );
}
