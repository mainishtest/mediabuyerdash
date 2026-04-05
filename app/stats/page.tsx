// /stats route — sidebar entry point.
// Reads ?clientId= from query params and redirects to the client-scoped Stats page.
// If no client is selected, shows a client picker.

export const dynamic = "force-dynamic";

import { prisma } from "../../lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function StatsRouterPage({
  searchParams,
}: {
  searchParams: { clientId?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.workspaceId) redirect("/login");

  // If a client is selected, redirect to the client-scoped Stats page
  if (searchParams.clientId) {
    redirect(`/clients/${searchParams.clientId}/stats`);
  }

  // Otherwise show a client picker
  const clients = await prisma.clientAccount.findMany({
    where: { workspaceId: session.user.workspaceId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="mx-auto max-w-xl px-6 py-12">
        <h1 className="mb-1 text-lg font-bold text-white">Stats</h1>
        <p className="mb-6 text-sm text-slate-500">Select a client to view performance stats.</p>

        {clients.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-5 py-8 text-center">
            <p className="text-sm text-slate-400">No clients found</p>
            <p className="mt-1 text-xs text-slate-600">Add a client from the Settings page first.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {clients.map(c => (
              <Link
                key={c.id}
                href={`/clients/${c.id}/stats`}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3
                  text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
              >
                {c.name}
                <svg className="h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
