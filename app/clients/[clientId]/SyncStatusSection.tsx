"use client";

// app/clients/[clientId]/SyncStatusSection.tsx
// Shows client sync readiness, last sync status, and action buttons.
// Mobile: stacked cards, large tap targets.
// Desktop: two-column readiness/summary layout with richer detail.

import { useState, useTransition } from "react";
import Link from "next/link";
import { SectionCard }  from "../../../components/ui/SectionCard";
import { Badge }        from "../../../components/ui/Badge";
import { ActionButton } from "../../../components/ui/ActionButton";
import type { ClientReadiness }         from "../../../lib/clientSync/readiness";
import type {
  ClientSyncStatusSummary,
  ClientSyncResult,
  MetaStepSummary,
  ShopifyStepSummary,
} from "../../../lib/clientSync/types";
import { runClientSyncAction } from "./syncActions";

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  clientId:    string;
  readiness:   ClientReadiness;
  syncStatus:  ClientSyncStatusSummary;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m    = Math.floor(diff / 60_000);
  if (m < 1)   return "just now";
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month:  "short",
    day:    "numeric",
    hour:   "numeric",
    minute: "2-digit",
  });
}

function parseMetaSummary(json: string | null | undefined): MetaStepSummary | null {
  if (!json) return null;
  try { return JSON.parse(json) as MetaStepSummary; } catch { return null; }
}
function parseShopifySummary(json: string | null | undefined): ShopifyStepSummary | null {
  if (!json) return null;
  try { return JSON.parse(json) as ShopifyStepSummary; } catch { return null; }
}

// ── Readiness checklist ───────────────────────────────────────────────────────

