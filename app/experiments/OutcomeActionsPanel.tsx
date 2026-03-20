"use client";

// app/experiments/OutcomeActionsPanel.tsx
// Displays outcome action recommendations for a completed experiment.
// Embedded inside ExperimentResultDetail and also used by the /experiments/actions page.
//
// Responsive:
//   Mobile:  stacked priority cards — priority badge + title + readiness + actions
//   Desktop: full-width cards with reason tags, plan detail, approve button

import { useState, useCallback } from "react";
import Link                      from "next/link";
import type {
  OutcomeActionRecommendation,
}                                from "../../types/outcomeActions";
import {
  ACTION_TYPE_LABEL,
  ACTION_PRIORITY_LABEL,
  ACTION_PRIORITY_COLOR,
  ACTION_PRIORITY_BG,
  READINESS_LABEL,
  READINESS_COLOR,
}                                from "../../types/outcomeActions";

// ---------------------------------------------------------------------------
// Individual plan detail — collapsible
// ---------------------------------------------------------------------------

function ScalePlanDetail({ rec }: { rec: OutcomeActionRecommendation }) {
  const [open, setOpen] = useState(false);
  const sp = rec.scalePlan;
  if (!sp) return null;

  return (
    <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/40">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <span className="text-xs font-medium text-slate-400">Scale Plan</span>
        <span className="text-xs text-slate-600">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="border-t border-slate-800 px-3 pb-3 pt-2 space-y-2">
          <p className="text-xs text-slate-400 leading-relaxed">{sp.scaleRationale}</p>
          <p className="text-xs text-slate-500">{sp.suggestedDailyBudgetNote}</p>
          <p className="text-xs text-slate-600">
            Suggested multiplier: <span className="text-slate-300">×{sp.suggestedBudgetMultiplier.toFixed(2)}</span>
          </p>
          <div className="pt-1">
            <p className="mb-1 text-xs font-medium text-slate-600 uppercase tracking-widest">Safety checks</p>
            <ul className="space-y-0.5">
              {sp.safetyChecks.map((c, i) => (
                <li key={i} className="text-xs text-slate-600">• {c}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function LoserPlanDetail({ rec }: { rec: OutcomeActionRecommendation }) {
  const [open, setOpen] = useState(false);
  const lp = rec.loserHandlingPlan;
  if (!lp) return null;

  return (
    <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/40">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <span className="text-xs font-medium text-slate-400">Handling Plan</span>
        <span className="text-xs text-slate-600">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="border-t border-slate-800 px-3 pb-3 pt-2 space-y-2">
          <p className="text-xs text-slate-400 leading-relaxed">{lp.actionRationale}</p>
          <div className="flex gap-3">
            <div>
              <p className="text-xs text-slate-600">Current ROAS</p>
              <p className={`text-xs font-medium ${lp.currentRoas < 1.0 ? "text-rose-400" : "text-slate-300"}`}>
                {lp.currentRoas.toFixed(2)}x
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-600">Spend</p>
              <p className="text-xs font-medium text-slate-300">${lp.currentSpend.toFixed(0)}</p>
            </div>
          </div>
          <div>
            <p className="mb-0.5 text-xs text-slate-600 uppercase tracking-widest">Safeguards</p>
            <ul className="space-y-0.5">
              {lp.safeguards.map((s, i) => <li key={i} className="text-xs text-slate-600">• {s}</li>)}
            </ul>
          </div>
          {lp.briefLabLink && (
            <Link href={lp.briefLabLink} className="block text-xs text-sky-500 hover:text-sky-400 transition-colors">
              ↗ Open Creative Lab
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function FollowUpPlanDetail({ rec }: { rec: OutcomeActionRecommendation }) {
  const [open, setOpen] = useState(false);
  const fp = rec.followUpPlan;
  if (!fp) return null;

  return (
    <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/40">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <span className="text-xs font-medium text-slate-400">Follow-up Plan</span>
        <span className="text-xs text-slate-600">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="border-t border-slate-800 px-3 pb-3 pt-2 space-y-2">
          <p className="text-xs text-slate-400 leading-relaxed">{fp.suggestedDirection}</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-slate-600">Brief intent</p>
              <p className="text-xs font-medium text-slate-300">{fp.suggestedBriefIntent.replace(/_/g, " ")}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600">Draft type</p>
              <p className="text-xs font-medium text-slate-300">{fp.suggestedDraftType.replace(/_/g, " ")}</p>
            </div>
          </div>
          <p className="text-xs text-slate-600">
            Control choice: <span className="text-slate-400">{fp.controlVariantChoice.replace(/_/g, " ")}</span>
          </p>
          <Link href="/creative-lab/briefs" className="block text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
            ↗ Start New Brief
          </Link>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single recommendation card
// ---------------------------------------------------------------------------

type CardProps = {
  rec:         OutcomeActionRecommendation;
  experimentId: string;
  onApprove:   (recId: string) => void;
  approving?:  boolean;
};

function RecommendationCard({ rec, experimentId, onApprove, approving = false }: CardProps) {
  const priorityColor = ACTION_PRIORITY_COLOR[rec.priority];
  const priorityBg    = ACTION_PRIORITY_BG[rec.priority];
  const readinessColor = READINESS_COLOR[rec.readiness];

  const canApprove = rec.readiness === "ready_for_approval" || rec.readiness === "review_required";
  const isInfoOnly = rec.actionType === "monitor_only" || rec.actionType === "keep_winner_running";

  return (
    <div className={`rounded-xl border p-4 ${priorityBg}`}>
      {/* Top row: priority + readiness */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold uppercase tracking-wider ${priorityColor}`}>
            {ACTION_PRIORITY_LABEL[rec.priority]}
          </span>
          <span className="text-slate-700">·</span>
          <span className="text-xs font-medium text-slate-400">
            {ACTION_TYPE_LABEL[rec.actionType]}
          </span>
        </div>
        <span className={`shrink-0 text-xs font-medium ${readinessColor}`}>
          {READINESS_LABEL[rec.readiness]}
        </span>
      </div>

      {/* Title + rationale */}
      <p className="mt-2 text-sm font-semibold text-slate-100">{rec.title}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">{rec.rationale}</p>

      {/* Blockers */}
      {rec.blockers.length > 0 && (
        <div className="mt-3 space-y-1">
          {rec.blockers.map((b, i) => (
            <p key={i} className="flex items-start gap-1.5 text-xs text-rose-400">
              <span className="shrink-0">✕</span>{b}
            </p>
          ))}
        </div>
      )}

      {/* Plan details */}
      <ScalePlanDetail   rec={rec} />
      <LoserPlanDetail   rec={rec} />
      <FollowUpPlanDetail rec={rec} />

      {/* Action buttons */}
      <div className="mt-3 flex flex-wrap gap-2">
        {!isInfoOnly && canApprove && rec.automationActionType && (
          <button
            onClick={() => onApprove(rec.id)}
            disabled={approving || rec.readiness === "approval_blocked"}
            className="rounded-lg border border-emerald-700/50 bg-emerald-950/30 px-3 py-2
              text-xs font-medium text-emerald-300 hover:bg-emerald-950/50
              active:scale-95 transition-all disabled:cursor-not-allowed disabled:opacity-40"
          >
            {approving ? "Submitting…" : "Approve Action"}
          </button>
        )}

        {rec.actionType === "send_loser_to_creative_lab" && (
          <Link
            href="/creative-lab/review"
            className="rounded-lg border border-sky-700/40 bg-sky-950/20 px-3 py-2
              text-xs font-medium text-sky-300 hover:bg-sky-950/40 transition-colors"
          >
            Open Creative Lab
          </Link>
        )}

        {rec.actionType === "launch_follow_up_experiment" && (
          <Link
            href="/creative-lab/briefs"
            className="rounded-lg border border-indigo-700/40 bg-indigo-950/20 px-3 py-2
              text-xs font-medium text-indigo-300 hover:bg-indigo-950/40 transition-colors"
          >
            Start New Brief
          </Link>
        )}

        {rec.relatedEntityType === "publish_prep" && rec.relatedEntityId && (
          <Link
            href="/creative-lab/publish-prep"
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2
              text-xs text-slate-400 hover:bg-slate-700 transition-colors"
          >
            Open Publish Prep
          </Link>
        )}

        {isInfoOnly && (
          <span className="rounded-lg border border-slate-800 px-3 py-2 text-xs text-slate-600">
            No approval needed — informational only
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

type Props = {
  experimentId:    string;
  recommendations: OutcomeActionRecommendation[];
  isLoading?:      boolean;
};

export function OutcomeActionsPanel({ experimentId, recommendations, isLoading = false }: Props) {
  const [approving,   setApproving]   = useState<string | null>(null);
  const [approveErr,  setApproveErr]  = useState<string | null>(null);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());

  const handleApprove = useCallback(async (recId: string) => {
    if (approving) return;
    setApproving(recId);
    setApproveErr(null);

    try {
      const res  = await fetch(`/api/experiments/${experimentId}/actions`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ recommendationId: recId }),
      });
      const json = await res.json();
      if (!json.ok) {
        setApproveErr(json.error ?? "Approval failed — try again.");
      } else {
        setApprovedIds((prev) => new Set([...prev, recId]));
      }
    } catch {
      setApproveErr("Network error — check your connection.");
    } finally {
      setApproving(null);
    }
  }, [approving, experimentId]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-dashed border-slate-800 px-4 py-6 text-center">
        <p className="text-xs text-slate-600">Loading recommendations…</p>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-800 px-4 py-5">
        <p className="text-xs text-slate-600">No recommendations available. Run evaluation first.</p>
      </div>
    );
  }

  const sorted = [...recommendations].sort((a, b) => {
    const p = { urgent: 0, high: 1, medium: 2, low: 3 };
    return p[a.priority] - p[b.priority];
  });

  return (
    <div className="space-y-3">
      {approveErr && (
        <div className="rounded-xl border border-rose-800/40 bg-rose-950/20 px-3 py-2">
          <p className="text-xs text-rose-300">{approveErr}</p>
          <button onClick={() => setApproveErr(null)} className="text-xs text-slate-500 underline">Dismiss</button>
        </div>
      )}

      {sorted.map((rec) => (
        <div key={rec.id} className="relative">
          {approvedIds.has(rec.id) && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-slate-900/80 backdrop-blur-sm">
              <p className="text-xs font-medium text-emerald-300">✓ Submitted for approval</p>
            </div>
          )}
          <RecommendationCard
            rec={rec}
            experimentId={experimentId}
            onApprove={handleApprove}
            approving={approving === rec.id}
          />
        </div>
      ))}

      <p className="px-1 text-xs text-slate-700">
        Approved actions enter the automation approval workflow — no campaign changes execute without a separate approval step.
      </p>
    </div>
  );
}
