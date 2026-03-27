export const dynamic = "force-dynamic";

// app/clients/[clientId]/setup/page.tsx
// Server page for the first live client setup path.
//
// Data flow:
//   1. Load client from DB (404 if not found)
//   2. Fetch integration status + sync history in parallel (reuse existing lib fns)
//   3. Run pure evaluator → ClientSetupSummary
//   4. Pass to ClientSetupView (client component)
//
// This page does NOT replace /clients/[clientId] — it orchestrates the setup
// journey and links users into the existing pages at each step.

import { notFound }                    from "next/navigation";
import { prisma }                      from "../../../../lib/db";
import { getClientIntegrationStatus }  from "../../../../lib/clientIntegrations";
import { getClientSyncStatusSummary }  from "../../../../lib/clientSync/db";
import { evaluateClientSetup }         from "../../../../lib/clientSetup/evaluator";
import { ClientSetupView }             from "./ClientSetupView";

type Props = { params: { clientId: string } };

export async function generateMetadata({ params }: Props) {
  const account = await prisma.clientAccount.findUnique({
    where: { id: params.clientId },
    select: { name: true },
  });
  return {
    title: account
      ? `Setup: ${account.name} — Media Buying Dashboard`
      : "Client Setup",
  };
}

export default async function ClientSetupPage({ params }: Props) {
  const { clientId } = params;

  // ── Load client ────────────────────────────────────────────────────────────
  const account = await prisma.clientAccount.findUnique({
    where:  { id: clientId },
    select: { id: true, name: true },
  });

  if (!account) notFound();

  // ── Fetch integration + sync state in parallel ─────────────────────────────
  const [integrations, syncStatus] = await Promise.all([
    getClientIntegrationStatus(clientId),
    getClientSyncStatusSummary(clientId),
  ]);

  // ── Evaluate setup state (pure function, no DB) ────────────────────────────
  const setupSummary = evaluateClientSetup(
    clientId,
    account.name,
    integrations,
    syncStatus,
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <ClientSetupView
      clientId={clientId}
      clientName={account.name}
      setupSummary={setupSummary}
    />
  );
}
