"use client";

// app/creative-lab/creative-engine/VariantOutputCard.tsx
// Displays a single generated creative variant with action buttons.
//
// Mobile:   full-width card, stacked copy sections, thumb-friendly buttons
// Desktop:  same card, richer copy display, additional context shown
//
// Action buttons:
//   Save draft         → sets status to "saved_draft"
//   Send to scoring    → sets status to "sent_to_scoring"
//   Send to approval   → sets status to "sent_to_approval"
//   Regenerate         → triggers parent regeneration
//   Edit manually      → inline edit mode
//   Approve / Reject   → for image briefs

import { useState, useCallback } from "react";
import type { CreativeVariant }  from "../../../types/creativeGeneration";

type Props = {
  variant:      CreativeVariant;
  provider:     string;
  onAction:     (variantId: string, action: CreativeVariant["status"]) => void;
  onRegenerate: () => void;
  index:        number;
};

const STATUS_STYLES: Record<CreativeVariant["status"], string> = {
  generated:         "bg-slate-700/60 text-slate-400",
  saved_draft:       "bg-sky-900/40 text-sky-300",
  sent_to_scoring:   "bg-violet-900/40 text-violet-300",
  sent_to_approval:  "bg-emerald-900/40 text-emerald-300",
  edited:            "bg-amber-900/40 text-amber-300",
};

const STATUS_LABELS: Record<CreativeVariant["status"], string> = {
  generated:         "Generated",
  saved_draft:       "Saved Draft",
  sent_to_scoring:   "Sent to Scoring",
  sent_to_approval:  "Sent to Approval",
  edited:            "Edited",
};

const INDEX_COLORS = [
  "border-indigo-800/40 bg-indigo-950/10",
  "border-violet-800/40 bg-violet-950/10",
  "border-sky-800/40 bg-sky-950/10",
  "border-emerald-800/40 bg-emerald-950/10",
  "border-amber-800/40 bg-amber-950/10",
  "border-rose-800/40 bg-rose-950/10",
];

const INDEX_LABEL_COLORS = [
  "text-indigo-400",
  "text-violet-400",
  "text-sky-400",
  "text-emerald-400",
  "text-amber-400",
  "text-rose-400",
];

