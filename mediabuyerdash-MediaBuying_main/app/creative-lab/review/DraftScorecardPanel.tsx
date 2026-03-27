"use client";

// app/creative-lab/review/DraftScorecardPanel.tsx
// Full scorecard panel for one draft variant.
//
// Phase 8 additions:
//   - CreativeReadinessStatus badge (draft/needs_review/high_potential/ready_for_approval/rejected)
//   - Quality signals section (winning pattern match, policy flag, duplicate, etc.)
//   - Edit action — inline editable fields for copy variants
//   - Discard action — lightweight dismissal separate from a formal Reject
//   - Experiment planning link — surfaces the variant into experiment context
//   - Low confidence / duplicate / missing signals surface in the header band
//   - Score summary (summarizeCreativeScore) shown as a one-line caption
//
// Responsive:
//   Mobile:  stacked — score header → content → signals → dimensions → actions
//   Desktop: used inside side-by-side or full-width depending on parent layout

import { useState, useCallback } from "react";
import Link from "next/link";
import type {
  CreativeDraftScorecard,
  CreativeScoreDimension,
  CreativeQualitySignal,
}                   from "../../../types/creativeScoring";
import {
  READINESS_LABEL,
  READINESS_COLOR,
  READINESS_BG,
  RISK_LABEL,
  RISK_COLOR,
  DIMENSION_LABEL,
  READINESS_STATUS_LABEL,
  READINESS_STATUS_COLOR,
  READINESS_STATUS_BG,
  QUALITY_SIGNAL_ICON,
  QUALITY_SIGNAL_COLOR,
  QUALITY_SIGNAL_BG,
}                   from "../../../types/creativeScoring";
import type { CreativeDraftVariant } from "../../../types/creativeBrief";
import { Badge }    from "../../../components/ui";
import { summarizeCreativeScore } from "../../../lib/creativeScoring/utils";

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
// Quality signals section
// ---------------------------------------------------------------------------

