"use client";
// app/clients/[clientId]/SourceOfTruthSection.tsx
// "Source-of-Truth Performance" section on the client dashboard.
//
// Shows per-campaign CRM-verified ROAS and CPA from the latest reconciliation
// run. If no run has been done yet, prompts the user to run one.
//
// Data: ReconciledCampaignPerformance rows loaded by the server component.

import Link from "next/link";
import type { ReconciledCampaignPerformance } from "@prisma/client";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt$(n: number) {
  if (n === 0) return "—";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtRoas(v: number | null) {
  if (v == null || v === 0) return "—";
  return v.toFixed(2) + "x";
}

function fmtOrders(n: number) {
  return n === 0 ? "—" : n.toLocaleString();
}

function roasColor(v: number | null): string {
  if (v == null) return "text-slate-400";
  if (v >= 3)    return "text-emerald-400 font-semibold";
  if (v >= 1.5)  return "text-slate-200";
  return "text-rose-400 font-semibold";
}

// ── Props ────────────────────────────────────────────────────────────────────

type Props = {
  clientId: string;
  rows:     ReconciledCampaignPerformance[];
  dateFrom: string | null;
  dateTo:   string | null;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function SourceOfTruthSection({ clientId, rows, dateFrom, dateTo }: Props) {
  const TH = "px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400 whitespace-nowrap";
  const TD = "px-4 py-3 text-sm text-slate-300 align-top";

  const hasData = rows.length > 0;

  const dateLabel = dateFrom && dateTo
    ? `${dateFrom} – ${dateTo}`
    : null;

  // Totals
  const totalSpend   = rows.reduce((s, r) => s + r.metaSpend,         0);
  const totalRevenue = rows.reduce((s, r) => s + r.attributedRevenue, 0);
  const totalOrders  = rows.reduce((s, r) => s + r.attributedOrders,  0);
  const overallRoas  = totalSpend > 0 ? totalRevenue / totalSpend : null;
  const overallCpa   = totalOrders > 0 ? totalSpend / totalOrders : null;

  return (
    <section className="mb-10">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-50">Source-of-Truth Performance</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            CRM-verified ROAS and CPA from Shopify orders attributed to Meta campaigns.
            {dateLabel && <span className="ml-1 text-slate-600">{dateLabel}</span>}
          </p>
        </div>
        <Link
          href={`/reconciliation?clientId=${clientId}`}
          className="text-xs text-slate-500 hover:text-slate-300"
        >
          Run / manage reconciliation →
        </Link>
      </div>

      {!hasData ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-6 py-8 text-center">
          <p className="text-sm text-slate-400">No reconciliation data yet for this client.</p>
          <p className="mt-1 text-xs text-slate-600">
            Go to{" "}
            <Link href={`/reconciliation?clientId=${clientId}`} className="text-slate-400 hover:text-slate-200 underline">
              Reconciliation
            </Link>{" "}
            and click &ldquo;Run Reconciliation&rdquo; to compute CRM-verified metrics.
          </p>
        </div>
      ) : (
        <>
          {/* Summary strip */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { label: "Campaigns",   value: String(rows.length) },
              { label: "Meta Spend",  value: fmt$(totalSpend) },
              { label: "CRM Revenue", value: fmt$(totalRevenue) },
              { label: "Real ROAS",   value: fmtRoas(overallRoas), color: roasColor(overallRoas) },
              { label: "Real CPA",    value: fmt$(overallCpa ?? 0) },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                <p className="text-xs text-slate-500">{item.label}</p>
                <p className={`mt-1 text-base ${item.color ?? "text-slate-200 font-semibold"}`}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          {/* Campaign table */}
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-900/60">
                  <th className={TH}>Campaign</th>
                  <th className={`${TH} text-right`}>Meta Spend</th>
                  <th className={`${TH} text-right`}>CRM Revenue</th>
                  <th className={`${TH} text-right`}>Orders</th>
                  <th className={`${TH} text-right`}>Real ROAS</th>
                  <th className={`${TH} text-right`}>Real CPA</th>
                  <th className={`${TH} text-right`}>UTM %</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const utmPct = row.attributedOrders > 0
                    ? Math.round((row.utmMatchedOrders / row.attributedOrders) * 100)
                    : null;

                  return (
                    <tr
                      key={row.id}
                      className={`transition-colors hover:bg-slate-800/20 ${
                        i < rows.length - 1 ? "border-b border-slate-800" : ""
                      }`}
                    >
                      <td className={`${TD} max-w-xs`}>
                        <p className="font-medium text-slate-100 truncate" title={row.campaignName}>
                          {row.campaignName}
                        </p>
                        <p className="text-xs font-mono text-slate-600">{row.externalCampaignId}</p>
                      </td>
                      <td className={`${TD} text-right font-medium`}>{fmt$(row.metaSpend)}</td>
                      <td className={`${TD} text-right`}>{fmt$(row.attributedRevenue)}</td>
                      <td className={`${TD} text-right`}>{fmtOrders(row.attributedOrders)}</td>
                      <td className={`${TD} text-right ${roasColor(row.calculatedRoas)}`}>
                        {fmtRoas(row.calculatedRoas)}
                      </td>
                      <td className={`${TD} text-right`}>{fmt$(row.calculatedCpa ?? 0)}</td>
                      <td className={`${TD} text-right`}>
                        {utmPct != null ? (
                          <span className={utmPct >= 70 ? "text-slate-300" : "text-amber-400"}>
                            {utmPct}%
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-2 text-xs text-slate-600">
            UTM % = share of attributed orders matched via utm_campaign (higher is more reliable).
            Remaining orders used {rows[0]?.attributionWindowDays ?? 7}-day lookback window.
          </p>
        </>
      )}
    </section>
  );
}
