"use client";

// app/creative-lab/briefs/BriefCard.tsx
// Compact card for a brief in the queue list.
// Shows: status + draft type + creative context + key metrics + review state

import type {
  CreativeBrief,
  CreativeBriefStatus,
  CreativeDraftType,
  CreativeGenerationIntent,
} from "../../../types/creativeBrief";
import { Badge }           from "../../../components/ui";
import type { BadgeVariant } from "../../../components/ui/Badge";
import { formatCurrency }  from "../../../lib/metricUtils";

// ---------------------------------------------------------------------------
// Display maps
// ---------------------------------------------------------------------------

export const STATUS_LABEL: Record<CreativeBriefStatus, string> = {
  draft:              "Draft",
  in_review:          "In Review",
  approved:           "Approved",
  rejected:           "Rejected",
  revision_requested: "Needs Revision",
};

export const STATUS_VARIANT: Record<CreativeBriefStatus, BadgeVariant> = {
  draft:              "neutral",
  in_review:          "purple",
  approved:           "success",
  rejected:           "danger",
  revision_requested: "warning",
};

export const DRAFT_TYPE_LABEL: Record<CreativeDraftType, string> = {
  copy_variation:    "Copy Variations",
  headline_variation: "Headline Variations",
  angle_variation:   "Angle Variations",
  image_brief:       "Image Briefs",
  full_refresh_brief: "Full Brief",
};

export const DRAFT_TYPE_VARIANT: Record<CreativeDraftType, BadgeVariant> = {
  copy_variation:    "info",
  headline_variation: "info",
  angle_variation:   "purple",
  image_brief:       "warning",
  full_refresh_brief: "danger",
};

export const INTENT_LABEL: Record<CreativeGenerationIntent, string> = {
  preserve_winner_pattern:  "Preserve winner",
  refresh_hook:             "Refresh hook",
  refresh_angle:            "Refresh angle",
  refresh_visual_direction: "Refresh visual",
  full_reset:               "Full reset",
};

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

type Props = {
  brief:      CreativeBrief;
  isSelected: boolean;
  onSelect:   (id: string) => void;
};

export function BriefCard({ brief, isSelected, onSelect }: Props) {
  const pc = brief.input;

  // Count how many variants have been reviewed
  const totalVariants    = brief.draftSet.variants.length;
  const reviewedVariants = brief.draftSet.variants.filter((v) => v.reviewDecision !== null).length;
  const approvedVariants = brief.draftSet.variants.filter((v) => v.reviewDecision === "approve").length;

  return (
    <button
      onClick={() => onSelect(brief.id)}
      className={`w-full rounded-xl border p-4 text-left transition-all
        ${isSelected
          ? "border-indigo-600/60 bg-indigo-950/30 ring-1 ring-indigo-600/40"
          : "border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-800/40"
        }`}
    >
      {/* Top row: status + draft type + review count */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={STATUS_VARIANT[brief.status]}>
            {STATUS_LABEL[brief.status]}
          </Badge>
          <Badge variant={DRAFT_TYPE_VARIANT[brief.draftType]}>
            {DRAFT_TYPE_LABEL[brief.draftType]}
          </Badge>
        </div>
        <span className="shrink-0 text-xs text-slate-500">
          {reviewedVariants}/{totalVariants} reviewed
        </span>
      </div>

      {/* Headline: creative name or campaign */}
      <p className="mt-2 truncate text-sm font-medium text-slate-100">
        {brief.creativeName ?? brief.campaignName ?? brief.clientName}
      </p>

      {/* Intent + client */}
      <p className="mt-0.5 truncate text-xs text-slate-500">
        {INTENT_LABEL[brief.intent]} · {brief.clientName}
      </p>

      {/* Key metrics + approved count */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        {pc.spend > 0 && (
          <span className="text-xs text-slate-500">{formatCurrency(pc.spend)} spend</span>
        )}
        {pc.avgCtr > 0 && (
          <span className="text-xs text-slate-500">{pc.avgCtr.toFixed(2)}% CTR</span>
        )}
        {pc.campaignRoas != null && (
          <span className={`text-xs font-medium ${
            pc.campaignRoas >= 2 ? "text-emerald-400" :
            pc.campaignRoas >= 1 ? "text-slate-300"   : "text-rose-400"
          }`}>
            {pc.campaignRoas.toFixed(2)}x ROAS
          </span>
        )}
        {approvedVariants > 0 && (
          <span className="ml-auto text-xs font-medium text-emerald-500">
            {approvedVariants} approved
          </span>
        )}
      </div>

      {/* Timestamp */}
      <p className="mt-2 text-xs text-slate-600">
        Created {new Date(brief.createdAt).toLocaleDateString()}
      </p>
    </button>
  );
}
