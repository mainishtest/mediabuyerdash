export const dynamic = "force-dynamic";

// app/onboarding/page.tsx
// First-login onboarding OR account readiness hub if clients already exist.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { prisma } from "../../lib/db";
import { OnboardingView } from "./OnboardingView";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const workspaceId = session?.user?.workspaceId ?? null;

  if (!workspaceId) {
    return (
      <OnboardingView workspaceName={session?.user?.workspaceName ?? "Your Workspace"} />
    );
  }

  const clients = await prisma.clientAccount.findMany({
    where:   { workspaceId },
    select:  { id: true, name: true, status: true, timezone: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  // No clients yet — show first-time setup
  if (clients.length === 0) {
    return (
      <OnboardingView workspaceName={session?.user?.workspaceName ?? "Your Workspace"} />
    );
  }

  // Has clients — show account readiness hub
  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">
              Account Readiness
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Check go-live readiness for each account before operating.
            </p>
          </div>
          <Link
            href="/clients"
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:border-slate-600 hover:text-slate-200"
          >
            + Add Account
          </Link>
        </div>

        <div className="space-y-3">
          {clients.map((client) => (
            <Link
              key={client.id}
              href={`/onboarding/${client.id}`}
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-4 transition-colors hover:border-slate-700"
            >
              <div>
                <p className="font-medium text-slate-200">{client.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {client.timezone} · Added {new Date(client.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                    client.status === "active"
                      ? "border-emerald-800 text-emerald-400"
                      : "border-slate-700 text-slate-500"
                  }`}
                >
                  {client.status}
                </span>
                <span className="text-slate-600">→</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