function ReadinessChecklist({ readiness }: { readiness: ClientReadiness }) {
  const items = [
    {
      label: "Meta mapped",
      done:  readiness.metaMapped,
      hint:  readiness.metaMapped
        ? `${readiness.metaAccountCount} account${readiness.metaAccountCount !== 1 ? "s" : ""}`
        : "Map a Meta ad account above",
    },
    {
      label: "Shopify mapped",
      done:  readiness.shopifyMapped,
      hint:  readiness.shopifyMapped
        ? readiness.shopifyDomain ?? "Store connected"
        : "Map a Shopify store above",
    },
    {
      label: "Shopify synced",
      done:  readiness.shopifySynced,
      hint:  readiness.shopifySynced
        ? `${readiness.shopifyOrderCount} order${readiness.shopifyOrderCount !== 1 ? "s" : ""} as source of truth`
        : "Run a Shopify sync to import orders",
    },
    {
      label: "Ready for reconciliation",
      done:  readiness.eligibleForFullSync && readiness.shopifySynced,
      hint:
        readiness.eligibleForFullSync && readiness.shopifySynced
          ? "All sources active and synced"
          : "Complete steps above",
    },
  ];

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-start gap-3">
          <span
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center
              rounded-full text-xs font-bold ${
                item.done
                  ? "bg-emerald-700 text-emerald-100"
                  : "bg-slate-800 text-slate-500"
              }`}
          >
            {item.done ? "✓" : "○"}
          </span>
          <div className="min-w-0">
            <p className={`text-sm font-medium ${item.done ? "text-slate-200" : "text-slate-500"}`}>
              {item.label}
            </p>
            <p className="text-xs text-slate-600 truncate">{item.hint}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Last sync summary (from DB record) ───────────────────────────────────────

function LastSyncSummaryPanel({
  syncStatus,
}: {
  syncStatus: ClientSyncStatusSummary;
}) {
  if (!syncStatus.hasEverSynced || !syncStatus.lastSyncRun) {
    return (
      <div className="flex flex-col items-start gap-1 rounded-lg border border-dashed border-slate-700 bg-slate-800/20 px-4 py-4">
        <p className="text-sm font-medium text-slate-500">No syncs yet</p>
        <p className="text-xs text-slate-600">
          Run your first sync using the buttons below.
        </p>
      </div>
    );
  }

  const run    = syncStatus.lastSyncRun;
  const meta   = run.steps.find((s) => s.stepType === "meta_account");
  const shopify = run.steps.find((s) => s.stepType === "shopify_orders");

  const metaSummary    = parseMetaSummary(meta?.summaryJson);
  const shopifySummary = parseShopifySummary(shopify?.summaryJson);

  const statusColor =
    run.status === "completed" ? "text-emerald-400"
    : run.status === "partial"  ? "text-amber-400"
    : "text-rose-400";

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-800/20 px-4 py-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Last sync
          </p>
          <p className="mt-0.5 text-sm text-slate-300">
            {formatDate(run.startedAt)}
            <span className="ml-2 text-xs text-slate-600">
              ({timeAgo(run.startedAt)})
            </span>
          </p>
        </div>
        <span className={`text-xs font-semibold capitalize ${statusColor}`}>
          {run.status}
        </span>
      </div>

      {metaSummary && (
        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">Meta</p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Campaigns",  value: metaSummary.campaignsSynced },
              { label: "Ad Sets",    value: metaSummary.adSetsSynced },
              { label: "Ads",        value: metaSummary.adsSynced },
              { label: "Creatives",  value: metaSummary.creativesSynced },
              { label: "Insight rows", value: metaSummary.insightRowsSynced },
            ].map((stat) => (
              <span
                key={stat.label}
                className="rounded-md bg-slate-700/60 px-2 py-0.5 text-xs text-slate-300"
              >
                {stat.value} {stat.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {shopifySummary && (
        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">Shopify</p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Orders",     value: shopifySummary.ordersSynced },
              { label: "Line items", value: shopifySummary.lineItemsSynced },
            ].map((stat) => (
              <span
                key={stat.label}
                className="rounded-md bg-slate-700/60 px-2 py-0.5 text-xs text-slate-300"
              >
                {stat.value} {stat.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {run.errorMessage && (
        <p className="text-xs text-rose-400">{run.errorMessage}</p>
      )}
    </div>
  );
}

// ── Inline result (shown immediately after a sync action completes) ───────────

function InlineSyncResult({ result }: { result: ClientSyncResult }) {
  const statusColor =
    result.status === "completed" ? "text-emerald-400"
    : result.status === "partial"  ? "text-amber-400"
    : "text-rose-400";

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/30 px-4 py-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className={`text-sm font-semibold capitalize ${statusColor}`}>
          {result.status === "completed" ? "✓" : result.status === "partial" ? "⚠" : "✗"}
          {" "}Sync {result.status}
        </span>
        <span className="text-xs text-slate-600">
          {result.syncType} · just now
        </span>
      </div>

      {result.metaSummary && (
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Campaigns",  value: result.metaSummary.campaignsSynced },
            { label: "Ad Sets",    value: result.metaSummary.adSetsSynced },
            { label: "Ads",        value: result.metaSummary.adsSynced },
            { label: "Creatives",  value: result.metaSummary.creativesSynced },
            { label: "Insights",   value: result.metaSummary.insightRowsSynced },
          ].map((stat) => (
            <span
              key={stat.label}
              className="rounded-md bg-emerald-900/30 px-2 py-0.5 text-xs text-emerald-300"
            >
              {stat.value} {stat.label}
            </span>
          ))}
        </div>
      )}

      {result.shopifySummary && (
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Orders",     value: result.shopifySummary.ordersSynced },
            { label: "Line items", value: result.shopifySummary.lineItemsSynced },
          ].map((stat) => (
            <span
              key={stat.label}
              className="rounded-md bg-emerald-900/30 px-2 py-0.5 text-xs text-emerald-300"
            >
              {stat.value} {stat.label}
            </span>
          ))}
        </div>
      )}

      {result.errors.length > 0 && (
        <div className="space-y-0.5">
          {result.errors.map((e, i) => (
            <p key={i} className="text-xs text-rose-400">{e}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Live status badge ─────────────────────────────────────────────────────────

function LiveStatusBadge({ syncStatus }: { syncStatus: ClientSyncStatusSummary }) {
  if (!syncStatus.hasEverSynced) {
    return <Badge variant="neutral">Not synced</Badge>;
  }
  const status = syncStatus.lastSyncRun?.status;
  if (status === "completed") return <Badge variant="success">Live</Badge>;
  if (status === "partial")   return <Badge variant="warning">Partial</Badge>;
  return <Badge variant="neutral">Failed</Badge>;
}

// ── Main component ────────────────────────────────────────────────────────────

export function SyncStatusSection({ clientId, readiness, syncStatus }: Props) {
  const [isPending, startTransition] = useTransition();
  const [activeSync, setActiveSync]  = useState<"meta" | "shopify" | "full" | null>(null);
  const [lastResult, setLastResult]  = useState<ClientSyncResult | null>(null);
  const [lastError,  setLastError]   = useState<string | null>(null);

  function triggerSync(syncType: "meta" | "shopify" | "full") {
    setActiveSync(syncType);
    setLastResult(null);
    setLastError(null);
    startTransition(async () => {
      const res = await runClientSyncAction(clientId, syncType);
      if (res.success) {
        setLastResult(res.result);
      } else {
        setLastError(res.error);
      }
      setActiveSync(null);
    });
  }

  const isRunning = isPending && activeSync !== null;

  return (
    <section className="mb-10">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-50">Sync Status</h2>
          <p className="mt-0.5 text-sm text-slate-400">
            Run a sync to pull the latest Meta delivery data and Shopify orders for this client.
          </p>
        </div>
        <LiveStatusBadge syncStatus={syncStatus} />
      </div>

      {/* Two-column on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 mb-4">
        <SectionCard title="Readiness" className="h-full">
          <ReadinessChecklist readiness={readiness} />
          {readiness.blockers.length > 0 && (
            <div className="mt-4 space-y-1">
              {readiness.blockers.map((b) => (
                <p key={b} className="text-xs text-amber-400">⚠ {b}</p>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Last Sync" className="h-full">
          <LastSyncSummaryPanel syncStatus={syncStatus} />
        </SectionCard>
      </div>

      {/* Inline result (shows after action completes) */}
      {lastResult && <div className="mb-4"><InlineSyncResult result={lastResult} /></div>}
      {lastError && (
        <div className="mb-4 rounded-lg border border-rose-800 bg-rose-950/30 px-4 py-3">
          <p className="text-sm text-rose-400">Sync failed: {lastError}</p>
          <p className="mt-1 text-xs text-rose-600">
            Check that Meta and Shopify connections are active in Integrations.
          </p>
        </div>
      )}

      {/* Action buttons — large tap targets on mobile */}
      <div className="flex flex-wrap items-center gap-3">
        <ActionButton
          variant="secondary"
          size="lg"
          disabled={isRunning || !readiness.eligibleForMetaSync}
          onClick={() => triggerSync("meta")}
          className="min-h-[48px] flex-1 justify-center sm:flex-none"
        >
          {isRunning && activeSync === "meta" ? (
            <><span className="animate-spin">⟳</span> Syncing Meta…</>
          ) : "Run Meta Sync"}
        </ActionButton>

        <ActionButton
          variant="secondary"
          size="lg"
          disabled={isRunning || !readiness.eligibleForShopifySync}
          onClick={() => triggerSync("shopify")}
          className="min-h-[48px] flex-1 justify-center sm:flex-none"
        >
          {isRunning && activeSync === "shopify" ? (
            <><span className="animate-spin">⟳</span> Syncing Shopify…</>
          ) : "Run Shopify Sync"}
        </ActionButton>

        <ActionButton
          variant="primary"
          size="lg"
          disabled={isRunning || !readiness.eligibleForFullSync}
          onClick={() => triggerSync("full")}
          className="min-h-[48px] flex-1 justify-center sm:flex-none"
        >
          {isRunning && activeSync === "full" ? (
            <><span className="animate-spin">⟳</span> Running Full Sync…</>
          ) : "Run Full Sync"}
        </ActionButton>

        <Link
          href={`/clients/${clientId}/sync`}
          className="ml-auto text-xs text-slate-400 hover:text-slate-200 whitespace-nowrap"
        >
          View sync history →
        </Link>
      </div>

      {/* Eligibility hints */}
      {!readiness.eligibleForMetaSync && readiness.metaMapped && (
        <p className="mt-2 text-xs text-slate-600">
          Meta sync unavailable — connection inactive.{" "}
          <Link href="/integrations/meta" className="text-slate-400 hover:text-slate-200">
            Reconnect →
          </Link>
        </p>
      )}
      {!readiness.eligibleForShopifySync && readiness.shopifyMapped && (
        <p className="mt-1 text-xs text-slate-600">
          Shopify sync unavailable — connection inactive.{" "}
          <Link href="/integrations/shopify" className="text-slate-400 hover:text-slate-200">
            Reconnect →
          </Link>
        </p>
      )}
    </section>
  );
}