export function VariantOutputCard({ variant, provider, onAction, onRegenerate, index }: Props) {
  const [editMode,   setEditMode]   = useState(false);
  const [editedHook, setEditedHook] = useState(variant.hook ?? "");
  const [editedBody, setEditedBody] = useState(variant.body ?? "");
  const [editedCta,  setEditedCta]  = useState(variant.callToAction ?? "");
  const [status,     setStatus]     = useState<CreativeVariant["status"]>(variant.status);
  const [saving,     setSaving]     = useState(false);

  const colorClass      = INDEX_COLORS[index % INDEX_COLORS.length] ?? INDEX_COLORS[0];
  const labelColorClass = INDEX_LABEL_COLORS[index % INDEX_LABEL_COLORS.length] ?? INDEX_LABEL_COLORS[0];
  const isCopy          = variant.variantType === "copy";

  const handleAction = useCallback(
    (action: CreativeVariant["status"]) => {
      setStatus(action);
      onAction(variant.id, action);
    },
    [variant.id, onAction],
  );

  const handleSaveEdit = useCallback(() => {
    setStatus("edited");
    onAction(variant.id, "edited");
    setEditMode(false);
  }, [variant.id, onAction]);

  return (
    <div className={`rounded-xl border ${colorClass} overflow-hidden`}>

      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-800/60 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-xs font-semibold uppercase tracking-widest shrink-0 ${labelColorClass}`}>
            {isCopy ? "Copy" : "Image Brief"}
          </span>
          <span className="truncate text-xs text-slate-400">{variant.title}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {variant.angle && (
            <span className="hidden rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-500 sm:block">
              {variant.angle}
            </span>
          )}
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
            {STATUS_LABELS[status]}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-3">

        {isCopy ? (
          editMode ? (
            /* ── Edit mode ── */
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Hook</label>
                <textarea
                  value={editedHook}
                  onChange={(e) => setEditedHook(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2
                    text-sm text-slate-200 focus:border-indigo-600 focus:outline-none resize-none"
                />
                <p className="mt-0.5 text-xs text-slate-600">{editedHook.length} chars</p>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Body</label>
                <textarea
                  value={editedBody}
                  onChange={(e) => setEditedBody(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2
                    text-sm text-slate-200 focus:border-indigo-600 focus:outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Call to Action</label>
                <input
                  type="text"
                  value={editedCta}
                  onChange={(e) => setEditedCta(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2
                    text-sm text-slate-200 focus:border-indigo-600 focus:outline-none"
                />
              </div>
            </div>
          ) : (
            /* ── Display mode — copy ── */
            <div className="space-y-2">
              {variant.hook && (
                <div>
                  <p className="text-xs text-slate-600 mb-0.5">Hook</p>
                  <p className="text-sm font-medium italic text-slate-100 leading-snug">
                    &ldquo;{variant.hook}&rdquo;
                  </p>
                  <p className="mt-0.5 text-xs text-slate-700">{variant.hook.length} chars</p>
                </div>
              )}
              {variant.body && (
                <div>
                  <p className="text-xs text-slate-600 mb-0.5">Body</p>
                  <p className="text-sm text-slate-300 leading-relaxed">{variant.body}</p>
                </div>
              )}
              {variant.callToAction && (
                <div>
                  <p className="text-xs text-slate-600 mb-0.5">CTA</p>
                  <p className="text-sm font-semibold text-slate-200">{variant.callToAction}</p>
                </div>
              )}
            </div>
          )
        ) : (
          /* ── Display mode — image brief ── */
          <div className="space-y-2">
            {variant.conceptSummary && (
              <div>
                <p className="text-xs text-slate-600 mb-0.5">Concept</p>
                <p className="text-sm text-slate-200 leading-relaxed">{variant.conceptSummary}</p>
              </div>
            )}
            {variant.visualChanges && (
              <div>
                <p className="text-xs text-slate-600 mb-0.5">Visual changes</p>
                <p className="text-sm text-slate-300 leading-relaxed">{variant.visualChanges}</p>
              </div>
            )}
            {variant.goal && (
              <div>
                <p className="text-xs text-slate-600 mb-0.5">Goal</p>
                <p className="text-sm font-medium text-slate-200">{variant.goal}</p>
              </div>
            )}
            {variant.directResponseAngle && (
              <div>
                <p className="text-xs text-slate-600 mb-0.5">DR angle</p>
                <p className="text-sm text-slate-400 italic">{variant.directResponseAngle}</p>
              </div>
            )}
          </div>
        )}

        {/* Performance rationale */}
        {variant.performanceRationale && (
          <p className="text-xs text-slate-600 border-t border-slate-800/60 pt-2 leading-relaxed">
            {variant.performanceRationale}
          </p>
        )}

        {/* Provider badge */}
        <p className="text-xs text-slate-700">
          {provider === "anthropic_text"   ? "Claude AI (Anthropic)" :
           provider === "mock"             ? "Structured mock — AI not configured" :
           provider === "mock_fallback"    ? "Mock fallback (network error)" :
           provider}
        </p>
      </div>

      {/* Action buttons — thumb-friendly, min 44px touch target */}
      <div className="border-t border-slate-800/60 px-4 py-3">
        {editMode ? (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleSaveEdit}
              disabled={saving}
              className="flex-1 rounded-lg bg-indigo-600 px-3 py-2.5 text-xs font-medium text-white
                hover:bg-indigo-500 active:scale-95 disabled:opacity-50 min-h-[44px]"
            >
              Save edit
            </button>
            <button
              onClick={() => setEditMode(false)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs
                text-slate-300 hover:bg-slate-700 min-h-[44px]"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleAction("saved_draft")}
              disabled={status === "saved_draft"}
              className="rounded-lg border border-sky-700/50 bg-sky-950/20 px-3 py-2.5 text-xs
                font-medium text-sky-300 hover:bg-sky-950/40 active:scale-95
                disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
            >
              Save draft
            </button>
            <button
              onClick={() => handleAction("sent_to_scoring")}
              disabled={status === "sent_to_scoring"}
              className="rounded-lg border border-violet-700/50 bg-violet-950/20 px-3 py-2.5 text-xs
                font-medium text-violet-300 hover:bg-violet-950/40 active:scale-95
                disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
            >
              Send to scoring
            </button>
            <button
              onClick={() => handleAction("sent_to_approval")}
              disabled={status === "sent_to_approval"}
              className="rounded-lg border border-emerald-700/50 bg-emerald-950/20 px-3 py-2.5 text-xs
                font-medium text-emerald-300 hover:bg-emerald-950/40 active:scale-95
                disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
            >
              Send to approval
            </button>
            {isCopy && (
              <button
                onClick={() => setEditMode(true)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs
                  text-slate-300 hover:bg-slate-700 active:scale-95 min-h-[44px]"
              >
                Edit manually
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
