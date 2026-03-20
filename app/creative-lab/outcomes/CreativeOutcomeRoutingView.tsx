"use client";

// app/creative-lab/outcomes/CreativeOutcomeRoutingView.tsx
// Client orchestrator for the creative outcome routing page.
//
// Responsive layout:
//   Mobile:  stacked — stat cards → filter → list → selected detail below
//   Desktop: col-5 left (filters + list) | col-7 right (sticky detail)

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import type {
  CreativeOutcomeRoute,
  CreativeOutcomeRoutingSummary,
  CreativeOutcomeRouteType,
} from "../../../types/creativeOutcomeRouting";
import {
  ROUTE_TYPE_LABEL,
  READINESS_STATE_COLOR,
} from "../../../types/creativeOutcomeRouting";
import {
  PageHeader,
  SectionCard,
  StatCard,
  EmptyState,
  Badge,
} from "../../../components/ui";
import { CreativeOutcomeRouteCard }   from "./CreativeOutcomeRouteCard";
import { CreativeOutcomeRouteDetail } from "./CreativeOutcomeRouteDetail";

type Props = {
  initialRoutes:    CreativeOutcomeRoute[];
  initialSummary:   CreativeOutcomeRoutingSummary;
  clientAccountId?: string;
};

type RouteFilter = CreativeOutcomeRouteType | "all" | "pending_action";

const FILTER_OPTIONS: Array<{ value: RouteFilter; label: string }> = [
  { value: "all",                              label: "All" },
  { value: "pending_action",                   label: "Pending Action" },
  { value: "send_winner_to_scale_review",      label: ROUTE_TYPE_LABEL.send_winner_to_scale_review },
  { value: "keep_winner_running",              label: ROUTE_TYPE_LABEL.keep_winner_running },
  { value: "send_loser_to_creative_lab",       label: ROUTE_TYPE_LABEL.send_loser_to_creative_lab },
  { value: "send_mixed_result_to_follow_up_test", label: ROUTE_TYPE_LABEL.send_mixed_result_to_follow_up_test },
  { value: "monitor_until_more_data",          label: ROUTE_TYPE_LABEL.monitor_until_more_data },
  { value: "capture_learning_only",            label: ROUTE_TYPE_LABEL.capture_learning_only },
];

