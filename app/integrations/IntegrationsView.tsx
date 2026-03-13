"use client";

import { useState } from "react";
import Link from "next/link";
import type { MetaAdAccountConnection, CRMConnection, UTMAttribution, CRMPerformanceMetric, ReconciliationRecord, ConnectionStatus } from "../../types/integrations";
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
  metaAccounts:         MetaAdAccountConnection[];
  crmConnections:       CRMConnection[];
  utmRows:              UTMAttribution[];
  crmMetrics:           CRMPerformanceMetric[];
  reconciliationRecords: ReconciliationRecord[];
};

// --- Component ---------------------------------------------------------------

export function IntegrationsView({
  metaAccounts,
  crmConnections,
  utmRows,
  crmMetrics,
  reconciliationRecords
}: Props) {
  // Local state for Meta account selection — no persistence yet.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(metaAccounts.filter((a) => a.isSelected).map((a) => a.id))
  );

  function toggleAccount(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
          Integrations
        </h1>
        <p className="mt-2 max-w-xl text-sm text-slate-300">
          Manage connections to Meta ad accounts, CRM platforms, and review
          UTM attribution and reconciliation data.
        </p>
      </header>

      {/* ── 1. Meta Ad Account Connection ──────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-1 text-xl font-semibold text-slate-50">
          Meta Ad Account Connection
        </h2>
        <p className="mb-5 text-sm text-slate-400">
          In the full flow, a user will authenticate via Facebook OAuth and see
          all ad accounts they have access to. Select which accounts to include
          in this dashboard. Changes are local-only until persistence is added.
        </p>

        <div className="flex flex-col gap-3">
          {metaAccounts.map((account) => {
            const selected = selectedIds.has(account.id);
            return (
              <div
                key={account.id}
                className={`flex flex-wrap items-center gap-4 rounded-xl border px-5 py-4 transition-colors ${
                  selected
                    ? "border-emerald-700/60 bg-emerald-950/20"
                    : "border-slate-800 bg-slate-900/60"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-50">{account.name}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {account.id} · {account.currency} · {account.timezone}
                    {account.businessName && ` · ${account.businessName}`}
                  </p>
                </div>
                {selected && (
                  <span className="rounded-full bg-emerald-900/60 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
                    Selected
                  </span>
                )}
                <button
                  onClick={() => toggleAccount(account.id)}
                  className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                    selected
                      ? "border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                      : "bg-slate-700 text-slate-50 hover:bg-slate-600"
                  }`}
                >
                  {selected ? "Remove" : "Add to Dashboard"}
                </button>
              </div>
            );
          })}
        </div>

        <p className="mt-3 text-xs text-slate-500">
          {selectedIds.size} of {metaAccounts.length} accounts selected
        </p>
      </section>

      {/* ── 2. CRM Connection ──────────────────────────────────────────────── */}
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
                  {crm.platform === "shopify" ? `Store: ${crm.storeUrl}` : `Endpoint: ${crm.apiEndpoint}`}
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

      {/* ── 4. Reconciliation Preview ─────────────────────────────────────── */}
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
    </>
  );
}
