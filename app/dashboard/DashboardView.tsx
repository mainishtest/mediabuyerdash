"use client";

// app/dashboard/DashboardView.tsx
// Operator command center — stat overview, recent clients, quick actions.

import Link from "next/link";
import { StatCard } from "../../components/ui/StatCard";
import { PageHeader } from "../../components/ui/PageHeader";
import { SectionCard } from "../../components/ui/SectionCard";
import { Badge } from "../../components/ui/Badge";
import type { BadgeVariant } from "../../components/ui/Badge";

// ── Types ─────────────────────────────────────────────────────────────────────

type RecentClient = {
  id:        string;
  name:      string;
  brandName: string | null;
  status:    string;
  createdAt: string;
};

type Stats = {
  clientCount:  number;
  metaCount:    number;
  shopifyCount: number;
  lastSyncAt:   string | null;
};

type Props = {
  workspaceName:  string;
  userEmail:      string;
  stats:          Stats;
  recentClients:  RecentClient[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusVariant(status: string): BadgeVariant {
  if (status === "active")   return "success";
  if (status === "paused")   return "warning";
  return "neutral";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day:   "numeric",
    year:  "numeric",
  });
}

function formatLastSync(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1)   return "Just now";
  if (diffMins < 60)  return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24)   return `${diffHrs}h ago`;
  return formatDate(iso);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DashboardView({
  workspaceName,
  stats,
  recentClients,
}: Props) {
  const { clientCount, metaCount, shopifyCount, lastSyncAt } = stats;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={workspaceName}
      />

      {/* Stat cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Clients"
          value={clientCount}
          sub="Active workspaces"
        />
        <StatCard
          label="Meta Accounts"
          value={metaCount}
          sub={metaCount === 0 ? "None connected" : "Connected"}
        />
        <StatCard
          label="Shopify Stores"
          value={shopifyCount}
          sub={shopifyCount === 0 ? "None connected" : "Connected"}
        />
        <StatCard
          label="Last Sync"
          value={formatLastSync(lastSyncAt)}
          sub={lastSyncAt ? formatDate(lastSyncAt) : "No syncs yet"}
        />
      </div>

      {/* Quick actions */}
      <div className="mb-8 flex flex-wrap gap-3">
        <Link
          href="/clients"
          className="rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm
            font-medium text-slate-200 transition-colors hover:bg-slate-700 hover:text-white"
        >
          + Add Client
        </Link>
        <Link
          href="/integrations/meta"
          className="rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm
            font-medium text-slate-200 transition-colors hover:bg-slate-700 hover:text-white"
        >
          Connect Meta
        </Link>
        <Link
          href="/integrations/shopify"
          className="rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm
            font-medium text-slate-200 transition-colors hover:bg-slate-700 hover:text-white"
        >
          Connect Shopify
        </Link>
      </div>

      {/* Recent Clients */}
      <SectionCard
        title="Recent Clients"
        description="Your most recently added client accounts."
        actions={
          <Link
            href="/clients"
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            View all →
          </Link>
        }
        flush
      >
        {recentClients.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <p className="text-sm font-medium text-slate-300">No clients yet</p>
            <p className="mt-1 text-xs text-slate-500">
              Create your first client to get started.
            </p>
            <Link
              href="/clients"
              className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium
                text-white transition-colors hover:bg-emerald-500"
            >
              + Add First Client
            </Link>
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                {["Client", "Brand", "Status", "Added"].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-xs font-semibold uppercase
                      tracking-widest text-slate-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentClients.map((client, i) => (
                <tr
                  key={client.id}
                  className={
                    i < recentClients.length - 1
                      ? "border-b border-slate-800/60"
                      : ""
                  }
                >
                  <td className="px-5 py-3">
                    <Link
                      href={`/clients/${client.id}`}
                      className="font-medium text-slate-200 hover:text-white transition-colors"
                    >
                      {client.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-400">
                    {client.brandName ?? <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-5 py-3">
                    <Badge variant={statusVariant(client.status)}>
                      {client.status.charAt(0).toUpperCase() + client.status.slice(1)}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-slate-500 text-xs">
                    {formatDate(client.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      {/* Getting started guide — shown when integrations are empty */}
      {(metaCount === 0 || shopifyCount === 0) && (
        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-200">
            Getting started
          </h3>
          <ul className="space-y-2.5">
            <li className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full
                  text-xs font-bold ${
                    clientCount > 0
                      ? "bg-emerald-700 text-emerald-200"
                      : "bg-slate-800 text-slate-500"
                  }`}
              >
                {clientCount > 0 ? "✓" : "1"}
              </span>
              <div>
                <p className="text-sm text-slate-300">Create your first client</p>
                <p className="text-xs text-slate-500">
                  Add a client account to organize campaigns and connections.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full
                  text-xs font-bold ${
                    metaCount > 0
                      ? "bg-emerald-700 text-emerald-200"
                      : "bg-slate-800 text-slate-500"
                  }`}
              >
                {metaCount > 0 ? "✓" : "2"}
              </span>
              <div>
                <p className="text-sm text-slate-300">Connect a Meta ad account</p>
                <p className="text-xs text-slate-500">
                  Sync campaigns, ad sets, and delivery metrics from Meta.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full
                  text-xs font-bold ${
                    shopifyCount > 0
                      ? "bg-emerald-700 text-emerald-200"
                      : "bg-slate-800 text-slate-500"
                  }`}
              >
                {shopifyCount > 0 ? "✓" : "3"}
              </span>
              <div>
                <p className="text-sm text-slate-300">Connect a Shopify store</p>
                <p className="text-xs text-slate-500">
                  Pull CRM orders for reconciled ROAS and CPA (source of truth).
                </p>
              </div>
            </li>
          </ul>
        </div>
      )}
    </>
  );
}
