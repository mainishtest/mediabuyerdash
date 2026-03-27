"use client";

import type { CRMConnection, UTMAttribution, ReconciliationRecord, ConnectionStatus } from "../../types/integrations";
import type { MetaConnectionSession, MetaAccessibleAdAccount, MetaSyncStatus } from "../../types/metaConnection";
import { MetaConnectionFlow } from "../components/MetaConnectionFlow";
import { formatCurrency, formatRoas } from "../../lib/metricUtils";

// --- Style helpers -----------------------------------------------------------

const TH = "px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400";
const TD = "px-4 py-3 text-sm text-slate-300";

function statusBadge(status: ConnectionStatus) {
  const styles: Record<ConnectionStatus, string> = {
    connected:    "bg-emerald-900/60 text-emerald-300",
    disconnected: "bg-slate-800 text-slate-400",
    pending:      "bg-amber-900/60 text-amber-300",
    error:        "bg-rose-900/60 text-rose-300"
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}

// --- Props -------------------------------------------------------------------

type Props = {
  // Meta connection flow
  metaSession:          MetaConnectionSession;
  accessibleAccounts:   MetaAccessibleAdAccount[];
  initialSelectedIds:   string[];
  syncStatuses:         MetaSyncStatus[];
  // CRM + reporting sections
  crmConnections:       CRMConnection[];
  utmRows:              UTMAttribution[];
  reconciliationRecords: ReconciliationRecord[];
};

// --- Component ---------------------------------------------------------------

export function IntegrationsView({
  metaSession,
  accessibleAccounts,
  initialSelectedIds,
  syncStatuses,
  crmConnections,
  utmRows,
  reconciliationRecords
}: Props) {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-10">
      {/* Page header */}
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-white">
          Integrations
        </h1>
        <p className="mt-1.5 max-w-xl text-sm text-slate-400">
          Connect Meta ad accounts, configure CRM data sources, and review
          UTM attribution and revenue reconciliation.
        </p>
        <a
          href="/integrations/meta"
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-700"
        >
          Meta Integration →
        </a>
      </header>

      {/* ── 1. Meta Connection Flow ────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-1 text-xl font-semibold text-slate-50">
          Meta Connection Flow
        </h2>
        <p className="mb-5 text-sm text-slate-400">
          Connect your Facebook account to discover accessible ad accounts,
          select which ones to sync, and keep metric data up to date.
          OAuth and sync execution are mocked — no real API calls are made yet.
        </p>
        <MetaConnectionFlow
          session={metaSession}
          accessibleAccounts={accessibleAccounts}
          initialSelectedIds={initialSelectedIds}
          syncStatuses={syncStatuses}
        />
      </section>

      {/* ── 2. CRM Connections ─────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-1 text-xl font-semibold text-slate-50">
          CRM Connections
        </h2>
        <p className="mb-5 text-sm text-slate-400">
          Connect a CRM or order management platform to enable source-of-truth
          revenue comparison against Meta-reported metrics.
        </p>

        <div className="flex flex-col gap-3">
          {crmConnections.map((crm) => (
            <div
              key={crm.id}
              className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-4"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-50">{crm.label}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {crm.platform === "shopify"
                    ? `Store: ${crm.storeUrl}`
                    : `Endpoint: ${crm.apiEndpoint}`}
                </p>
              </div>
              {statusBadge(crm.status)}
              <button
                disabled
                className="cursor-not-allowed rounded-lg border border-slate-700 px-4 py-1.5 text-sm font-medium text-slate-500"
              >
                Connect (coming soon)
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── 3. UTM Reporting Preview ───────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-1 text-xl font-semibold text-slate-50">
          UTM Reporting Preview
        </h2>
        <p className="mb-5 text-sm text-slate-400">
          Sample UTM attribution rows as they would arrive from a CRM or
          analytics system. utm_campaign and utm_content map to internal
          campaign and ad entities.
        </p>

        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm shadow-slate-900/40">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {["Date", "utm_campaign", "utm_content", "utm_medium", "Sessions", "Orders", "Revenue"].map(
                  (h) => <th key={h} className={TH}>{h}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {utmRows.map((row, i) => (
                <tr key={row.id} className={i < utmRows.length - 1 ? "border-b border-slate-800" : ""}>
                  <td className={TD}>{row.date}</td>
                  <td className={TD}>{row.utmCampaign ?? "—"}</td>
                  <td className={TD}>{row.utmContent  ?? "—"}</td>
                  <td className={TD}>{row.utmMedium   ?? "—"}</td>
                  <td className={TD}>{row.sessions.toLocaleString()}</td>
                  <td className={TD}>{row.orders}</td>
                  <td className={TD}>{formatCurrency(row.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 4. Meta vs CRM Reconciliation ─────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-1 text-xl font-semibold text-slate-50">
          Meta vs CRM Reconciliation
        </h2>
        <p className="mb-5 text-sm text-slate-400">
          Compares Meta-reported revenue against CRM actual revenue per
          campaign and date. A discrepancy flag fires when the gap exceeds 20%.
        </p>

        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm shadow-slate-900/40">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {[
                  "Date", "Campaign", "Spend",
                  "Meta Revenue", "Meta ROAS",
                  "CRM Revenue", "CRM ROAS",
                  "Δ Revenue", "Δ %", "Flag"
                ].map((h) => <th key={h} className={TH}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {reconciliationRecords.map((r, i) => (
                <tr
                  key={r.id}
                  className={i < reconciliationRecords.length - 1 ? "border-b border-slate-800" : ""}
                >
                  <td className={TD}>{r.date}</td>
                  <td className={`${TD} font-medium text-slate-200`}>{r.campaignName}</td>
                  <td className={TD}>{formatCurrency(r.metaSpend)}</td>
                  <td className={TD}>{formatCurrency(r.metaRevenue)}</td>
                  <td className={TD}>{formatRoas(r.metaRoas)}</td>
                  <td className={TD}>{formatCurrency(r.crmRevenue)}</td>
                  <td className={TD}>{formatRoas(r.crmRoas)}</td>
                  <td className={`${TD} ${r.revenueDelta < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                    {r.revenueDelta > 0 ? "+" : ""}{formatCurrency(r.revenueDelta)}
                  </td>
                  <td className={`${TD} ${r.revenueDelta < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                    {r.revenueDelta > 0 ? "+" : ""}{r.revenueDeltaPct}%
                  </td>
                  <td className={TD}>
                    {r.discrepancyFlag ? (
                      <span className="rounded-full bg-rose-900/60 px-2 py-0.5 text-xs font-medium text-rose-300">
                        ⚠ Gap
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                        OK
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
