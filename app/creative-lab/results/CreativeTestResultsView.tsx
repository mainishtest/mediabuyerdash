"use client";

// app/creative-lab/results/CreativeTestResultsView.tsx
// Client orchestrator for the creative test results page.
//
// Responsive layout:
//   Mobile:  stacked — stat cards → filter → list → selected detail below
//   Desktop: col-5 left (filters + list) | col-7 right (sticky detail)

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import type {
  CreativeTestResult,
  CreativeTestResultSummary,
  CreativeTestTrackingState,
} from "../../../types/creativeTestResults";
import {
  TEST_TRACKING_STATE_LABEL,
  TEST_TRACKING_STATE_COLOR,
} from "../../../types/creativeTestResults";
import {
  PageHeader,
  SectionCard,
  StatCard,
  EmptyState,
  Badge,
} from "../../../components/ui";
import { CreativeTestResultCard }   from "./CreativeTestResultCard";
import { CreativeTestResultDetail } from "./CreativeTestResultDetail";

type Props = {
  initialResults:   CreativeTestResult[];
  initialSummary:   CreativeTestResultSummary;
  clientAccountId?: string;
};

const FILTER_OPTIONS: Array<{ value: CreativeTestTrackingState | "all"; label: string }> = [
  { value: "all",            label: "All" },
  { value: "pending_launch", label: "Pending" },
  { value: "active",         label: "Active" },
  { value: "evaluating",     label: "Evaluating" },
  { value: "completed",      label: "Completed" },
  { value: "stale",          label: "Stale" },
  { value: "blocked",        label: "Blocked" },
];

