"use client";

// app/clients/[clientId]/LiveMetaCampaignsSection.tsx
// Displays synced Meta campaign data scoped to the mapped ad accounts for this client.
// Responsive: mobile cards + desktop table. Handles all empty states.

import { useState } from "react";
import Link from "next/link";
import { SectionCard } from "../../../components/ui/SectionCard";
import { Badge }       from "../../../components/ui/Badge";
import { EmptyState }  from "../../../components/ui/EmptyState";
import type { ClientMetaData, ClientMetaCampaignRow } from "../../../lib/meta/clientMetaService";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtCurrency(n: number) {
  return "$" + fmt(n);
}

function fmtCompact(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "k";
  return n.toLocaleString();
}

function ctr(impressions: number, clicks: number): string {
  if (!impressions) return "—";
  return fmt((clicks / impressions) * 100, 2) + "%";
}

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day:   "numeric",
    year:  "numeric",
  });
}

type BadgeVariant = "success" | "warning" | "neutral";
function statusVariant(status: string): BadgeVariant {
  const s = status.toUpperCase();
  if (s === "ACTIVE")                   return "success";
  if (s === "PAUSED" || s === "PENDING") return "warning";
  return "neutral";
}

// ── Stat strip ────────────────────────────────────────────────────────────────

function StatStrip({ data }: { data: ClientMetaData }) {
  const { stats } = data;
  const items = [
    { label: "Mapped Accounts", value: stats.mappedAccountCount.toString() },
    { label: "Campaigns",       value: stats.campaignCount.toString() },
    { label: "Ad Sets",         value: stats.adSetCount.toString() },
    { label: "Ads",             value: stats.adCount.toString() },
    {
      label: "Last Sync",
      value: stats.lastSyncAt ? fmtDate(stats.lastSyncAt) : "Never",
    },
  ];

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-slate-800 bg-slate-900/40 p-3"
        >
          <p className="text-xs text-slate-500">{item.label}</p>
          <p className="mt-1 text-base font-semibold text-slate-200">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Mobile campaign card ──────────────────────────────────────────────────────

function CampaignCard({ campaign }: { campaign: ClientMetaCampaignRow }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-800/30 p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-200 leading-tight">{campaign.name}</p>
        <Badge variant={statusVariant(campaign.status)}>
          {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1).toLowerCase()}
        </Badge>
      </div>

      {campaign.objective && (
        <p className="mb-3 text-xs text-slate-500">{campaign.objective}</p>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <span className="text-slate-500">Spend (30d)</span>
          <p className="font-medium text-slate-300">{fmtCurrency(campaign.totalSpend)}</p>
        </div>
        <div>
          <span className="text-slate-500">Impressions</span>
          <p className="font-medium text-slate-300">{fmtCompact(campaign.totalImpressions)}</p>
        </div>
        <div>
          <span className="text-slate-500">Clicks</span>
          <p className="font-medium text-slate-300">{fmtCompact(campaign.totalClicks)}</p>
        </div>
        <div>
          <span className="text-slate-500">CTR</span>
          <p className="font-medium text-slate-300">
            {ctr(campaign.totalImpressions, campaign.totalClicks)}
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-600">
        Updated {fmtDate(campaign.updatedAt)}
      </p>
    </div>
  );
}

// ── Desktop table ─────────────────────────────────────────────────────────────

const TH = "px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400";
const TD = "px-4 py-3 text-sm text-slate-300";

function CampaignTable({ campaigns }: { campaigns: ClientMetaCampaignRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700 bg-slate-900/60">
            <th className={TH}>Campaign</th>
            <th className={TH}>Status</th>
            <th className={TH}>Objective</th>
            <th className={`${TH} text-right`}>Spend (30d)</th>
            <th className={`${TH} text-right`}>Impressions</th>
            <th className={`${TH} text-right`}>Clicks</th>
            <th className={`${TH} text-right`}>CTR</th>
            <th className={TH}>Updated</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c, i) => (
            <tr
              key={c.id}
              className={`${
                i < campaigns.length - 1 ? "border-b border-slate-800" : ""
              } hover:bg-slate-800/20`}
            >
              <td className={`${TD} font-medium text-slate-200 max-w-xs`}>
                <span className="block truncate" title={c.name}>{c.name}</span>
                <span className="block text-xs font-mono text-slate-600 truncate">
                  {c.externalCampaignId}
                </span>
              </td>
              <td className={TD}>
                <Badge variant={statusVariant(c.status)}>
                  {c.status.charAt(0).toUpperCase() + c.status.slice(1).toLowerCase()}
                </Badge>
              </td>
              <td className={TD}>
                <span className="text-slate-400">{c.objective ?? "—"}</span>
              </td>
              <td className={`${TD} text-right font-medium`}>{fmtCurrency(c.totalSpend)}</td>
              <td className={`${TD} text-right`}>{fmtCompact(c.totalImpressions)}</td>
              <td className={`${TD} text-right`}>{fmtCompact(c.totalClicks)}</td>
              <td className={`${TD} text-right`}>
                {ctr(c.totalImpressions, c.totalClicks)}
              </td>
              <td className={`${TD} text-slate-500`}>{fmtDate(c.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main section ──────────────────────────────────────────────────────────────

type Props = {
  clientId: string;
  data:     ClientMetaData;
};

export function LiveMetaCampaignsSection({ clientId, data }: Props) {
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // ── Empty states ────────────────────────────────────────────────────────────

  if (!data.hasMapping) {
    return (
      <section className="mb-10">
        <SectionHeading />
        <SectionCard>
          <EmptyState
            icon="□"
            title="No Meta accounts mapped"
            description="Assign a Meta ad account to this client in the Client Integrations section above."
          />
        </SectionCard>
      </section>
    );
  }

  if (!data.hasSynced) {
    return (
      <section className="mb-10">
        <SectionHeading />
        <StatStrip data={data} />
        <SectionCard>
          <EmptyState
            icon="○"
            title="No synced campaigns yet"
            description="Run a Meta sync from the Integrations page to populate campaign data for this client."
            action={
              <Link
                href="/integrations/meta/sync"
                className="mt-3 inline-block rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-600"
              >
                Go to Meta Sync →
              </Link>
            }
          />
        </SectionCard>
      </section>
    );
  }

  // ── Filtering ───────────────────────────────────────────────────────────────

  const filtered = data.campaigns.filter((c) => {
    const matchesSearch = !search || c.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all"
        ? true
        : statusFilter === "active"
        ? c.status.toUpperCase() === "ACTIVE"
        : c.status.toUpperCase() !== "ACTIVE";
    return matchesSearch && matchesStatus;
  });

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <section className="mb-10">
      <SectionHeading />

      <StatStrip data={data} />

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Status pills */}
        <div className="flex gap-1">
          {(["all", "active", "inactive"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setStatusFilter(v)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === v
                  ? "bg-slate-700 text-slate-100"
                  : "text-slate-500 hover:bg-slate-800 hover:text-slate-300"
              }`}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search campaigns…"
          className="ml-auto w-full max-w-xs rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm
            text-slate-200 placeholder-slate-600 focus:border-emerald-600 focus:outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon="○"
            title="No campaigns match your filter"
            description="Try clearing the search or changing the status filter."
          />
        </SectionCard>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((c) => (
              <CampaignCard key={c.id} campaign={c} />
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block">
            <CampaignTable campaigns={filtered} />
          </div>

          <p className="mt-3 text-xs text-slate-600">
            Showing {filtered.length} of {data.campaigns.length} campaigns.
            Spend and metrics are from the last 30 days.
          </p>
        </>
      )}
    </section>
  );
}

// ── Section heading (reused across empty states) ──────────────────────────────

function SectionHeading() {
  return (
    <>
      <h2 className="mb-1 text-lg font-semibold text-slate-50">
        Live Meta Campaigns
      </h2>
      <p className="mb-5 text-sm text-slate-400">
        Synced Meta campaign delivery data for this client&apos;s mapped ad accounts.
        Spend and metrics cover the last 30 days.
      </p>
    </>
  );
}
