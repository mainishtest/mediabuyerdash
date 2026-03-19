"use client";

// app/creative-lab/publish-prep/PublishPrepItemCard.tsx
// Compact card for a publish prep item in the list panel.
// Shows: status, variant title, target mapping summary, blockers count.

import type { PublishPrepItem } from "../../../types/publishPrep";
import {
  PREP_STATUS_LABEL,
  PREP_STATUS_COLOR,
}                               from "../../../types/publishPrep";
import { Badge }                from "../../../components/ui";
import type { BadgeVariant }    from "../../../components/ui/Badge";

function statusVariant(status: PublishPrepItem["status"]): BadgeVariant {
  switch (status) {
    case "published":           return "success";
    case "ready_to_publish":    return "success";
    case "approved_for_launch": return "success";
    case "ready_for_approval":  return "warning";
    case "blocked":             return "danger";
    case "publish_failed":      return "danger";
    case "validating":          return "info";
    default:                    return "neutral";
  }
}

type Props = {
  item:       PublishPrepItem;
  isSelected: boolean;
  onSelect:   (id: string) => void;
};

export function PublishPrepItemCard({ item, isSelected, onSelect }: Props) {
  const blockerCount = item.validation?.blockers.length ?? 0;
  const hasCampaign  = !!(item.targetMapping.targetCampaignName ?? item.targetMapping.targetCampaignExternalId);
  const hasAdSet     = !!(item.targetMapping.targetAdSetName    ?? item.targetMapping.targetAdSetExternalId);

  return (
    <button
      onClick={() => onSelect(item.id)}
      className={`w-full rounded-xl border p-4 text-left transition-all
        ${isSelected
          ? "border-indigo-600/60 bg-indigo-950/30 ring-1 ring-indigo-600/40"
          : "border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-800/40"
        }`}
    >
      {/* Top row: status + type */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant={statusVariant(item.status)}>
            {PREP_STATUS_LABEL[item.status]}
          </Badge>
          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-500">
            {item.variantType}
          </span>
        </div>
        {blockerCount > 0 && (
          <span className="shrink-0 rounded-md bg-rose-950/40 px-2 py-0.5 text-xs font-medium text-rose-400">
            {blockerCount} blocker{blockerCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Title */}
      <p className="mt-2 truncate text-sm font-medium text-slate-100">{item.variantTitle}</p>

      {/* Source */}
      <p className="mt-0.5 truncate text-xs text-slate-500">
        {item.clientName} · {item.campaignName ?? "No campaign"} · {item.briefIntent.replace(/_/g, " ")}
      </p>

      {/* Target mapping summary */}
      <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
        <span className={`text-xs ${hasCampaign ? "text-slate-400" : "text-slate-700"}`}>
          {hasCampaign
            ? `→ ${item.targetMapping.targetCampaignName ?? item.targetMapping.targetCampaignExternalId}`
            : "No campaign mapped"}
        </span>
        {hasAdSet && (
          <span className="text-xs text-slate-600">
            / {item.targetMapping.targetAdSetName ?? item.targetMapping.targetAdSetExternalId}
          </span>
        )}
      </div>

      {/* Timestamp */}
      <p className="mt-2 text-xs text-slate-700">
        Created {new Date(item.createdAt).toLocaleDateString()}
      </p>
    </button>
  );
}
