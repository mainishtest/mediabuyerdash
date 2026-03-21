"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { PageHeader }   from "../../../../components/ui/PageHeader";
import { SectionCard }  from "../../../../components/ui/SectionCard";
import { Badge }        from "../../../../components/ui/Badge";
import { ActionButton } from "../../../../components/ui/ActionButton";
import { StatCard }     from "../../../../components/ui/StatCard";
import { loadImageVariationInsightsAction } from "../actions";
import type { LearningMemoryEntry, LearningSummary } from "../../../../lib/learningMemory/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
  winning_visual_hook:          "Winning Visual Hook",
  winning_composition:          "Winning Composition",
  winning_color_direction:      "Winning Color Direction",
  winning_product_focus:        "Winning Product Focus",
  winning_ugc_style:            "Winning UGC Style",
  winning_hook:                 "Winning Hook",
  winning_angle:                "Winning Angle",
  winning_offer_framing:        "Winning Offer Framing",
  fatigue_prone_visual_pattern: "Fatigue-Prone Visual",
  poor_performer_visual_pattern: "Poor Visual Pattern",
  fatigue_pattern:              "Fatigue Pattern",
  poor_performer_pattern:       "Poor Performer",
  experiment_pattern:           "Experiment Pattern",
  refresh_pattern:              "Refresh Pattern",
  launch_condition:             "Launch Condition",
  audience_message_fit:         "Audience Fit",
};

