"use client";

// app/creative-lab/launch/LaunchWiringView.tsx
// Client orchestrator for the experiment launch wiring page.
//
// Responsive layout:
//   Mobile:  stacked — stat cards → list → selected detail below list
//   Desktop: col-5 left (filters + plan list) | col-7 right (sticky detail panel)

import { useState, useCallback, useMemo } from "react";
import Link  from "next/link";
import type {
  CreativeExperimentLaunchPlan,
  CreativeExperimentLaunchSummary,
  CreativeExperimentReadinessState,
} from "../../../types/experimentLaunch";
import {
  READINESS_STATE_LABEL,
  READINESS_STATE_COLOR,
} from "../../../types/experimentLaunch";
import {
  PageHeader,
  SectionCard,
  StatCard,
  EmptyState,
  Badge,
} from "../../../components/ui";
import { LaunchPlanCard }   from "./LaunchPlanCard";
import { LaunchPlanDetail } from "./LaunchPlanDetail";

type Props = {
  initialPlans:   CreativeExperimentLaunchPlan[];
  initialSummary: CreativeExperimentLaunchSummary;
  clientAccountId?: string;
};

const FILTER_OPTIONS: Array<{ value: CreativeExperimentReadinessState | "all"; label: string }> = [
  { value: "all",            label: "All" },
  { value: "draft",          label: "Draft" },
  { value: "needs_mapping",  label: "Needs Mapping" },
  { value: "needs_approval", label: "Needs Approval" },
  { value: "ready_for_launch", label: "Ready" },
  { value: "blocked",        label: "Blocked" },
  { value: "launched",       label: "Launched" },
];

export function LaunchWiringView({
  initialPlans,
  initialSummary,
  clientAccountId,
}: Props) {
  const [plans,    setPlans]    = useState<CreativeExperimentLaunchPlan[]>(initialPlans);
  const [summary,  setSummary]  = useState<CreativeExperimentLaunchSummary>(initialSummary);
  const [selectedId, setSelectedId] = useState<string | null>(initialPlans[0]?.id ?? null);
  const [filter,   setFilter]   = useState<CreativeExperimentReadinessState | "all">("all");
  const [pending,  setPending]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedId) ?? null,
    [plans, selectedId],
  );

  // Refresh a single plan from API
  const refreshPlan = useCallback(async (id: string) => {
    try {
      const res  = await fetch(`/api/creative-lab/launch/${id}`);
      const data = await res.json();
      if (data.ok && data.plan) {
        setPlans((prev) => prev.map((p) => p.id === id ? data.plan : p));
      }
    } catch { /* non-critical */ }
  }, []);

  // Refresh summary
  const refreshSummary = useCallback(async () => {
    try {
      const qs  = clientAccountId ? `?clientAccountId=${clientAccountId}` : "";
      const res = await fetch(`/api/creative-lab/launch${qs}`);
      const data = await res.json();
      if (data.ok && data.summary) setSummary(data.summary);
    } catch { /* non-critical */ }
  }, [clientAccountId]);

  const handleUpdate = useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      setPending(true);
      setError(null);
      try {
        const res  = await fetch(`/api/creative-lab/launch/${id}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(patch),
        });
        const data = await res.json();
        if (!data.ok) {
          setError(data.error ?? "Update failed.");
        } else {
          await refreshPlan(id);
          await refreshSummary();
        }
      } catch {
        setError("Network error — please try again.");
      } finally {
        setPending(false);
      }
    },
    [refreshPlan, refreshSummary],
  );

  const filteredPlans = useMemo(
    () => filter === "all"
      ? plans
      : plans.filter((p) => p.readiness.state === filter),
    [plans, filter],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Experiment Launch Wiring"
        description="Wire approved creative drafts into structured test plans with control/challenger mapping, success criteria, and guardrails."
        badge={<Badge variant="default">Creative Lab</Badge>}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/creative-lab/publish-prep"
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm
                font-medium text-slate-200 transition-colors hover:bg-slate-700"
            >
              ← Publish Prep
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

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total Plans"    value={summary.total}          />
        <StatCard label="Draft"          value={summary.draft}          />
        <StatCard label="Needs Mapping"  value={summary.needsMapping}   />
        <StatCard label="Needs Approval" value={summary.needsApproval}  />
        <StatCard label="Ready"          value={summary.readyForLaunch} />
        <StatCard label="Launched"       value={summary.launched}       />
      </div>

      {error && (
        <div className="rounded-xl border border-rose-800/40 bg-rose-950/20 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      {/* Main content — stacked mobile, 2-col desktop */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">

        {/* Left col — filter + plan list */}
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
                  <span className={`ml-1.5 ${filter === opt.value ? READINESS_STATE_COLOR[opt.value as CreativeExperimentReadinessState] : "text-slate-500"}`}>
                    {opt.value === "draft"            ? summary.draft
                    : opt.value === "needs_mapping"   ? summary.needsMapping
                    : opt.value === "needs_approval"  ? summary.needsApproval
                    : opt.value === "ready_for_launch"? summary.readyForLaunch
                    : opt.value === "blocked"         ? summary.blocked
                    : summary.launched}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Plan list */}
          {filteredPlans.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 p-8">
              <EmptyState
                icon="⬡"
                title={filter === "all" ? "No launch plans yet" : `No ${READINESS_STATE_LABEL[filter as CreativeExperimentReadinessState]} plans`}
                description={filter === "all"
                  ? "Approve creative drafts in Publish Prep, then create experiment launch plans here."
                  : "Change the filter to see other plans."}
              />
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPlans.map((plan) => (
                <LaunchPlanCard
                  key={plan.id}
                  plan={plan}
                  isSelected={plan.id === selectedId}
                  onSelect={setSelectedId}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right col — detail panel */}
        <div className="w-full lg:sticky lg:top-4 lg:w-7/12 xl:w-8/12">
          {selectedPlan ? (
            <SectionCard>
              <LaunchPlanDetail
                plan={selectedPlan}
                onUpdate={handleUpdate}
                pending={pending}
              />
            </SectionCard>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/20 p-10">
              <EmptyState
                icon="◇"
                title="Select a plan"
                description="Click any launch plan on the left to review its wiring, readiness, and actions."
              />
            </div>
          )}
        </div>
      </div>

      {/* Navigation links */}
      <div className="flex flex-wrap gap-4 border-t border-slate-800/60 pt-4">
        <Link href="/creative-lab"               className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← Creative Lab</Link>
        <Link href="/creative-lab/review"        className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Draft Review</Link>
        <Link href="/creative-lab/publish-prep"  className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Publish Prep</Link>
        <Link href="/experiments"                className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Experiments →</Link>
      </div>
    </div>
  );
}
