"use client";

// app/creative-lab/workspace/CreativeReviewWorkspace.tsx
// Creative Review Workspace — unified high-speed ops view.
//
// Single-page vertical flow:
//   A. Performance Context Header (sticky)
//   B. Current Creative Review (image + copy side-by-side)
//   C. Variation Workbench (generate & review)
//   D. Combination Mockup Area (mix & match)
//   E. Fast Approval Strip (inline approve/reject/favorite)
//   F. Test Builder (lightweight packaging)
//   G. Launch Queue (ready / blocked status)
//
// Desktop: side-by-side panels, dense layout, sticky header
// Mobile:  stacked, collapsible sections, thumb-friendly actions

import { useState, useMemo, useCallback } from "react";
import { useRouter }                       from "next/navigation";
import type { CreativeLabItem }            from "../../../types/creativeLab";
import { formatCurrency }                  from "../../../lib/metricUtils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ClientOption = { id: string; name: string };

type CopyVar = {
  id: string; title: string;
  hook: string; body: string; callToAction: string;
  approvalStatus: string;
};

type ImageVar = {
  id: string; title: string;
  conceptSummary: string; visualChanges: string; goal: string;
  thumbnailUrl?: string | null;
  approvalStatus: string;
};

type Combination = {
  id: string;
  imageVar: ImageVar;
  copyVar: CopyVar;
  rating: "none" | "strong" | "weak" | "favorite";
  readyForTest: boolean;
};

type LaunchQueueItem = {
  id: string; testName: string; campaignName: string | null;
  status: "blocked" | "incomplete" | "ready" | "launched";
  blockedReason: string | null; createdAt: string;
};

type WorkspaceItemExt = CreativeLabItem & {
  briefId?: string | null;
  copyVariations?: CopyVar[];
  imageVariations?: ImageVar[];
};

type Props = {
  clients: ClientOption[];
  initialItems: WorkspaceItemExt[];
  launchQueue: LaunchQueueItem[];
  selectedClientId: string | null;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "text-rose-400",
  high:   "text-amber-400",
  medium: "text-slate-300",
  low:    "text-slate-500",
};

