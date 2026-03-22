"use client";

// HistoryView — Account-level action history timeline.
// Client-side filtering over server-loaded entries.
// Imports only from utils.ts (client-safe, no Prisma).

import { useState, useMemo }     from "react";
import Link                      from "next/link";
import type {
  ActionHistoryEntry,
  ActionHistoryFilterState,
} from "../../types/actionHistory";
import {
  buildActionHistorySummary,
  groupActionHistoryEntries,
  filterActionHistoryEntries,
} from "../../lib/actionHistory/utils";
import { TimelineSummaryBar }    from "./sections/TimelineSummaryBar";
import { TimelineFilters }       from "./sections/TimelineFilters";
import { TimelineList }          from "./sections/TimelineList";
import { EntryDetailDrawer }     from "./sections/EntryDetailDrawer";

type Props = {
  entries:  ActionHistoryEntry[];
  clients:  { id: string; name: string }[];
};

const EMPTY_FILTERS: ActionHistoryFilterState = {
  clientId:  "",
  eventType: "",
  status:    "",
  actor:     "",
  dateFrom:  "",
  dateTo:    "",
};

export function HistoryView({ entries, clients }: Props) {
  const [filters, setFilters]     = useState<ActionHistoryFilterState>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Client-side filtering
  const filtered = useMemo(
    () => filterActionHistoryEntries(entries, filters),
    [entries, filters],
  );

  const summary = useMemo(() => buildActionHistorySummary(filtered), [filtered]);
  const groups  = useMemo(() => groupActionHistoryEntries(filtered), [filtered]);

  const selectedEntry = selectedId
    ? entries.find((e) => e.id === selectedId) ?? null
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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

      {/* Timeline + optional detail drawer */}
      <div className="flex gap-6">
        <div className={`min-w-0 ${selectedEntry ? "flex-1" : "w-full"}`}>
          <TimelineList groups={groups} onSelectEntry={setSelectedId} selectedId={selectedId} />
        </div>

        {selectedEntry && (
          <div className="hidden w-[380px] shrink-0 lg:block">
            <EntryDetailDrawer entry={selectedEntry} onClose={() => setSelectedId(null)} />
          </div>
        )}
      </div>

      {/* Mobile detail drawer (below timeline) */}
      {selectedEntry && (
        <div className="lg:hidden">
          <EntryDetailDrawer entry={selectedEntry} onClose={() => setSelectedId(null)} />
        </div>
      )}

      {/* Footer links */}
      <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
        {[
          { href: "/command-center",      label: "Command Center" },
          { href: "/briefs",              label: "Morning Brief" },
          { href: "/creative-lab",        label: "Creative Lab" },
          { href: "/creative-lab/outcomes", label: "Outcome Routing" },
          { href: "/automation/history",  label: "Automation Audit" },
          { href: "/alerts",              label: "Alerts" },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
          >
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
