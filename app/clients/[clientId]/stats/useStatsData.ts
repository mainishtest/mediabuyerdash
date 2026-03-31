// app/clients/[clientId]/stats/useStatsData.ts
// Custom hook for fetching and managing hierarchical stats data.
// Handles campaign loading, lazy child expansion, caching, and abort logic.

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { StatsRow, StatsApiResponse, StatsSearchResult, StatsLevel } from "../../../../lib/stats/statsTypes";

interface DateRange {
  startDate: string;
  endDate: string;
}

interface UseStatsDataParams {
  clientId: string;
  dateRange: DateRange;
  activeOnly: boolean;
  search: string;
}

interface UseStatsDataReturn {
  campaignRows: StatsRow[];
  childrenMap: Record<string, StatsRow[]>;
  searchAdSets: StatsRow[];
  searchAds: StatsRow[];
  ancestorMap: Record<string, string[]>;
  totals: { spend: number; impressions: number; clicks: number; revenue: number; orders: number };
  loading: boolean;
  expandingIds: Set<string>;
  expandedIds: Set<string>;
  toggleExpand: (externalId: string, level: StatsLevel) => void;
  sortColumn: string;
  sortDirection: "asc" | "desc";
  setSortColumn: (col: string) => void;
}

export function useStatsData({ clientId, dateRange, activeOnly, search }: UseStatsDataParams): UseStatsDataReturn {
  const [campaignRows, setCampaignRows] = useState<StatsRow[]>([]);
  const [childrenMap, setChildrenMap] = useState<Record<string, StatsRow[]>>({});
  const [searchAdSets, setSearchAdSets] = useState<StatsRow[]>([]);
  const [searchAds, setSearchAds] = useState<StatsRow[]>([]);
  const [ancestorMap, setAncestorMap] = useState<Record<string, string[]>>({});
  const [totals, setTotals] = useState({ spend: 0, impressions: 0, clicks: 0, revenue: 0, orders: 0 });
  const [loading, setLoading] = useState(true);
  const [expandingIds, setExpandingIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumnState] = useState("spend");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const abortRef = useRef<AbortController | null>(null);

  // Fetch campaigns or deep search on mount / filter change
  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    async function load() {
      setLoading(true);
      setChildrenMap({});
      setSearchAdSets([]);
      setSearchAds([]);
      setAncestorMap({});

      try {
        if (search && search.length >= 2) {
          // Deep search mode
          const params = new URLSearchParams({
            deepSearch: "true",
            search,
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            ...(activeOnly ? { activeOnly: "true" } : {}),
          });

          const res = await fetch(`/api/clients/${clientId}/stats?${params}`, {
            signal: controller.signal,
          });

          if (!res.ok) throw new Error("Search failed");

          const data: StatsSearchResult = await res.json();
          setCampaignRows(data.campaigns);
          setSearchAdSets(data.adSets);
          setSearchAds(data.ads);
          setAncestorMap(data.ancestorMap);

          // Auto-expand ancestors of matched items
          const autoExpand = new Set<string>();
          for (const ancestors of Object.values(data.ancestorMap)) {
            for (const id of ancestors) autoExpand.add(id);
          }
          setExpandedIds(autoExpand);

          // Populate childrenMap from search results for expanded items
          const newChildrenMap: Record<string, StatsRow[]> = {};
          for (const adSet of data.adSets) {
            const parentId = adSet.parentExternalId;
            if (!newChildrenMap[parentId]) newChildrenMap[parentId] = [];
            newChildrenMap[parentId].push(adSet);
          }
          for (const ad of data.ads) {
            const parentId = ad.parentExternalId;
            if (!newChildrenMap[parentId]) newChildrenMap[parentId] = [];
            newChildrenMap[parentId].push(ad);
          }
          setChildrenMap(newChildrenMap);

          // Compute totals from campaign level
          const t = data.campaigns.reduce(
            (acc, r) => ({
              spend: acc.spend + r.spend,
              impressions: acc.impressions + r.impressions,
              clicks: acc.clicks + r.clicks,
              revenue: acc.revenue + r.revenue,
              orders: acc.orders + r.orders,
            }),
            { spend: 0, impressions: 0, clicks: 0, revenue: 0, orders: 0 },
          );
          setTotals(t);
        } else {
          // Standard campaign load
          const params = new URLSearchParams({
            level: "campaign",
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            ...(activeOnly ? { activeOnly: "true" } : {}),
          });

          const res = await fetch(`/api/clients/${clientId}/stats?${params}`, {
            signal: controller.signal,
          });

          if (!res.ok) throw new Error("Campaign fetch failed");

          const data: StatsApiResponse = await res.json();
          setCampaignRows(data.rows);
          setTotals(data.totals);
          setExpandedIds(new Set());
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        console.error("[useStatsData] Error:", err);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    load();

    return () => controller.abort();
  }, [clientId, dateRange.startDate, dateRange.endDate, activeOnly, search]);

  // Toggle expand/collapse for a row
  const toggleExpand = useCallback(
    async (externalId: string, level: StatsLevel) => {
      if (expandedIds.has(externalId)) {
        // Collapse
        setExpandedIds(prev => {
          const next = new Set(prev);
          next.delete(externalId);
          return next;
        });
        return;
      }

      // Expand — check if children already cached
      setExpandedIds(prev => new Set(prev).add(externalId));

      if (childrenMap[externalId]) return; // Already loaded

      // Fetch children
      const childLevel: StatsLevel = level === "campaign" ? "adset" : "ad";
      setExpandingIds(prev => new Set(prev).add(externalId));

      try {
        const params = new URLSearchParams({
          level: childLevel,
          parentId: externalId,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          ...(activeOnly ? { activeOnly: "true" } : {}),
        });

        const res = await fetch(`/api/clients/${clientId}/stats?${params}`);
        if (!res.ok) throw new Error("Child fetch failed");

        const data: StatsApiResponse = await res.json();
        setChildrenMap(prev => ({ ...prev, [externalId]: data.rows }));
      } catch (err) {
        console.error("[useStatsData] Error loading children:", err);
        // Collapse on error
        setExpandedIds(prev => {
          const next = new Set(prev);
          next.delete(externalId);
          return next;
        });
      } finally {
        setExpandingIds(prev => {
          const next = new Set(prev);
          next.delete(externalId);
          return next;
        });
      }
    },
    [childrenMap, dateRange, activeOnly, clientId, expandedIds],
  );

  // Sort column toggle
  const setSortColumn = useCallback(
    (col: string) => {
      if (sortColumn === col) {
        setSortDirection(prev => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortColumnState(col);
        setSortDirection("desc");
      }
    },
    [sortColumn],
  );

  return {
    campaignRows,
    childrenMap,
    searchAdSets,
    searchAds,
    ancestorMap,
    totals,
    loading,
    expandingIds,
    expandedIds,
    toggleExpand,
    sortColumn,
    sortDirection,
    setSortColumn,
  };
}
