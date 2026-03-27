"use client";

// app/creative-fatigue/CreativeFatigueView.tsx
// Creative fatigue monitoring page — filters, summary cards, refresh queue,
// and full creative list.
//
// Responsive:
//   Mobile  (< lg): stacked cards, prominent badge, thumb-friendly action grid
//   Desktop (≥ lg): full table with all metric columns + inline action buttons

import { useMemo, useState } from "react";
import Link                  from "next/link";
import type {
  CreativeFatigueSummary,
  CreativeHealthCounts,
  CreativeFatigueStatus,
  CreativeRefreshActionType,
} from "../../lib/creativeFatigue/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  summaries: CreativeFatigueSummary[];
  counts:    CreativeHealthCounts;
}

// ---------------------------------------------------------------------------
// Fatigue status helpers
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<CreativeFatigueStatus, string> = {
  severe_fatigue:    "Severe Fatigue",
  fatigued:          "Fatigued",
  watch:             "Watch",
  healthy:           "Healthy",
  insufficient_data: "Insufficient Data",
};

const STATUS_BADGE: Record<CreativeFatigueStatus, string> = {
  severe_fatigue:    "bg-rose-900/60 text-rose-300 border-rose-700",
  fatigued:          "bg-orange-900/60 text-orange-300 border-orange-700",
  watch:             "bg-amber-900/60 text-amber-300 border-amber-700",
  healthy:           "bg-emerald-900/60 text-emerald-300 border-emerald-700",
  insufficient_data: "bg-slate-800/60 text-slate-400 border-slate-700",
};

const STATUS_DOT: Record<CreativeFatigueStatus, string> = {
  severe_fatigue:    "bg-rose-500",
  fatigued:          "bg-orange-500",
  watch:             "bg-amber-400",
  healthy:           "bg-emerald-500",
  insufficient_data: "bg-slate-600",
};

const ACTION_LABEL: Record<CreativeRefreshActionType, string> = {
  review_creative:               "Review in Lab",
  generate_new_copy_variations:  "Copy Variations",
  generate_new_image_variations: "Image Variations",
  generate_full_creative_refresh: "Full Refresh",
  pause_creative_candidate:      "Pause Candidate",
};

const PRIORITY_COLOR: Record<string, string> = {
  high:   "text-rose-400",
  medium: "text-amber-400",
  low:    "text-slate-400",
};

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function fmt(n: number, decimals = 2) {
  return n.toFixed(decimals);
}

