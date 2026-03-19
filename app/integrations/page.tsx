export const dynamic = "force-dynamic";

// app/integrations/page.tsx
// Workspace-level integrations overview.
// Shows all Meta connections and Shopify connections in the workspace.
// Per-client mapping is managed at /clients/[clientId].

import Link               from "next/link";
import { getServerSession } from "next-auth";
import { authOptions }    from "../../lib/auth";
import { prisma }         from "../../lib/db";
import { PageHeader, SectionCard, Badge, EmptyState } from "../../components/ui";

export const metadata = {
  title: "Integrations — Media Buying Dashboard",
};

export default async function IntegrationsPage() {
  const session     = await getServerSession(authOptions);
  const workspaceId = session?.user?.workspaceId ?? null;

  // Load Meta connections (no workspaceId field — global to the instance)
  const metaConnections = await prisma.metaConnection.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id:              true,
      userDisplayName: true,
      connectionStatus: true,
      tokenExpiresAt:  true,
      createdAt:       true,
      selectedAdAccounts: {
        select: {
          id:              true,
          clientAccountId: true,
          accessibleAdAccount: {
            select: { externalAdAccountId: true, name: true },
          },
        },
      },
    },
  });

  // Load workspace Shopify connections
  const shopifyConnections = await prisma.shopifyConnection.findMany({
    where:   workspaceId ? { workspaceId } : {},
    orderBy: { installedAt: "desc" },
    select: {
      id:               true,
      shopDomain:       true,
      connectionStatus: true,
      clientAccountId:  true,
      installedAt:      true,
    },
  });

  // Load clients for name lookup
  const clients = await prisma.clientAccount.findMany({
    where:   workspaceId ? { workspaceId } : {},
    select:  { id: true, name: true },
  });
  const clientNameById = new Map(clients.map((c) => [c.id, c.name]));

  const TH = "px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500";
  const TD = "px-4 py-3 text-sm text-slate-300";

  return (
    <div className="space-y-0">
      <PageHeader
        title="Integrations"
        description="Workspace-level overview of Meta and Shopify connections. Manage per-client mappings from the client detail page."
      />

      {/* Meta Connections */}
      <SectionCard
        title="Meta Connections"
        description="OAuth connections to Meta Ads accounts."
        flush
        className="mb-8"
      >
        {metaConnections.length === 0 ? (
          <EmptyState
            icon="◎"
            title="No Meta connections"
            description="Connect a Meta account from a client's setup page."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className={TH}>User</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Mapped Accounts</th>
                  <th className={TH}>Token Expires</th>
                  <th className={TH}>Connected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {metaConnections.map((conn) => {
                  const isActive  = conn.connectionStatus === "active";
                  const isExpired = conn.tokenExpiresAt && new Date(conn.tokenExpiresAt) < new Date();
                  const mapped    = conn.selectedAdAccounts.filter((a) => a.clientAccountId);
                  return (
                    <tr key={conn.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className={`${TD} font-medium text-white`}>
                        {conn.userDisplayName || "—"}
                      </td>
                      <td className={TD}>
                        <Badge variant={isActive && !isExpired ? "success" : "danger"}>
                          {isExpired ? "Token expired" : (isActive ? "Active" : conn.connectionStatus)}
                        </Badge>
                      </td>
                      <td className={TD}>
                        {mapped.length === 0 ? (
                          <span className="text-slate-600">No mapped accounts</span>
                        ) : (
                          <div className="space-y-0.5">
                            {mapped.map((a) => (
                              <div key={a.id} className="text-xs">
                                <span className="text-slate-400">{a.accessibleAdAccount?.name ?? a.accessibleAdAccount?.externalAdAccountId}</span>
                                {a.clientAccountId && (
                                  <span className="ml-1.5 text-slate-600">
                                    → {clientNameById.get(a.clientAccountId) ?? a.clientAccountId}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className={TD}>
                        {conn.tokenExpiresAt
                          ? new Date(conn.tokenExpiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                          : "—"}
                      </td>
                      <td className={TD}>
                        {new Date(conn.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Shopify Connections */}
      <SectionCard
        title="Shopify Connections"
        description="Connected Shopify stores used as the CRM source of truth for ROAS and CPA."
        flush
        className="mb-8"
      >
        {shopifyConnections.length === 0 ? (
          <EmptyState
            icon="◎"
            title="No Shopify connections"
            description="Connect a Shopify store from a client's setup page."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className={TH}>Store</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Mapped Client</th>
                  <th className={TH}>Connected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {shopifyConnections.map((conn) => {
                  const isActive = conn.connectionStatus === "active";
                  return (
                    <tr key={conn.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className={`${TD} font-medium text-white`}>
                        {conn.shopDomain}
                      </td>
                      <td className={TD}>
                        <Badge variant={isActive ? "success" : "neutral"}>
                          {isActive ? "Active" : conn.connectionStatus}
                        </Badge>
                      </td>
                      <td className={TD}>
                        {conn.clientAccountId ? (
                          <Link
                            href={`/clients/${conn.clientAccountId}`}
                            className="text-indigo-400 hover:text-indigo-300 underline"
                          >
                            {clientNameById.get(conn.clientAccountId) ?? conn.clientAccountId}
                          </Link>
                        ) : (
                          <span className="text-slate-600">Unmapped</span>
                        )}
                      </td>
                      <td className={TD}>
                        {new Date(conn.installedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-4 text-sm text-slate-500">
        To connect or remap integrations, go to{" "}
        <Link href="/clients" className="text-slate-300 underline hover:text-white">
          Clients
        </Link>{" "}
        and open a client&apos;s setup page.
      </div>
    </div>
  );
}
