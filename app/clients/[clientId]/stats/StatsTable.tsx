// Hierarchical expandable table — campaigns → ad sets → ads.
// Flattens the tree into a sorted list with depth-based indentation.

"use client";

import { useMemo } from "react";
import type { StatsRow, StatsLevel } from "../../../../lib/stats/statsTypes";
import { STATS_COLUMNS, type SortDirection } from "./StatsColumns";

interface Props {
  campaignRows: StatsRow[];
  childrenMap: Record<string, StatsRow[]>;
  expandedIds: Set<string>;
  expandingIds: Set<string>;
  onToggleExpand: (externalId: string, level: StatsLevel) => void;
  sortColumn: string;
  sortDirection: SortDirection;
  onSortColumn: (col: string) => void;
  search?: string;
}

// ── Sort within a sibling group ─────────────────────────────────────────────

function sortRows(rows: StatsRow[], column: string, direction: SortDirection): StatsRow[] {
  // "name" sort
  if (column === "name") {
    return [...rows].sort((a, b) => {
      const cmp = a.name.localeCompare(b.name);
      return direction === "asc" ? cmp : -cmp;
    });
  }

  const col = STATS_COLUMNS.find(c => c.key === column);
  if (!col) return rows;

  return [...rows].sort((a, b) => {
    const aVal = col.sortValue(a);
    const bVal = col.sortValue(b);
    const cmp = typeof aVal === "string" && typeof bVal === "string"
      ? aVal.localeCompare(bVal)
      : (aVal as number) - (bVal as number);
    return direction === "asc" ? cmp : -cmp;
  });
}

// ── Micro-components ────────────────────────────────────────────────────────

