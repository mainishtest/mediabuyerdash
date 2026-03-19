"use client";

// app/experiments/ExperimentsView.tsx
// Client orchestrator for the experiments results page.
//
// Responsive layout:
//   Mobile:  stacked — stat cards → list → selected detail below
//   Desktop: col-4 left (filter + list) | col-8 right (sticky detail)
//
// State:
//   - experiments loaded server-side, refreshed after each action
//   - selected experiment drives the detail panel
//   - "Evaluate Now" triggers POST /api/experiments/[id]/ingest

import { useState, useCallback, useMemo } from "react";
import Link                               from "next/link";
import type {
  ExperimentWithResult,
  ExperimentListSummary,
}                                         from "../../types/experiment";
import {
  STATUS_LABEL,
}                                         from "../../types/experiment";
import {
  PageHeader,
  SectionCard,
  StatCard,
  EmptyState,
}                                         from "../../components/ui";
import { ExperimentCard }                 from "./ExperimentCard";
import { ExperimentResultDetail }         from "./ExperimentResultDetail";

type Props = {
  initialExperiments: ExperimentWithResult[];
  initialSummary:     ExperimentListSummary;
  clientAccountId?:   string;
};

export function ExperimentsView({ initialExperiments, initialSummary, clientAccountId }: Props) {
  const [experiments, setExperiments] = useState<ExperimentWithResult[]>(initialExperiments);
  const [summary,     setSummary]     = useState<ExperimentListSummary>(initialSummary);
  const [selectedId,  setSelectedId]  = useState<string | null>(initialExperiments[0]?.id ?? null);
  const [pending,     setPending]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const selectedExp = useMemo(
    () => experiments.find((e) => e.id === selectedId) ?? null,
    [experiments, selectedId],
  );

  // Refresh a single experiment from API
  const refreshExperiment = useCallback(async (id: string) => {
    try {
      const res  = await fetch(`/api/experiments/${id}`);
      const data = await res.json();
      if (data.ok && data.experiment) {
        setExperiments((prev) => prev.map((e) => e.id === id ? data.experiment : e));
      }
    } catch { /* non-critical */ }
  }, []);

  // Trigger evaluation
  const handleEvaluate = useCallback(async () => {
    if (!selectedId || pending) return;
    setPending(true);
    setError(null);
    try {
      const res  = await fetch(`/api/experiments/${selectedId}/ingest`, { method: "POST" });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Evaluation failed — try again.");
      } else {
        await refreshExperiment(selectedId);
      }
    } catch {
      setError("Network error — check your connection.");
    } finally {
      setPending(false);
    }
  }, [selectedId, pending, refreshExperiment]);

  // Archive experiment
  const handleArchive = useCallback(async () => {
    if (!selectedId || pending) return;
    setPending(true);
    setError(null);
    try {
      const res  = await fetch(`/api/experiments/${selectedId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "archive" }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Archive failed.");
      } else {
        await refreshExperiment(selectedId);
      }
    } catch {
      setError("Network error.");
    } finally {
      setPending(false);
    }
  }, [selectedId, pending, refreshExperiment]);

  // Filtered list
  const visibleExperiments = useMemo(() => {
    if (statusFilter === "all") return experiments;
    return experiments.filter((e) => e.status === statusFilter);
  }, [experiments, statusFilter]);

  const statusOptions = [
    { value: "all",       label: "All" },
    { value: "active",    label: "Active" },
    { value: "completed", label: "Completed" },
    { value: "archived",  label: "Archived" },
    { value: "failed",    label: "Failed" },
  ];

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <PageHeader
        title="Experiment Results"
        description="Ingest performance data, detect winners, and capture learnings."
        actions={
          <div className="flex gap-2">
            <Link
              href="/creative-lab/publish-prep"
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm
                font-medium text-slate-200 transition-colors hover:bg-slate-700"
            >
              ← Publish Prep
            </Link>
          </div>
        }
      />

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total"           value={summary.total}         sub="experiments" />
        <StatCard label="Challenger Wins" value={summary.challengerWins} sub="detected" />
        <StatCard label="Control Holds"   value={summary.controlHolds}  sub="detected" />
        <StatCard label="Active"          value={summary.active}        sub="running" />
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-rose-800/50 bg-rose-950/20 px-4 py-3">
          <p className="text-xs text-rose-300">{error}</p>
          <button onClick={() => setError(null)} className="mt-1 text-xs text-slate-500 underline">Dismiss</button>
        </div>
      )}

      {/* ── Main split ── */}
      <div className="grid gap-6 lg:grid-cols-12">

        {/* ── Left: filter + list ── */}
        <div className="space-y-4 lg:col-span-4">
          <SectionCard title="Experiments" description={`${visibleExperiments.length} item${visibleExperiments.length !== 1 ? "s" : ""}`}>

            {/* Filter chips */}
            <div className="mb-4 flex flex-wrap gap-1.5">
              {statusOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors
                    ${statusFilter === opt.value
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {visibleExperiments.length === 0 ? (
              <EmptyState
                icon="⬡"
                title="No experiments"
                description={
                  statusFilter === "all"
                    ? "Create an experiment from the Publish Prep page after launching a creative."
                    : `No experiments with status "${statusFilter}".`
                }
                action={
                  <Link
                    href="/creative-lab/publish-prep"
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                  >
                    Go to Publish Prep
                  </Link>
                }
              />
            ) : (
              <div className="space-y-2">
                {visibleExperiments.map((exp) => (
                  <ExperimentCard
                    key={exp.id}
                    experiment={exp}
                    isSelected={selectedId === exp.id}
                    onSelect={setSelectedId}
                  />
                ))}
              </div>
            )}
          </SectionCard>

          {/* Quick links */}
          <div className="flex flex-wrap gap-3 px-1">
            <Link href="/creative-lab"               className="text-xs text-slate-600 hover:text-slate-300 transition-colors">Creative Lab</Link>
            <Link href="/creative-lab/publish-prep"  className="text-xs text-slate-600 hover:text-slate-300 transition-colors">Publish Prep</Link>
            <Link href="/creative-lab/review"        className="text-xs text-slate-600 hover:text-slate-300 transition-colors">Draft Review</Link>
          </div>
        </div>

        {/* ── Right: detail ── */}
        <div className="lg:col-span-8">
          {selectedExp ? (
            <div className="lg:sticky lg:top-6">
              <ExperimentResultDetail
                experiment={selectedExp}
                onEvaluate={handleEvaluate}
                onArchive={handleArchive}
                actionPending={pending}
              />
            </div>
          ) : (
            <div className="hidden lg:flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-800">
              <p className="text-sm text-slate-600">Select an experiment from the list</p>
            </div>
          )}

          {/* Mobile: all stacked */}
          {!selectedExp && visibleExperiments.length > 0 && (
            <div className="space-y-4 lg:hidden">
              {visibleExperiments.map((exp) => (
                <ExperimentResultDetail
                  key={exp.id}
                  experiment={exp}
                  onEvaluate={handleEvaluate}
                  onArchive={handleArchive}
                  actionPending={pending}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
