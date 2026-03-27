"use client";

// app/creative-lab/CreativeGalleryView.tsx
// Creative Gallery — visual grid view for creatives.
//
// Allows creative teams to visually scan all creatives, identify winning patterns,
// and spot fatigued content. Features filtering, sorting, comparison mode,
// and toggle between grid/list views.

import { useState, useMemo }         from "react";
import { useRouter }                  from "next/navigation";
import Link                           from "next/link";
import type {
  CreativeLabItem,
  CreativeLabStatus,
  CreativeLabFilterState,
}                                     from "../../types/creativeLab";
import {
  applyCreativeLabFilters,
}                                     from "../../lib/creativelab/workflowUtils";
import {
  SectionCard,
  Badge,
  EmptyState,
}                                     from "../../components/ui";
import type { BadgeVariant }          from "../../components/ui/Badge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ClientOption = { id: string; name: string };

type Props = {
  clients:          ClientOption[];
  initialItems:     CreativeLabItem[];
  selectedClientId: string | null;
};

type SortBy = "roas_desc" | "cpa_asc" | "spend_desc" | "newest";
type StatusFilter = "all" | "strong" | "fatigued" | "weak";

// ---------------------------------------------------------------------------
// Status badge color mapping
// ---------------------------------------------------------------------------

function getEvaluationColor(status: string): BadgeVariant {
  switch (status) {
    case "strong":
      return "success";
    case "fatigued":
      return "warning";
    case "weak":
      return "danger";
    default:
      return "neutral";
  }
}

function getROASColor(roas: number | null): BadgeVariant {
  if (roas === null) return "neutral";
  if (roas >= 2) return "success";
  if (roas >= 1) return "warning";
  return "danger";
}

// ---------------------------------------------------------------------------
// Gallery card component
// ---------------------------------------------------------------------------