const PRIORITY_BG: Record<string, string> = {
  urgent: "border-rose-800/50 bg-rose-950/40",
  high:   "border-amber-800/50 bg-amber-950/40",
  medium: "border-slate-700 bg-slate-800",
  low:    "border-slate-800 bg-slate-900/40",
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function CreativeReviewWorkspace({
  clients,
  initialItems,
  launchQueue: initialLaunchQueue,
  selectedClientId,
}: Props) {
  const router = useRouter();

  // State
  const [items]          = useState<WorkspaceItemExt[]>(initialItems);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialItems[0]?.id ?? null,
  );
  const [clientFilter, setClientFilter] = useState(selectedClientId ?? "");
  const [combinations, setCombinations] = useState<Combination[]>([]);
  const [testDrafts, setTestDrafts]     = useState<Array<{
    id: string; name: string; combos: Combination[]; status: string;
  }>>([]);
  const [generatingCopy, setGeneratingCopy]   = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [launchQueue] = useState(initialLaunchQueue);

  // Filtered items
  const filtered = useMemo(() => {
    if (!clientFilter) return items;
    return items.filter((i) => i.clientAccountId === clientFilter);
  }, [items, clientFilter]);

  const selected = useMemo(
    () => filtered.find((i) => i.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  // Copy & image variations from the selected item
  const copyVars  = selected?.copyVariations  ?? [];
  const imageVars = selected?.imageVariations ?? [];

  // Handlers
  const handleApproveVariant = useCallback(async (
    variantId: string, decision: "approve" | "reject" | "favorite",
  ) => {
    await fetch("/api/creative-lab/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve_variant", variantId, decision }),
    });
  }, []);

  const addCombination = useCallback((imgVar: ImageVar, cpVar: CopyVar) => {
    const id = `combo-${imgVar.id}-${cpVar.id}`;
    setCombinations((prev) => {
      if (prev.some((c) => c.id === id)) return prev;
      return [...prev, {
        id,
        imageVar: imgVar,
        copyVar: cpVar,
        rating: "none",
        readyForTest: false,
      }];
    });
  }, []);

  const updateComboRating = useCallback((
    comboId: string, rating: Combination["rating"],
  ) => {
    setCombinations((prev) =>
      prev.map((c) => c.id === comboId ? { ...c, rating } : c),
    );
  }, []);

  const markComboReady = useCallback((comboId: string) => {
    setCombinations((prev) =>
      prev.map((c) => c.id === comboId ? { ...c, readyForTest: !c.readyForTest } : c),
    );
  }, []);

  const createTestDraft = useCallback(async () => {
    const readyCombos = combinations.filter((c) => c.readyForTest);
    if (readyCombos.length === 0) return;

    const name = `Test — ${selected?.adName ?? "Ad"} — ${new Date().toLocaleDateString()}`;
    const res = await fetch("/api/creative-lab/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action:          "create_test_draft",
        name,
        combinationIds:  readyCombos.map((c) => c.id),
        clientAccountId: selected?.clientAccountId,
        campaignId:      selected?.campaignId,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setTestDrafts((prev) => [
        ...prev,
        { id: data.draftId, name, combos: readyCombos, status: "draft" },
      ]);
      // Clear ready flags
      setCombinations((prev) =>
        prev.map((c) => c.readyForTest ? { ...c, readyForTest: false } : c),
      );
    }
  }, [combinations, selected]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* ── A. Performance Context Header (sticky) ────────────────────────── */}
      <div className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 backdrop-blur-sm">
        {/* Client selector + item selector */}
        <div className="flex items-center gap-3 border-b border-slate-800/60 px-4 py-2">
          <select
            value={clientFilter}
            onChange={(e) => { setClientFilter(e.target.value); setSelectedId(null); }}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm
              text-slate-200 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Item selector — scrollable horizontal strip */}
          <div className="flex flex-1 gap-2 overflow-x-auto py-1 scrollbar-thin">
            {filtered.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors
                  ${item.id === selectedId
                    ? "border-indigo-500 bg-indigo-950/50 text-indigo-300"
                    : `${PRIORITY_BG[item.priority]} hover:bg-slate-700`
                  }`}
              >
                <span className={`mr-1.5 ${PRIORITY_COLOR[item.priority]}`}>
                  {item.priority === "urgent" ? "!" : item.priority === "high" ? "▲" : "·"}
                </span>
                {item.adName ?? item.campaignName ?? item.clientName}
              </button>
            ))}
          </div>
        </div>

        {/* KPI strip */}
        {selected && (
          <div className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {/* Why this ad needs attention */}
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {selected.recommendationHeadline}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {selected.campaignName} → {selected.adName ?? "Creative"}
                </p>
              </div>
              {/* KPI pills */}
              <div className="flex flex-wrap gap-3 text-xs tabular-nums">
                <KpiPill label="Spend" value={formatCurrency(selected.performanceContext?.spend ?? 0)} />
                <KpiPill
                  label="CTR"
                  value={`${(selected.performanceContext?.avgCtr ?? 0).toFixed(2)}%`}
                  highlight={
                    (selected.performanceContext?.avgCtr ?? 0) < 0.8 ? "bad" :
                    (selected.performanceContext?.avgCtr ?? 0) < 1.2 ? "warn" : "good"
                  }
                />
                <KpiPill
                  label="CPA"
                  value={selected.performanceContext?.campaignCpa != null
                    ? formatCurrency(selected.performanceContext.campaignCpa) : "—"}
                />
                <KpiPill
                  label="ROAS"
                  value={selected.performanceContext?.campaignRoas != null
                    ? `${selected.performanceContext.campaignRoas.toFixed(2)}x` : "—"}
                  highlight={
                    (selected.performanceContext?.campaignRoas ?? 0) < 1 ? "bad" :
                    (selected.performanceContext?.campaignRoas ?? 0) < 2 ? "warn" : "good"
                  }
                />
                {selected.performanceContext?.avgFrequency != null && (
                  <KpiPill
                    label="Freq"
                    value={`${selected.performanceContext.avgFrequency.toFixed(1)}x`}
                    highlight={
                      selected.performanceContext.avgFrequency > 4 ? "bad" :
                      selected.performanceContext.avgFrequency > 3 ? "warn" : "good"
                    }
                  />
                )}
              </div>
              {/* Fatigue / diagnosis badges */}
              <div className="flex gap-2">
                {selected.fatigueContext?.fatigueStatus &&
                  selected.fatigueContext.fatigueStatus !== "not_fatigued" && (
                  <span className="rounded-full border border-amber-800/50 bg-amber-950/40 px-2.5 py-0.5 text-xs font-medium text-amber-300">
                    {selected.fatigueContext.fatigueStatus.replace(/_/g, " ")}
                  </span>
                )}
                {selected.evaluationContext && (
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium
                    ${selected.evaluationContext.status === "strong"
                      ? "border-emerald-800/50 bg-emerald-950/40 text-emerald-300"
                      : selected.evaluationContext.status === "weak"
                      ? "border-rose-800/50 bg-rose-950/40 text-rose-300"
                      : "border-slate-700 bg-slate-800 text-slate-400"
                    }`}>
                    {selected.evaluationContext.status}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {selected ? (
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
          {/* ── B. Current Creative Review ──────────────────────────────── */}
          <section>
            <SectionLabel>Current Creative</SectionLabel>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Image preview */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                {selected.performanceContext?.thumbnailUrl ? (
                  <div className="aspect-square overflow-hidden rounded-lg bg-slate-800">
                    <img
                      src={selected.performanceContext.thumbnailUrl}
                      alt="Current creative"
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-square items-center justify-center rounded-lg bg-slate-800 text-slate-600">
                    No image preview
                  </div>
                )}
              </div>

              {/* Copy + analysis */}
              <div className="space-y-3">
                {/* Hook */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-500">Hook</p>
                  <p className="text-sm text-white leading-relaxed">
                    {extractHook(selected.performanceContext?.adCopy) ?? "No copy available"}
                  </p>
                </div>

                {/* Body */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-500">Body</p>
                  <p className="whitespace-pre-line text-sm text-slate-300 leading-relaxed max-h-32 overflow-y-auto">
                    {selected.performanceContext?.adCopy ?? "—"}
                  </p>
                </div>

                {/* CTA */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-500">CTA</p>
                  <p className="text-sm font-medium text-indigo-300">
                    {selected.performanceContext?.callToAction ?? "—"}
                  </p>
                </div>

                {/* Diagnosis */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Diagnosis
                  </p>
                  <p className="text-sm text-slate-300">{selected.recommendationRationale}</p>
                  {selected.suggestedNextAction && (
                    <p className="mt-2 text-xs text-indigo-400">
                      → {selected.suggestedNextAction}
                    </p>
                  )}
                  {/* Fatigue signals */}
                  {selected.fatigueContext?.fatigueSignals && selected.fatigueContext.fatigueSignals.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {selected.fatigueContext.fatigueSignals.map((s, i) => (
                        <span
                          key={i}
                          className={`rounded-md px-2 py-0.5 text-xs ${
                            s.severity === "critical"
                              ? "bg-rose-950/40 text-rose-300"
                              : "bg-amber-950/40 text-amber-300"
                          }`}
                        >
                          {s.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* ── C. Variation Workbench ──────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between">
              <SectionLabel>Variation Workbench</SectionLabel>
              <div className="flex gap-2">
                <ActionBtn
                  onClick={async () => {
                    setGeneratingCopy(true);
                    try {
                      // Trigger generation via existing API
                      if (selected.briefId) {
                        await fetch("/api/creative-lab/generation", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            briefId: selected.briefId,
                            requestType: "copy",
                          }),
                        });
                        router.refresh();
                      }
                    } finally {
                      setGeneratingCopy(false);
                    }
                  }}
                  loading={generatingCopy}
                >
                  Generate Copy
                </ActionBtn>
                <ActionBtn
                  onClick={async () => {
                    setGeneratingImage(true);
                    try {
                      if (selected.briefId) {
                        await fetch("/api/creative-lab/generation", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            briefId: selected.briefId,
                            requestType: "image",
                          }),
                        });
                        router.refresh();
                      }
                    } finally {
                      setGeneratingImage(false);
                    }
                  }}
                  loading={generatingImage}
                >
                  Generate Images
                </ActionBtn>
              </div>
            </div>

            <div className="mt-3 grid gap-4 md:grid-cols-2">
              {/* Image variations */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Image Concepts ({imageVars.length})
                </p>
                {imageVars.length === 0 ? (
                  <EmptySlot>No image variations yet. Generate or upload.</EmptySlot>
                ) : (
                  <div className="space-y-2">
                    {imageVars.map((iv) => (
                      <div
                        key={iv.id}
                        className={`rounded-lg border p-3 transition-colors cursor-pointer
                          ${iv.approvalStatus === "approve"
                            ? "border-emerald-700 bg-emerald-950/20"
                            : iv.approvalStatus === "reject"
                            ? "border-rose-800/50 bg-rose-950/10 opacity-50"
                            : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
                          }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-white">{iv.title}</p>
                            <p className="mt-1 text-xs text-slate-400">{iv.conceptSummary}</p>
                            <p className="mt-1 text-xs text-slate-600">{iv.visualChanges}</p>
                          </div>
                          {/* Inline approval */}
                          <div className="flex shrink-0 gap-1">
                            <MicroBtn
                              active={iv.approvalStatus === "approve"}
                              onClick={() => handleApproveVariant(iv.id, "approve")}
                              title="Approve"
                            >✓</MicroBtn>
                            <MicroBtn
                              active={iv.approvalStatus === "reject"}
                              onClick={() => handleApproveVariant(iv.id, "reject")}
                              title="Reject"
                              danger
                            >✕</MicroBtn>
                          </div>
                        </div>
                        {/* Pair button */}
                        {iv.approvalStatus !== "reject" && copyVars.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {copyVars
                              .filter((cv) => cv.approvalStatus !== "reject")
                              .map((cv) => (
                                <button
                                  key={cv.id}
                                  onClick={() => addCombination(iv, cv)}
                                  className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5
                                    text-[10px] text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                                  title={`Pair with: ${cv.title}`}
                                >
                                  + {cv.title}
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Copy variations */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Copy Variations ({copyVars.length})
                </p>
                {copyVars.length === 0 ? (
                  <EmptySlot>No copy variations yet. Generate from brief.</EmptySlot>
                ) : (
                  <div className="space-y-2">
                    {copyVars.map((cv) => (
                      <div
                        key={cv.id}
                        className={`rounded-lg border p-3 transition-colors
                          ${cv.approvalStatus === "approve"
                            ? "border-emerald-700 bg-emerald-950/20"
                            : cv.approvalStatus === "reject"
                            ? "border-rose-800/50 bg-rose-950/10 opacity-50"
                            : "border-slate-800 bg-slate-900/60"
                          }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-white">{cv.title}</p>
                            <div className="mt-1.5 space-y-1">
                              <p className="text-xs">
                                <span className="text-slate-600">Hook: </span>
                                <span className="text-indigo-300">{cv.hook}</span>
                              </p>
                              <p className="text-xs text-slate-400 line-clamp-2">{cv.body}</p>
                              <p className="text-xs">
                                <span className="text-slate-600">CTA: </span>
                                <span className="text-slate-300">{cv.callToAction}</span>
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <MicroBtn
                              active={cv.approvalStatus === "approve"}
                              onClick={() => handleApproveVariant(cv.id, "approve")}
                              title="Approve"
                            >✓</MicroBtn>
                            <MicroBtn
                              active={cv.approvalStatus === "reject"}
                              onClick={() => handleApproveVariant(cv.id, "reject")}
                              title="Reject"
                              danger
                            >✕</MicroBtn>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ── D. Combination Mockup Area ──────────────────────────────── */}
          {combinations.length > 0 && (
            <section>
              <SectionLabel>Combination Mockups ({combinations.length})</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {combinations.map((combo) => (
                  <div
                    key={combo.id}
                    className={`rounded-xl border p-4 transition-colors
                      ${combo.rating === "favorite"
                        ? "border-indigo-500 bg-indigo-950/20 ring-1 ring-indigo-500/30"
                        : combo.rating === "strong"
                        ? "border-emerald-700 bg-emerald-950/15"
                        : combo.rating === "weak"
                        ? "border-slate-800 bg-slate-900/40 opacity-60"
                        : "border-slate-800 bg-slate-900/60"
                      }`}
                  >
                    {/* Image concept */}
                    <div className="mb-3">
                      {combo.imageVar.thumbnailUrl ? (
                        <div className="aspect-video overflow-hidden rounded-lg bg-slate-800">
                          <img
                            src={combo.imageVar.thumbnailUrl}
                            alt={combo.imageVar.title}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex aspect-video items-center justify-center rounded-lg bg-slate-800/60 text-xs text-slate-600">
                          {combo.imageVar.title}
                        </div>
                      )}
                    </div>

                    {/* Copy */}
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-indigo-300">{combo.copyVar.hook}</p>
                      <p className="text-xs text-slate-400 line-clamp-3">{combo.copyVar.body}</p>
                      <p className="text-xs text-slate-500">CTA: {combo.copyVar.callToAction}</p>
                    </div>

                    {/* ── E. Fast Approval Strip (inline per combo) ────── */}
                    <div className="mt-3 flex items-center gap-1.5 border-t border-slate-800/60 pt-3">
                      <RatingBtn
                        active={combo.rating === "favorite"}
                        onClick={() => updateComboRating(combo.id, combo.rating === "favorite" ? "none" : "favorite")}
                        className="text-indigo-400"
                        title="Favorite"
                      >★</RatingBtn>
                      <RatingBtn
                        active={combo.rating === "strong"}
                        onClick={() => updateComboRating(combo.id, combo.rating === "strong" ? "none" : "strong")}
                        className="text-emerald-400"
                        title="Strong"
                      >▲</RatingBtn>
                      <RatingBtn
                        active={combo.rating === "weak"}
                        onClick={() => updateComboRating(combo.id, combo.rating === "weak" ? "none" : "weak")}
                        className="text-slate-500"
                        title="Weak"
                      >▼</RatingBtn>
                      <div className="flex-1" />
                      <button
                        onClick={() => markComboReady(combo.id)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors
                          ${combo.readyForTest
                            ? "bg-indigo-600 text-white"
                            : "border border-slate-700 bg-slate-800 text-slate-400 hover:text-white"
                          }`}
                      >
                        {combo.readyForTest ? "Ready ✓" : "Mark for Test"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── F. Test Builder ─────────────────────────────────────────── */}
          {combinations.some((c) => c.readyForTest) && (
            <section>
              <SectionLabel>Test Builder</SectionLabel>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white">
                      {combinations.filter((c) => c.readyForTest).length} combination(s) ready for test
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {selected.campaignName ?? "No campaign"} — {selected.adName ?? "Ad"}
                    </p>
                  </div>
                  <button
                    onClick={createTestDraft}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white
                      transition-colors hover:bg-indigo-500 active:scale-95"
                  >
                    Create Test Draft
                  </button>
                </div>

                {/* Ready combos summary */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {combinations
                    .filter((c) => c.readyForTest)
                    .map((c) => (
                      <span
                        key={c.id}
                        className="rounded-md border border-indigo-800/50 bg-indigo-950/30 px-2 py-1 text-xs text-indigo-300"
                      >
                        {c.imageVar.title} × {c.copyVar.title}
                      </span>
                    ))}
                </div>
              </div>
            </section>
          )}

          {/* Test drafts created this session */}
          {testDrafts.length > 0 && (
            <section>
              <SectionLabel>Created Test Drafts ({testDrafts.length})</SectionLabel>
              <div className="space-y-2">
                {testDrafts.map((td) => (
                  <div
                    key={td.id}
                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm text-white">{td.name}</p>
                      <p className="text-xs text-slate-500">{td.combos.length} combination(s)</p>
                    </div>
                    <span className="rounded-full border border-emerald-800/50 bg-emerald-950/40 px-2.5 py-0.5 text-xs text-emerald-300">
                      {td.status}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── G. Launch Queue ─────────────────────────────────────────── */}
          <section>
            <SectionLabel>Launch Queue ({launchQueue.length})</SectionLabel>
            {launchQueue.length === 0 ? (
              <EmptySlot>No items in launch queue yet.</EmptySlot>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/80 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">
                      <th className="px-4 py-2.5">Test</th>
                      <th className="hidden px-4 py-2.5 sm:table-cell">Campaign</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="hidden px-4 py-2.5 md:table-cell">Blocker</th>
                    </tr>
                  </thead>
                  <tbody>
                    {launchQueue.map((lq) => (
                      <tr key={lq.id} className="border-b border-slate-800/60 last:border-0">
                        <td className="px-4 py-2.5 text-white">{lq.testName}</td>
                        <td className="hidden px-4 py-2.5 text-slate-400 sm:table-cell">
                          {lq.campaignName ?? "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium
                            ${lq.status === "ready"
                              ? "border-emerald-800/50 bg-emerald-950/40 text-emerald-300"
                              : lq.status === "launched"
                              ? "border-sky-800/50 bg-sky-950/40 text-sky-300"
                              : lq.status === "blocked"
                              ? "border-rose-800/50 bg-rose-950/40 text-rose-300"
                              : "border-amber-800/50 bg-amber-950/40 text-amber-300"
                            }`}
                          >
                            {lq.status}
                          </span>
                        </td>
                        <td className="hidden px-4 py-2.5 text-xs text-slate-600 md:table-cell">
                          {lq.blockedReason ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <p className="text-4xl text-slate-700">◇</p>
            <p className="mt-3 text-sm text-slate-500">
              {filtered.length === 0
                ? "No creatives need attention right now."
                : "Select a creative to begin review."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KpiPill({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "good" | "warn" | "bad";
}) {
  const color =
    highlight === "good" ? "text-emerald-400" :
    highlight === "warn" ? "text-amber-300"   :
    highlight === "bad"  ? "text-rose-400"    : "text-slate-200";

  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-slate-600">{label}</span>
      <span className={`font-semibold ${color}`}>{value}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
      {children}
    </h2>
  );
}

function EmptySlot({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/30 p-6 text-center text-xs text-slate-600">
      {children}
    </div>
  );
}

function ActionBtn({
  onClick,
  children,
  loading = false,
}: {
  onClick: () => void;
  children: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium
        text-slate-200 transition-colors hover:bg-slate-700 disabled:opacity-50 active:scale-95"
    >
      {loading ? "..." : children}
    </button>
  );
}

function MicroBtn({
  onClick,
  children,
  active = false,
  danger = false,
  title,
}: {
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  danger?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold transition-colors
        ${active
          ? danger
            ? "bg-rose-600 text-white"
            : "bg-emerald-600 text-white"
          : "border border-slate-700 bg-slate-800 text-slate-500 hover:text-white"
        }`}
    >
      {children}
    </button>
  );
}

function RatingBtn({
  onClick,
  children,
  active = false,
  className = "",
  title,
}: {
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold transition-all
        ${active
          ? `bg-slate-700 ${className} scale-110`
          : "border border-slate-700 bg-slate-800 text-slate-600 hover:text-slate-300"
        }`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractHook(adCopy?: string | null): string | null {
  if (!adCopy) return null;
  const lines = adCopy.split("\n").filter(Boolean);
  return lines[0] ?? adCopy.slice(0, 120);
}
