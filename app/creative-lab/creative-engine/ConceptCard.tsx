"use client";

// app/creative-lab/creative-engine/ConceptCard.tsx
// Displays a full creative concept — angle + copy + optional image brief.
//
// Mobile:   single-column stacked layout, scannable copy, thumb-friendly actions
// Desktop:  side-by-side copy + image brief where available
//
// Shows:
//   - Angle type + performance rationale
//   - Hook + body + CTA (structured ad preview)
//   - Image brief (if present)
//   - Trigger link (fatigue/opportunity signal)
//   - Estimated quality score
//   - Action buttons: Save draft, Send to scoring, Send to approval, Regenerate

import { useState, useCallback } from "react";
import type { CreativeConcept }  from "../../../types/creativeGeneration";

type Props = {
  concept:      CreativeConcept;
  index:        number;
  onSaveDraft:  (conceptId: string) => void;
  onToScoring:  (conceptId: string) => void;
  onToApproval: (conceptId: string) => void;
  onRegenerate: () => void;
};

type ConceptStatus = "generated" | "saved_draft" | "sent_to_scoring" | "sent_to_approval";

const STATUS_STYLES: Record<ConceptStatus, string> = {
  generated:        "bg-slate-700/60 text-slate-400",
  saved_draft:      "bg-sky-900/40 text-sky-300",
  sent_to_scoring:  "bg-violet-900/40 text-violet-300",
  sent_to_approval: "bg-emerald-900/40 text-emerald-300",
};

const STATUS_LABELS: Record<ConceptStatus, string> = {
  generated:        "Generated",
  saved_draft:      "Saved Draft",
  sent_to_scoring:  "Sent to Scoring",
  sent_to_approval: "Sent to Approval",
};

const SCORE_COLORS = (score: number) =>
  score >= 75 ? "text-emerald-400" :
  score >= 50 ? "text-amber-400"   :
  "text-rose-400";

const ANGLE_BADGE_COLORS: Record<string, string> = {
  outcome:       "bg-indigo-900/40 text-indigo-300",
  problem_first: "bg-rose-900/40 text-rose-300",
  social_proof:  "bg-emerald-900/40 text-emerald-300",
  identity:      "bg-violet-900/40 text-violet-300",
  fear_of_loss:  "bg-amber-900/40 text-amber-300",
  authority:     "bg-sky-900/40 text-sky-300",
  curiosity:     "bg-teal-900/40 text-teal-300",
};

const CARD_BORDERS = [
  "border-indigo-800/40",
  "border-violet-800/40",
  "border-sky-800/40",
];

