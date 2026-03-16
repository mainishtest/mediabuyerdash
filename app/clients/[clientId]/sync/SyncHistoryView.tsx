"use client";

// app/clients/[clientId]/sync/SyncHistoryView.tsx
// Displays a list of past sync runs for a client.
// Mobile: card per run.
// Desktop: table view.

import Link from "next/link";
import { Badge }        from "../../../../components/ui/Badge";
import { SectionCard }  from "../../../../components/ui/SectionCard";
import { EmptyState }   from "../../../../components/ui/EmptyState";
import type { BadgeVariant } from "../../../../components/ui/Badge";
import type {
  ClientSyncRunRecord,
  MetaStepSummary,
  ShopifyStepSummary,
} from "../../../../lib/clientSync/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function duration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return "—";
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  const s  = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

function statusBadgeVariant(status: string): BadgeVariant {
  if (status === "completed") return "success";
  if (status === "partial")   return "warning";
  return "neutral";
}

function parseMeta(json: string | null | undefined): MetaStepSummary | null {
  if (!json) return null;
  try { return JSON.parse(json) as MetaStepSummary; } catch { return null; }
}

function parseShopify(json: string | null | undefined): ShopifyStepSummary | null {
  if (!json) return null;
  try { return JSON.parse(json) as ShopifyStepSummary; } catch { return null; }
}

// ── Summary chips ─────────────────────────────────────────────────────────────

function SummaryChips({ run }: { run: ClientSyncRunRecord }) {
  const meta    = run.steps.find((s) => s.stepType === "meta_account");
  const shopify = run.steps.find((s) => s.stepType === "shopify_orders");
  const ms      = parseMeta(meta?.summaryJson);
  const ss      = parseShopify(shopify?.summaryJson);

  const chips: { label: string; value: number }[] = [];

  if (ms) {
    chips.push(
      { label: "Campaigns",  value: ms.campaignsSynced },
      { label: "Ad Sets",    value: ms.adSetsSynced },
      { label: "Ads",        value: ms.adsSynced },
      { label: "Insights",   value: ms.insightRowsSynced },
    );
  }
  if (ss) {
    chips.push(
      { label: "Orders",     value: ss.ordersSynced },
      { label: "Line items", value: ss.lineItemsSynced },
    );
  }

  if (chips.length === 0) return <span className="text-xs text-slate-600">—</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((c) => (
        <span
          key={c.label}
          className="rounded bg-slate-700/60 px-1.5 py-0.5 text-xs text-slate-300"
        >
          {c.value} {c.label}
        </span>
      ))}
    </div>
  );
}

// ── Mobile card ───────────────────────────────────────────────────────────────

function RunCard({ run }: { run: ClientSyncRunRecord }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-200 capitalize">{run.syncType} sync</p>
          <p className="text-xs text-slate-500">{formatDate(run.startedAt)}</p>
        </div>
        <Badge variant={statusBadgeVariant(run.status)}>
          {run.status}
        </Badge>
      </div>

      <SummaryChips run={run} />

      <div className="flex items-center justify-between text-xs text-slate-600">
        <span>Duration: {duration(run.startedAt, run.completedAt)}</span>
        {run.errorMessage && (
          <span className="text-rose-500 truncate max-w-[180px]" title={run.errorMessage}>
            {run.errorMessage}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Desktop table row ─────────────────────────────────────────────────────────

const TH = "px-3 py-2 text-left text-xs font-medium uppercase tracking-widest text-slate-400";
const TD = "px-3 py-3 text-sm text-slate-300 align-top";

function RunTableRow({ run }: { run: ClientSyncRunRecord }) {
  return (
    <tr className="border-b border-slate-800 last:border-0">
      <td className={`${TD} capitalize`}>{run.syncType}</td>
      <td className={TD}>
        <Badge variant={statusBadgeVariant(run.status)}>{run.status}</Badge>
      </td>
      <td className={`${TD} whitespace-nowrap`}>{formatDate(run.startedAt)}</td>
      <td className={`${TD} whitespace-nowrap`}>{duration(run.startedAt, run.completedAt)}</td>
      <td className={TD}>
        <SummaryChips run={run} />
      </td>
      <td className={TD}>
        {run.errorMessage
          ? <span className="text-xs text-rose-400" title={run.errorMessage}>
              {run.errorMessage.slice(0, 60)}{run.errorMessage.length > 60 ? "…" : ""}
            </span>
          : <span className="text-slate-600">—</span>
        }
      </td>
    </tr>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function SyncHistoryView({
  clientId,
  clientName,
  runs,
}: {
  clientId:   string;
  clientName: string;
  runs:       ClientSyncRunRecord[];
}) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/clients/${clientId}`}
          className="mb-3 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200"
        >
          ← Back to {clientName}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
          Sync History
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Past sync runs for {clientName}. Shows last 50 runs.
        </p>
      </div>

      {runs.length === 0 ? (
        <SectionCard>
          <EmptyState
            title="No syncs yet"
            description="Return to the client page and run your first sync to see history here."
            icon="↕"
            action={
              <Link
                href={`/clients/${clientId}`}
                className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-200
                  transition-colors hover:bg-slate-600"
              >
                Go to client page →
              </Link>
            }
          />
        </SectionCard>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="space-y-3 sm:hidden">
            {runs.map((run) => (
              <RunCard key={run.id} run={run} />
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className={TH}>Type</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Started</th>
                  <th className={TH}>Duration</th>
                  <th className={TH}>Summary</th>
                  <th className={TH}>Error</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <RunTableRow key={run.id} run={run} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
