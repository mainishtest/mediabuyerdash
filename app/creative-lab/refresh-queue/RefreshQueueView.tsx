"use client";

// app/creative-lab/refresh-queue/RefreshQueueView.tsx
// Creative Refresh Queue — main client-side orchestrator.
//
// Responsive layout:
//   Mobile:  summary cards (2-col) → filter bar → stacked item cards →
//            detail section expands inline below selected item
//   Desktop: summary cards (4-col) → filter bar →
//            left 5/12 queue list | right 7/12 sticky detail panel

import { useState, useMemo }            from "react";
import { useRouter }                    from "next/navigation";
import Link                             from "next/link";
import type {
  CreativeRefreshQueueItem,
  CreativeRefreshPriority,
  CreativeRefreshActionType,
  CreativeRefreshQueueFilterState,
}                                       from "../../../types/creativeRefreshQueue";
import {
  summarizeCreativeRefreshQueue,
  applyCreativeRefreshQueueFilters,
}                                       from "../../../lib/creativeRefreshQueue/queue";
import {
  PageHeader,
  StatCard,
  SectionCard,
  Badge,
  EmptyState,
}                                       from "../../../components/ui";
import { RefreshQueueItemCard }         from "./RefreshQueueItemCard";
import { RefreshQueueItemDetail }       from "./RefreshQueueItemDetail";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ClientOption = { id: string; name: string };

type Props = {
  clients:          ClientOption[];
  initialItems:     CreativeRefreshQueueItem[];
  selectedClientId: string | null;
};

const EMPTY_FILTERS: CreativeRefreshQueueFilterState = {
  clientId:      "",
  priority:      "all",
  fatigueStatus: "all",
  actionType:    "all",
  campaignId:    "",
  confidence:    "all",
};

// ---------------------------------------------------------------------------
// Filter select helper
// ---------------------------------------------------------------------------

