// app/clients/[clientId]/stats/StatsTable.tsx
// Hierarchical expandable table for the Stats view.
// Renders campaigns → ad sets → ads with expand/collapse, sorting, and loading states.

"use client";

import { useMemo } from "react";
import type { StatsRow, StatsLevel } from "../../../../lib/stats/statsTypes";
import { STATS_COLUMNS, type SortDirection } from "./StatsColumns";

interface StatsTableProps {
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

// ---------------------------------------------------------------------------
// Sort helper
// ---------------------------------------------------------------------------

function sortRows(rows: StatsRow[], column: string, direction: SortDirection): StatsRow[] {
  const col = STATS_COLUMNS.find(c => c.key === column);
  if (!col) return rows;

  return [...rows].sort((a, b) => {
    const aVal = col.sortValue(a);
    const bVal = col.sortValue(b);
    let cmp: number;
    if (typeof aVal === "string" && typeof bVal === "string") {
      cmp = aVal.localeCompare(bVal);
    } else {
      cmp = (aVal as number) - (bVal as number);
    }
    return direction === "asc" ? cmp : -cmp;
  });
}

// ---------------------------------------------------------------------------
// Chevron icon
// ---------------------------------------------------------------------------

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`h-3.5 w-3.5 text-slate-500 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.5}
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Loading spinner (inline)
// ---------------------------------------------------------------------------

function InlineSpinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin text-slate-500" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Table header
// ---------------------------------------------------------------------------

function TableHeader({
  sortColumn,
  sortDirection,
  onSortColumn,
}: {
  sortColumn: string;
  sortDirection: SortDirection;
  onSortColumn: (col: string) => void;
}) {
  return (
    <thead className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur-sm">
      <tr className="border-b border-slate-800">
        {/* Name column (wider, fixed) */}
        <th className="pb-2.5 pl-3 pr-4 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500 min-w-[260px]">
          Name
        </th>
        {STATS_COLUMNS.map(col => {
          const isActive = sortColumn === col.key;
          return (
            <th
              key={col.key}
              onClick={() => onSortColumn(col.key)}
              className={`cursor-pointer select-none pb-2.5 pr-4 text-[10px] font-semibold uppercase tracking-widest transition-colors hover:text-slate-300 ${
                col.align === "right" ? "text-right" : "text-left"
              } ${col.width ?? ""} ${isActive ? "text-slate-300" : "text-slate-500"}`}
            >
              <span className="inline-flex items-center gap-1">
                {col.header}
                {isActive && (
                  <span className="text-[8px]">{sortDirection === "desc" ? "▼" : "▲"}</span>
                )}
              </span>
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

// ---------------------------------------------------------------------------
// Row component
// ---------------------------------------------------------------------------

function StatsRowComponent({
  row,
  depth,
  isExpanded,
  isExpanding,
  onToggle,
  search,
}: {
  row: StatsRow;
  depth: number;
  isExpanded: boolean;
  isExpanding: boolean;
  onToggle: () => void;
  search?: string;
}) {
  const indent = depth * 24;
  const hasChildren = row.childCount > 0;

  const bgClass =
    depth === 0 ? "hover:bg-slate-800/30" :
    depth === 1 ? "bg-slate-900/30 hover:bg-slate-800/40" :
                  "bg-slate-900/50 hover:bg-slate-800/50";

  // Highlight matching search text
  function highlightName(name: string) {
    if (!search || search.length < 2) return <span className="text-slate-200">{name}</span>;
    const idx = name.toLowerCase().indexOf(search.toLowerCase());
    if (idx === -1) return <span className="text-slate-200">{name}</span>;
    return (
      <span className="text-slate-200">
        {name.slice(0, idx)}
        <span className="rounded bg-amber-500/20 px-0.5 text-amber-300">{name.slice(idx, idx + search.length)}</span>
        {name.slice(idx + search.length)}
      </span>
    );
  }

  return (
    <tr className={`border-b border-slate-800/40 transition-colors ${bgClass}`}>
      {/* Name cell with indent + chevron */}
      <td className="py-2 pl-3 pr-4">
        <div className="flex items-center gap-1.5" style={{ paddingLeft: indent }}>
          {hasChildren ? (
            <button
              onClick={onToggle}
              className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded hover:bg-slate-700/50"
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanding ? <InlineSpinner /> : <ChevronIcon expanded={isExpanded} />}
            </button>
          ) : (
            <span className="h-5 w-5 flex-shrink-0" />
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-medium leading-tight">
              {highlightName(row.name)}
            </div>
          </div>
        </div>
      </td>

      {/* Metric cells */}
      {STATS_COLUMNS.map(col => (
        <td
          key={col.key}
          className={`py-2 pr-4 text-sm tabular-nums ${
            col.align === "right" ? "text-right" : "text-left"
          }`}
        >
          {col.render(row)}
        </td>
      ))}
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main table
// ---------------------------------------------------------------------------

export function StatsTable({
  campaignRows,
  childrenMap,
  expandedIds,
  expandingIds,
  onToggleExpand,
  sortColumn,
  sortDirection,
  onSortColumn,
  search,
}: StatsTableProps) {
  // Build the flattened, sorted row list with depth info
  const flatRows = useMemo(() => {
    const result: Array<{ row: StatsRow; depth: number }> = [];

    const sortedCampaigns = sortColumn === "name"
      ? [...campaignRows] // Name sort handled differently
      : sortRows(campaignRows, sortColumn, sortDirection);

    for (const campaign of sortedCampaigns) {
      result.push({ row: campaign, depth: 0 });

      if (expandedIds.has(campaign.externalId)) {
        const adSets = childrenMap[campaign.externalId] ?? [];
        const sortedAdSets = sortRows(adSets, sortColumn, sortDirection);

        for (const adSet of sortedAdSets) {
          result.push({ row: adSet, depth: 1 });

          if (expandedIds.has(adSet.externalId)) {
            const ads = childrenMap[adSet.externalId] ?? [];
            const sortedAds = sortRows(ads, sortColumn, sortDirection);

            for (const ad of sortedAds) {
              result.push({ row: ad, depth: 2 });
            }
          }
        }
      }
    }

    return result;
  }, [campaignRows, childrenMap, expandedIds, sortColumn, sortDirection]);

  if (campaignRows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm font-medium text-slate-400">No campaigns found</p>
        <p className="mt-1 text-xs text-slate-600">
          {search ? "Try a different search term" : "Make sure campaigns are synced from Meta"}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <TableHeader
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSortColumn={onSortColumn}
        />
        <tbody>
          {flatRows.map(({ row, depth }) => (
            <StatsRowComponent
              key={`${row.level}-${row.externalId}`}
              row={row}
              depth={depth}
              isExpanded={expandedIds.has(row.externalId)}
              isExpanding={expandingIds.has(row.externalId)}
              onToggle={() => onToggleExpand(row.externalId, row.level)}
              search={search}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
