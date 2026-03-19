"use client";

// app/creative-lab/CreativeLabWorkflowView.tsx
// Creative Lab workflow queue — main client-side orchestrator.
//
// Responsive layout:
//   Mobile:  summary cards (2-col) → filter bar → item cards (stacked) →
//            detail section expands inline below selected item
//   Desktop: summary cards (6-col) → filter bar →
//            left 5/12 queue list | right 7/12 detail panel

import { useState, useMemo }         from "react";
import { useRouter }                  from "next/navigation";
import Link                           from "next/link";
import type {
  CreativeLabItem,
  CreativeLabStatus,
  CreativeLabFilterState,
  CreativeLabSourceType,
  CreativeLabPriority,
  CreativeLabActivity,
}                                     from "../../types/creativeLab";
import {
  applyCreativeLabFilters,
  summarizeCreativeLab,
}                                     from "../../lib/creativelab/workflowUtils";
import {
  PageHeader,
  StatCard,
  SectionCard,
  Badge,
  EmptyState,
}                                     from "../../components/ui";
import { CreativeLabItemCard }        from "./CreativeLabItemCard";
import { CreativeLabItemDetail }      from "./CreativeLabItemDetail";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ClientOption = { id: string; name: string };

type Props = {
  clients:          ClientOption[];
  initialItems:     CreativeLabItem[];
  selectedClientId: string | null;
};

const EMPTY_FILTERS: CreativeLabFilterState = {
  clientId:   "",
  status:     "all",
  campaignId: "",
  sourceType: "all",
  priority:   "all",
};

// ---------------------------------------------------------------------------
// Filter bar sub-component
// ---------------------------------------------------------------------------

