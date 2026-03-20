"use client";

// app/creative-lab/briefs/BriefsView.tsx
// Creative Briefs — main client-side orchestrator.
//
// Responsive layout:
//   Mobile:  summary cards (2-col) → filter bar → stacked brief cards →
//            detail section expands inline below selected card
//   Desktop: summary cards (4-col) → filter bar →
//            left 5/12 queue list | right 7/12 sticky detail panel

import { useState, useMemo, useCallback } from "react";
import { useRouter }                      from "next/navigation";
import Link                               from "next/link";
import type {
  CreativeBrief,
  CreativeBriefStatus,
  CreativeReviewDecision,
  CreativeDraftType,
}                                         from "../../../types/creativeBrief";
import { buildCreativeReviewSummary }     from "../../../lib/creativeBrief/briefs";
import {
  PageHeader,
  StatCard,
  SectionCard,
  Badge,
  EmptyState,
}                                         from "../../../components/ui";
import { BriefCard, STATUS_LABEL, STATUS_VARIANT } from "./BriefCard";
import { BriefDetail }                    from "./BriefDetail";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ClientOption = { id: string; name: string };

type Props = {
  clients:          ClientOption[];
  initialBriefs:    CreativeBrief[];
  selectedClientId: string | null;
};

// ---------------------------------------------------------------------------
// Filter select helper
// ---------------------------------------------------------------------------

