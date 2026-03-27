// app/clients/page.tsx
// Clients list — server component.
// Queries all ClientAccounts in the current user's workspace and passes
// them to the client view for interactive display and creation.

export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { prisma } from "../../lib/db";
import { ClientsView } from "./ClientsView";
import type { SerializedClient } from "./ClientsView";

export const metadata = {
  title: "Clients — Media Buying Dashboard",
};

export default async function ClientsPage() {
  const session     = await getServerSession(authOptions);
  const workspaceId = session?.user?.workspaceId ?? null;

  // Fetch clients scoped to the workspace.
  const rawClients = workspaceId
    ? await prisma.clientAccount.findMany({
        where:   { workspaceId },
        orderBy: { createdAt: "desc" },
      })
    : [];

  // Serialize Dates for the client component.
  const clients: SerializedClient[] = rawClients.map((c) => ({
    id:        c.id,
    name:      c.name,
    brandName: c.brandName,
    status:    c.status,
    notes:     c.notes,
    createdAt: c.createdAt.toISOString().slice(0, 10),
  }));

  return (
    <ClientsView
      clients={clients}
      workspaceId={workspaceId}
    />
  );
}
