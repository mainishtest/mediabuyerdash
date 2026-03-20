"use client";

// app/creative-lab/publish-prep/PublishPrepView.tsx
// Client orchestrator for the publish preparation page.
//
// Responsive layout:
//   Mobile:  stacked — stat cards → prep item list → selected detail below
//   Desktop: left col-4 (filter + list) | right col-8 (sticky detail panel)
//
// State:
//   - items loaded server-side, refreshed after each action
//   - selected item drives the detail panel
//   - actions POST/PATCH to the API and refresh in-place

import { useState, useCallback, useMemo } from "react";
import Link                               from "next/link";
import type {
  PublishPrepItem,
  PublishPrepSummary,
}                                         from "../../../types/publishPrep";
import {
  PREP_STATUS_LABEL,
}                                         from "../../../types/publishPrep";
import {
  PageHeader,
  SectionCard,
  Badge,
  StatCard,
  EmptyState,
}                                         from "../../../components/ui";
import { PublishPrepItemCard }            from "./PublishPrepItemCard";
import { PublishPrepDetail }              from "./PublishPrepDetail";

type PrepAction = "approve" | "reject" | "hold" | "publish" | "set_target" | "set_notes";

type Props = {
  initialItems:   PublishPrepItem[];
  initialSummary: PublishPrepSummary;
  clientAccountId?: string;
};

export function PublishPrepView({ initialItems, initialSummary, clientAccountId }: Props) {
  const [items,     setItems]     = useState<PublishPrepItem[]>(initialItems);
  const [summary,   setSummary]   = useState<PublishPrepSummary>(initialSummary);
  const [selectedId, setSelectedId] = useState<string | null>(initialItems[0]?.id ?? null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const selectedItem = useMemo(
    () => items.find((i) => i.id === selectedId) ?? null,
    [items, selectedId],
  );

  // Re-fetch a single item and merge into list
  const refreshItem = useCallback(async (id: string) => {
    try {
      const res  = await fetch(`/api/creative-lab/publish-prep/${id}`);
      const data = await res.json();
      if (data.ok && data.item) {
        setItems((prev) => prev.map((i) => i.id === id ? data.item : i));
      }
    } catch { /* non-critical */ }
  }, []);

  // Handle action for a specific item (accepts explicit itemId so mobile stacked view works)
  const handleAction = useCallback(
    async (itemId: string, action: PrepAction, data?: Record<string, unknown>) => {
      if (!itemId || pendingId) return;
      setPendingId(itemId);
      setError(null);

      try {
        const res  = await fetch(`/api/creative-lab/publish-prep/${itemId}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ action, ...data }),
        });
        const json = await res.json();

        if (!json.ok) {
          setError(json.error ?? "Action failed — try again.");
        } else {
          await refreshItem(itemId);
        }
      } catch {
        setError("Network error — check your connection.");
      } finally {
        setPendingId(null);
      }
    },
    [pendingId, refreshItem],
  );

  // Filtered list
  const visibleItems = useMemo(() => {
    if (statusFilter === "all") return items;
    return items.filter((i) => i.status === statusFilter);
  }, [items, statusFilter]);

  const statusOptions = [
    { value: "all",               label: "All" },
    { value: "blocked",           label: "Blocked" },
    { value: "ready_for_approval",label: "Ready for Approval" },
    { value: "approved_for_launch", label: "Approved" },
    { value: "ready_to_publish",  label: "Ready to Publish" },
    { value: "held",              label: "Held" },
    { value: "published",         label: "Published" },
    { value: "publish_failed",    label: "Failed" },
  ];

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <PageHeader
        title="Publish Preparation"
        description="Validate, map, and approve creative drafts for guarded launch."
        badge={<Badge variant="warning">Launch Prep</Badge>}
        actions={
          <Link
            href="/creative-lab/review"
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm
              font-medium text-slate-200 transition-colors hover:bg-slate-700"
          >
            ← Draft Review
          </Link>
        }
      />

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Prep Items"    value={summary.total}             sub="in workflow" />
        <StatCard label="Blocked"             value={summary.blocked}           sub="need resolution" />
        <StatCard label="Ready for Approval"  value={summary.readyForApproval}  sub="awaiting sign-off" />
        <StatCard label="Published"           value={summary.published}         sub="launched" />
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-xl border border-rose-800/50 bg-rose-950/20 px-4 py-3">
          <p className="text-xs text-rose-300">{error}</p>
          <button onClick={() => setError(null)} className="mt-1 text-xs text-slate-500 underline">Dismiss</button>
        </div>
      )}

      {/* ── Main split layout ── */}
      <div className="grid gap-6 lg:grid-cols-12">

        {/* ── Left: filter + list ── */}
        <div className="space-y-4 lg:col-span-4">
          <SectionCard title="Prep Queue" description={`${visibleItems.length} item${visibleItems.length !== 1 ? "s" : ""}`}>

            {/* Status filter */}
            <div className="mb-4 flex flex-wrap gap-1.5">
              {statusOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={`rounded-lg px-2.5 py-2 text-xs font-medium transition-colors
                    ${statusFilter === opt.value
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {visibleItems.length === 0 ? (
              <EmptyState
                icon="◈"
                title="No prep items"
                description={
                  statusFilter === "all"
                    ? "Approve drafts from the review page to create publish prep items."
                    : `No items with status "${PREP_STATUS_LABEL[statusFilter as never] ?? statusFilter}".`
                }
                action={
                  <Link
                    href="/creative-lab/review"
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                  >
                    Go to Draft Review
                  </Link>
                }
              />
            ) : (
              <div className="space-y-2">
                {visibleItems.map((item) => (
                  <PublishPrepItemCard
                    key={item.id}
                    item={item}
                    isSelected={selectedId === item.id}
                    onSelect={setSelectedId}
                  />
                ))}
              </div>
            )}
          </SectionCard>

          {/* Quick links */}
          <div className="flex flex-wrap gap-3 px-1">
            <Link href="/creative-lab"               className="text-xs text-slate-600 hover:text-slate-300 transition-colors">← Creative Lab</Link>
            <Link href="/creative-lab/briefs"        className="text-xs text-slate-600 hover:text-slate-300 transition-colors">Briefs</Link>
            <Link href="/creative-lab/review"        className="text-xs text-slate-600 hover:text-slate-300 transition-colors">Review</Link>
            {clientAccountId && (
              <Link href={`/creative-lab/refresh-queue?clientId=${encodeURIComponent(clientAccountId)}`}
                className="text-xs text-slate-600 hover:text-slate-300 transition-colors">
                Refresh Queue
              </Link>
            )}
          </div>
        </div>

        {/* ── Right: detail ── */}
        <div className="lg:col-span-8">
          {selectedItem ? (
            <div className="lg:sticky lg:top-6">
              <PublishPrepDetail
                item={selectedItem}
                onAction={(action, data) => handleAction(selectedItem.id, action, data)}
                actionPending={pendingId === selectedItem.id}
              />
            </div>
          ) : (
            <div className="hidden lg:flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-800">
              <p className="text-sm text-slate-600">Select a prep item from the list to review</p>
            </div>
          )}

          {/* Mobile: show all stacked if no selection */}
          {!selectedItem && visibleItems.length > 0 && (
            <div className="space-y-4 lg:hidden">
              {visibleItems.map((item) => (
                <PublishPrepDetail
                  key={item.id}
                  item={item}
                  onAction={(action, data) => handleAction(item.id, action, data)}
                  actionPending={pendingId === item.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
