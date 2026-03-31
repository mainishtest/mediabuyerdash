// Data hook for the Stats page.
// Manages campaign fetching, lazy child expansion, caching, and request lifecycle.

"use client";

import { useState, useCallback, useRef, useEffect, type MutableRefObject } from "react";
import type { StatsRow, StatsApiResponse, StatsSearchResult, StatsLevel } from "../../../../lib/stats/statsTypes";

export interface DateRange {
  startDate: string;
  endDate: string;
}

interface Params {
  clientId: string;
  dateRange: DateRange;
  activeOnly: boolean;
  search: string;
}

export interface StatsData {
  campaignRows: StatsRow[];
  childrenMap: Record<string, StatsRow[]>;
  totals: { spend: number; impressions: number; clicks: number; revenue: number; orders: number };
  loading: boolean;
  error: string | null;
  expandingIds: Set<string>;
  expandedIds: Set<string>;
  toggleExpand: (externalId: string, level: StatsLevel) => void;
  sortColumn: string;
  sortDirection: "asc" | "desc";
  setSortColumn: (col: string) => void;
}

const EMPTY_TOTALS = { spend: 0, impressions: 0, clicks: 0, revenue: 0, orders: 0 };

export function useStatsData({ clientId, dateRange, activeOnly, search }: Params): StatsData {
  const [campaignRows, setCampaignRows] = useState<StatsRow[]>([]);
  const [childrenMap, setChildrenMap] = useState<Record<string, StatsRow[]>>({});
  const [totals, setTotals] = useState(EMPTY_TOTALS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandingIds, setExpandingIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumnRaw] = useState("spend");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const abortRef = useRef<AbortController | null>(null);

  // ── Fetch campaigns (or deep search) on mount / filter change ─────────────
  useEffect(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    (async () => {
      setLoading(true);
      setError(null);
      // Clear child cache — date/filter change invalidates everything
      setChildrenMap({});

      try {
        const isDeepSearch = search.length >= 2;
        const qs = new URLSearchParams({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          ...(activeOnly ? { activeOnly: "true" } : {}),
          ...(isDeepSearch
            ? { deepSearch: "true", search }
            : { level: "campaign" }),
        });

        const res = await fetch(`/api/clients/${clientId}/stats?${qs}`, { signal: ac.signal });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }

        if (isDeepSearch) {
          const data: StatsSearchResult = await res.json();
          setCampaignRows(data.campaigns);

          // Build childrenMap from search results so expanded rows show immediately
          const cm: Record<string, StatsRow[]> = {};
          for (const as of data.adSets) {
            (cm[as.parentExternalId] ??= []).push(as);
          }
          for (const ad of data.ads) {
            (cm[ad.parentExternalId] ??= []).push(ad);
          }
          setChildrenMap(cm);

          // Auto-expand ancestors of matched items
          const expand = new Set<string>();
          for (const ancestors of Object.values(data.ancestorMap)) {
            for (const id of ancestors) expand.add(id);
          }
          setExpandedIds(expand);

          // Totals from campaign rows
          setTotals(data.campaigns.reduce(
            (t, r) => ({
              spend: t.spend + r.spend,
              impressions: t.impressions + r.impressions,
              clicks: t.clicks + r.clicks,
              revenue: t.revenue + r.revenue,
              orders: t.orders + r.orders,
            }),
            { ...EMPTY_TOTALS },
          ));
        } else {
          const data: StatsApiResponse = await res.json();
          setCampaignRows(data.rows);
          setTotals(data.totals);
          setExpandedIds(new Set());
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Unknown error");
        setCampaignRows([]);
        setTotals(EMPTY_TOTALS);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [clientId, dateRange.startDate, dateRange.endDate, activeOnly, search]);

  // ── Expand / collapse ─────────────────────────────────────────────────────
  // Uses refs for values that change on every expand (expandedIds, childrenMap)
  // so the callback identity stays stable and doesn't re-render the entire table.
  const childrenMapRef = useRef(childrenMap);
  childrenMapRef.current = childrenMap;
  const expandedIdsRef = useRef(expandedIds);
  expandedIdsRef.current = expandedIds;

  const toggleExpand = useCallback(
    async (externalId: string, level: StatsLevel) => {
      // Collapse
      if (expandedIdsRef.current.has(externalId)) {
        setExpandedIds(prev => { const n = new Set(prev); n.delete(externalId); return n; });
        return;
      }

      // Expand — mark expanded immediately for instant chevron rotation
      setExpandedIds(prev => new Set(prev).add(externalId));

      // Already cached — nothing to fetch
      if (childrenMapRef.current[externalId]) return;

      // Fetch children lazily
      const childLevel: StatsLevel = level === "campaign" ? "adset" : "ad";
      setExpandingIds(prev => new Set(prev).add(externalId));

      try {
        const qs = new URLSearchParams({
          level: childLevel,
          parentId: externalId,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          ...(activeOnly ? { activeOnly: "true" } : {}),
        });

        const res = await fetch(`/api/clients/${clientId}/stats?${qs}`);
        if (!res.ok) throw new Error("Failed to load");

        const data: StatsApiResponse = await res.json();
        setChildrenMap(prev => ({ ...prev, [externalId]: data.rows }));
      } catch {
        // Collapse on error so user can retry
        setExpandedIds(prev => { const n = new Set(prev); n.delete(externalId); return n; });
      } finally {
        setExpandingIds(prev => { const n = new Set(prev); n.delete(externalId); return n; });
      }
    },
    [dateRange, activeOnly, clientId], // Stable — no expandedIds/childrenMap churn
  );

  // ── Sort ──────────────────────────────────────────────────────────────────
  const setSortColumn = useCallback(
    (col: string) => {
      if (sortColumn === col) {
        setSortDirection(d => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortColumnRaw(col);
        setSortDirection("desc");
      }
    },
    [sortColumn],
  );

  return {
    campaignRows, childrenMap, totals, loading, error,
    expandingIds, expandedIds, toggleExpand,
    sortColumn, sortDirection, setSortColumn,
  };
}
