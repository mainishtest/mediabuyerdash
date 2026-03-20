"use client";

// app/creative-lab/generation/GeneratedVariantCard.tsx
// Displays one AI-generated draft variant with provenance badge and review actions.
// Mirrors BriefDetail's VariantCard but adds AI source context.

import { useState, useCallback } from "react";
import type {
  CreativeDraftVariant,
  CreativeReviewDecision,
}                                from "../../../types/creativeBrief";
import { Badge }                 from "../../../components/ui";

// ---------------------------------------------------------------------------
// Button styles
// ---------------------------------------------------------------------------

const BTN = "rounded-xl px-4 py-3 text-xs font-medium transition-colors active:scale-95 sm:py-2.5";

function ApproveBtn({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${BTN} border border-emerald-700/50 bg-emerald-950/30 text-emerald-300
        hover:bg-emerald-950/50 disabled:opacity-40`}
    >
      Approve
    </button>
  );
}
function ReviseBtn({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${BTN} border border-amber-700/50 bg-amber-950/30 text-amber-300
        hover:bg-amber-950/50 disabled:opacity-40`}
    >
      Revise
    </button>
  );
}
function RejectBtn({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${BTN} border border-rose-800/50 bg-rose-950/30 text-rose-300
        hover:bg-rose-950/50 disabled:opacity-40`}
    >
      Reject
    </button>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  variant:    CreativeDraftVariant;
  provider:   string;
  onReview:   (variantId: string, decision: CreativeReviewDecision) => Promise<void>;
  briefId:    string;
};

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export function GeneratedVariantCard({ variant, provider, onReview, briefId }: Props) {
  const [saving, setSaving] = useState(false);

  const decide = useCallback(
    async (decision: CreativeReviewDecision) => {
      if (saving) return;
      setSaving(true);
      await onReview(variant.id, decision);
      setSaving(false);
    },
    [saving, variant.id, onReview],
  );

  const isAI       = provider !== "mock" && provider !== "anthropic_text_fallback";
  const providerLabel =
    provider === "anthropic_text"          ? "Claude AI"       :
    provider === "mock"                    ? "Mock"            :
    provider === "anthropic_text_fallback" ? "AI (fallback)"   :
    provider === "mock_fallback"           ? "Mock (fallback)" :
    provider;

  const decisionVariant =
    variant.reviewDecision === "approve"          ? "success" :
    variant.reviewDecision === "reject"           ? "danger"  :
    variant.reviewDecision === "request_revision" ? "warning" : "neutral";

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">

      {/* Title + badges + review status */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-xs font-semibold text-slate-300">{variant.title}</p>
        <div className="flex items-center gap-1.5">
          {isAI && (
            <span className="rounded-md bg-indigo-900/60 px-1.5 py-0.5 text-xs font-medium text-indigo-300">
              AI
            </span>
          )}
          <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-xs text-slate-500">
            {providerLabel}
          </span>
          {variant.reviewDecision && (
            <Badge variant={decisionVariant}>
              {variant.reviewDecision === "approve"          ? "Approved"   :
               variant.reviewDecision === "reject"           ? "Rejected"   :
               "Needs Revision"}
            </Badge>
          )}
        </div>
      </div>

      {/* Copy variant content */}
      {variant.variantType === "copy" && (
        <div className="mt-3 space-y-2.5">
          {variant.hook && (
            <div>
              <p className="text-xs text-slate-600">Hook</p>
              <p className="mt-0.5 text-sm font-medium leading-snug text-slate-100">
                &ldquo;{variant.hook}&rdquo;
              </p>
            </div>
          )}
          {variant.body && (
            <div>
              <p className="text-xs text-slate-600">Body</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-300">{variant.body}</p>
            </div>
          )}
          {variant.callToAction && (
            <div>
              <p className="text-xs text-slate-600">CTA</p>
              <p className="mt-0.5 text-xs font-medium text-indigo-300">{variant.callToAction}</p>
            </div>
          )}
        </div>
      )}

      {/* Image brief content */}
      {variant.variantType === "image" && (
        <div className="mt-3 space-y-2.5">
          {variant.conceptSummary && (
            <div>
              <p className="text-xs text-slate-600">Concept</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-300">{variant.conceptSummary}</p>
            </div>
          )}
          {variant.visualChanges && (
            <div>
              <p className="text-xs text-slate-600">Visual changes</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-300">{variant.visualChanges}</p>
            </div>
          )}
          {variant.goal && (
            <div>
              <p className="text-xs text-slate-600">Goal</p>
              <p className="mt-0.5 text-xs text-slate-400">{variant.goal}</p>
            </div>
          )}
          {variant.directResponseAngle && (
            <div>
              <p className="text-xs text-slate-600">DR angle</p>
              <p className="mt-0.5 text-xs italic text-slate-500">{variant.directResponseAngle}</p>
            </div>
          )}
        </div>
      )}

      {/* Review actions */}
      {!variant.reviewDecision ? (
        <div className="mt-4 flex gap-2">
          <ApproveBtn onClick={() => decide("approve")}           disabled={saving} />
          <ReviseBtn  onClick={() => decide("request_revision")}  disabled={saving} />
          <RejectBtn  onClick={() => decide("reject")}            disabled={saving} />
        </div>
      ) : (
        <div className="mt-3 flex justify-end">
          <button
            onClick={() => decide(variant.reviewDecision === "approve" ? "reject" : "approve")}
            disabled={saving}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-40"
          >
            Change decision
          </button>
        </div>
      )}
    </div>
  );
}