function FilterSelect({
  label, value, onChange, children,
}: {
  label:    string;
  value:    string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
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

export function CreativeLabWorkflowView({ clients, initialItems, selectedClientId }: Props) {
  const router = useRouter();

  // Workflow item state — transitions happen client-side in this step
  const [items, setItems]       = useState<CreativeLabItem[]>(initialItems);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters]   = useState<CreativeLabFilterState>({
    ...EMPTY_FILTERS,
    clientId: selectedClientId ?? "",
  });

  // Derived
  const summary  = useMemo(() => summarizeCreativeLab(items), [items]);
  const filtered = useMemo(() => applyCreativeLabFilters(items, filters), [items, filters]);

  const selectedItem = useMemo(
    () => (selectedId ? items.find((i) => i.id === selectedId) ?? null : null),
    [selectedId, items],
  );

  // Campaign options derived from filtered items (for the campaign filter)
  const campaignOptions = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .filter((i) => !filters.clientId || i.clientAccountId === filters.clientId)
            .map((i) => i.campaignId)
            .filter(Boolean) as string[],
        ),
      ).sort(),
    [items, filters.clientId],
  );

  const campaignNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of items) {
      if (i.campaignId && i.campaignName) m.set(i.campaignId, i.campaignName);
    }
    return m;
  }, [items]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  function handleClientChange(clientId: string) {
    setFilters((f) => ({ ...f, clientId, campaignId: "" }));
    if (clientId) {
      router.push(`/creative-lab?clientId=${encodeURIComponent(clientId)}`, { scroll: false });
    } else {
      router.push("/creative-lab", { scroll: false });
    }
    setSelectedId(null);
  }

  function handleStatusChange(id: string, newStatus: CreativeLabStatus, note?: string) {
    const item = items.find((i) => i.id === id);
    const fromStatus = item?.status ?? null;

    // Optimistic UI update
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;

        const entry: CreativeLabActivity = {
          id:        Math.random().toString(36).slice(2),
          action:    `Status changed to "${newStatus.replace(/_/g, " ")}"`,
          note:      note ?? null,
          actor:     null,
          timestamp: new Date().toISOString(),
        };

        return {
          ...it,
          status: newStatus,
          reviewState:
            newStatus === "in_review" ? "reviewing"
            : newStatus === "approved" || newStatus === "rejected" ? "reviewed"
            : it.reviewState,
          approvalState:
            newStatus === "approved" ? "approved"
            : newStatus === "rejected" ? "rejected"
            : it.approvalState,
          updatedAt:   new Date().toISOString(),
          activityLog: [...it.activityLog, entry],
        };
      }),
    );

    // Persist to DB (fire-and-forget — optimistic update already applied)
    if (item) {
      fetch(`/api/creative-lab/items/${encodeURIComponent(id)}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          action:          "status",
          toStatus:        newStatus,
          fromStatus,
          note:            note ?? undefined,
          clientAccountId: item.clientAccountId,
        }),
      }).catch((err) => console.error("[creative-lab status save]", err));
    }
  }

  function handleNotesSave(id: string, notes: string) {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    // Optimistic update
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, notes, updatedAt: new Date().toISOString() } : it)),
    );

    fetch(`/api/creative-lab/items/${encodeURIComponent(id)}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        action:          "notes",
        notes,
        clientAccountId: item.clientAccountId,
      }),
    }).catch((err) => console.error("[creative-lab notes save]", err));
  }

  const hasFilters =
    filters.clientId !== "" ||
    filters.status !== "all" ||
    filters.campaignId !== "" ||
    filters.sourceType !== "all" ||
    filters.priority !== "all";

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6">

      {/* Header */}
      <PageHeader
        title="Creative Lab"
        description="Review creative opportunities, track refresh work, and prepare actions from performance signals."
        badge={<Badge variant="purple">Workflow Queue</Badge>}
        actions={
          <Link
            href="/creative-lab/generate"
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm
              font-medium text-slate-200 transition-colors hover:bg-slate-700"
          >
            AI Generator →
          </Link>
        }
      />

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Queued"         value={summary.queued}        sub="awaiting review"       />
        <StatCard label="In Review"      value={summary.inReview}      sub="being reviewed"        />
        <StatCard label="Approved"       value={summary.approved}      sub="approved for action"   />
        <StatCard label="Needs Revision" value={summary.needsRevision} sub="returned for changes"  />
        <StatCard label="High Priority"  value={summary.highPriority}  sub="high + urgent items"   />
        <StatCard label="Urgent"         value={summary.urgent}        sub="needs immediate action" />
      </div>

      {/* Filter bar */}
      <SectionCard>
        <div className="flex flex-wrap items-end gap-3">
          {/* Client filter */}
          <div>
            <p className="mb-1 text-xs text-slate-500">Client</p>
            <select
              value={filters.clientId}
              onChange={(e) => handleClientChange(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm
                text-slate-200 focus:border-slate-600 focus:outline-none"
            >
              <option value="">All clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <FilterSelect
            label="Status"
            value={filters.status}
            onChange={(v) => setFilters((f) => ({ ...f, status: v as CreativeLabStatus | "all" }))}
          >
            <option value="all">All statuses</option>
            <option value="queued">Queued</option>
            <option value="in_review">In Review</option>
            <option value="approved">Approved</option>
            <option value="needs_revision">Needs Revision</option>
            <option value="rejected">Rejected</option>
            <option value="blocked">Blocked</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </FilterSelect>

          <FilterSelect
            label="Source"
            value={filters.sourceType}
            onChange={(v) => setFilters((f) => ({ ...f, sourceType: v as CreativeLabSourceType | "all" }))}
          >
            <option value="all">All sources</option>
            <option value="fatigued_creative">Fatigue Signal</option>
            <option value="underperforming_creative">Underperforming</option>
            <option value="winning_creative">Scale Opportunity</option>
            <option value="manual_entry">Manual</option>
            <option value="recommendation_engine">Auto-Detected</option>
          </FilterSelect>

          <FilterSelect
            label="Priority"
            value={filters.priority}
            onChange={(v) => setFilters((f) => ({ ...f, priority: v as CreativeLabPriority | "all" }))}
          >
            <option value="all">All priorities</option>
            <option value="urgent">Urgent</option>
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
            {filtered.length} of {items.length} items
          </span>
        </div>
      </SectionCard>

      {/* Queue + Detail split */}
      <div className={`grid gap-6 ${selectedId ? "lg:grid-cols-12" : ""}`}>

        {/* Queue list — full width or left 5/12 */}
        <div className={selectedId ? "lg:col-span-5" : ""}>
          <SectionCard
            title="Creative Work Queue"
            description={
              filtered.length === 0
                ? "No items match the current filters."
                : `${filtered.length} item${filtered.length !== 1 ? "s" : ""} — click to review`
            }
          >
            {filtered.length === 0 ? (
              <EmptyState
                icon="◻"
                title={
                  items.length === 0
                    ? "Queue is empty"
                    : "No items match filters"
                }
                description={
                  items.length === 0
                    ? "Sync your Meta account and run reconciliation to populate the queue with performance signals."
                    : "Try clearing the filters to see all items."
                }
                action={
                  items.length === 0 ? (
                    <Link
                      href="/integrations"
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                    >
                      Connect Meta
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              <div className="space-y-2">
                {/* Sort: urgent → high → medium → low */}
                {[...filtered]
                  .sort((a, b) => {
                    const order = { urgent: 0, high: 1, medium: 2, low: 3 };
                    return order[a.priority] - order[b.priority];
                  })
                  .map((item) => (
                    <div key={item.id}>
                      <CreativeLabItemCard
                        item={item}
                        isSelected={selectedId === item.id}
                        onSelect={(id) =>
                          setSelectedId((prev) => (prev === id ? null : id))
                        }
                      />

                      {/* Mobile inline detail — shows below selected card */}
                      {selectedId === item.id && selectedItem && (
                        <div className="mt-2 lg:hidden">
                          <CreativeLabItemDetail
                            item={selectedItem}
                            onStatusChange={handleStatusChange}
                            onNotesSave={handleNotesSave}
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

        {/* Desktop detail panel — right 7/12, hidden on mobile (rendered inline above) */}
        {selectedId && selectedItem && (
          <div className="hidden lg:block lg:col-span-7">
            <div className="sticky top-6">
              <CreativeLabItemDetail
                item={selectedItem}
                onStatusChange={handleStatusChange}
                onNotesSave={handleNotesSave}
                onClose={() => setSelectedId(null)}
              />
            </div>
          </div>
        )}

        {/* Desktop placeholder when no item is selected */}
        {!selectedId && items.length > 0 && (
          <div className="hidden lg:block lg:col-span-7">
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-800">
              <p className="text-sm text-slate-600">
                Select an item from the queue to review it here
              </p>
            </div>
          </div>
        )}

      </div>

      {/* Bottom nav — link to generate tool + fatigue page */}
      <div className="flex flex-wrap gap-3 border-t border-slate-800/60 pt-4">
        <Link
          href="/creative-lab/refresh-queue"
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Creative Refresh Queue →
        </Link>
        <Link
          href="/creative-lab/generate"
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          AI Copy & Image Generator →
        </Link>
        <Link
          href="/creative-fatigue"
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Creative Fatigue Analysis →
        </Link>
        <Link
          href="/creative-lab/performance"
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Creative Performance →
        </Link>
      </div>

    </div>
  );
}