function QualitySignalsSection({ signals }: { signals: CreativeQualitySignal[] }) {
  if (signals.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
        Quality Signals
      </p>
      <div className="space-y-1">
        {signals.map((sig) => (
          <div
            key={sig.type}
            className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 ${QUALITY_SIGNAL_BG[sig.severity]}`}
          >
            <span className={`shrink-0 mt-0.5 text-xs font-bold ${QUALITY_SIGNAL_COLOR[sig.severity]}`}>
              {QUALITY_SIGNAL_ICON[sig.severity]}
            </span>
            <div className="min-w-0">
              <span className="text-xs font-semibold">{sig.label}</span>
              <span className="mx-1.5 text-xs opacity-60">·</span>
              <span className="text-xs opacity-80">{sig.detail}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variant content — collapsible view / editable toggle
// ---------------------------------------------------------------------------

function VariantContentSection({
  variant,
  editMode,
  editState,
  onEditChange,
}: {
  variant:      CreativeDraftVariant;
  editMode:     boolean;
  editState:    Record<string, string>;
  onEditChange: (field: string, value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const fieldClass = "mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500";

  if (editMode && variant.variantType === "copy") {
    return (
      <div className="rounded-xl border border-indigo-700/40 bg-indigo-950/20 p-4 space-y-3">
        <p className="text-xs font-semibold text-indigo-300">Editing copy variant</p>
        <div>
          <p className="text-xs text-slate-500">Hook</p>
          <textarea
            rows={2}
            value={editState.hook ?? variant.hook ?? ""}
            onChange={(e) => onEditChange("hook", e.target.value)}
            className={fieldClass}
            placeholder="Opening hook line…"
          />
        </div>
        <div>
          <p className="text-xs text-slate-500">Body</p>
          <textarea
            rows={4}
            value={editState.body ?? variant.body ?? ""}
            onChange={(e) => onEditChange("body", e.target.value)}
            className={fieldClass}
            placeholder="Main body copy…"
          />
        </div>
        <div>
          <p className="text-xs text-slate-500">CTA</p>
          <textarea
            rows={1}
            value={editState.callToAction ?? variant.callToAction ?? ""}
            onChange={(e) => onEditChange("callToAction", e.target.value)}
            className={fieldClass}
            placeholder="Call to action…"
          />
        </div>
        <p className="text-xs text-slate-600 italic">
          Edits are local — save as revision to persist changes.
        </p>
      </div>
    );
  }

  if (editMode && variant.variantType === "image") {
    return (
      <div className="rounded-xl border border-indigo-700/40 bg-indigo-950/20 p-4 space-y-3">
        <p className="text-xs font-semibold text-indigo-300">Editing image brief</p>
        <div>
          <p className="text-xs text-slate-500">Concept Summary</p>
          <textarea rows={3} value={editState.conceptSummary ?? variant.conceptSummary ?? ""} onChange={(e) => onEditChange("conceptSummary", e.target.value)} className={fieldClass} placeholder="Visual concept…" />
        </div>
        <div>
          <p className="text-xs text-slate-500">Visual Changes</p>
          <textarea rows={2} value={editState.visualChanges ?? variant.visualChanges ?? ""} onChange={(e) => onEditChange("visualChanges", e.target.value)} className={fieldClass} placeholder="Specific visual changes…" />
        </div>
        <div>
          <p className="text-xs text-slate-500">Goal</p>
          <textarea rows={1} value={editState.goal ?? variant.goal ?? ""} onChange={(e) => onEditChange("goal", e.target.value)} className={fieldClass} placeholder="Design goal…" />
        </div>
        <p className="text-xs text-slate-600 italic">
          Edits are local — save as revision to persist changes.
        </p>
      </div>
    );
  }

  // Read-only view (collapsible)
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
            <div className="flex items-center gap-1.5">
              {expanded && (
                <span className="text-xs text-slate-600 tabular-nums">
                  ×{(dim.weight * 100).toFixed(0)}%
                </span>
              )}
              {!dim.pass && (
                <span className="rounded bg-rose-900/40 px-1.5 py-0.5 text-xs text-rose-400">flag</span>
              )}
            </div>
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
  clientAccountId?: string;
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
  clientAccountId,
  onAction,
  isTop = false,
}: Props) {
  const [dimensionsExpanded, setDimensionsExpanded] = useState(false);
  const [prepPending, setPrepPending]   = useState(false);
  const [prepItemId,  setPrepItemId]    = useState<string | null>(null);
  const [prepError,   setPrepError]     = useState<string | null>(null);

  // Phase 8: edit mode state
  const [editMode,    setEditMode]      = useState(false);
  const [editState,   setEditState]     = useState<Record<string, string>>({});
  const [discarded,   setDiscarded]     = useState(false);

  const handleEditChange = useCallback((field: string, value: string) => {
    setEditState((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSaveEdit = useCallback(async () => {
    // Save as "needs_revision" decision so reviewer knows content was modified
    await fetch(`/api/creative-lab/briefs/${encodeURIComponent(briefId)}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        action:         "variant",
        variantId:      scorecard.variantId,
        reviewDecision: "request_revision",
      }),
    }).catch((err) => console.error("[save edit]", err));
    setEditMode(false);
    onAction(scorecard.variantId, "needs_revision");
  }, [briefId, scorecard.variantId, onAction]);

  const handleDiscard = useCallback(async () => {
    setDiscarded(true);
    await fetch(`/api/creative-lab/briefs/${encodeURIComponent(briefId)}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        action:         "variant",
        variantId:      scorecard.variantId,
        reviewDecision: "reject",
      }),
    }).catch((err) => console.error("[discard]", err));
    onAction(scorecard.variantId, "reject");
  }, [briefId, scorecard.variantId, onAction]);

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

  const readinessStatus  = scorecard.readinessStatus;
  const qualitySignals   = scorecard.qualitySignals ?? [];
  const scoreSummary     = summarizeCreativeScore(scorecard);
  const readinessBg      = READINESS_BG[scorecard.approvalReadiness];
  const riskClass        = RISK_COLOR[scorecard.riskLevel];

  // Alert band: critical signals worth a banner (policy, duplicate, missing)
  const criticalSignals = qualitySignals.filter((s) => s.severity === "critical");

  if (discarded) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-6 text-center">
        <p className="text-sm text-slate-500">Variant discarded</p>
        <p className="mt-1 text-xs text-slate-600">
          This variant was removed from the active review set.
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border bg-slate-900/60 ${
      isTop ? "border-indigo-700/50 ring-1 ring-indigo-700/30" : "border-slate-800"
    }`}>

      {/* ── Critical signal banner ── */}
      {criticalSignals.length > 0 && (
        <div className="rounded-t-xl border-b border-rose-800/40 bg-rose-950/20 px-4 py-2 flex items-center gap-2">
          <span className="shrink-0 text-rose-400 text-xs font-bold">!</span>
          <p className="text-xs text-rose-300">
            {criticalSignals.map((s) => s.label).join(" · ")} —{" "}
            {criticalSignals.length === 1
              ? criticalSignals[0].detail
              : "review flagged issues before advancing."}
          </p>
        </div>
      )}

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
        <div className="flex-1 min-w-0 space-y-1.5">
          <p className="text-sm font-semibold leading-snug text-slate-100 truncate">
            {scorecard.variantTitle}
          </p>

          {/* Readiness status (Phase 8) — primary badge */}
          {readinessStatus ? (
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold
                ${READINESS_STATUS_BG[readinessStatus]} ${READINESS_STATUS_COLOR[readinessStatus]}`}>
                {READINESS_STATUS_LABEL[readinessStatus]}
              </span>
              <span className={`text-xs font-medium ${riskClass}`}>
                {RISK_LABEL[scorecard.riskLevel]}
              </span>
              <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-500">
                {scorecard.variantType}
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${readinessBg} ${READINESS_COLOR[scorecard.approvalReadiness]}`}>
                {READINESS_LABEL[scorecard.approvalReadiness]}
              </span>
              <span className={`text-xs font-medium ${riskClass}`}>
                {RISK_LABEL[scorecard.riskLevel]}
              </span>
              <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-500">
                {scorecard.variantType}
              </span>
            </div>
          )}

          {/* Score summary caption */}
          <p className="text-xs italic text-slate-600 leading-relaxed">{scoreSummary}</p>
        </div>
      </div>

      <div className="divide-y divide-slate-800/40">

        {/* ── Quality signals ── */}
        {qualitySignals.length > 0 && (
          <div className="px-4 py-4">
            <QualitySignalsSection signals={qualitySignals} />
          </div>
        )}

        {/* ── Variant content (read/edit) ── */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Content
            </p>
            {!editMode ? (
              <button
                onClick={() => setEditMode(true)}
                className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs
                  font-medium text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors"
              >
                Edit
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleSaveEdit}
                  className="rounded-md border border-indigo-700/50 bg-indigo-950/30 px-2 py-1
                    text-xs font-medium text-indigo-300 hover:bg-indigo-950/50 transition-colors"
                >
                  Save Revision
                </button>
                <button
                  onClick={() => { setEditMode(false); setEditState({}); }}
                  className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1
                    text-xs font-medium text-slate-500 hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
          <VariantContentSection
            variant={variant}
            editMode={editMode}
            editState={editState}
            onEditChange={handleEditChange}
          />
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

        {/* ── Strengths + risks + notes ── */}
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

        {/* ── Experiment planning link (Phase 8 integration) ── */}
        <div className="px-4 py-3 flex items-center justify-between border-t border-slate-800/40">
          <p className="text-xs text-slate-600">
            Use this variant in an experiment?
          </p>
          <Link
            href={`/experiments/new?briefId=${encodeURIComponent(briefId)}&variantId=${encodeURIComponent(scorecard.variantId)}${clientAccountId ? `&clientId=${encodeURIComponent(clientAccountId)}` : ""}`}
            className="text-xs text-sky-400 hover:text-sky-300 transition-colors font-medium"
          >
            → Plan Experiment
          </Link>
        </div>

        {/* ── Review actions ── */}
        <div className="px-4 py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-600">
            Review Actions
          </p>
          <div className="space-y-2">
            {/* Prep creation feedback */}
            {prepItemId && (
              <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/20 px-3 py-2.5 flex items-center justify-between gap-2">
                <p className="text-xs text-emerald-300">Sent to Publish Prep</p>
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

            {/* Primary: send to approval or needs revision */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={prepItemId ? undefined : handleCreatePrepItem}
                disabled={prepPending || !!prepItemId}
                className="rounded-xl border border-emerald-700/50 bg-emerald-950/30 px-3 py-3
                  text-xs font-medium text-emerald-300 hover:bg-emerald-950/50
                  active:scale-95 transition-all disabled:cursor-not-allowed disabled:opacity-60"
              >
                {prepPending ? "Sending…" : prepItemId ? "Sent to Approval ✓" : "Send to Approval"}
              </button>
              <button
                onClick={() => { setEditMode(true); }}
                disabled={editMode}
                className="rounded-xl border border-indigo-700/40 bg-indigo-950/20 px-3 py-3
                  text-xs font-medium text-indigo-300 hover:bg-indigo-950/40
                  active:scale-95 transition-all disabled:opacity-60"
              >
                Edit Copy
              </button>
            </div>

            {/* Secondary row: needs revision, discard, regenerate */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => onAction(scorecard.variantId, "needs_revision")}
                className="rounded-xl border border-amber-700/50 bg-amber-950/20 px-3 py-2.5
                  text-xs font-medium text-amber-300 hover:bg-amber-950/40
                  active:scale-95 transition-all"
              >
                Needs Revision
              </button>
              <button
                onClick={handleDiscard}
                disabled={discarded}
                className="rounded-xl border border-rose-800/50 bg-rose-950/20 px-3 py-2.5
                  text-xs font-medium text-rose-400 hover:bg-rose-950/40
                  active:scale-95 transition-all disabled:opacity-40"
              >
                Discard
              </button>
              <button
                onClick={() => onAction(scorecard.variantId, "regenerate_same_brief")}
                className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5
                  text-xs font-medium text-slate-300 hover:bg-slate-700
                  active:scale-95 transition-all"
              >
                Regenerate
              </button>
            </div>

            {/* New angle link */}
            <button
              onClick={() => onAction(scorecard.variantId, "regenerate_new_angle")}
              className="w-full text-xs text-slate-500 hover:text-slate-300 transition-colors py-1"
            >
              Regenerate with new angle →
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