function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`h-3.5 w-3.5 text-slate-500 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
      fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin text-slate-500" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ── Table header ────────────────────────────────────────────────────────────

function Header({ sortColumn, sortDirection, onSort }: {
  sortColumn: string; sortDirection: SortDirection; onSort: (k: string) => void;
}) {
  const isName = sortColumn === "name";

  return (
    <thead className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur-sm">
      <tr className="border-b border-slate-800">
        {/* Name column — sortable */}
        <th
          onClick={() => onSort("name")}
          className={`cursor-pointer select-none pb-2.5 pl-3 pr-4 text-left text-[10px] font-semibold uppercase
            tracking-widest transition-colors hover:text-slate-300 min-w-[280px]
            ${isName ? "text-slate-300" : "text-slate-500"}`}
        >
          <span className="inline-flex items-center gap-1">
            Name
            {isName && <span className="text-[8px]">{sortDirection === "desc" ? "▼" : "▲"}</span>}
          </span>
        </th>

        {STATS_COLUMNS.map(col => {
          const active = sortColumn === col.key;
          return (
            <th
              key={col.key}
              onClick={() => onSort(col.key)}
              className={`cursor-pointer select-none whitespace-nowrap pb-2.5 pr-4 text-[10px] font-semibold uppercase
                tracking-widest transition-colors hover:text-slate-300
                ${col.align === "right" ? "text-right" : "text-left"}
                ${col.width ?? ""}
                ${active ? "text-slate-300" : "text-slate-500"}`}
            >
              <span className="inline-flex items-center gap-1">
                {col.header}
                {active && <span className="text-[8px]">{sortDirection === "desc" ? "▼" : "▲"}</span>}
              </span>
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

// ── Single row ──────────────────────────────────────────────────────────────

function Row({ row, depth, expanded, expanding, onToggle, search }: {
  row: StatsRow; depth: number; expanded: boolean; expanding: boolean;
  onToggle: () => void; search?: string;
}) {
  const indent = depth * 24;
  const hasChildren = row.childCount > 0;

  const bg =
    depth === 0 ? "hover:bg-slate-800/30" :
    depth === 1 ? "bg-slate-900/30 hover:bg-slate-800/40" :
                  "bg-slate-900/50 hover:bg-slate-800/50";

  return (
    <tr className={`border-b border-slate-800/40 transition-colors ${bg}`}>
      {/* Name cell */}
      <td className="py-2 pl-3 pr-4">
        <div className="flex items-center gap-1.5" style={{ paddingLeft: indent }}>
          {hasChildren ? (
            <button
              onClick={onToggle}
              className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded hover:bg-slate-700/50"
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              {expanding ? <Spinner /> : <Chevron expanded={expanded} />}
            </button>
          ) : (
            <span className="h-5 w-5 flex-shrink-0" />
          )}
          <span className="truncate text-sm font-medium text-slate-200 leading-tight">
            <HighlightName name={row.name} search={search} />
          </span>
        </div>
      </td>

      {/* Metric cells */}
      {STATS_COLUMNS.map(col => (
        <td
          key={col.key}
          className={`py-2 pr-4 text-sm text-slate-300 tabular-nums whitespace-nowrap ${
            col.align === "right" ? "text-right" : "text-left"
          }`}
        >
          {col.render(row)}
        </td>
      ))}
    </tr>
  );
}

// ── Search highlight ────────────────────────────────────────────────────────

function HighlightName({ name, search }: { name: string; search?: string }) {
  if (!search || search.length < 2) return <>{name}</>;
  const idx = name.toLowerCase().indexOf(search.toLowerCase());
  if (idx === -1) return <>{name}</>;
  return (
    <>
      {name.slice(0, idx)}
      <span className="rounded bg-amber-500/20 px-0.5 text-amber-300">
        {name.slice(idx, idx + search.length)}
      </span>
      {name.slice(idx + search.length)}
    </>
  );
}

// ── Empty state ─────────────────────────────────────────────────────────────

function Empty({ search }: { search?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-2 text-2xl text-slate-700">
        {search ? (
          <svg className="mx-auto h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        ) : (
          <svg className="mx-auto h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
          </svg>
        )}
      </div>
      <p className="text-sm font-medium text-slate-400">
        {search ? "No results found" : "No campaigns found"}
      </p>
      <p className="mt-1 text-xs text-slate-600">
        {search ? "Try a different search term" : "Make sure campaigns are synced from Meta"}
      </p>
    </div>
  );
}

// ── Main table ──────────────────────────────────────────────────────────────

export function StatsTable({
  campaignRows, childrenMap, expandedIds, expandingIds,
  onToggleExpand, sortColumn, sortDirection, onSortColumn, search,
}: Props) {
  // Flatten the 3-level tree into a sorted list with depth markers.
  // Sort is applied per sibling group (campaigns among campaigns, etc.)
  const flat = useMemo(() => {
    const out: Array<{ row: StatsRow; depth: number }> = [];

    for (const campaign of sortRows(campaignRows, sortColumn, sortDirection)) {
      out.push({ row: campaign, depth: 0 });

      if (expandedIds.has(campaign.externalId)) {
        const adSets = childrenMap[campaign.externalId] ?? [];
        for (const adSet of sortRows(adSets, sortColumn, sortDirection)) {
          out.push({ row: adSet, depth: 1 });

          if (expandedIds.has(adSet.externalId)) {
            const ads = childrenMap[adSet.externalId] ?? [];
            for (const ad of sortRows(ads, sortColumn, sortDirection)) {
              out.push({ row: ad, depth: 2 });
            }
          }
        }
      }
    }

    return out;
  }, [campaignRows, childrenMap, expandedIds, sortColumn, sortDirection]);

  if (campaignRows.length === 0) return <Empty search={search} />;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <Header sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSortColumn} />
        <tbody>
          {flat.map(({ row, depth }) => (
            <Row
              key={`${row.level}-${row.externalId}`}
              row={row}
              depth={depth}
              expanded={expandedIds.has(row.externalId)}
              expanding={expandingIds.has(row.externalId)}
              onToggle={() => onToggleExpand(row.externalId, row.level)}
              search={search}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