function fmtSpend(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: CreativeFatigueStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
      {STATUS_LABEL[status]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Priority badge
// ---------------------------------------------------------------------------

function PriorityBadge({ priority }: { priority: "high" | "medium" | "low" }) {
  const colors: Record<string, string> = {
    high:   "bg-rose-900/40 text-rose-300 border-rose-800",
    medium: "bg-amber-900/40 text-amber-300 border-amber-800",
    low:    "bg-slate-800/40 text-slate-400 border-slate-700",
  };
  return (
    <span className={`rounded border px-1.5 py-0.5 text-xs font-medium ${colors[priority]}`}>
      {priority}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Summary cards
// ---------------------------------------------------------------------------

interface CardProps {
  label:   string;
  count:   number;
  color:   string; // bg/text combo
  onClick: () => void;
  active:  boolean;
}

function SummaryCard({ label, count, color, onClick, active }: CardProps) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col gap-1 rounded-lg border p-4 text-left transition-all ${
        active
          ? "border-slate-500 bg-slate-800"
          : "border-slate-800 bg-slate-900 hover:border-slate-700"
      }`}
    >
      <span className={`text-2xl font-bold ${color}`}>{count}</span>
      <span className="text-xs text-slate-400">{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Action buttons for a fatigued creative
// ---------------------------------------------------------------------------

function ActionButtons({ summary }: { summary: CreativeFatigueSummary }) {
  const rec = summary.refreshRecommendation;

  // Primary action from recommendation; fallback to Review
  const primary = rec?.actionType ?? "review_creative";

  const actions: CreativeRefreshActionType[] = ["review_creative"];
  if (primary !== "review_creative") actions.unshift(primary);

  // Add generation options for fatigued/severe
  if (
    summary.fatigueStatus === "fatigued" ||
    summary.fatigueStatus === "severe_fatigue"
  ) {
    if (!actions.includes("generate_new_copy_variations")) {
      actions.push("generate_new_copy_variations");
    }
    if (!actions.includes("generate_new_image_variations")) {
      actions.push("generate_new_image_variations");
    }
  }

  // Limit to 4 buttons max
  const visible = actions.slice(0, 4);

  return (
    <div className="mt-3 grid grid-cols-2 gap-2 lg:flex lg:flex-wrap lg:gap-1.5">
      {visible.map((action) => {
        const isPrimary = action === primary && action !== "review_creative";
        const isPause   = action === "pause_creative_candidate";
        const isReview  = action === "review_creative";

        const btnCls = isPause
          ? "border-rose-800 bg-rose-950/40 text-rose-300 hover:bg-rose-900/50"
          : isPrimary
          ? "border-emerald-700 bg-emerald-900/40 text-emerald-300 hover:bg-emerald-800/50"
          : isReview
          ? "border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-700/60"
          : "border-slate-700 bg-slate-800/40 text-slate-400 hover:bg-slate-700/50";

        return (
          <Link
            key={action}
            href="/creative-lab"
            className={`inline-flex items-center justify-center rounded border px-2.5 py-1.5 text-xs font-medium transition-colors lg:px-2 lg:py-1 ${btnCls}`}
          >
            {ACTION_LABEL[action]}
          </Link>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile card — single creative fatigue item
// ---------------------------------------------------------------------------

function FatigueMobileCard({ s }: { s: CreativeFatigueSummary }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-100">
            {s.creativeName ?? s.externalCreativeId}
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {s.campaignName} &middot; {s.clientName}
          </p>
        </div>
        <StatusBadge status={s.fatigueStatus} />
      </div>

      {/* Key metrics strip */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-sm font-semibold text-slate-200">{fmt(s.avgCtr)}%</p>
          <p className="text-xs text-slate-600">CTR</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-200">
            {s.avgFrequency != null ? `${fmt(s.avgFrequency, 1)}x` : "—"}
          </p>
          <p className="text-xs text-slate-600">Freq</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-200">
            {s.campaignRoas != null ? `${fmt(s.campaignRoas, 2)}x` : "—"}
          </p>
          <p className="text-xs text-slate-600">ROAS</p>
        </div>
      </div>

      {/* Recommendation */}
      {s.refreshRecommendation && (
        <div className="mt-3 rounded border border-slate-800 bg-slate-950/50 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-300">
              {s.refreshRecommendation.headline}
            </p>
            <PriorityBadge priority={s.refreshRecommendation.priority} />
          </div>
          {expanded && (
            <p className="mt-1.5 text-xs text-slate-500">
              {s.refreshRecommendation.rationale}
            </p>
          )}
        </div>
      )}

      {/* Signals (expandable) */}
      {s.fatigueSignals.length > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs text-slate-600 hover:text-slate-400"
        >
          {expanded ? "Hide signals" : `${s.fatigueSignals.length} signal${s.fatigueSignals.length > 1 ? "s" : ""} detected`}
        </button>
      )}
      {expanded && s.fatigueSignals.length > 0 && (
        <ul className="mt-2 space-y-1">
          {s.fatigueSignals.map((sig) => (
            <li key={sig.reason} className="flex items-start gap-2 text-xs">
              <span
                className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                  sig.severity === "critical" ? "bg-rose-500" : "bg-amber-400"
                }`}
              />
              <span className="text-slate-400">{sig.label}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Action buttons — always visible for fatigued+ */}
      {(s.fatigueStatus === "fatigued" ||
        s.fatigueStatus === "severe_fatigue" ||
        s.fatigueStatus === "watch") && (
        <ActionButtons summary={s} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

interface FilterState {
  clientId:        string;
  status:          string;
  campaign:        string;
  recommendationType: string;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CreativeFatigueView({ summaries, counts }: Props) {
  const [filters, setFilters] = useState<FilterState>({
    clientId:           "",
    status:             "",
    campaign:           "",
    recommendationType: "",
  });

  // Quick filter from summary card clicks
  const [activeCard, setActiveCard] = useState<CreativeFatigueStatus | "">("");

  function toggleCard(status: CreativeFatigueStatus) {
    if (activeCard === status) {
      setActiveCard("");
      setFilters((f) => ({ ...f, status: "" }));
    } else {
      setActiveCard(status);
      setFilters((f) => ({ ...f, status }));
    }
  }

  // Unique clients for dropdown
  const clients = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of summaries) seen.set(s.clientAccountId, s.clientName);
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [summaries]);

  // Unique campaigns for dropdown
  const campaigns = useMemo(() => {
    const seen = new Set<string>();
    for (const s of summaries) seen.add(s.campaignName);
    return [...seen].sort();
  }, [summaries]);

  // Apply filters
  const filtered = useMemo(() => {
    return summaries.filter((s) => {
      if (filters.clientId && s.clientAccountId !== filters.clientId) return false;
      if (filters.status && s.fatigueStatus !== filters.status) return false;
      if (
        filters.campaign &&
        !s.campaignName.toLowerCase().includes(filters.campaign.toLowerCase())
      ) {
        return false;
      }
      if (
        filters.recommendationType &&
        s.refreshRecommendation?.actionType !== filters.recommendationType
      ) {
        return false;
      }
      return true;
    });
  }, [summaries, filters]);

  // Refresh queue: fatigued + severe, sorted by priority then spend
  const refreshQueue = useMemo(() => {
    const priorityRank: Record<string, number> = { high: 2, medium: 1, low: 0 };
    return filtered
      .filter(
        (s) =>
          s.fatigueStatus === "fatigued" || s.fatigueStatus === "severe_fatigue"
      )
      .sort((a, b) => {
        const pa = a.refreshRecommendation?.priority ?? "low";
        const pb = b.refreshRecommendation?.priority ?? "low";
        const rankDiff = priorityRank[pb] - priorityRank[pa];
        return rankDiff !== 0 ? rankDiff : b.spend - a.spend;
      });
  }, [filtered]);

  const hasFilters =
    filters.clientId || filters.status || filters.campaign || filters.recommendationType;

  function clearFilters() {
    setFilters({ clientId: "", status: "", campaign: "", recommendationType: "" });
    setActiveCard("");
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Creative Fatigue</h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Fatigue detection across {counts.total} creative
          {counts.total !== 1 ? "s" : ""} in the last 14 days.
          {counts.severe_fatigue + counts.fatigued > 0 && (
            <span className="ml-1 text-rose-400">
              {counts.severe_fatigue + counts.fatigued} need{counts.severe_fatigue + counts.fatigued === 1 ? "s" : ""} attention.
            </span>
          )}
        </p>
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard
          label="Severe Fatigue"
          count={counts.severe_fatigue}
          color="text-rose-400"
          onClick={() => toggleCard("severe_fatigue")}
          active={activeCard === "severe_fatigue"}
        />
        <SummaryCard
          label="Fatigued"
          count={counts.fatigued}
          color="text-orange-400"
          onClick={() => toggleCard("fatigued")}
          active={activeCard === "fatigued"}
        />
        <SummaryCard
          label="Watch"
          count={counts.watch}
          color="text-amber-400"
          onClick={() => toggleCard("watch")}
          active={activeCard === "watch"}
        />
        <SummaryCard
          label="Healthy"
          count={counts.healthy}
          color="text-emerald-400"
          onClick={() => toggleCard("healthy")}
          active={activeCard === "healthy"}
        />
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-2">
        {/* Client filter */}
        {clients.length > 1 && (
          <select
            value={filters.clientId}
            onChange={(e) => setFilters((f) => ({ ...f, clientId: e.target.value }))}
            className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-500"
          >
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}

        {/* Status filter */}
        <select
          value={filters.status}
          onChange={(e) => {
            setFilters((f) => ({ ...f, status: e.target.value }));
            setActiveCard((e.target.value as CreativeFatigueStatus) || "");
          }}
          className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          <option value="">All statuses</option>
          <option value="severe_fatigue">Severe Fatigue</option>
          <option value="fatigued">Fatigued</option>
          <option value="watch">Watch</option>
          <option value="healthy">Healthy</option>
          <option value="insufficient_data">Insufficient Data</option>
        </select>

        {/* Campaign filter */}
        {campaigns.length > 1 && (
          <select
            value={filters.campaign}
            onChange={(e) => setFilters((f) => ({ ...f, campaign: e.target.value }))}
            className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-500"
          >
            <option value="">All campaigns</option>
            {campaigns.map((c) => (
              <option key={c} value={c}>
                {c.length > 40 ? c.slice(0, 40) + "…" : c}
              </option>
            ))}
          </select>
        )}

        {/* Recommendation type filter */}
        <select
          value={filters.recommendationType}
          onChange={(e) =>
            setFilters((f) => ({ ...f, recommendationType: e.target.value }))
          }
          className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          <option value="">All recommendations</option>
          <option value="review_creative">Review Creative</option>
          <option value="generate_new_copy_variations">Copy Variations</option>
          <option value="generate_new_image_variations">Image Variations</option>
          <option value="generate_full_creative_refresh">Full Refresh</option>
          <option value="pause_creative_candidate">Pause Candidate</option>
        </select>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-300"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Creative Refresh Queue */}
      {refreshQueue.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Creative Refresh Queue
            </h2>
            <span className="rounded bg-rose-900/50 px-1.5 py-0.5 text-xs font-medium text-rose-300">
              {refreshQueue.length}
            </span>
          </div>

          {/* Mobile: stacked cards */}
          <div className="space-y-3 lg:hidden">
            {refreshQueue.map((s) => (
              <FatigueMobileCard key={`${s.externalCreativeId}::${s.externalCampaignId}`} s={s} />
            ))}
          </div>

          {/* Desktop: richer list */}
          <div className="hidden space-y-2 lg:block">
            {refreshQueue.map((s) => (
              <div
                key={`${s.externalCreativeId}::${s.externalCampaignId}`}
                className="rounded-lg border border-slate-800 bg-slate-900 p-4"
              >
                <div className="flex items-start gap-4">
                  {/* Identity */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-slate-100">
                        {s.creativeName ?? s.externalCreativeId}
                      </p>
                      <StatusBadge status={s.fatigueStatus} />
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {s.campaignName} &middot; {s.clientName}
                    </p>

                    {/* Signals */}
                    {s.fatigueSignals.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {s.fatigueSignals.map((sig) => (
                          <span
                            key={sig.reason}
                            className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs ${
                              sig.severity === "critical"
                                ? "border-rose-800 bg-rose-950/40 text-rose-300"
                                : "border-amber-800 bg-amber-950/40 text-amber-300"
                            }`}
                          >
                            {sig.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-4 gap-4 text-center shrink-0">
                    <div>
                      <p className="text-sm font-semibold text-slate-200">{fmt(s.avgCtr)}%</p>
                      <p className="text-xs text-slate-600">CTR</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-200">
                        {s.avgFrequency != null ? `${fmt(s.avgFrequency, 1)}x` : "—"}
                      </p>
                      <p className="text-xs text-slate-600">Freq</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-200">
                        {s.campaignRoas != null ? `${fmt(s.campaignRoas, 2)}x` : "—"}
                      </p>
                      <p className="text-xs text-slate-600">ROAS</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-200">{fmtSpend(s.spend)}</p>
                      <p className="text-xs text-slate-600">Spend</p>
                    </div>
                  </div>
                </div>

                {/* Recommendation + actions */}
                {s.refreshRecommendation && (
                  <div className="mt-3 flex items-center justify-between gap-4 border-t border-slate-800 pt-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-slate-300">
                          {s.refreshRecommendation.headline}
                        </p>
                        <PriorityBadge priority={s.refreshRecommendation.priority} />
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">
                        {s.refreshRecommendation.rationale}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      {(["review_creative",
                        s.refreshRecommendation.actionType,
                        "generate_new_copy_variations",
                        "generate_new_image_variations",
                      ] as CreativeRefreshActionType[])
                        .filter((a, i, arr) => arr.indexOf(a) === i)
                        .slice(0, 4)
                        .map((action) => {
                          const isPrimary  = action === s.refreshRecommendation!.actionType && action !== "review_creative";
                          const isPause    = action === "pause_creative_candidate";
                          const isReview   = action === "review_creative";
                          const btnCls = isPause
                            ? "border-rose-800 bg-rose-950/40 text-rose-300 hover:bg-rose-900/50"
                            : isPrimary
                            ? "border-emerald-700 bg-emerald-900/40 text-emerald-300 hover:bg-emerald-800/50"
                            : isReview
                            ? "border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-700/60"
                            : "border-slate-700 bg-slate-800/40 text-slate-400 hover:bg-slate-700/50";
                          return (
                            <Link
                              key={action}
                              href="/creative-lab"
                              className={`rounded border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${btnCls}`}
                            >
                              {ACTION_LABEL[action]}
                            </Link>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* All creatives */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            All Creatives
          </h2>
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400">
            {filtered.length}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-8 text-center">
            <p className="text-sm text-slate-400">
              {summaries.length === 0
                ? "No creative data found. Run a Meta sync to populate ad-level insights."
                : "No creatives match the current filters."}
            </p>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="mt-2 text-xs text-emerald-500 hover:text-emerald-400"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile: stacked cards */}
            <div className="space-y-3 lg:hidden">
              {filtered.map((s) => (
                <FatigueMobileCard
                  key={`${s.externalCreativeId}::${s.externalCampaignId}`}
                  s={s}
                />
              ))}
            </div>

            {/* Desktop: full table */}
            <div className="hidden lg:block overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/80">
                    {[
                      "Creative",
                      "Campaign",
                      "Client",
                      "CTR",
                      "Freq",
                      "ROAS",
                      "Spend",
                      "Status",
                      "Recommendation",
                      "Priority",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900">
                  {filtered.map((s) => (
                    <tr
                      key={`${s.externalCreativeId}::${s.externalCampaignId}`}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="max-w-[180px] px-4 py-3">
                        <p className="truncate text-xs font-medium text-slate-200">
                          {s.creativeName ?? s.externalCreativeId}
                        </p>
                        {s.fatigueSignals.length > 0 && (
                          <p className="mt-0.5 truncate text-xs text-slate-600">
                            {s.fatigueSignals[0].label}
                          </p>
                        )}
                      </td>
                      <td className="max-w-[160px] px-4 py-3 text-xs text-slate-400">
                        <p className="truncate">{s.campaignName}</p>
                      </td>
                      <td className="max-w-[120px] px-4 py-3 text-xs text-slate-400">
                        <p className="truncate">{s.clientName}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-300">
                        {fmt(s.avgCtr)}%
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-300">
                        {s.avgFrequency != null ? `${fmt(s.avgFrequency, 1)}x` : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-300">
                        {s.campaignRoas != null ? `${fmt(s.campaignRoas, 2)}x` : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-300">
                        {fmtSpend(s.spend)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={s.fatigueStatus} />
                      </td>
                      <td className="max-w-[180px] px-4 py-3 text-xs text-slate-400">
                        {s.refreshRecommendation ? (
                          <p className="truncate">{s.refreshRecommendation.headline}</p>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {s.refreshRecommendation ? (
                          <div className="flex items-center gap-2">
                            <PriorityBadge priority={s.refreshRecommendation.priority} />
                            <Link
                              href="/creative-lab"
                              className="rounded border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-xs text-slate-400 hover:text-slate-200 transition-colors whitespace-nowrap"
                            >
                              Open Lab
                            </Link>
                          </div>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* Empty state — only when no data exists (not redundant with filtered empty) */}
      {summaries.length === 0 && filtered.length === 0 && (
        <div className="mt-6 rounded-lg border border-amber-800/50 bg-amber-950/30 p-4 text-sm text-amber-200/80">
          <p className="font-medium text-amber-300">No creative data available</p>
          <p className="mt-1 text-xs">
            Fatigue detection requires ad-level Meta insights. Go to{" "}
            <Link href="/integrations" className="underline hover:text-amber-200">
              Integrations
            </Link>{" "}
            and run a sync to populate data.
          </p>
        </div>
      )}
    </div>
  );
}