export function CreativeOutcomeRoutingView({
  initialRoutes,
  initialSummary,
  clientAccountId,
}: Props) {
  const [routes,     setRoutes]     = useState<CreativeOutcomeRoute[]>(initialRoutes);
  const [summary,    setSummary]    = useState<CreativeOutcomeRoutingSummary>(initialSummary);
  const [selectedId, setSelectedId] = useState<string | null>(initialRoutes[0]?.id ?? null);
  const [filter,     setFilter]     = useState<RouteFilter>("all");
  const [pending,    setPending]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const selectedRoute = useMemo(
    () => routes.find((r) => r.id === selectedId) ?? null,
    [routes, selectedId],
  );

  // Refresh a single route from API
  const refreshRoute = useCallback(async (id: string) => {
    try {
      const res  = await fetch(`/api/creative-lab/outcomes/${id}`);
      const data = await res.json();
      if (data.route) {
        setRoutes((prev) => prev.map((r) => r.id === id ? data.route : r));
      }
    } catch { /* non-critical */ }
  }, []);

  // Refresh summary
  const refreshSummary = useCallback(async () => {
    try {
      const qs   = clientAccountId ? `?clientAccountId=${clientAccountId}` : "";
      const res  = await fetch(`/api/creative-lab/outcomes${qs}`);
      const data = await res.json();
      if (data.summary) setSummary(data.summary);
    } catch { /* non-critical */ }
  }, [clientAccountId]);

  // Route a test result to generate / refresh a route record
  const handleRoute = useCallback(
    async (testResultId: string) => {
      setPending(true);
      setError(null);
      try {
        const res  = await fetch("/api/creative-lab/outcomes", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ testResultId }),
        });
        const data = await res.json();
        if (res.ok && data.route) {
          setRoutes((prev) => {
            const exists = prev.find((r) => r.id === data.route.id);
            return exists
              ? prev.map((r) => r.id === data.route.id ? data.route : r)
              : [data.route, ...prev];
          });
          setSelectedId(data.route.id);
          await refreshSummary();
        } else {
          setError(data.error ?? "Route generation failed.");
        }
      } catch {
        setError("Network error — please try again.");
      } finally {
        setPending(false);
      }
    },
    [refreshSummary],
  );

  // Update action state
  const handleAction = useCallback(
    async (id: string, readinessState: string, note?: string) => {
      setPending(true);
      setError(null);
      try {
        const res  = await fetch(`/api/creative-lab/outcomes/${id}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ readinessState, actionNote: note }),
        });
        const data = await res.json();
        if (res.ok && data.route) {
          setRoutes((prev) => prev.map((r) => r.id === id ? data.route : r));
          await refreshSummary();
        } else {
          setError(data.error ?? "Update failed.");
        }
      } catch {
        setError("Network error — please try again.");
      } finally {
        setPending(false);
      }
    },
    [refreshSummary],
  );

  const filteredRoutes = useMemo(() => {
    if (filter === "all")            return routes;
    if (filter === "pending_action") return routes.filter((r) => r.readinessState === "pending_action");
    return routes.filter((r) => r.routeType === filter);
  }, [routes, filter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Outcome Routing"
        description="Route completed test results to the right next workflow — scale review, creative iteration, follow-up test, or monitoring."
        badge={<Badge variant="neutral">Creative Lab</Badge>}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/creative-lab/results"
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm
                font-medium text-slate-200 transition-colors hover:bg-slate-700"
            >
              ← Test Results
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
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-9">
        <StatCard label="Total"          value={summary.total}             />
        <StatCard label="Pending"        value={summary.pendingAction}     />
        <StatCard label="Actioned"       value={summary.actioned}          />
        <StatCard label="Learning"       value={summary.learningCaptured}  />
        <StatCard label="Winners"        value={summary.winnerRoutes}      />
        <StatCard label="Iterate"        value={summary.loserRoutes}       />
        <StatCard label="Mixed"          value={summary.mixedRoutes}       />
        <StatCard label="Monitor"        value={summary.monitorRoutes}     />
        <StatCard label="Archived"       value={summary.archived}          />
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-rose-800/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-400">
          {error}
        </div>
      )}

      {/* Main layout */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">

        {/* Left panel — filters + list */}
        <div className="w-full lg:w-5/12 space-y-3">
          {/* Filter tabs */}
          <div className="flex flex-wrap gap-1.5">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFilter(opt.value)}
                className={[
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  filter === opt.value
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200",
                ].join(" ")}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Route list */}
          {filteredRoutes.length === 0 ? (
            <EmptyState
              icon="⇢"
              title="No routes match this filter"
              description="Try a different filter or route a test result."
            />
          ) : (
            <div className="space-y-2">
              {filteredRoutes.map((route) => (
                <CreativeOutcomeRouteCard
                  key={route.id}
                  route={route}
                  isSelected={route.id === selectedId}
                  onSelect={setSelectedId}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right panel — detail (sticky on desktop) */}
        <div className="w-full lg:sticky lg:top-6 lg:w-7/12">
          {selectedRoute ? (
            <CreativeOutcomeRouteDetail
              route={selectedRoute}
              pending={pending}
              onAction={handleAction}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/30 p-10">
              <EmptyState
                icon="⇢"
                title="Select an outcome"
                description="Click a route in the list to view the decision, learning, and next action."
              />
            </div>
          )}
        </div>
      </div>

      {/* Footer nav */}
      <div className="flex flex-wrap gap-4 border-t border-slate-800/60 pt-4">
        <Link href="/creative-lab"              className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← Creative Lab</Link>
        <Link href="/creative-lab/results"      className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Test Results</Link>
        <Link href="/creative-lab/publish-prep" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Publish Prep</Link>
        <Link href="/creative-lab/launch"       className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Launch Plans</Link>
        <Link href="/experiments"               className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Experiments →</Link>
        <Link href="/insights/memory"           className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Learning Memory →</Link>
      </div>
    </div>
  );
}
