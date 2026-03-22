export const dynamic = "force-dynamic";

// app/admin/page.tsx
// Admin area — client management, connections, and workspace settings.

import { getServerSession } from "next-auth";
import { redirect }         from "next/navigation";
import { authOptions }       from "../../lib/auth";
import { prisma }            from "../../lib/db";
import { AdminView }         from "./AdminView";

export const metadata = {
  title: "Admin — Media Buying Dashboard",
};

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const workspaceId = session.user.workspaceId ?? null;

  const [clients, metaConnections, shopifyConnections] = await Promise.all([
    prisma.clientAccount
      .findMany({
        where:   workspaceId ? { workspaceId } : {},
        orderBy: { name: "asc" },
        select: {
          id:        true,
          name:      true,
          brandName: true,
          platform:  true,
          currency:  true,
          timezone:  true,
          status:    true,
          notes:     true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              campaigns:               true,
              utmPerformanceRows:      true,
              reconciliationSummaries: true,
              alertEvents:             true,
              metaSelectedAccounts:    true,
              shopifyConnections:      true,
            },
          },
        },
      })
      .catch(() => []),

    prisma.metaConnection
      .findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id:                true,
          userDisplayName:   true,
          connectionStatus:  true,
          tokenExpiresAt:    true,
          createdAt:         true,
          selectedAccounts: {
            select: {
              id:              true,
              clientAccountId: true,
              accessibleAdAccount: {
                select: { externalAdAccountId: true, accountName: true },
              },
            },
          },
        },
      })
      .catch(() => []),

    prisma.shopifyConnection
      .findMany({
        where:   workspaceId ? { workspaceId } : {},
        orderBy: { installedAt: "desc" },
        select: {
          id:               true,
          shopDomain:       true,
          connectionStatus: true,
          clientAccountId:  true,
          installedAt:      true,
        },
      })
      .catch(() => []),
  ]);

  // Serialize dates
  const serializedClients = clients.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString().slice(0, 10),
    updatedAt: c.updatedAt.toISOString().slice(0, 10),
  }));

  const serializedMeta = metaConnections.map((c) => ({
    ...c,
    tokenExpiresAt: c.tokenExpiresAt?.toISOString() ?? null,
    createdAt:      c.createdAt.toISOString().slice(0, 10),
  }));

  const serializedShopify = shopifyConnections.map((c) => ({
    ...c,
    installedAt: c.installedAt.toISOString().slice(0, 10),
  }));

  return (
    <AdminView
      clients={serializedClients}
      metaConnections={serializedMeta}
      shopifyConnections={serializedShopify}
      workspaceId={workspaceId}
    />
  );
}