function FilterSelect({
  label, value, onChange, children,
}: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs text-slate-500">{label}</p>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm
          text-slate-200 focus:border-slate-600 focus:outline-none"
      >
        {children}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function RefreshQueueView({ clients, initialItems, selectedClientId }: Props) {
  const router = useRouter();

  const [items]      = useState<CreativeRefreshQueueItem[]>(initialItems);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters]       = useState<CreativeRefreshQueueFilterState>({
    ...EMPTY_FILTERS,
    clientId: selectedClientId ?? "",
  });

  const summary  = useMemo(() => summarizeCreativeRefreshQueue(items), [items]);
  const filtered = useMemo(() => applyCreativeRefreshQueueFilters(items, filters), [items, filters]);

  const selectedItem = useMemo(
    () => (selectedId ? items.find((i) => i.id === selectedId) ?? null : null),
    [selectedId, items],
  );

  const campaignOptions = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .filter((i) => !filters.clientId || i.clientAccountId === filters.clientId)
            .map((i) => i.campaignId)
            .filter(Boolean),
        ),
      ).sort(),
    [items, filters.clientId],
  );

  const campaignNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of items) m.set(i.campaignId, i.campaignName);
    return m;
  }, [items]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  function handleClientChange(clientId: string) {
    setFilters((f) => ({ ...f, clientId, campaignId: "" }));
    if (clientId) {
      router.push(`/creative-lab/refresh-queue?clientId=${encodeURIComponent(clientId)}`, { scroll: false });
    } else {
      router.push("/creative-lab/refresh-queue", { scroll: false });
    }
    setSelectedId(null);
  }

  function handleAction(id: string, action: string) {
    // Placeholder — future integration with brief generation module.
    // In the next phase (Creative Brief), these will open a brief creation flow.
    console.info("[refresh-queue] action:", action, "for item:", id);
    // For now: "Review in Creative Lab" actions navigate there
    if (action === "review_creative") {
      const item = items.find((i) => i.id === id);
      if (item) {
        router.push(`/creative-lab?clientId=${encodeURIComponent(item.clientAccountId)}`);
      }
    }
  }

  const hasFilters =
    filters.clientId !== "" ||
    filters.priority !== "all" ||
    filters.fatigueStatus !== "all" ||
    filters.actionType !== "all" ||
    filters.campaignId !== "" ||
    filters.confidence !== "all";

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6">

      {/* Header */}
      <PageHeader
        title="Creative Refresh Queue"
        description="Creatives that need refresh attention — prioritised by fatigue and performance signals."
        badge={<Badge variant="purple">Refresh Queue</Badge>}
        actions={
          <Link
            href="/creative-lab"
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm
              font-medium text-slate-200 transition-colors hover:bg-slate-700"
          >
            ← Creative Lab
          </Link>
        }
      />

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Urgent"
          value={summary.urgent}
          sub="replace immediately"
        />
        <StatCard
          label="High Priority"
          value={summary.high}
          sub="refresh needed soon"
        />
        <StatCard
          label="Watchlist"
          value={summary.medium}
          sub="early signals"
        />
        <StatCard
          label="Monitor Only"
          value={summary.monitorOnly}
          sub="no action yet"
        />
      </div>

      {/* Secondary action counts */}
      {summary.total > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Full Brief Needed"   value={summary.needsFullBrief}       sub="complete replacement" />
          <StatCard label="New Copy Needed"     value={summary.needsCopyVariations}   sub="message refresh" />
          <StatCard label="New Images Needed"   value={summary.needsImageVariations}  sub="visual hook refresh" />
          <StatCard label="Pause Candidates"    value={summary.needsPause}            sub="budget protection" />
        </div>
      )}

      {/* Filter bar */}
      <SectionCard>
        <div className="flex flex-wrap items-end gap-3">

          {/* Client */}
          <div>
            <p className="mb-1 text-xs text-slate-500">Client</p>
            <select
              value={filters.clientId}
              onChange={(e) => handleClientChange(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm
                text-slate-200 focus:border-slate-600 focus:outline-none"
            >
              <option value="">All clients</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <FilterSelect
            label="Priority"
            value={filters.priority}
            onChange={(v) => setFilters((f) => ({ ...f, priority: v as CreativeRefreshPriority | "all" }))}
          >
            <option value="all">All priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </FilterSelect>

          <FilterSelect
            label="Fatigue Status"
            value={filters.fatigueStatus}
            onChange={(v) => setFilters((f) => ({ ...f, fatigueStatus: v }))}
          >
            <option value="all">All statuses</option>
            <option value="severe_fatigue">Severe Fatigue</option>
            <option value="fatigued">Fatigued</option>
            <option value="watch">Watch</option>
            <option value="healthy">Healthy</option>
          </FilterSelect>

          <FilterSelect
            label="Recommendation"
            value={filters.actionType}
            onChange={(v) => setFilters((f) => ({ ...f, actionType: v as CreativeRefreshActionType | "all" }))}
          >
            <option value="all">All recommendations</option>
            <option value="generate_full_refresh_brief">Full Brief</option>
            <option value="generate_new_copy_variations">New Copy</option>
            <option value="generate_new_image_variations">New Images</option>
            <option value="pause_creative_candidate">Pause</option>
            <option value="review_creative">Review</option>
            <option value="monitor_only">Monitor Only</option>
          </FilterSelect>

          <FilterSelect
            label="Confidence"
            value={filters.confidence}
            onChange={(v) => setFilters((f) => ({ ...f, confidence: v as "low" | "medium" | "high" | "all" }))}
          >
            <option value="all">All confidence</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </FilterSelect>

          {campaignOptions.length > 0 && (
            <FilterSelect
              label="Campaign"
              value={filters.campaignId}
              onChange={(v) => setFilters((f) => ({ ...f, campaignId: v }))}
            >
              <option value="">All campaigns</option>
              {campaignOptions.map((id) => (
                <option key={id} value={id}>
                  {campaignNameById.get(id) ?? id}
                </option>
              ))}
            </FilterSelect>
          )}

          {hasFilters && (
            <button
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="self-end pb-0.5 text-xs text-slate-400 underline hover:text-slate-200"
            >
              Clear filters
            </button>
          )}

          <span className="ml-auto self-end pb-0.5 text-xs text-slate-500">
            {filtered.length} of {items.length} creatives
          </span>
        </div>
      </SectionCard>

      {/* Queue + Detail split */}
      <div className={`grid gap-6 ${selectedId ? "lg:grid-cols-12" : ""}`}>

        {/* Queue list */}
        <div className={selectedId ? "lg:col-span-5" : ""}>
          <SectionCard
            title="Refresh Queue"
            description={
              filtered.length === 0
                ? "No items match the current filters."
                : `${filtered.length} creative${filtered.length !== 1 ? "s" : ""} — click to review`
            }
          >
            {filtered.length === 0 ? (
              <EmptyState
                icon="◻"
                title={items.length === 0 ? "Queue is empty" : "No items match filters"}
                description={
                  items.length === 0
                    ? "Sync your Meta account and run CRM reconciliation to detect creatives needing refresh."
                    : "Try clearing the filters to see all items."
                }
                action={
                  items.length === 0 ? (
                    <Link
                      href="/integrations"
                      className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
                    >
                      Connect Meta
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              <div className="space-y-2">
                {filtered.map((item) => (
                  <div key={item.id}>
                    <RefreshQueueItemCard
                      item={item}
                      isSelected={selectedId === item.id}
                      onSelect={(id) => setSelectedId((prev) => (prev === id ? null : id))}
                    />

                    {/* Mobile inline detail */}
                    {selectedId === item.id && selectedItem && (
                      <div className="mt-2 lg:hidden">
                        <RefreshQueueItemDetail
                          item={selectedItem}
                          onAction={handleAction}
                          onClose={() => setSelectedId(null)}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Desktop detail panel */}
        {selectedId && selectedItem && (
          <div className="hidden lg:block lg:col-span-7">
            <div className="sticky top-6">
              <RefreshQueueItemDetail
                item={selectedItem}
                onAction={handleAction}
                onClose={() => setSelectedId(null)}
              />
            </div>
          </div>
        )}

        {/* Desktop placeholder */}
        {!selectedId && items.length > 0 && (
          <div className="hidden lg:block lg:col-span-7">
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-800">
              <p className="text-sm text-slate-600">
                Select a creative from the queue to see signals and recommended actions
              </p>
            </div>
          </div>
        )}

      </div>

      {/* Bottom nav */}
      <div className="flex flex-wrap gap-3 border-t border-slate-800/60 pt-4">
        <Link href="/creative-lab"
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
          ← Creative Lab Queue →
        </Link>
        <Link href="/creative-fatigue"
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
          Creative Fatigue Analysis →
        </Link>
        <Link href="/creative-lab/generate"
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
          AI Generator →
        </Link>
      </div>

    </div>
  );
}
