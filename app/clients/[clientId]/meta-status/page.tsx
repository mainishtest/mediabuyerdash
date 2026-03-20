export const dynamic = "force-dynamic";

// app/clients/[clientId]/meta-status/page.tsx
// Dedicated full-detail Meta import status page for a client.
// Shows: verification summary → import counts → issues → debug panel → campaign preview.
// Useful for troubleshooting without navigating the full client page.

import Link                           from "next/link";
import { notFound }                   from "next/navigation";
import { getServerSession }            from "next-auth";
import { authOptions }                 from "../../../../lib/auth";
import { prisma }                      from "../../../../lib/db";
import { getClientMetaValidation }     from "../../../../lib/meta/clientMetaValidation";
import { getMetaImportStatus }         from "../../../../lib/meta/metaImportStatus";
import { getClientMetaData }           from "../../../../lib/meta/clientMetaService";
import { MetaVerificationSection }     from "../MetaVerificationSection";
import { MetaImportDebugPanel }        from "../MetaImportDebugPanel";
import { LiveMetaCampaignsSection }    from "../LiveMetaCampaignsSection";
import { PageContainer }               from "../../../../components/ui/PageContainer";

type PageProps = { params: { clientId: string } };

export async function generateMetadata({ params }: PageProps) {
  const account = await prisma.clientAccount.findUnique({
    where:  { id: params.clientId },
    select: { name: true },
  });
  return {
    title: account
      ? `Meta Status — ${account.name} — Media Buying Dashboard`
      : "Meta Status",
  };
}

export default async function ClientMetaStatusPage({ params }: PageProps) {
  const { clientId } = params;

  const account = await prisma.clientAccount.findUnique({
    where:  { id: clientId },
    select: { id: true, name: true },
  });
  if (!account) notFound();

  const session     = await getServerSession(authOptions);
  const workspaceId = session?.user?.workspaceId ?? null;

  // All data in parallel — no cascading waterfalls
  const [validation, importStatus, clientMetaData] = await Promise.all([
    getClientMetaValidation(clientId, workspaceId),
    getMetaImportStatus(clientId, workspaceId),
    getClientMetaData(clientId, workspaceId),
  ]);

  return (
    <PageContainer>
      {/* Breadcrumb nav */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-slate-500">
        <Link href="/clients" className="hover:text-slate-300">Clients</Link>
        <span>/</span>
        <Link href={`/clients/${clientId}`} className="hover:text-slate-300">{account.name}</Link>
        <span>/</span>
        <span className="text-slate-400">Meta Status</span>
      </nav>

      {/* Page header */}
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
          Meta Import Status
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Full pipeline verification for{" "}
          <strong className="font-medium text-slate-300">{account.name}</strong>.
          Use this page to diagnose why Meta data may not be appearing in the client dashboard.
        </p>
      </header>

      {/* ── Verification section (always visible, user-facing) ── */}
      <MetaVerificationSection clientId={clientId} validation={validation} />

      {/* ── Debug panel (collapsible, developer-facing) ── */}
      <div id="debug">
        <MetaImportDebugPanel clientId={clientId} status={importStatus} />
      </div>

      {/* ── Campaign data preview ── */}
      <section className="mb-8">
        <h2 className="mb-1 text-lg font-semibold text-slate-50">
          Campaign Data Preview
        </h2>
        <p className="mb-5 text-sm text-slate-400">
          Live synced campaign data from mapped Meta ad accounts.
          Confirms whether dashboard query returns results.
        </p>
        <LiveMetaCampaignsSection clientId={clientId} data={clientMetaData} />
      </section>

      {/* Docs reference */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/30 px-5 py-4 text-sm">
        <p className="font-medium text-slate-300">Setup checklist</p>
        <ol className="mt-2 list-decimal list-inside space-y-1 text-xs text-slate-500">
          <li>Connect Meta at <Link href="/integrations/meta" className="underline hover:text-slate-300">Integrations → Meta</Link> (OAuth)</li>
          <li>Select ad accounts to include in the workspace</li>
          <li>Assign an account to <strong className="text-slate-400">{account.name}</strong> using the Client Integrations section</li>
          <li>Run a Meta Sync from the Sync Status section on the client page</li>
          <li>Campaign data will appear in the Live Meta Campaigns section and dashboard</li>
        </ol>
        <p className="mt-3 text-xs text-slate-600">
          See <code className="font-mono">docs/meta-import-verification.md</code> for full troubleshooting guidance.
        </p>
      </div>
    </PageContainer>
  );
}