export function CreativeTestResultsView({
  initialResults,
  initialSummary,
  clientAccountId,
}: Props) {
  const [results,    setResults]    = useState<CreativeTestResult[]>(initialResults);
  const [summary,    setSummary]    = useState<CreativeTestResultSummary>(initialSummary);
  const [selectedId, setSelectedId] = useState<string | null>(initialResults[0]?.id ?? null);
  const [filter,     setFilter]     = useState<CreativeTestTrackingState | "all">("all");
  const [pending,    setPending]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const selectedResult = useMemo(
    () => results.find((r) => r.id === selectedId) ?? null,
    [results, selectedId],
  );

  // Refresh a single result from API
  const refreshResult = useCallback(async (id: string) => {
    try {
      const res  = await fetch(`/api/creative-lab/results/${id}`);
      const data = await res.json();
      if (data.ok && data.result) {
        setResults((prev) => prev.map((r) => r.id === id ? data.result : r));
      }
    } catch { /* non-critical */ }
  }, []);

  // Refresh summary
  const refreshSummary = useCallback(async () => {
    try {
      const qs  = clientAccountId ? `?clientAccountId=${clientAccountId}` : "";
      const res = await fetch(`/api/creative-lab/results${qs}`);
      const data = await res.json();
      if (data.ok && data.summary) setSummary(data.summary);
    } catch { /* non-critical */ }
  }, [clientAccountId]);

  const handleUpdate = useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      setPending(true);
      setError(null);
      try {
        const res  = await fetch(`/api/creative-lab/results/${id}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(patch),
        });
        const data = await res.json();
        if (!data.ok) {
          setError(data.error ?? "Update failed.");
        } else {
          await refreshResult(id);
          await refreshSummary();
        }
      } catch {
        setError("Network error — please try again.");
      } finally {
        setPending(false);
      }
    },
    [refreshResult, refreshSummary],
  );

  const handleIngest = useCallback(
    async (id: string) => {
      setPending(true);
      setError(null);
      try {
        const res  = await fetch(`/api/creative-lab/results/${id}/ingest`, {
          method: "POST",
        });
        const data = await res.json();
        if (!data.ok) {
          setError(data.error ?? "Ingestion failed.");
        } else {
          await refreshResult(id);
          await refreshSummary();
        }
      } catch {
        setError("Ingestion error — please try again.");
      } finally {
        setPending(false);
      }
    },
    [refreshResult, refreshSummary],
  );

  const filteredResults = useMemo(
    () => filter === "all"
      ? results
      : results.filter((r) => r.trackingState === filter),
    [results, filter],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Test Results"
        description="Ingest performance data, compare control vs challenger, and track creative test outcomes."
        badge={<Badge variant="default">Creative Lab</Badge>}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/creative-lab/launch"
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm
                font-medium text-slate-200 transition-colors hover:bg-slate-700"
            >
              ← Launch Plans
            </Link>
            <Link
              href="/experiments"
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm
                font-medium text-slate-200 transition-colors hover:bg-slate-700"
            >
              Experiments →
            </Link>
          </div>
        }
      />

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <StatCard label="Total"     value={summary.total}          />
        <StatCard label="Active"    value={summary.active}         />
        <StatCard label="Evaluating" value={summary.evaluating}    />
        <StatCard label="Completed" value={summary.completed}      />
        <StatCard label="Chall. Wins" value={summary.challengerWins} />
        <StatCard label="Ctrl Holds"  value={summary.controlHolds}   />
        <StatCard label="No Winner"   value={summary.noWinner}       />
      </div>

      {error && (
        <div className="rounded-xl border border-rose-800/40 bg-rose-950/20 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      {/* Main content — stacked mobile, 2-col desktop */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">

        {/* Left col — filter + result list */}
        <div className="w-full lg:w-5/12 xl:w-4/12 space-y-3">
          {/* Filter chips */}
          <div className="flex flex-wrap gap-2">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFilter(opt.value)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors
                  ${filter === opt.value
                    ? "border-indigo-600 bg-indigo-950/40 text-indigo-300"
                    : "border-slate-700 bg-slate-800/60 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                  }`}
              >
                {opt.label}
                {opt.value !== "all" && (
                  <span className={`ml-1.5 ${filter === opt.value
                    ? TEST_TRACKING_STATE_COLOR[opt.value as CreativeTestTrackingState]
                    : "text-slate-500"}`}>
                    {opt.value === "pending_launch" ? summary.pendingLaunch
                    : opt.value === "active"        ? summary.active
                    : opt.value === "evaluating"    ? summary.evaluating
                    : opt.value === "completed"     ? summary.completed
                    : opt.value === "stale"         ? summary.stale
                    : summary.blocked}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Result list */}
          {filteredResults.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 p-8">
              <EmptyState
                icon="◎"
                title={filter === "all" ? "No test results yet" : `No ${TEST_TRACKING_STATE_LABEL[filter as CreativeTestTrackingState]} tests`}
                description={filter === "all"
                  ? "Create a test result from an experiment launch plan to start tracking performance."
                  : "Change the filter to see other results."}
              />
            </div>
          ) : (
            <div className="space-y-2">
              {filteredResults.map((r) => (
                <CreativeTestResultCard
                  key={r.id}
                  result={r}
                  isSelected={r.id === selectedId}
                  onSelect={setSelectedId}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right col — detail panel */}
        <div className="w-full lg:sticky lg:top-4 lg:w-7/12 xl:w-8/12">
          {selectedResult ? (
            <SectionCard>
              <CreativeTestResultDetail
                result={selectedResult}
                onUpdate={handleUpdate}
                onIngest={handleIngest}
                pending={pending}
              />
            </SectionCard>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/20 p-10">
              <EmptyState
                icon="◎"
                title="Select a test"
                description="Click any test result on the left to see performance metrics, outcome, and actions."
              />
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex flex-wrap gap-4 border-t border-slate-800/60 pt-4">
        <Link href="/creative-lab"              className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← Creative Lab</Link>
        <Link href="/creative-lab/publish-prep" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Publish Prep</Link>
        <Link href="/creative-lab/launch"       className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Launch Plans</Link>
        <Link href="/experiments"               className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Experiments →</Link>
      </div>
    </div>
  );
}
