// Hierarchical expandable table — campaigns → ad sets → ads.
//
// Layout:
//   - Sticky header row (stays visible during vertical scroll)
//   - Sticky name column (stays visible during horizontal scroll)
//   - Dense row height (~32px) for data-heavy analytics viewing
//   - Depth-based indent + subtle background tinting for hierarchy
//   - Expand chevron doubles as loading spinner during child fetch

"use client";

import { useMemo, memo, useCallback } from "react";
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

// ── Sort ────────────────────────────────────────────────────────────────────

function sortRows(rows: StatsRow[], column: string, direction: SortDirection): StatsRow[] {
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

// ── Icons ───────────────────────────────────────────────────────────────────

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3 w-3 text-slate-500 transition-transform duration-100 ${open ? "rotate-90" : ""}`}
      fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="h-3 w-3 animate-spin text-slate-500" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ── Sort indicator ──────────────────────────────────────────────────────────

function SortArrow({ active, direction }: { active: boolean; direction: SortDirection }) {
  if (!active) return null;
  return (
    <svg className="h-2.5 w-2.5 text-slate-400 flex-shrink-0" viewBox="0 0 10 10" fill="currentColor">
      {direction === "desc"
        ? <path d="M5 7L1 3h8z" />
        : <path d="M5 3l4 4H1z" />}
    </svg>
  );
}

// ── Search highlight ────────────────────────────────────────────────────────

function Highlight({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(term);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm bg-amber-500/20 px-px text-amber-200">{text.slice(idx, idx + term.length)}</mark>
      {text.slice(idx + term.length)}
    </>
  );
}

// ── Table header (sticky) ───────────────────────────────────────────────────

const TH_BASE = "select-none whitespace-nowrap text-[10px] font-semibold uppercase tracking-widest transition-colors cursor-pointer";

function Header({ sortColumn, sortDirection, onSort }: {
  sortColumn: string; sortDirection: SortDirection; onSort: (k: string) => void;
}) {
  const nameActive = sortColumn === "name";
  return (
    <thead>
      <tr>
        {/* Sticky name column header — sits above the sticky name cells */}
        <th
          onClick={() => onSort("name")}
          className={`${TH_BASE} sticky top-0 left-0 z-30 bg-slate-950 border-b border-r border-slate-800
            pl-3 pr-4 py-2 text-left min-w-[300px]
            ${nameActive ? "text-slate-300" : "text-slate-500"} hover:text-slate-300`}
        >
          <span className="inline-flex items-center gap-1">
            Name <SortArrow active={nameActive} direction={sortDirection} />
          </span>
        </th>

        {STATS_COLUMNS.map(col => {
          const active = sortColumn === col.key;
          return (
            <th
              key={col.key}
              onClick={() => onSort(col.key)}
              className={`${TH_BASE} sticky top-0 z-20 bg-slate-950 border-b border-slate-800
                py-2 px-3 ${col.minW ?? ""}
                ${col.align === "right" ? "text-right" : "text-left"}
                ${active ? "text-slate-300" : "text-slate-500"} hover:text-slate-300`}
            >
              <span className={`inline-flex items-center gap-1 ${col.align === "right" ? "justify-end" : ""}`}>
                {col.header} <SortArrow active={active} direction={sortDirection} />
              </span>
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

// ── Row (memoized) ──────────────────────────────────────────────────────────

interface RowProps {
  row: StatsRow;
  depth: number;
  expanded: boolean;
  expanding: boolean;
  onToggle: () => void;
  searchLower: string;
}

const Row = memo(function Row({ row, depth, expanded, expanding, onToggle, searchLower }: RowProps) {
  const indent = depth * 20;
  const hasChildren = row.childCount > 0;

  // Subtle depth tinting — campaigns are clean, children are slightly recessed
  const rowBg =
    depth === 0 ? "" :
    depth === 1 ? "bg-slate-900/40" : "bg-slate-900/60";

  // Level indicator for child rows
  const levelTag =
    depth === 1 ? "Ad Set" :
    depth === 2 ? "Ad" : null;

  return (
    <tr className={`border-b border-slate-800/30 transition-colors hover:bg-slate-800/30 ${rowBg} group`}>
      {/* Sticky name column */}
      <td
        className={`sticky left-0 z-10 py-1.5 pl-3 pr-3 border-r border-slate-800/40
          ${depth === 0 ? "bg-slate-950" : depth === 1 ? "bg-[#0d1120]" : "bg-[#0b0f1c]"}
          group-hover:bg-slate-800/60 transition-colors`}
      >
        <div className="flex items-center gap-1" style={{ paddingLeft: indent }}>
          {/* Expand/collapse toggle */}
          {hasChildren ? (
            <button
              onClick={onToggle}
              className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded
                text-slate-500 hover:text-slate-300 hover:bg-slate-700/60 transition-colors"
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              {expanding ? <Spinner /> : <Chevron open={expanded} />}
            </button>
          ) : (
            <span className="w-5 flex-shrink-0" />
          )}

          {/* Name + level tag */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate text-[13px] font-medium text-slate-200 leading-tight">
              <Highlight text={row.name} term={searchLower} />
            </span>
            {levelTag && (
              <span className="flex-shrink-0 rounded bg-slate-800/80 px-1 py-px text-[9px] font-medium uppercase tracking-wide text-slate-500">
                {levelTag}
              </span>
            )}
            {hasChildren && !expanded && (
              <span className="flex-shrink-0 text-[10px] text-slate-600">
                {row.childCount}
              </span>
            )}
          </div>
        </div>
      </td>

      {/* Metric cells */}
      {STATS_COLUMNS.map(col => (
        <td
          key={col.key}
          className={`py-1.5 px-3 text-[13px] tabular-nums whitespace-nowrap
            ${col.align === "right" ? "text-right" : "text-left"}`}
        >
          {col.render(row)}
        </td>
      ))}
    </tr>
  );
});

// ── Loading rows (in-table skeleton for child expansion) ────────────────────

function LoadingChildRows({ depth }: { depth: number }) {
  const indent = depth * 20;
  return (
    <>
      {[0, 1, 2].map(i => (
        <tr key={`skel-${i}`} className="border-b border-slate-800/20">
          <td className="sticky left-0 z-10 py-1.5 pl-3 pr-3 border-r border-slate-800/40 bg-slate-950">
            <div className="flex items-center gap-2" style={{ paddingLeft: indent }}>
              <span className="w-5" />
              <div className="h-3 animate-pulse rounded bg-slate-800/60" style={{ width: 120 + i * 30 }} />
            </div>
          </td>
          {STATS_COLUMNS.map(col => (
            <td key={col.key} className="py-1.5 px-3">
              <div className={`h-3 w-12 animate-pulse rounded bg-slate-800/40 ${col.align === "right" ? "ml-auto" : ""}`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── Empty state ─────────────────────────────────────────────────────────────

function Empty({ search }: { search?: string }) {
  return (
    <div className="py-20 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800/50">
        {search ? (
          <svg className="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        ) : (
          <svg className="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
          </svg>
        )}
      </div>
      <p className="text-sm font-medium text-slate-400">
        {search ? `No results for "${search}"` : "No campaigns found"}
      </p>
      <p className="mt-1 text-xs text-slate-600">
        {search
          ? "Try broadening your search or changing the date range"
          : "Connect a Meta ad account and sync campaigns to see data here"}
      </p>
    </div>
  );
}

// ── Main table ──────────────────────────────────────────────────────────────

export function StatsTable({
  campaignRows, childrenMap, expandedIds, expandingIds,
  onToggleExpand, sortColumn, sortDirection, onSortColumn, search,
}: Props) {
  const searchLower = useMemo(
    () => (search && search.length >= 2 ? search.toLowerCase() : ""),
    [search],
  );

  // Flatten tree → sorted list with depth markers
  const flat = useMemo(() => {
    const out: Array<{ row: StatsRow; depth: number }> = [];

    for (const campaign of sortRows(campaignRows, sortColumn, sortDirection)) {
      out.push({ row: campaign, depth: 0 });

      if (expandedIds.has(campaign.externalId)) {
        const adSets = childrenMap[campaign.externalId];
        if (adSets) {
          for (const adSet of sortRows(adSets, sortColumn, sortDirection)) {
            out.push({ row: adSet, depth: 1 });

            if (expandedIds.has(adSet.externalId)) {
              const ads = childrenMap[adSet.externalId];
              if (ads) {
                for (const ad of sortRows(ads, sortColumn, sortDirection)) {
                  out.push({ row: ad, depth: 2 });
                }
              }
            }
          }
        }
      }
    }

    return out;
  }, [campaignRows, childrenMap, expandedIds, sortColumn, sortDirection]);

  const makeToggle = useCallback(
    (externalId: string, level: StatsLevel) => () => onToggleExpand(externalId, level),
    [onToggleExpand],
  );

  if (campaignRows.length === 0) return <Empty search={search} />;

  return (
    <div className="overflow-auto max-h-[calc(100vh-280px)]">
      <table className="min-w-full border-collapse text-sm">
        <Header sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSortColumn} />
        <tbody>
          {flat.map(({ row, depth }) => {
            const isExpanded = expandedIds.has(row.externalId);
            const isExpanding = expandingIds.has(row.externalId);

            return (
              <Row
                key={`${row.level}-${row.externalId}`}
                row={row}
                depth={depth}
                expanded={isExpanded}
                expanding={isExpanding}
                onToggle={makeToggle(row.externalId, row.level)}
                searchLower={searchLower}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
