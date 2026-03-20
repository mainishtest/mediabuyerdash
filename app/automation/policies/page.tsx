// app/automation/policies/page.tsx
// Server component — loads workspace clients and policy records, then renders
// the PoliciesView client component.

import { redirect }         from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions }      from "../../../lib/auth";
import { prisma }           from "../../../lib/db";
import {
  loadWorkspacePolicies,
  buildActionSafetySummaryFromPolicies,
  buildSystemDefaultPolicy,
} from "../../../lib/policy";
import { PoliciesView }     from "./PoliciesView";

export const dynamic = "force-dynamic";

export default async function PoliciesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const workspaceId = session.user.workspaceId ?? null;
  if (!workspaceId) redirect("/dashboard");

  // Load all clients for scope listing
  const clients = await prisma.clientAccount.findMany({
    where:   { workspaceId },
    orderBy: { name: "asc" },
    select:  { id: true, name: true },
  });

  // Load all active policies for the workspace
  const allPolicies = await loadWorkspacePolicies(workspaceId);

  // Build per-client summaries (client scope only — campaign/ad_account overrides shown inline)
  const clientSummaries = await Promise.all(
    clients.map(async (client) => {
      const clientPolicies = allPolicies.filter(
        (p) =>
          (p.scope === "client"     && p.scopeId === client.id) ||
          p.scope === "ad_account" ||
          p.scope === "campaign"
      );

      const summary = buildActionSafetySummaryFromPolicies(
        { workspaceId, clientId: client.id },
        clientPolicies
      );

      // Find explicit client-level policy if it exists
      const clientPolicy = allPolicies.find(
        (p) => p.scope === "client" && p.scopeId === client.id
      ) ?? buildSystemDefaultPolicy(workspaceId);

      return {
        client,
        policy: clientPolicy,
        summary,
      };
    })
  );

  // Workspace-level stats
  const stats = {
    totalClients:    clients.length,
    policiesSet:     allPolicies.filter((p) => p.scope === "client").length,
    usingDefault:    clients.length - allPolicies.filter((p) => p.scope === "client").length,
    overrideScopes:  allPolicies.filter(
      (p) => p.scope === "campaign" || p.scope === "ad_account"
    ).length,
  };

  return (
    <PoliciesView
      workspaceId={workspaceId}
      clientSummaries={clientSummaries}
      allPolicies={allPolicies}
      stats={stats}
    />
  );
}