function FilterSelect({ label, value, onChange, children }: {
  label: string; value: string; onChange: (v: string) => void; children: React.ReactNode;
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

export function BriefsView({ clients, initialBriefs, selectedClientId }: Props) {
  const router = useRouter();

  const [briefs, setBriefs]             = useState<CreativeBrief[]>(initialBriefs);
  const [selectedId, setSelectedId]     = useState<string | null>(null);
  const [clientFilter, setClientFilter] = useState(selectedClientId ?? "");
  const [statusFilter, setStatusFilter] = useState<CreativeBriefStatus | "all">("all");
  const [typeFilter, setTypeFilter]     = useState<CreativeDraftType | "all">("all");

  const summary  = useMemo(() => buildCreativeReviewSummary(briefs), [briefs]);

  const filtered = useMemo(() =>
    briefs.filter((b) => {
      if (clientFilter && b.clientAccountId !== clientFilter) return false;
      if (statusFilter !== "all" && b.status !== statusFilter)  return false;
      if (typeFilter   !== "all" && b.draftType !== typeFilter)  return false;
      return true;
    }),
    [briefs, clientFilter, statusFilter, typeFilter],
  );

  const selectedBrief = useMemo(
    () => (selectedId ? briefs.find((b) => b.id === selectedId) ?? null : null),
    [selectedId, briefs],
  );

  const hasFilters = clientFilter !== "" || statusFilter !== "all" || typeFilter !== "all";

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  function handleClientChange(id: string) {
    setClientFilter(id);
    if (id) {
      router.push(`/creative-lab/briefs?clientId=${encodeURIComponent(id)}`, { scroll: false });
    } else {
      router.push("/creative-lab/briefs", { scroll: false });
    }
    setSelectedId(null);
  }

  const handleStatusChange = useCallback(
    async (briefId: string, status: CreativeBriefStatus, notes?: string) => {
      // Snapshot for rollback
      const prev = briefs;
      setBriefs((bs) =>
        bs.map((b) => b.id === briefId ? { ...b, status, updatedAt: new Date().toISOString() } : b),
      );
      try {
        const res = await fetch(`/api/creative-lab/briefs/${encodeURIComponent(briefId)}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ action: "status", status, notes }),
        });
        if (!res.ok) setBriefs(prev); // rollback on failure
      } catch (err) {
        console.error("[briefs status]", err);
        setBriefs(prev);
      }
    },
    [briefs],
  );

  const handleVariantReview = useCallback(
    async (briefId: string, variantId: string, decision: CreativeReviewDecision) => {
      // Snapshot for rollback
      const prev = briefs;
      setBriefs((bs) =>
        bs.map((b) => {
          if (b.id !== briefId) return b;
          return {
            ...b,
            draftSet: {
              ...b.draftSet,
              variants: b.draftSet.variants.map((v) =>
                v.id === variantId
                  ? { ...v, reviewDecision: decision, reviewedAt: new Date().toISOString() }
                  : v
              ),
            },
          };
        }),
      );
      try {
        const res = await fetch(`/api/creative-lab/briefs/${encodeURIComponent(briefId)}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ action: "variant", variantId, reviewDecision: decision }),
        });
        if (!res.ok) setBriefs(prev); // rollback on failure
      } catch (err) {
        console.error("[briefs variant]", err);
        setBriefs(prev);
      }
    },
    [briefs],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6">

      {/* Header */}
      <PageHeader
        title="Creative Briefs"
        description="Generated refresh briefs and draft variants for review and approval."
        badge={<Badge variant="info">Brief Review</Badge>}
        actions={
          <Link
            href="/creative-lab/refresh-queue"
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm
              font-medium text-slate-200 transition-colors hover:bg-slate-700"
          >
            ← Refresh Queue
          </Link>
        }
      />

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Briefs"      value={summary.total}             sub="all briefs" />
        <StatCard label="Awaiting Review"   value={summary.draft + summary.inReview} sub="draft + in review" />
        <StatCard label="Approved"          value={summary.approved}          sub="ready for next step" />
        <StatCard label="Needs Revision"    value={summary.revisionRequested} sub="returned for changes" />
      </div>

      {/* Filter bar */}
      <SectionCard>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="mb-1 text-xs text-slate-500">Client</p>
            <select
              value={clientFilter}
              onChange={(e) => handleClientChange(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm
                text-slate-200 focus:border-slate-600 focus:outline-none"
            >
              <option value="">All clients</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <FilterSelect label="Status" value={statusFilter} onChange={(v) => setStatusFilter(v as CreativeBriefStatus | "all")}>
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="in_review">In Review</option>
            <option value="approved">Approved</option>
            <option value="revision_requested">Needs Revision</option>
            <option value="rejected">Rejected</option>
          </FilterSelect>

          <FilterSelect label="Draft Type" value={typeFilter} onChange={(v) => setTypeFilter(v as CreativeDraftType | "all")}>
            <option value="all">All types</option>
            <option value="copy_variation">Copy Variations</option>
            <option value="headline_variation">Headline Variations</option>
            <option value="angle_variation">Angle Variations</option>
            <option value="image_brief">Image Briefs</option>
            <option value="full_refresh_brief">Full Brief</option>
          </FilterSelect>

          {hasFilters && (
            <button
              onClick={() => { setClientFilter(""); setStatusFilter("all"); setTypeFilter("all"); }}
              className="self-end pb-0.5 text-xs text-slate-400 underline hover:text-slate-200"
            >
              Clear filters
            </button>
          )}

          <span className="ml-auto self-end pb-0.5 text-xs text-slate-500">
            {filtered.length} of {briefs.length} briefs
          </span>
        </div>
      </SectionCard>

      {/* List + Detail split */}
      <div className={`grid gap-6 ${selectedId ? "lg:grid-cols-12" : ""}`}>

        {/* Brief list */}
        <div className={selectedId ? "lg:col-span-5" : ""}>
          <SectionCard
            title="Brief Queue"
            description={
              filtered.length === 0
                ? "No briefs match the current filters."
                : `${filtered.length} brief${filtered.length !== 1 ? "s" : ""} — click to review`
            }
          >
            {filtered.length === 0 ? (
              <EmptyState
                icon="◻"
                title={briefs.length === 0 ? "No briefs yet" : "No briefs match filters"}
                description={
                  briefs.length === 0
                    ? "Go to the Refresh Queue and click a creative action to generate your first brief."
                    : "Try clearing the filters."
                }
                action={
                  briefs.length === 0 ? (
                    <Link
                      href="/creative-lab/refresh-queue"
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                    >
                      Open Refresh Queue
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              <div className="space-y-2">
                {filtered.map((brief) => (
                  <div key={brief.id}>
                    <BriefCard
                      brief={brief}
                      isSelected={selectedId === brief.id}
                      onSelect={(id) => setSelectedId((prev) => (prev === id ? null : id))}
                    />

                    {/* Mobile inline detail */}
                    {selectedId === brief.id && selectedBrief && (
                      <div className="mt-2 lg:hidden">
                        <BriefDetail
                          brief={selectedBrief}
                          onStatusChange={handleStatusChange}
                          onVariantReview={handleVariantReview}
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
        {selectedId && selectedBrief && (
          <div className="hidden lg:block lg:col-span-7">
            <div className="sticky top-6">
              <BriefDetail
                brief={selectedBrief}
                onStatusChange={handleStatusChange}
                onVariantReview={handleVariantReview}
                onClose={() => setSelectedId(null)}
              />
            </div>
          </div>
        )}

        {/* Desktop placeholder */}
        {!selectedId && briefs.length > 0 && (
          <div className="hidden lg:block lg:col-span-7">
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-800">
              <p className="text-sm text-slate-600">Select a brief to review drafts and take action</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div className="flex flex-wrap gap-3 border-t border-slate-800/60 pt-4">
        <Link href="/creative-lab"             className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← Creative Lab</Link>
        <Link href="/creative-lab/refresh-queue" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Refresh Queue →</Link>
        <Link href="/creative-fatigue"         className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Fatigue Analysis →</Link>
      </div>

    </div>
  );
}