function CreativeCard({
  item,
  selected,
  onSelect,
  onViewClick,
}: {
  item: CreativeLabItem;
  selected: boolean;
  onSelect: (id: string, selected: boolean) => void;
  onViewClick: (id: string) => void;
}) {
  const perf = item.performanceContext;
  const displayName = item.creativeName || item.adName || `Creative ${item.id.slice(0, 8)}`;
  const thumbnailUrl = perf?.thumbnailUrl || perf?.adCopy;

  const roasValue = perf?.campaignRoas ?? null;
  const cpaValue = perf?.campaignCpa ?? null;
  const spendValue = perf?.spend ?? 0;
  const evaluationStatus = perf?.evaluationStatus ?? "insufficient_data";

  return (
    <div
      className="flex flex-col rounded-lg border border-slate-800 bg-slate-900/60 overflow-hidden
        transition-all hover:border-slate-700 hover:shadow-lg"
    >
      {/* Checkbox overlay */}
      <div className="absolute top-2 left-2 z-10">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(item.id, e.target.checked)}
          className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-600 cursor-pointer
            accent-emerald-600"
        />
      </div>

      {/* Image/Thumbnail */}
      <div className="relative h-48 w-full bg-slate-800 flex items-center justify-center overflow-hidden">
        {thumbnailUrl && thumbnailUrl.startsWith("http") ? (
          <img
            src={thumbnailUrl}
            alt={displayName}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full w-full bg-slate-700/40 text-slate-500 text-xs text-center px-2">
            {item.clientName}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-3 flex flex-col gap-2">
        {/* Name */}
        <div className="min-h-[2.5rem]">
          <h3 className="text-sm font-medium text-white truncate" title={displayName}>
            {displayName}
          </h3>
          <p className="text-xs text-slate-500 truncate">{item.clientName}</p>
        </div>

        {/* ROAS Badge */}
        {roasValue !== null && (
          <Badge variant={getROASColor(roasValue)}>
            ROAS {roasValue.toFixed(2)}x
          </Badge>
        )}

        {/* Metrics */}
        <div className="space-y-1 text-xs text-slate-400">
          {cpaValue !== null && (
            <p>CPA: <span className="text-slate-300 font-medium">${cpaValue.toFixed(2)}</span></p>
          )}
          {spendValue > 0 && (
            <p>Spend: <span className="text-slate-300 font-medium">${spendValue.toFixed(0)}</span></p>
          )}
        </div>

        {/* Status Badge */}
        <div>
          <Badge variant={getEvaluationColor(evaluationStatus)}>
            {evaluationStatus.replace("_", " ").charAt(0).toUpperCase() +
             evaluationStatus.replace("_", " ").slice(1).toLowerCase()}
          </Badge>
        </div>
      </div>

      {/* Footer — View button */}
      <div className="px-3 py-2 border-t border-slate-800/60">
        <button
          onClick={() => onViewClick(item.id)}
          className="w-full px-2 py-1.5 text-xs font-medium rounded bg-slate-800 text-slate-200
            hover:bg-slate-700 transition-colors"
        >
          View Details
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Comparison panel
// ---------------------------------------------------------------------------

function ComparisonPanel({
  items,
  allItems,
  onClose,
}: {
  items: string[];
  allItems: CreativeLabItem[];
  onClose: () => void;
}) {
  const selected = allItems.filter((i) => items.includes(i.id));
  if (selected.length < 2) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-end" onClick={onClose}>
      <div
        className="w-full max-h-[80vh] bg-slate-950 border-t border-slate-800 rounded-t-xl overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between px-5 py-3 bg-slate-950 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-white">
            Compare {selected.length} Creatives
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300"
          >
            ✕
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/40">
                <th className="px-4 py-2 text-left text-slate-400 font-medium w-32">Metric</th>
                {selected.map((item) => (
                  <th key={item.id} className="px-3 py-2 text-left text-slate-300 font-medium">
                    <div className="truncate max-w-xs">
                      {item.creativeName || item.adName || `Creative ${item.id.slice(0, 8)}`}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-800/40">
                <td className="px-4 py-2 text-slate-400 font-medium">Client</td>
                {selected.map((item) => (
                  <td key={item.id} className="px-3 py-2 text-slate-300">
                    {item.clientName}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-800/40">
                <td className="px-4 py-2 text-slate-400 font-medium">Status</td>
                {selected.map((item) => (
                  <td key={item.id} className="px-3 py-2 text-slate-300">
                    {item.performanceContext?.evaluationStatus?.replace("_", " ") || "N/A"}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-800/40">
                <td className="px-4 py-2 text-slate-400 font-medium">ROAS</td>
                {selected.map((item) => (
                  <td key={item.id} className="px-3 py-2 text-slate-300">
                    {item.performanceContext?.campaignRoas != null
                      ? `${item.performanceContext.campaignRoas.toFixed(2)}x`
                      : "—"}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-800/40">
                <td className="px-4 py-2 text-slate-400 font-medium">CPA</td>
                {selected.map((item) => (
                  <td key={item.id} className="px-3 py-2 text-slate-300">
                    {item.performanceContext?.campaignCpa != null
                      ? `$${item.performanceContext.campaignCpa.toFixed(2)}`
                      : "—"}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-800/40">
                <td className="px-4 py-2 text-slate-400 font-medium">Spend</td>
                {selected.map((item) => (
                  <td key={item.id} className="px-3 py-2 text-slate-300">
                    ${(item.performanceContext?.spend ?? 0).toFixed(0)}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-800/40">
                <td className="px-4 py-2 text-slate-400 font-medium">CTR</td>
                {selected.map((item) => (
                  <td key={item.id} className="px-3 py-2 text-slate-300">
                    {item.performanceContext?.avgCtr != null
                      ? `${item.performanceContext.avgCtr.toFixed(2)}%`
                      : "—"}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-800/40">
                <td className="px-4 py-2 text-slate-400 font-medium">Frequency</td>
                {selected.map((item) => (
                  <td key={item.id} className="px-3 py-2 text-slate-300">
                    {item.performanceContext?.avgFrequency != null
                      ? `${item.performanceContext.avgFrequency.toFixed(1)}x`
                      : "—"}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-4 py-2 text-slate-400 font-medium">Source</td>
                {selected.map((item) => (
                  <td key={item.id} className="px-3 py-2 text-slate-300">
                    {item.sourceType?.replace("_", " ") || "—"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter bar
// ---------------------------------------------------------------------------

function FilterBar({
  clients,
  selectedClientId,
  onClientChange,
  statusFilter,
  onStatusChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
}: {
  clients: ClientOption[];
  selectedClientId: string;
  onClientChange: (id: string) => void;
  statusFilter: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  sortBy: SortBy;
  onSortChange: (sort: SortBy) => void;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
}) {
  return (
    <SectionCard>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {/* Client Filter */}
        <div>
          <label className="block text-xs text-slate-500 mb-1.5 font-medium">Client</label>
          <select
            value={selectedClientId}
            onChange={(e) => onClientChange(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs
              text-slate-200 focus:border-slate-600 focus:outline-none"
          >
            <option value="">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-xs text-slate-500 mb-1.5 font-medium">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value as StatusFilter)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs
              text-slate-200 focus:border-slate-600 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="strong">Strong</option>
            <option value="fatigued">Fatigued</option>
            <option value="weak">Weak</option>
          </select>
        </div>

        {/* Sort By */}
        <div>
          <label className="block text-xs text-slate-500 mb-1.5 font-medium">Sort By</label>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortBy)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs
              text-slate-200 focus:border-slate-600 focus:outline-none"
          >
            <option value="newest">Newest</option>
            <option value="roas_desc">ROAS (High to Low)</option>
            <option value="cpa_asc">CPA (Low to High)</option>
            <option value="spend_desc">Spend (High to Low)</option>
          </select>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-end gap-2">
          <button
            onClick={() => onViewModeChange("grid")}
            className={`flex-1 px-2 py-2 text-xs font-medium rounded transition-colors ${
              viewMode === "grid"
                ? "bg-slate-700 text-white"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700/60"
            }`}
            title="Grid view"
          >
            Grid
          </button>
          <button
            onClick={() => onViewModeChange("list")}
            className={`flex-1 px-2 py-2 text-xs font-medium rounded transition-colors ${
              viewMode === "list"
                ? "bg-slate-700 text-white"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700/60"
            }`}
            title="Switch to list view"
          >
            List
          </button>
        </div>
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function CreativeGalleryView({ clients, initialItems, selectedClientId }: Props) {
  const router = useRouter();

  const [items] = useState<CreativeLabItem[]>(initialItems);
  const [clientId, setClientId] = useState<string>(selectedClientId ?? "");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [showComparison, setShowComparison] = useState(false);

  // Apply filters
  const filteredItems = useMemo(() => {
    let result = items;

    if (clientId) {
      result = result.filter((i) => i.clientAccountId === clientId);
    }

    if (statusFilter !== "all") {
      result = result.filter(
        (i) => i.performanceContext?.evaluationStatus === statusFilter
      );
    }

    return result;
  }, [items, clientId, statusFilter]);

  // Apply sorting
  const sortedItems = useMemo(() => {
    const sorted = [...filteredItems];

    switch (sortBy) {
      case "roas_desc":
        sorted.sort(
          (a, b) =>
            (b.performanceContext?.campaignRoas ?? 0) -
            (a.performanceContext?.campaignRoas ?? 0)
        );
        break;
      case "cpa_asc":
        sorted.sort(
          (a, b) =>
            (a.performanceContext?.campaignCpa ?? Infinity) -
            (b.performanceContext?.campaignCpa ?? Infinity)
        );
        break;
      case "spend_desc":
        sorted.sort(
          (a, b) =>
            (b.performanceContext?.spend ?? 0) -
            (a.performanceContext?.spend ?? 0)
        );
        break;
      case "newest":
      default:
        sorted.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
    }

    return sorted;
  }, [filteredItems, sortBy]);

  const handleCardSelect = (id: string, selected: boolean) => {
    const newSelected = new Set(selectedCards);
    if (selected) {
      if (newSelected.size < 4) {
        newSelected.add(id);
      }
    } else {
      newSelected.delete(id);
    }
    setSelectedCards(newSelected);
  };

  const handleViewClick = (itemId: string) => {
    // Could link to detail view or open modal
    // For now, just close comparison and reset
    setShowComparison(false);
  };

  // Redirect to list view
  if (viewMode === "list") {
    return (
      <div className="min-h-screen bg-slate-950 p-5">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white mb-2">Creative Gallery</h1>
            <p className="text-slate-400">Switching to list view...</p>
          </div>
          <Link
            href="/creative-lab"
            className="inline-block px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium
              hover:bg-emerald-700 transition-colors"
          >
            Go to Creative Lab Workflow
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-5">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Creative Gallery</h1>
            <p className="text-slate-400 text-sm mt-1">
              Visually scan creatives, identify patterns, and spot fatigue
            </p>
          </div>
        </div>

        {/* Filter bar */}
        <FilterBar
          clients={clients}
          selectedClientId={clientId}
          onClientChange={setClientId}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          sortBy={sortBy}
          onSortChange={setSortBy}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {/* Comparison button */}
        {selectedCards.size > 1 && (
          <div className="flex items-center gap-3">
            <p className="text-sm text-slate-400">
              {selectedCards.size} creative{selectedCards.size !== 1 ? "s" : ""} selected
            </p>
            <button
              onClick={() => setShowComparison(true)}
              className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg
                hover:bg-emerald-700 transition-colors"
            >
              Compare
            </button>
            <button
              onClick={() => setSelectedCards(new Set())}
              className="px-3 py-2 text-slate-400 text-sm hover:text-slate-300 transition-colors"
            >
              Clear
            </button>
          </div>
        )}

        {/* Grid or empty state */}
        {sortedItems.length === 0 ? (
          <EmptyState title="No creatives found" description="Try adjusting your filters" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedItems.map((item) => (
              <CreativeCard
                key={item.id}
                item={item}
                selected={selectedCards.has(item.id)}
                onSelect={handleCardSelect}
                onViewClick={handleViewClick}
              />
            ))}
          </div>
        )}

        {/* Comparison panel */}
        {showComparison && (
          <ComparisonPanel
            items={Array.from(selectedCards)}
            allItems={sortedItems}
            onClose={() => setShowComparison(false)}
          />
        )}
      </div>
    </div>
  );
}
