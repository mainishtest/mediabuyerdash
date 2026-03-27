export const dynamic = "force-dynamic";

// Redirect to the first client's settings page.
// If multiple clients exist, shows a picker.

import { redirect }       from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions }    from "../../../lib/auth";
import { prisma }         from "../../../lib/db";
import Link               from "next/link";
import { PageHeader, SectionCard } from "../../../components/ui";

export const metadata = { title: "Client Settings" };

export default async function ClientSettingsRedirectPage() {
  const session     = await getServerSession(authOptions);
  const workspaceId = session?.user?.workspaceId ?? null;

  const clients = await prisma.clientAccount.findMany({
    where:   workspaceId ? { workspaceId } : {},
    select:  { id: true, name: true, brandName: true },
    orderBy: { name: "asc" },
  });

  // Single client — go directly to their settings
  if (clients.length === 1) {
    redirect(`/clients/${clients[0].id}/settings`);
  }

  // No clients
  if (clients.length === 0) {
    redirect("/clients");
  }

  // Multiple clients — show picker
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <PageHeader
        title="Client Settings"
        description="Select a client to manage their copywriting prompts, campaign defaults, and image library."
      />
      <SectionCard>
        <div className="space-y-2">
          {clients.map((client) => (
            <Link
              key={client.id}
              href={`/clients/${client.id}/settings`}
              className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/40
                px-4 py-3 text-sm transition-colors hover:bg-slate-700"
            >
              <div>
                <p className="font-medium text-white">{client.name}</p>
                {client.brandName && (
                  <p className="text-xs text-slate-500">{client.brandName}</p>
                )}
              </div>
              <span className="text-xs text-slate-500">Settings →</span>
            </Link>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
