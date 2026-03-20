"use client";

// app/creative-lab/review/DraftScorecardPanel.tsx
// Full scorecard panel for one draft variant.
// Shows: variant content, total score ring, dimension breakdown, readiness, risk, actions.
//
// Responsive:
//   Mobile:  stacked — score header → content → collapsible dimensions → actions
//   Desktop: used inside side-by-side or full-width depending on parent layout

import { useState, useCallback } from "react";
import Link from "next/link";
import type {
  CreativeDraftScorecard,
  CreativeScoreDimension,
}                   from "../../../types/creativeScoring";
import {
  READINESS_LABEL,
  READINESS_COLOR,
  READINESS_BG,
  RISK_LABEL,
  RISK_COLOR,
  DIMENSION_LABEL,
}                   from "../../../types/creativeScoring";
import type { CreativeDraftVariant } from "../../../types/creativeBrief";
import { Badge }    from "../../../components/ui";

// ---------------------------------------------------------------------------
// Score bar — horizontal progress indicator for a dimension
// ---------------------------------------------------------------------------

function ScoreBar({ score, pass }: { score: number; pass: boolean }) {
  const pct   = Math.round((score / 10) * 100);
  const color = score >= 8 ? "bg-emerald-500"
    : score >= 6 ? "bg-sky-500"
    : score >= 4 ? "bg-amber-500"
    : "bg-rose-500";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full transition-all ${color} ${!pass ? "opacity-60" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`w-6 shrink-0 text-right text-xs font-medium tabular-nums
        ${score >= 8 ? "text-emerald-400" : score >= 6 ? "text-sky-400" : score >= 4 ? "text-amber-400" : "text-rose-400"}`}
      >
        {score}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Score ring — circular total score display
// ---------------------------------------------------------------------------

function ScoreRing({ score }: { score: number }) {
  const color = score >= 72 ? "text-emerald-400"
    : score >= 55 ? "text-sky-400"
    : score >= 35 ? "text-amber-400"
    : "text-rose-400";

  return (
    <div className="flex flex-col items-center">
      <span className={`text-3xl font-bold tabular-nums ${color}`}>{score}</span>
      <span className="text-xs text-slate-600">/ 100</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variant content preview
// ---------------------------------------------------------------------------

function VariantContentPreview({ variant }: { variant: CreativeDraftVariant }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-xs font-semibold text-slate-300">{variant.title}</span>
        <span className="text-xs text-slate-600">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-slate-800/60 pt-3">
          {variant.variantType === "copy" && (
            <>
              {variant.hook && (
                <div>
                  <p className="text-xs text-slate-600">Hook</p>
                  <p className="mt-0.5 text-xs font-medium leading-snug text-slate-200">
                    &ldquo;{variant.hook}&rdquo;
                  </p>
                </div>
              )}
              {variant.body && (
                <div>
                  <p className="text-xs text-slate-600">Body</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{variant.body}</p>
                </div>
              )}
              {variant.callToAction && (
                <div>
                  <p className="text-xs text-slate-600">CTA</p>
                  <p className="mt-0.5 text-xs font-medium text-indigo-300">{variant.callToAction}</p>
                </div>
              )}
            </>
          )}
          {variant.variantType === "image" && (
            <>
              {variant.conceptSummary && (
                <div>
                  <p className="text-xs text-slate-600">Concept</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{variant.conceptSummary}</p>
                </div>
              )}
              {variant.visualChanges && (
                <div>
                  <p className="text-xs text-slate-600">Visual changes</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{variant.visualChanges}</p>
                </div>
              )}
              {variant.goal && (
                <div>
                  <p className="text-xs text-slate-600">Goal</p>
                  <p className="mt-0.5 text-xs text-slate-500">{variant.goal}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dimension rows
// ---------------------------------------------------------------------------

function DimensionRows({
  scorecard,
  expanded,
}: {
  scorecard: CreativeDraftScorecard;
  expanded:  boolean;
}) {
  const activeDimensions = scorecard.dimensions.filter((d) => d.weight > 0);
  const hiddenDimensions = scorecard.dimensions.filter((d) => d.weight === 0);

  return (
    <div className="space-y-3">
      {activeDimensions.map((dim) => (
        <div key={dim.dimension}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400">{dim.label}</span>
            {!dim.pass && (
              <span className="rounded bg-rose-900/40 px-1.5 py-0.5 text-xs text-rose-400">flag</span>
            )}
          </div>
          <ScoreBar score={dim.score} pass={dim.pass} />
          {expanded && (
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{dim.explanation}</p>
          )}
        </div>
      ))}

      {expanded && hiddenDimensions.length > 0 && (
        <div className="pt-1">
          <p className="text-xs text-slate-700">
            {DIMENSION_LABEL[hiddenDimensions[0].dimension as CreativeScoreDimension]}: not scored for this variant type.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type ReviewAction =
  | "approve_for_publish_prep"
  | "needs_revision"
  | "reject"
  | "regenerate_same_brief"
  | "regenerate_new_angle";

type Props = {
  rank:      number;
  scorecard: CreativeDraftScorecard;
  variant:   CreativeDraftVariant;
  briefId:   string;
  onAction:  (variantId: string, action: ReviewAction) => void;
  isTop?:    boolean;
};

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export function DraftScorecardPanel({
  rank,
  scorecard,
  variant,
  briefId,
  onAction,
  isTop = false,
}: Props) {
  const [dimensionsExpanded, setDimensionsExpanded] = useState(false);
  const [prepPending, setPrepPending]   = useState(false);
  const [prepItemId,  setPrepItemId]    = useState<string | null>(null);
  const [prepError,   setPrepError]     = useState<string | null>(null);

  // Create a publish prep item from this approved variant
  const handleCreatePrepItem = useCallback(async () => {
    if (prepPending) return;
    setPrepPending(true);
    setPrepError(null);
    try {
      const res  = await fetch("/api/creative-lab/publish-prep", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ briefId, variantId: scorecard.variantId }),
      });
      const data = await res.json();
      if (data.ok) {
        setPrepItemId(data.id);
        // Also call the parent approve action to update variant review state
        onAction(scorecard.variantId, "approve_for_publish_prep");
      } else {
        setPrepError(data.error ?? "Failed to create prep item.");
      }
    } catch {
      setPrepError("Network error — try again.");
    } finally {
      setPrepPending(false);
    }
  }, [prepPending, briefId, scorecard.variantId, onAction]);

  const readinessClass = READINESS_COLOR[scorecard.approvalReadiness];
  const readinessBg    = READINESS_BG[scorecard.approvalReadiness];
  const riskClass      = RISK_COLOR[scorecard.riskLevel];

  return (
    <div className={`rounded-xl border bg-slate-900/60 ${
      isTop ? "border-indigo-700/50 ring-1 ring-indigo-700/30" : "border-slate-800"
    }`}>

      {/* ── Header: rank + title + badges ── */}
      <div className="flex items-start gap-4 border-b border-slate-800/60 px-4 py-4">
        {/* Rank + score */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <span className={`text-xs font-bold ${isTop ? "text-indigo-400" : "text-slate-600"}`}>
            #{rank}
          </span>
          <ScoreRing score={scorecard.totalScore} />
        </div>

        {/* Meta */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-snug text-slate-100 truncate">
            {scorecard.variantTitle}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${readinessBg} ${readinessClass}`}>
              {READINESS_LABEL[scorecard.approvalReadiness]}
            </span>
            <span className={`text-xs font-medium ${riskClass}`}>
              {RISK_LABEL[scorecard.riskLevel]}
            </span>
            <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-500">
              {scorecard.variantType}
            </span>
          </div>
        </div>
      </div>

      <div className="divide-y divide-slate-800/40">

        {/* ── Variant content preview ── */}
        <div className="px-4 py-3">
          <VariantContentPreview variant={variant} />
        </div>

        {/* ── Dimension scores ── */}
        <div className="px-4 py-4">
          <button
            onClick={() => setDimensionsExpanded((e) => !e)}
            className="flex w-full items-center justify-between mb-3 text-left"
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Score Breakdown
            </span>
            <span className="text-xs text-slate-600">
              {dimensionsExpanded ? "▲ collapse" : "▼ expand"}
            </span>
          </button>
          <DimensionRows scorecard={scorecard} expanded={dimensionsExpanded} />
        </div>

        {/* ── Strengths + risks ── */}
        {(scorecard.explanation.strengths.length > 0 || scorecard.explanation.risks.length > 0) && (
          <div className="px-4 py-4 space-y-3">
            {scorecard.explanation.strengths.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-emerald-600">
                  Strengths
                </p>
                <ul className="space-y-1">
                  {scorecard.explanation.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-slate-400">
                      <span className="shrink-0 text-emerald-500 mt-0.5">✓</span>{s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {scorecard.explanation.risks.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-amber-600">
                  Risks
                </p>
                <ul className="space-y-1">
                  {scorecard.explanation.risks.map((r, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-slate-400">
                      <span className="shrink-0 text-amber-500 mt-0.5">◐</span>{r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {scorecard.explanation.notes.map((note, i) => (
              <p key={i} className="text-xs italic text-slate-600">{note}</p>
            ))}
          </div>
        )}

        {/* ── Review actions ── */}
        <div className="px-4 py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-600">
            Review Actions
          </p>
          <div className="space-y-2">
            {/* Prep creation feedback */}
            {prepItemId && (
              <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/20 px-3 py-2.5 flex items-center justify-between gap-2">
                <p className="text-xs text-emerald-300">Prep item created</p>
                <Link
                  href={`/creative-lab/publish-prep`}
                  className="text-xs text-sky-400 hover:text-sky-300 transition-colors"
                >
                  Open Publish Prep →
                </Link>
              </div>
            )}
            {prepError && (
              <p className="text-xs text-rose-400">{prepError}</p>
            )}

            {/* Primary: approve or needs revision — full width on mobile */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={prepItemId ? undefined : handleCreatePrepItem}
                disabled={prepPending || !!prepItemId}
                className="rounded-xl border border-emerald-700/50 bg-emerald-950/30 px-3 py-3
                  text-xs font-medium text-emerald-300 hover:bg-emerald-950/50
                  active:scale-95 transition-all disabled:cursor-not-allowed disabled:opacity-60"
              >
                {prepPending ? "Creating…" : prepItemId ? "Prep Created ✓" : "Approve for Publish Prep"}
              </button>
              <button
                onClick={() => onAction(scorecard.variantId, "needs_revision")}
                className="rounded-xl border border-amber-700/50 bg-amber-950/20 px-3 py-3
                  text-xs font-medium text-amber-300 hover:bg-amber-950/40
                  active:scale-95 transition-all"
              >
                Needs Revision
              </button>
            </div>

            {/* Secondary row */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => onAction(scorecard.variantId, "reject")}
                className="rounded-xl border border-rose-800/50 bg-rose-950/20 px-3 py-2.5
                  text-xs font-medium text-rose-400 hover:bg-rose-950/40
                  active:scale-95 transition-all"
              >
                Reject
              </button>
              <button
                onClick={() => onAction(scorecard.variantId, "regenerate_same_brief")}
                className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5
                  text-xs font-medium text-slate-300 hover:bg-slate-700
                  active:scale-95 transition-all"
              >
                Regenerate
              </button>
              <button
                onClick={() => onAction(scorecard.variantId, "regenerate_new_angle")}
                className="rounded-xl border border-indigo-800/50 bg-indigo-950/20 px-3 py-2.5
                  text-xs font-medium text-indigo-300 hover:bg-indigo-950/40
                  active:scale-95 transition-all"
              >
                New Angle
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