export function ConceptCard({
  concept, index, onSaveDraft, onToScoring, onToApproval, onRegenerate,
}: Props) {
  const [status,    setStatus]    = useState<ConceptStatus>("generated");
  const [expanded,  setExpanded]  = useState(true);

  const borderClass   = CARD_BORDERS[index % CARD_BORDERS.length] ?? CARD_BORDERS[0];
  const angleBadge    = ANGLE_BADGE_COLORS[concept.angle.type] ?? "bg-slate-700 text-slate-300";
  const scoreColor    = SCORE_COLORS(concept.estimatedScore);
  const hasImageBrief = concept.imageBrief != null;

  const handleSaveDraft = useCallback(() => {
    setStatus("saved_draft");
    onSaveDraft(concept.id);
  }, [concept.id, onSaveDraft]);

  const handleToScoring = useCallback(() => {
    setStatus("sent_to_scoring");
    onToScoring(concept.id);
  }, [concept.id, onToScoring]);

  const handleToApproval = useCallback(() => {
    setStatus("sent_to_approval");
    onToApproval(concept.id);
  }, [concept.id, onToApproval]);

  return (
    <div className={`rounded-xl border ${borderClass} bg-slate-900/50 overflow-hidden`}>

      {/* Concept header */}
      <div className="border-b border-slate-800/60 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${angleBadge}`}>
                {concept.angle.name}
              </span>
              <span className={`text-xs font-semibold ${scoreColor}`}>
                {concept.estimatedScore}/100
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
                {STATUS_LABELS[status]}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-slate-200 leading-snug">{concept.title}</h3>
          </div>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="shrink-0 text-xs text-slate-600 hover:text-slate-400 pt-0.5"
          >
            {expanded ? "▲" : "▼"}
          </button>
        </div>

        {/* Trigger link */}
        <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">{concept.triggerLink}</p>
      </div>

      {expanded && (
        <>
          {/* Copy + Image brief — side-by-side on desktop */}
          <div className={`divide-y divide-slate-800/60 lg:divide-y-0 ${hasImageBrief ? "lg:grid lg:grid-cols-2 lg:divide-x lg:divide-slate-800/60" : ""}`}>

            {/* Copy block */}
            <div className="px-4 py-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Ad Copy — {hasImageBrief ? "Paired with image below" : "Copy only"}
              </p>

              {/* Hook */}
              {concept.copyBlock.hook.text && (
                <div>
                  <p className="text-xs text-slate-600 mb-0.5">
                    Hook · {concept.copyBlock.hook.charCount} chars
                  </p>
                  <p className="text-sm font-medium italic text-slate-100 leading-snug">
                    &ldquo;{concept.copyBlock.hook.text}&rdquo;
                  </p>
                </div>
              )}

              {/* Body */}
              {concept.copyBlock.body && (
                <div>
                  <p className="text-xs text-slate-600 mb-0.5">Body</p>
                  <p className="text-sm text-slate-300 leading-relaxed">{concept.copyBlock.body}</p>
                </div>
              )}

              {/* CTA */}
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-xs text-slate-600 mb-0.5">Call to Action</p>
                  <p className="text-sm font-semibold text-slate-200">{concept.copyBlock.callToAction}</p>
                </div>
                {!concept.copyBlock.platformReady && (
                  <span className="text-xs text-amber-400">⚠ Exceeds Meta mobile preview length</span>
                )}
              </div>

              {/* Angle rationale */}
              <p className="text-xs text-slate-600 border-t border-slate-800/40 pt-2 leading-relaxed">
                {concept.angle.rationale}
              </p>
            </div>

            {/* Image brief */}
            {hasImageBrief && (
              <div className="px-4 py-4 space-y-3 bg-slate-900/20">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Image Brief</p>

                {concept.imageBrief!.conceptSummary && (
                  <div>
                    <p className="text-xs text-slate-600 mb-0.5">Concept</p>
                    <p className="text-sm text-slate-200 leading-relaxed">{concept.imageBrief!.conceptSummary}</p>
                  </div>
                )}
                {concept.imageBrief!.visualChanges && (
                  <div>
                    <p className="text-xs text-slate-600 mb-0.5">Visual changes</p>
                    <p className="text-sm text-slate-300 leading-relaxed">{concept.imageBrief!.visualChanges}</p>
                  </div>
                )}
                {concept.imageBrief!.goal && (
                  <div>
                    <p className="text-xs text-slate-600 mb-0.5">Goal</p>
                    <p className="text-sm font-medium text-slate-200">{concept.imageBrief!.goal}</p>
                  </div>
                )}
                {concept.imageBrief!.directResponseAngle && (
                  <div>
                    <p className="text-xs text-slate-600 mb-0.5">DR angle</p>
                    <p className="text-sm italic text-slate-400">{concept.imageBrief!.directResponseAngle}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Performance rationale */}
          <div className="border-t border-slate-800/60 px-4 py-3">
            <p className="text-xs text-slate-500 leading-relaxed">
              <span className="font-medium text-slate-400">Rationale: </span>
              {concept.performanceRationale}
            </p>
          </div>

          {/* Action buttons — thumb-friendly (min 44px) */}
          <div className="border-t border-slate-800/60 px-4 py-3">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleSaveDraft}
                disabled={status === "saved_draft"}
                className="rounded-lg border border-sky-700/50 bg-sky-950/20 px-3 py-2.5 text-xs
                  font-medium text-sky-300 hover:bg-sky-950/40 active:scale-95
                  disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
              >
                Save draft
              </button>
              <button
                onClick={handleToScoring}
                disabled={status === "sent_to_scoring"}
                className="rounded-lg border border-violet-700/50 bg-violet-950/20 px-3 py-2.5 text-xs
                  font-medium text-violet-300 hover:bg-violet-950/40 active:scale-95
                  disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
              >
                Send to scoring
              </button>
              <button
                onClick={handleToApproval}
                disabled={status === "sent_to_approval"}
                className="rounded-lg border border-emerald-700/50 bg-emerald-950/20 px-3 py-2.5 text-xs
                  font-medium text-emerald-300 hover:bg-emerald-950/40 active:scale-95
                  disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
              >
                Send to approval
              </button>
              <button
                onClick={onRegenerate}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs
                  text-slate-300 hover:bg-slate-700 active:scale-95 min-h-[44px]"
              >
                Regenerate variants
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
