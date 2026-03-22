"use client";

// HistoryView — Account-level action history timeline.
// Client-side filtering over server-loaded data.

import { useState, useMemo } from "react";
import Link                  from "next/link";
import type {
  ActionHistoryEntry,
  ActionHistoryFilterState,
} from "../../types/actionHistory";
import {
  buildActionHistorySummary,
  groupActionHistoryEntries,
} from "../../lib/actionHistory/aggregator";
import { TimelineSummaryBar } from "./sections/TimelineSummaryBar";
import { TimelineFilters }    from "./sections/TimelineFilters";
import { TimelineList }       from "./sections/TimelineList";

type Props = {
  entries:  ActionHistoryEntry[];
  clients:  { id: string; name: string }[];
};

const EMPTY_FILTERS: ActionHistoryFilterState = {
  clientId:  "",
  eventType: "",
  status:    "",
  dateFrom:  "",
  dateTo:    "",
};

export function HistoryView({ entries, clients }: Props) {
  const [filters, setFilters] = useState<ActionHistoryFilterState>(EMPTY_FILTERS);

  // Client-side filtering
  const filtered = useMemo(() => {
    let result = entries;

    if (filters.clientId) {
      result = result.filter((e) => e.clientId === filters.clientId);
    }
    if (filters.eventType) {
      result = result.filter((e) => e.eventType === filters.eventType);
    }
    if (filters.status) {
      result = result.filter((e) => e.status === filters.status);
    }
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom).getTime();
      result = result.filter((e) => new Date(e.occurredAt).getTime() >= from);
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo).getTime() + 86_400_000;
      result = result.filter((e) => new Date(e.occurredAt).getTime() <= to);
    }

    return result;
  }, [entries, filters]);

  const summary = useMemo(() => buildActionHistorySummary(filtered), [filtered]);
  const groups = useMemo(() => groupActionHistoryEntries(filtered), [filtered]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Action History</h1>
          <p className="mt-1 text-sm text-slate-500">
            Account-level timeline of decisions, actions, and outcomes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/command-center"
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-700"
          >
            Command Center
          </Link>
          <Link
            href="/briefs"
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-700"
          >
            Morning Brief
          </Link>
          <Link
            href="/automation/history"
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-700"
          >
            Audit Log
          </Link>
        </div>
      </div>

      {/* Summary bar */}
      <TimelineSummaryBar summary={summary} />

      {/* Filters */}
      <TimelineFilters
        filters={filters}
        clients={clients}
        onChange={setFilters}
        onReset={() => setFilters(EMPTY_FILTERS)}
      />

      {/* Timeline */}
      <TimelineList groups={groups} />

      {/* Footer links */}
      <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
        <Link href="/command-center" className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200">
          Command Center
        </Link>
        <Link href="/briefs" className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200">
          Morning Brief
        </Link>
        <Link href="/creative-lab" className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200">
          Creative Lab
        </Link>
        <Link href="/creative-lab/outcomes" className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200">
          Outcome Routing
        </Link>
        <Link href="/automation/history" className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200">
          Automation Audit
        </Link>
      </div>
    </div>
  );
}
