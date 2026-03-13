"use client";

import { useState } from "react";
import Link from "next/link";
import type { MetaSyncJob, MetaSyncSummary, MetaSyncPayload } from "../../../types/metaSync";
import type { MetaSyncMappedBatch } from "../../../lib/metaSyncOrchestrator";
import { formatCurrency, formatRoas } from "../../../lib/metricUtils";

// ── Style helpers ─────────────────────────────────────────────────────────────

const TH = "px-3 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400 whitespace-nowrap";
const TD = "px-3 py-3 text-sm text-slate-300 whitespace-nowrap";

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  accent = false
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${accent ? "text-emerald-400" : "text-slate-50"}`}>
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: MetaSyncJob["status"] }) {
  const styles: Record<MetaSyncJob["status"], string> = {
    idle:      "bg-slate-800 text-slate-400",
    pending:   "bg-amber-900/60 text-amber-300",
    running:   "bg-blue-900/60 text-blue-300",
    completed: "bg-emerald-900/60 text-emerald-300",
    failed:    "bg-rose-900/60 text-rose-300"
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

type Tab = "rawPayload" | "mappedRecords" | "metrics";

// ── Main component ────────────────────────────────────────────────────────────

type Props = {
  payload: MetaSyncPayload;
  job:     MetaSyncJob;
  batch:   MetaSyncMappedBatch;
  summary: MetaSyncSummary;
};

export function MetaSyncView({ payload, job, batch, summary }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("rawPayload");

  const tabs: { id: Tab; label: string }[] = [
    { id: "rawPayload",    label: "Raw Payload" },
    { id: "mappedRecords", label: "Mapped Records" },
    { id: "metrics",       label: "Hourly Metrics" }
  ];

  return (
    <>
      {/* Page header */}
      <header className="mb-10">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200"
        >
          ← Back to Dashboard
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
          Meta Sync Preview
        </h1>
        <p className="mt-2 max-w-xl text-sm text-slate-300">
          Validates the sync contract layer end-to-end: mock Meta payload →
          mapping functions → Prisma upsert. No real Meta API calls are made.
        </p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
          <span aria-hidden>⚠</span>
          <span>Mock sync only — not connected to the real Meta Ads API</span>
        </div>
      </header>

      {/* Sync job status card */}
      <section className="mb-8 rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm shadow-slate-900/40">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Sync Job</p>
            <p className="mt-1 font-mono text-sm text-slate-300">{job.id}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Type</p>
            <p className="mt-1 text-sm text-slate-300 capitalize">{job.syncType}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Ad Account</p>
            <p className="mt-1 font-mono text-sm text-slate-300">{job.selectedAdAccountId}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Status</p>
            <div className="mt-1">
              <StatusBadge status={summary.status} />
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Duration</p>
            <p className="mt-1 text-sm text-slate-300">{summary.durationMs} ms</p>
          </div>
        </div>

        {summary.errorsCount > 0 && (
          <div className="mt-4 rounded-lg border border-rose-800/60 bg-rose-950/30 p-3">
            <p className="text-xs font-medium text-rose-400">
              {summary.errorsCount} error{summary.errorsCount !== 1 ? "s" : ""}
            </p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              {summary.errors.map((e, i) => (
                <li key={i} className="text-xs text-rose-300">{e}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Sync summary counts */}
      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Accounts"   value={summary.accountsProcessed}  accent />
        <StatCard label="Campaigns"  value={summary.campaignsProcessed} accent />
        <StatCard label="Ad Sets"    value={summary.adSetsProcessed}    accent />
        <StatCard label="Ads"        value={summary.adsProcessed}       accent />
        <StatCard label="Creatives"  value={summary.creativesProcessed} accent />
        <StatCard label="Metrics"    value={summary.metricsProcessed}   accent />
      </section>

      {/* Tabs: raw vs mapped vs metrics */}
      <div className="mb-4 flex gap-2 border-b border-slate-800 pb-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`-mb-px rounded-t-lg px-4 py-2 text-sm transition-colors ${
              activeTab === t.id
                ? "border border-b-transparent border-slate-700 bg-slate-900 text-slate-100"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Raw Payload ── */}
      {activeTab === "rawPayload" && (
        <section className="space-y-6">
          <PayloadSection title="Accounts" count={payload.accounts.length}>
            <pre className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-xs text-slate-300">
              {JSON.stringify(payload.accounts, null, 2)}
            </pre>
          </PayloadSection>

          <PayloadSection title="Campaigns" count={payload.campaigns.length}>
            <pre className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-xs text-slate-300">
              {JSON.stringify(payload.campaigns, null, 2)}
            </pre>
          </PayloadSection>

          <PayloadSection title="Ad Sets" count={payload.adSets.length}>
            <pre className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-xs text-slate-300">
              {JSON.stringify(payload.adSets, null, 2)}
            </pre>
          </PayloadSection>

          <PayloadSection title="Creatives" count={payload.creatives.length}>
            <pre className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-xs text-slate-300">
              {JSON.stringify(payload.creatives, null, 2)}
            </pre>
          </PayloadSection>

          <PayloadSection title="Ads" count={payload.ads.length}>
            <pre className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-xs text-slate-300">
              {JSON.stringify(payload.ads, null, 2)}
            </pre>
          </PayloadSection>
        </section>
      )}

      {/* ── Tab: Mapped Records ── */}
      {activeTab === "mappedRecords" && (
        <section className="space-y-6">
          <MappedTable
            title="Mapped Accounts"
            headers={["ID", "Name", "Platform", "Currency", "Timezone"]}
            rows={batch.accounts.map((a) => [a.id, a.name, a.platform, a.currency, a.timezone])}
          />
          <MappedTable
            title="Mapped Campaigns"
            headers={["ID", "Account ID", "Name", "Objective", "Status", "Daily Budget"]}
            rows={batch.campaigns.map((c) => [
              c.id, c.accountId, c.name, c.objective, c.status, formatCurrency(c.dailyBudget)
            ])}
          />
          <MappedTable
            title="Mapped Ad Sets"
            headers={["ID", "Campaign ID", "Name", "Status", "Daily Budget"]}
            rows={batch.adSets.map((as) => [
              as.id, as.campaignId, as.name, as.status, formatCurrency(as.dailyBudget)
            ])}
          />
          <MappedTable
            title="Mapped Creatives"
            headers={["ID", "Name", "Type", "Headline", "CTA"]}
            rows={batch.creatives.map((cr) => [
              cr.id, cr.name, cr.type, cr.headline, cr.callToAction
            ])}
          />
          <MappedTable
            title="Mapped Ads"
            headers={["ID", "Ad Set ID", "Creative ID", "Name", "Status"]}
            rows={batch.ads.map((ad) => [
              ad.id, ad.adSetId, ad.creativeId, ad.name, ad.status
            ])}
          />
        </section>
      )}

      {/* ── Tab: Hourly Metrics ── */}
      {activeTab === "metrics" && (
        <section>
          <p className="mb-4 text-sm text-slate-400">
            {batch.hourlyMetrics.length} hourly metric row
            {batch.hourlyMetrics.length !== 1 ? "s" : ""} mapped and persisted into the database.
          </p>
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm shadow-slate-900/40">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  {["Date", "Hour", "Campaign", "Ad Set", "Spend", "Impr.", "Clicks", "Conv.", "Revenue", "CPA", "ROAS", "utm_campaign"].map((h) => (
                    <th key={h} className={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {batch.hourlyMetrics.map((m, i) => (
                  <tr
                    key={m.id}
                    className={i < batch.hourlyMetrics.length - 1 ? "border-b border-slate-800" : ""}
                  >
                    <td className={`${TD} text-slate-500`}>{m.date}</td>
                    <td className={TD}>{m.hour}:00</td>
                    <td className={`${TD} max-w-[160px] truncate`}>{m.campaignName}</td>
                    <td className={`${TD} max-w-[140px] truncate`}>{m.adSetName ?? "—"}</td>
                    <td className={TD}>{formatCurrency(m.spend)}</td>
                    <td className={TD}>{m.impressions.toLocaleString()}</td>
                    <td className={TD}>{m.clicks.toLocaleString()}</td>
                    <td className={TD}>{m.conversions}</td>
                    <td className={TD}>{formatCurrency(m.revenue)}</td>
                    <td className={TD}>{formatCurrency(m.cpa)}</td>
                    <td className={TD}>{formatRoas(m.roas)}</td>
                    <td className={`${TD} font-mono text-xs text-slate-400`}>
                      {m.utmCampaign ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-emerald-400">
            ● These rows were upserted into the local SQLite database via the sync contract path.
          </p>
        </section>
      )}
    </>
  );
}

// ── Local helpers ─────────────────────────────────────────────────────────────

function PayloadSection({
  title,
  count,
  children
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-slate-300">
        {title}{" "}
        <span className="ml-1 rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
          {count}
        </span>
      </h3>
      {children}
    </div>
  );
}

function MappedTable({
  title,
  headers,
  rows
}: {
  title:   string;
  headers: string[];
  rows:    (string | number | null)[][];
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-slate-300">{title}</h3>
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              {headers.map((h) => (
                <th key={h} className={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr
                key={ri}
                className={ri < rows.length - 1 ? "border-b border-slate-800" : ""}
              >
                {row.map((cell, ci) => (
                  <td key={ci} className={`${TD} ${ci === 0 ? "font-mono text-xs text-slate-400" : ""}`}>
                    {cell ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
