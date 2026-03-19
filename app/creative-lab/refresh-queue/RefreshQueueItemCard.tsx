"use client";

// app/creative-lab/refresh-queue/RefreshQueueItemCard.tsx
// Compact queue item card for the refresh queue list.
// Two layouts:
//   Mobile  — full card with priority badge, recommendation headline, key metrics
//   Desktop — same card, slightly denser (no structural difference needed at this size)

import type {
  CreativeRefreshQueueItem,
  CreativeRefreshPriority,
  CreativeRefreshActionType,
} from "../../../types/creativeRefreshQueue";
import { Badge }           from "../../../components/ui";
import type { BadgeVariant } from "../../../components/ui/Badge";
import { formatCurrency }  from "../../../lib/metricUtils";

// ---------------------------------------------------------------------------
// Display mappings
// ---------------------------------------------------------------------------

export const PRIORITY_LABEL: Record<CreativeRefreshPriority, string> = {
  urgent: "Urgent",
  high:   "High",
  medium: "Medium",
  low:    "Low",
};

export const PRIORITY_VARIANT: Record<CreativeRefreshPriority, BadgeVariant> = {
  urgent: "danger",
  high:   "warning",
  medium: "info",
  low:    "neutral",
};

const PRIORITY_DOT: Record<CreativeRefreshPriority, string> = {
  urgent: "bg-rose-500",
  high:   "bg-amber-400",
  medium: "bg-sky-500",
  low:    "bg-slate-600",
};

export const ACTION_LABEL: Record<CreativeRefreshActionType, string> = {
  review_creative:               "Review",
  generate_new_copy_variations:  "New Copy",
  generate_new_image_variations: "New Images",
  generate_full_refresh_brief:   "Full Brief",
  pause_creative_candidate:      "Pause",
  monitor_only:                  "Monitor",
};

export const ACTION_VARIANT: Record<CreativeRefreshActionType, BadgeVariant> = {
  review_creative:               "neutral",
  generate_new_copy_variations:  "info",
  generate_new_image_variations: "purple",
  generate_full_refresh_brief:   "warning",
  pause_creative_candidate:      "danger",
  monitor_only:                  "neutral",
};

export const FATIGUE_LABEL: Record<string, string> = {
  healthy:           "Healthy",
  watch:             "Watch",
  fatigued:          "Fatigued",
  severe_fatigue:    "Severe Fatigue",
  insufficient_data: "Low Data",
};

export const FATIGUE_VARIANT: Record<string, BadgeVariant> = {
  healthy:           "success",
  watch:             "warning",
  fatigued:          "danger",
  severe_fatigue:    "danger",
  insufficient_data: "neutral",
};

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

type Props = {
  item:       CreativeRefreshQueueItem;
  isSelected: boolean;
  onSelect:   (id: string) => void;
};

export function RefreshQueueItemCard({ item, isSelected, onSelect }: Props) {
  const pc       = item;
  const action   = item.recommendation.actionType;
  const fatigue  = item.fatigueStatus;

  return (
    <button
      onClick={() => onSelect(item.id)}
      className={`w-full rounded-xl border p-4 text-left transition-all
        ${isSelected
          ? "border-violet-600/60 bg-violet-950/30 ring-1 ring-violet-600/40"
          : "border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-800/40"
        }`}
    >
      {/* Top row: priority dot + headline + priority badge */}
      <div className="flex items-start gap-3">
        <span className="mt-1.5 shrink-0">
          <span
            className={`block h-2.5 w-2.5 rounded-full ${PRIORITY_DOT[item.priority]}`}
            title={`${PRIORITY_LABEL[item.priority]} priority`}
          />
        </span>

        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-medium leading-snug text-slate-100">
            {item.recommendation.headline}
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {item.creativeName ?? item.campaignName ?? item.clientName}
          </p>
        </div>

        <div className="shrink-0">
          <Badge variant={PRIORITY_VARIANT[item.priority]}>
            {PRIORITY_LABEL[item.priority]}
          </Badge>
        </div>
      </div>

      {/* Bottom row: action + fatigue + key metrics */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Badge variant={ACTION_VARIANT[action]}>
          {ACTION_LABEL[action]}
        </Badge>

        {fatigue && (
          <Badge variant={FATIGUE_VARIANT[fatigue] ?? "neutral"}>
            {FATIGUE_LABEL[fatigue] ?? fatigue}
          </Badge>
        )}

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

        {/* Confidence indicator */}
        <span className={`ml-auto text-xs
          ${item.recommendation.confidence === "high"   ? "text-emerald-500" :
            item.recommendation.confidence === "medium" ? "text-slate-400"   : "text-slate-600"
          }`}
        >
          {item.recommendation.confidence} confidence
        </span>
      </div>
    </button>
  );
}
