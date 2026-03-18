"use client";

// app/creative-lab/CreativeLabItemCard.tsx
// Queue item card — one per Creative Lab item in the left panel list.
// Renders at two densities: compact (list row on desktop) and full (mobile card).

import type { CreativeLabItem, CreativeLabStatus, CreativeLabPriority, CreativeLabSourceType } from "../../types/creativeLab";
import { Badge } from "../../components/ui";
import type { BadgeVariant } from "../../components/ui/Badge";
import { formatCurrency } from "../../lib/metricUtils";

// ---------------------------------------------------------------------------
// Display mappings
// ---------------------------------------------------------------------------

export const STATUS_LABEL: Record<CreativeLabStatus, string> = {
  draft:          "Draft",
  queued:         "Queued",
  in_review:      "In Review",
  approved:       "Approved",
  rejected:       "Rejected",
  needs_revision: "Needs Revision",
  blocked:        "Blocked",
  archived:       "Archived",
};

export const STATUS_VARIANT: Record<CreativeLabStatus, BadgeVariant> = {
  draft:          "neutral",
  queued:         "info",
  in_review:      "purple",
  approved:       "success",
  rejected:       "danger",
  needs_revision: "warning",
  blocked:        "neutral",
  archived:       "neutral",
};

export const SOURCE_LABEL: Record<CreativeLabSourceType, string> = {
  fatigued_creative:        "Fatigue Signal",
  underperforming_creative: "Underperforming",
  winning_creative:         "Scale Opportunity",
  manual_entry:             "Manual",
  recommendation_engine:    "Auto-Detected",
};

export const SOURCE_VARIANT: Record<CreativeLabSourceType, BadgeVariant> = {
  fatigued_creative:        "warning",
  underperforming_creative: "danger",
  winning_creative:         "success",
  manual_entry:             "neutral",
  recommendation_engine:    "info",
};

const PRIORITY_DOT: Record<CreativeLabPriority, string> = {
  low:    "bg-slate-600",
  medium: "bg-sky-500",
  high:   "bg-amber-400",
  urgent: "bg-rose-500",
};

const PRIORITY_LABEL: Record<CreativeLabPriority, string> = {
  low:    "Low",
  medium: "Medium",
  high:   "High",
  urgent: "Urgent",
};

// ---------------------------------------------------------------------------
// Card component
// ---------------------------------------------------------------------------

type Props = {
  item:       CreativeLabItem;
  isSelected: boolean;
  onSelect:   (id: string) => void;
};

export function CreativeLabItemCard({ item, isSelected, onSelect }: Props) {
  const pc = item.performanceContext;

  return (
    <button
      onClick={() => onSelect(item.id)}
      className={`w-full rounded-xl border p-4 text-left transition-all
        ${isSelected
          ? "border-indigo-600/60 bg-indigo-950/30 ring-1 ring-indigo-600/40"
          : "border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-800/40"
        }`}
    >
      {/* Top row: priority dot + headline + status badge */}
      <div className="flex items-start gap-3">
        {/* Priority indicator */}
        <span className="mt-1.5 shrink-0">
          <span
            className={`block h-2 w-2 rounded-full ${PRIORITY_DOT[item.priority]}`}
            title={`${PRIORITY_LABEL[item.priority]} priority`}
          />
        </span>

        <div className="min-w-0 flex-1">
          {/* Headline */}
          <p className="truncate text-sm font-medium text-slate-100">
            {item.recommendationHeadline}
          </p>

          {/* Creative / campaign context */}
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {item.creativeName
              ? item.creativeName
              : item.campaignName
              ? `Campaign: ${item.campaignName}`
              : item.clientName}
          </p>
        </div>

        {/* Status badge — shrinks on narrow screens */}
        <div className="shrink-0">
          <Badge variant={STATUS_VARIANT[item.status]}>
            {STATUS_LABEL[item.status]}
          </Badge>
        </div>
      </div>

      {/* Bottom row: source + key metrics + priority label */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Badge variant={SOURCE_VARIANT[item.sourceType]}>
          {SOURCE_LABEL[item.sourceType]}
        </Badge>

        {pc && (
          <>
            {pc.spend > 0 && (
              <span className="text-xs text-slate-500">
                {formatCurrency(pc.spend)} spend
              </span>
            )}
            {pc.avgCtr > 0 && (
              <span className="text-xs text-slate-500">
                {pc.avgCtr.toFixed(2)}% CTR
              </span>
            )}
            {pc.campaignRoas != null && (
              <span
                className={`text-xs font-medium ${
                  pc.campaignRoas >= 2 ? "text-emerald-400" :
                  pc.campaignRoas >= 1 ? "text-slate-300"   : "text-rose-400"
                }`}
              >
                {pc.campaignRoas.toFixed(2)}x ROAS
              </span>
            )}
          </>
        )}

        {/* Priority — shows as text on wider cards */}
        <span className={`ml-auto text-xs font-medium
          ${item.priority === "urgent" ? "text-rose-400"  :
            item.priority === "high"   ? "text-amber-400" :
            item.priority === "medium" ? "text-sky-400"   : "text-slate-600"
          }`}
        >
          {PRIORITY_LABEL[item.priority]}
        </span>
      </div>
    </button>
  );
}