const CONFIDENCE_BADGE: Record<string, "success" | "warning" | "neutral"> = {
  high: "success", medium: "warning", low: "neutral",
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ImageVariationInsightsView() {
  const [entries, setEntries] = useState<LearningMemoryEntry[]>([]);
  const [summary, setSummary] = useState<LearningSummary | null>(null);
  const [loading, startLoad] = useTransition();
  const [categoryFilter, setCategoryFilter] = useState("");
  const [confidenceFilter, setConfidenceFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function loadData() {
    startLoad(async () => {
      const data = await loadImageVariationInsightsAction({
        category:   categoryFilter || undefined,
        confidence: confidenceFilter || undefined,
      });
      setEntries(data.entries);
      setSummary(data.summary);
    });
  }

  useEffect(() => { loadData(); }, []);

  function applyFilters() { loadData(); }

  const inputCls = "rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 focus:border-emerald-600 focus:outline-none";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6 sm:px-6 sm:py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/creative-lab" className="hover:text-slate-300">Creative Lab</Link>
        <span>/</span>
        <Link href="/creative-lab/image-variations" className="hover:text-slate-300">Image Variations</Link>
        <span>/</span>
        <span className="text-slate-400">Insights</span>
      </nav>

      <PageHeader
        title="Image Variation Learning Insights"
        description="Learnings from image variation experiments — what visual directions work, what fails, and how to improve future generation."
      />

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Category</label>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={inputCls}>
            <option value="">All categories</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Confidence</label>
          <select value={confidenceFilter} onChange={(e) => setConfidenceFilter(e.target.value)} className={inputCls}>
            <option value="">All</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <ActionButton variant="secondary" size="sm" disabled={loading} onClick={applyFilters}>
          {loading ? "Loading..." : "Apply"}
        </ActionButton>
      </div>

      {/* Summary */}
      {summary && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatCard label="Total Learnings"   value={String(summary.totalEntries)} />
          <StatCard label="High Confidence"   value={String(summary.highConfidenceCount)} />
          <StatCard label="Usable for Briefs" value={String(summary.usableForBriefsCount)} />
          <StatCard label="From Experiments"  value={String(summary.experimentCount)} />
          <StatCard label="Sparse Data"       value={summary.isSparse ? "Yes" : "No"} />
        </section>
      )}

      {/* Top insight */}
      {summary?.topInsight && (
        <SectionCard title="Top Insight">
          <p className="text-sm text-slate-300">{summary.topInsight}</p>
        </SectionCard>
      )}

      {/* Top patterns */}
      {summary && summary.topPatterns.length > 0 && (
        <SectionCard title="Recurring Patterns">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {summary.topPatterns.map((p, i) => (
              <div key={i} className="rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-200">{p.patternLabel}</span>
                  <Badge variant={CONFIDENCE_BADGE[p.confidence] ?? "neutral"}>
                    {p.confidence}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500">
                  {CATEGORY_LABELS[p.category] ?? p.category} · {p.occurrences} occurrences
                </p>
                <p className="text-xs text-slate-400 line-clamp-2">{p.exampleInsight}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Loading / empty */}
      {loading && entries.length === 0 && (
        <SectionCard>
          <div className="py-10 text-center">
            <p className="text-sm text-slate-400">Loading learnings...</p>
          </div>
        </SectionCard>
      )}

      {!loading && entries.length === 0 && (
        <SectionCard>
          <div className="py-10 text-center">
            <p className="text-sm text-slate-500">No image variation learnings yet.</p>
            <p className="mt-2 text-xs text-slate-600">
              Launch image variation experiments to start building learning memory.
            </p>
            <Link href="/creative-lab/image-variations/launch" className="mt-4 inline-block text-xs text-emerald-500 hover:text-emerald-400">
              Go to Experiment Launch →
            </Link>
          </div>
        </SectionCard>
      )}

      {/* Entries */}
      {entries.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            All Learnings ({entries.length})
          </p>
          {entries.map((entry) => (
            <InsightCard
              key={entry.id}
              entry={entry}
              expanded={expandedId === entry.id}
              onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
            />
          ))}
        </div>
      )}

      {/* Navigation */}
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/creative-lab/image-variations/results" className="text-xs text-emerald-500 hover:text-emerald-400">
          ← Test Results
        </Link>
        <Link href="/insights/memory" className="text-xs text-slate-500 hover:text-slate-300">
          All Learning Memory →
        </Link>
        <Link href="/creative-lab" className="ml-auto text-xs text-slate-500 hover:text-slate-300">
          ← Creative Lab
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Insight card
// ---------------------------------------------------------------------------

function InsightCard({
  entry,
  expanded,
  onToggle,
}: {
  entry:    LearningMemoryEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const catLabel = CATEGORY_LABELS[entry.category] ?? entry.category;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-2">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-200 leading-relaxed">{entry.insightText}</p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <Badge variant={CONFIDENCE_BADGE[entry.confidence] ?? "neutral"}>
            {entry.confidence}
          </Badge>
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-400">{catLabel}</span>
        {entry.pattern && (
          <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-500">{entry.pattern.replace(/_/g, " ")}</span>
        )}
        <span className="text-slate-600">{entry.clientName}</span>
        {entry.campaignName && <span className="text-slate-600">· {entry.campaignName}</span>}
        <span className="text-slate-600">· {new Date(entry.createdAt).toLocaleDateString()}</span>
        {entry.usableForBriefs && (
          <span className="rounded bg-emerald-900/30 px-2 py-0.5 text-emerald-400 text-xs">Usable for briefs</span>
        )}
      </div>

      {/* Expanded: evidence + entities */}
      {expanded && (
        <>
          {entry.evidence.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-400">Evidence</p>
              <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {entry.evidence.map((sig, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className={
                      sig.direction === "positive" ? "text-emerald-400" :
                      sig.direction === "negative" ? "text-rose-400" : "text-slate-500"
                    }>
                      {sig.direction === "positive" ? "+" : sig.direction === "negative" ? "−" : "·"}
                    </span>
                    <span className="text-slate-500">{sig.label}:</span>
                    <span className="text-slate-300">{sig.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {entry.relatedEntities.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-400">Related</p>
              {entry.relatedEntities.map((e, i) => (
                <p key={i} className="text-xs text-slate-500">{e.type}: {e.label}</p>
              ))}
            </div>
          )}
        </>
      )}

      {/* Toggle */}
      <button type="button" onClick={onToggle} className="text-xs text-emerald-500 hover:text-emerald-400">
        {expanded ? "Hide evidence" : "Show evidence"}
      </button>
    </div>
  );
}
