"use client";

import { useState, useMemo }          from "react";
import { useRouter, useSearchParams }  from "next/navigation";
import type {
  LearningMemoryEntry,
  LearningSummary,
  LearningCategory,
  LearningConfidence,
  LearningSourceType,
} from "../../../lib/learningMemory/types";
import {
  CATEGORY_LABEL,
  SOURCE_LABEL,
  extractLearningPatterns,
  groupByCategory,
} from "../../../lib/learningMemory/patterns";
import { SummaryBar }       from "./sections/SummaryBar";
import { FlatLearningsList, GroupedLearningsList } from "./sections/LearningsList";
import { PatternsSummary }  from "./sections/PatternsSummary";

// ── Filter bar ────────────────────────────────────────────────────────────────

type LocalFilters = {
  category:   LearningCategory | "";
  confidence: LearningConfidence | "";
  sourceType: LearningSourceType | "";
  grouped:    boolean;
};

function FilterBar({
  clients,
  selectedClientId,
  dateFrom,
  dateTo,
  local,
  onClientChange,
  onDateChange,
  onLocalChange,
}: {
  clients:           { id: string; name: string }[];
  selectedClientId:  string;
  dateFrom:          string;
  dateTo:            string;
  local:             LocalFilters;
  onClientChange:    (id: string) => void;
  onDateChange:      (from: string, to: string) => void;
  onLocalChange:     (patch: Partial<LocalFilters>) => void;
}) {
  const [localFrom, setLocalFrom] = useState(dateFrom);
  const [localTo,   setLocalTo]   = useState(dateTo);

  const sel =
    "rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 " +
    "outline-none focus:border-emerald-600 transition-colors hover:border-slate-600";

  return (
    <div className="flex flex-wrap items-end gap-2">
      {/* Client */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">Client</label>
        <select value={selectedClientId} onChange={(e) => onClientChange(e.target.value)} className={sel}>
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Date from */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">From</label>
        <input type="date" value={localFrom}
          onChange={(e) => setLocalFrom(e.target.value)}
          onBlur={() => onDateChange(localFrom, localTo)}
          className={sel}
        />
      </div>

      {/* Date to */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">To</label>
        <input type="date" value={localTo}
          onChange={(e) => setLocalTo(e.target.value)}
          onBlur={() => onDateChange(localFrom, localTo)}
          className={sel}
        />
      </div>

      {/* Category */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">Category</label>
        <select value={local.category} onChange={(e) => onLocalChange({ category: e.target.value as LearningCategory | "" })} className={sel}>
          <option value="">All categories</option>
          {(Object.entries(CATEGORY_LABEL) as [LearningCategory, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Confidence */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">Confidence</label>
        <select value={local.confidence} onChange={(e) => onLocalChange({ confidence: e.target.value as LearningConfidence | "" })} className={sel}>
          <option value="">All levels</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Source */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">Source</label>
        <select value={local.sourceType} onChange={(e) => onLocalChange({ sourceType: e.target.value as LearningSourceType | "" })} className={sel}>
          <option value="">All sources</option>
          {(Object.entries(SOURCE_LABEL) as [LearningSourceType, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Group toggle */}
      <label className="flex cursor-pointer items-center gap-2 pb-1.5">
        <input
          type="checkbox"
          checked={local.grouped}
          onChange={(e) => onLocalChange({ grouped: e.target.checked })}
          className="h-3.5 w-3.5 accent-emerald-500"
        />
        <span className="text-xs text-slate-400">Group by category</span>
      </label>
    </div>
  );
}

// ── Card wrapper ──────────────────────────────────────────────────────────────

function Section({ title, count, children }: {
  title:    string;
  count?:   number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40">
      <div className="border-b border-slate-800/60 px-5 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {count !== undefined && (
            <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
              {count}
            </span>
          )}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function LearningMemoryView({
  entries,
  summary,
  clients,
  dateRange,
  selectedClientId: initClientId,
}: {
  entries:           LearningMemoryEntry[];
  summary:           LearningSummary;
  clients:           { id: string; name: string }[];
  dateRange:         { from: string; to: string };
  selectedClientId:  string;
}) {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [local, setLocal] = useState<LocalFilters>({
    category:   "",
    confidence: "",
    sourceType: "",
    grouped:    false,
  });

  function handleClientChange(id: string) {
    const sp = new URLSearchParams(searchParams.toString());
    if (id) sp.set("clientId", id); else sp.delete("clientId");
    router.push(`/insights/memory?${sp.toString()}`);
  }

  function handleDateChange(from: string, to: string) {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("from", from);
    sp.set("to", to);
    router.push(`/insights/memory?${sp.toString()}`);
  }

  // Client-side filter (no re-fetch)
  const filtered = useMemo(() => {
    let list = entries;
    if (local.category)   list = list.filter((e) => e.category   === local.category);
    if (local.confidence) list = list.filter((e) => e.confidence === local.confidence);
    if (local.sourceType) list = list.filter((e) => e.sourceType === local.sourceType);
    return list;
  }, [entries, local]);

  const topLearnings    = useMemo(() => filtered.slice(0, 5),                              [filtered]);
  const patterns        = useMemo(() => extractLearningPatterns(filtered).slice(0, 5),    [filtered]);
  const categoryGroups  = useMemo(() => groupByCategory(filtered),                         [filtered]);

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-screen-xl">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Phase 4 · Learning Memory
              </p>
              <h1 className="mt-0.5 text-lg font-semibold text-white">
                Creative & Experiment Learning Memory
              </h1>
            </div>
            <p className="text-xs text-slate-600">
              {dateRange.from} – {dateRange.to} · 90-day default window
            </p>
          </div>
          <FilterBar
            clients={clients}
            selectedClientId={initClientId}
            dateFrom={dateRange.from}
            dateTo={dateRange.to}
            local={local}
            onClientChange={handleClientChange}
            onDateChange={handleDateChange}
            onLocalChange={(patch) => setLocal((prev) => ({ ...prev, ...patch }))}
          />
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-screen-xl space-y-5 px-4 py-5 sm:px-6">

        {/* Summary bar */}
        <SummaryBar summary={summary} />

        {/* Mobile: top learnings first, then patterns */}
        {/* Desktop: 2-col (top learnings | patterns) */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Section title="Top Learnings" count={topLearnings.length}>
            <FlatLearningsList
              entries={topLearnings}
              emptyMessage="No learnings match your current filters. Try widening the date range or removing filters."
            />
          </Section>

          <Section title="Recurring Patterns" count={patterns.length}>
            <PatternsSummary patterns={patterns} />
          </Section>
        </div>

        {/* All learnings */}
        <Section title="All Learnings" count={filtered.length}>
          {local.grouped ? (
            <GroupedLearningsList groups={categoryGroups} />
          ) : (
            <FlatLearningsList
              entries={filtered}
              emptyMessage="No learnings match your current filters."
            />
          )}
        </Section>

        {/* Client breakdown */}
        {summary.clientsWithLearnings.length > 1 && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-4">
            <h2 className="mb-3 text-sm font-semibold text-white">Learnings by Client</h2>
            <div className="flex flex-wrap gap-2">
              {summary.clientsWithLearnings.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleClientChange(c.id)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800
                             px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-emerald-600
                             hover:text-emerald-300"
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="rounded-full border border-slate-600 bg-slate-700 px-1.5 py-0.5 text-slate-400">
                    {c.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-slate-800 pt-4 text-center">
          <p className="text-xs text-slate-700">
            Learnings are derived from experiment outcomes (ExperimentLearningRecord), campaign performance
            vs goals (ReconciledCampaignPerformance), creative launches (PublishPrepRecord), and executed
            automation actions (ProposedAutomationAction). All ROAS uses CRM source of truth with 7-day attribution.
          </p>
        </div>
      </div>
    </div>
  );
}
