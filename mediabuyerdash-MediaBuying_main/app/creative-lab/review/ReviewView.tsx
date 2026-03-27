"use client";

// app/creative-lab/review/ReviewView.tsx
// Main client orchestrator for the creative draft scoring and review page.
//
// Phase 8 additions:
//   - Low-confidence warning banner (when no CRM data + no source copy)
//   - Experiment planning integration link in summary bar
//   - High-potential variant count in stat cards
//   - clientAccountId passed to DraftScorecardPanel for experiment link
//
// Responsive layout:
//   Mobile:  stacked — stat cards → score button → ranking list → selected scorecard below
//   Desktop: left col-4 (brief summary + ranking list) | right col-8 (scorecard + actions)
//
// State flow:
//   1. User arrives with brief loaded (variants from DB)
//   2. "Score Drafts" → POST /api/creative-lab/scoring
//   3. Rankings rendered in left panel
//   4. Clicking a rank opens full scorecard + actions in right panel
//   5. Review action → PATCH /api/creative-lab/briefs/[id] (variant review decision)
//      OR navigate to generation page (regenerate actions)

import { useState, useCallback, useMemo } from "react";
import Link                               from "next/link";
import { useRouter }                      from "next/navigation";
import type { CreativeBrief }             from "../../../types/creativeBrief";
import type {
  CreativeDraftReviewSet,
  CreativeDraftRanking,
}                                         from "../../../types/creativeScoring";
import {
  READINESS_LABEL,
  READINESS_COLOR,
  READINESS_STATUS_LABEL,
  READINESS_STATUS_COLOR,
}                                         from "../../../types/creativeScoring";
import {
  PageHeader,
  SectionCard,
  Badge,
  StatCard,
  EmptyState,
}                                         from "../../../components/ui";
import {
  STATUS_LABEL,
  STATUS_VARIANT,
  INTENT_LABEL,
  DRAFT_TYPE_LABEL,
}                                         from "../briefs/BriefCard";
import { formatCurrency }                 from "../../../lib/metricUtils";
import { DraftRankingList }               from "./DraftRankingList";
import { DraftScorecardPanel }            from "./DraftScorecardPanel";

// ---------------------------------------------------------------------------
// Brief context summary (collapsible)
// ---------------------------------------------------------------------------

function BriefContextSummary({ brief }: { brief: CreativeBrief }) {
  const [open, setOpen] = useState(false);
  const pc = brief.input;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant={STATUS_VARIANT[brief.status]}>{STATUS_LABEL[brief.status]}</Badge>
          <span className="truncate text-xs font-semibold text-slate-300">
            {brief.creativeName ?? brief.campaignName ?? brief.clientName}
          </span>
        </div>
        <span className="shrink-0 text-xs text-slate-600">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="border-t border-slate-800 px-4 pb-4 pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {[
              { label: "Spend",      value: formatCurrency(pc.spend) },
              { label: "CTR",        value: `${pc.avgCtr.toFixed(2)}%` },
              { label: "Frequency",  value: pc.avgFrequency != null ? `${pc.avgFrequency.toFixed(1)}x` : "—" },
              { label: "ROAS (CRM)", value: pc.campaignRoas != null ? `${pc.campaignRoas.toFixed(2)}x` : "—" },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-slate-600">{label}</p>
                <p className="text-sm font-medium text-slate-200">{value}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-400">
              {INTENT_LABEL[brief.intent]}
            </span>
            <span className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-400">
              {DRAFT_TYPE_LABEL[brief.draftType]}
            </span>
          </div>
          <p className="text-xs text-slate-600">
            {brief.input.priorityReason}
          </p>
          <p className="text-xs text-slate-700">ROAS from CRM — not Meta self-reported.</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ReviewAction =
  | "approve_for_publish_prep"
  | "needs_revision"
  | "reject"
  | "regenerate_same_brief"
  | "regenerate_new_angle";

type Props = {
  brief: CreativeBrief;
};

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function ReviewView({ brief }: Props) {
  const router = useRouter();

  const [scoring,    setScoring]    = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [reviewSet,  setReviewSet]  = useState<CreativeDraftReviewSet | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const variantCount  = brief.draftSet.variants.length;
  // Low-confidence: no CRM ROAS/CPA and no source copy — scoring is structural only
  const isLowConfidence = brief.input.campaignRoas === null
    && brief.input.campaignCpa === null
    && !brief.input.adCopy?.trim();

  // ── Score all variants ─────────────────────────────────────────────────────

  const handleScore = useCallback(async () => {
    if (scoring) return;
    setScoring(true);
    setScoreError(null);

    try {
      const res  = await fetch("/api/creative-lab/scoring", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ briefId: brief.id }),
      });
      const data = await res.json();

      if (!data.ok) {
        setScoreError(data.error ?? "Scoring failed — try again.");
        return;
      }

      setReviewSet(data.reviewSet);
      // Auto-select top variant
      if (data.reviewSet.summary.topRankedVariantId) {
        setSelectedId(data.reviewSet.summary.topRankedVariantId);
      }
    } catch {
      setScoreError("Network error — check your connection and try again.");
    } finally {
      setScoring(false);
    }
  }, [scoring, brief.id]);

  // ── Review action handler ──────────────────────────────────────────────────

  const handleAction = useCallback(
    async (variantId: string, action: ReviewAction) => {
      if (action === "approve_for_publish_prep" || action === "needs_revision" || action === "reject") {
        const decision =
          action === "approve_for_publish_prep" ? "approve" :
          action === "needs_revision"            ? "request_revision" : "reject";

        await fetch(`/api/creative-lab/briefs/${encodeURIComponent(brief.id)}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ action: "variant", variantId, reviewDecision: decision }),
        }).catch((err) => console.error("[review action]", err));
        return;
      }

      // Regenerate actions → navigate to generation page
      if (action === "regenerate_same_brief" || action === "regenerate_new_angle") {
        router.push(`/creative-lab/generation?briefId=${encodeURIComponent(brief.id)}`);
      }
    },
    [brief.id, router],
  );

  // ── Selected ranking ───────────────────────────────────────────────────────

  const selectedRanking: CreativeDraftRanking | null = useMemo(() => {
    if (!reviewSet || !selectedId) return null;
    return reviewSet.rankings.find((r) => r.variantId === selectedId) ?? null;
  }, [reviewSet, selectedId]);

  const selectedVariant = useMemo(() => {
    if (!selectedId) return null;
    return brief.draftSet.variants.find((v) => v.id === selectedId) ?? null;
  }, [brief.draftSet.variants, selectedId]);

  // ── Summary stats ──────────────────────────────────────────────────────────

  const summary = reviewSet?.summary;

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <PageHeader
        title="Draft Review"
        description="Score, rank, and evaluate generated creative drafts for approval readiness."
        badge={<Badge variant="info">Scoring</Badge>}
        actions={
          <Link
            href={`/creative-lab/briefs?clientId=${encodeURIComponent(brief.clientAccountId)}`}
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm
              font-medium text-slate-200 transition-colors hover:bg-slate-700"
          >
            ← Creative Brief
          </Link>
        }
      />

      {/* ── Low-confidence warning ── */}
      {isLowConfidence && (
        <div className="rounded-xl border border-amber-700/40 bg-amber-950/20 px-4 py-3 flex items-start gap-2">
          <span className="shrink-0 text-amber-400 text-xs font-bold mt-0.5">◐</span>
          <div>
            <p className="text-xs font-semibold text-amber-300">Low confidence brief</p>
            <p className="text-xs text-amber-400/80 mt-0.5">
              No CRM ROAS/CPA and no source ad copy available. Scoring reflects creative structure
              only — performance alignment cannot be assessed. Add CRM data to improve scoring accuracy.
            </p>
          </div>
        </div>
      )}

      {/* ── Stat cards ── */}
      {summary ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Variants Scored"  value={summary.totalVariants}       sub="all variants" />
          <StatCard label="Ready for Approval" value={summary.readyForPublishPrep} sub="approval threshold met" />
          {/* Phase 8: High Potential replaces Conditionally Ready label */}
          <StatCard label="High Potential"   value={
            reviewSet?.rankings.filter((r) => r.scorecard.readinessStatus === "high_potential").length
            ?? summary.conditionallyReady
          } sub="priority for review" />
          <StatCard label="Average Score"    value={summary.averageScore}        sub="/ 100" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Variants"      value={variantCount} sub="ready to score" />
          <StatCard label="Generated"     value={variantCount} sub="awaiting review" />
          <StatCard label="Approved"      value={brief.draftSet.variants.filter((v) => v.reviewDecision === "approve").length} sub="reviewer approved" />
          <StatCard label="Reviewed"      value={brief.draftSet.variants.filter((v) => v.reviewDecision !== null).length} sub="decisions made" />
        </div>
      )}

      {/* ── Score button (before scoring) ── */}
      {!reviewSet && (
        <SectionCard>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-slate-200">Score All Drafts</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Evaluate {variantCount} variant{variantCount !== 1 ? "s" : ""} across 9 quality dimensions
                — goal alignment, hook strength, offer clarity, angle novelty, policy risk, and more.
              </p>
            </div>

            {scoreError && (
              <div className="rounded-xl border border-rose-800/50 bg-rose-950/20 px-4 py-3">
                <p className="text-xs text-rose-300">{scoreError}</p>
              </div>
            )}

            {variantCount === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 px-4 py-6 text-center">
                <p className="text-sm text-slate-500">No variants yet</p>
                <p className="mt-1 text-xs text-slate-600">
                  Generate drafts first from the{" "}
                  <Link
                    href={`/creative-lab/generation?briefId=${encodeURIComponent(brief.id)}`}
                    className="text-indigo-400 hover:text-indigo-300"
                  >
                    generation page
                  </Link>.
                </p>
              </div>
            ) : (
              <button
                onClick={handleScore}
                disabled={scoring || variantCount === 0}
                className="w-full rounded-xl bg-indigo-600 px-5 py-3 text-sm font-medium
                  text-white transition-colors hover:bg-indigo-500 active:scale-95
                  disabled:cursor-not-allowed disabled:opacity-50"
              >
                {scoring ? "Scoring…" : `Score ${variantCount} Draft${variantCount !== 1 ? "s" : ""}`}
              </button>
            )}
          </div>
        </SectionCard>
      )}

      {/* ── Rescore + experiment bar (after scoring) ── */}
      {reviewSet && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
          <div>
            <p className="text-xs font-semibold text-slate-300">
              Scored {reviewSet.summary.totalVariants} variants — avg {reviewSet.summary.averageScore}/100
            </p>
            <p className="text-xs text-slate-600">
              {reviewSet.summary.readyForPublishPrep} ready for approval ·{" "}
              {reviewSet.rankings.filter((r) => r.scorecard.readinessStatus === "high_potential").length} high potential ·{" "}
              {reviewSet.summary.highRisk} high risk
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/experiments?clientId=${encodeURIComponent(brief.clientAccountId)}`}
              className="rounded-lg border border-sky-800/50 bg-sky-950/20 px-3 py-1.5 text-xs
                font-medium text-sky-400 hover:bg-sky-950/40 transition-colors"
            >
              → Experiment Planning
            </Link>
            <button
              onClick={handleScore}
              disabled={scoring}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs
                font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-40"
            >
              {scoring ? "Rescoring…" : "Rescore"}
            </button>
          </div>
        </div>
      )}

      {/* ── Main layout: ranking list + scorecard ── */}
      {reviewSet && reviewSet.rankings.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-12">

          {/* ── Left: brief context + ranking list ── */}
          <div className="space-y-5 lg:col-span-4">
            <SectionCard title="Source Brief">
              <BriefContextSummary brief={brief} />
              <div className="mt-3 flex flex-wrap gap-2 pt-3 border-t border-slate-800/60">
                <Link
                  href={`/creative-lab/generation?briefId=${encodeURIComponent(brief.id)}`}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  ↗ Generate more
                </Link>
                <Link
                  href={`/creative-lab/refresh-queue?clientId=${encodeURIComponent(brief.clientAccountId)}`}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  ↗ Refresh queue
                </Link>
              </div>
            </SectionCard>

            <SectionCard
              title="Draft Ranking"
              description={`${reviewSet.rankings.length} variants — click to review`}
            >
              <DraftRankingList
                rankings={reviewSet.rankings}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />

              {/* Phase 8: Readiness status summary (new labels) */}
              <div className="mt-4 space-y-1.5 border-t border-slate-800/60 pt-3">
                {(["ready_for_approval", "high_potential", "needs_review", "draft"] as const)
                  .map((status) => {
                    const count = reviewSet.rankings.filter(
                      (r) => (r.scorecard.readinessStatus ?? "draft") === status
                    ).length;
                    if (count === 0) return null;
                    return (
                      <div key={status} className="flex items-center justify-between">
                        <span className={`text-xs font-medium ${READINESS_STATUS_COLOR[status]}`}>
                          {READINESS_STATUS_LABEL[status]}
                        </span>
                        <span className="text-xs text-slate-600">{count}</span>
                      </div>
                    );
                  })
                }
              </div>
            </SectionCard>
          </div>

          {/* ── Right: scorecard detail ── */}
          <div className="lg:col-span-8">
            {selectedRanking && selectedVariant ? (
              <div className="lg:sticky lg:top-6">
                <DraftScorecardPanel
                  rank={selectedRanking.rank}
                  scorecard={selectedRanking.scorecard}
                  variant={selectedVariant}
                  briefId={brief.id}
                  clientAccountId={brief.clientAccountId}
                  onAction={handleAction}
                  isTop={selectedRanking.rank === 1}
                />
              </div>
            ) : (
              <div className="hidden lg:flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-800">
                <p className="text-sm text-slate-600">Select a variant from the ranking list to review</p>
              </div>
            )}

            {/* Mobile: show all scorecards stacked if no selection */}
            {!selectedRanking && (
              <div className="space-y-4 lg:hidden">
                {reviewSet.rankings.map((r) => {
                  const v = brief.draftSet.variants.find((vv) => vv.id === r.variantId);
                  if (!v) return null;
                  return (
                    <DraftScorecardPanel
                      key={r.variantId}
                      rank={r.rank}
                      scorecard={r.scorecard}
                      variant={v}
                      briefId={brief.id}
                      clientAccountId={brief.clientAccountId}
                      onAction={handleAction}
                      isTop={r.rank === 1}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom nav */}
      <div className="flex flex-wrap gap-4 border-t border-slate-800/60 pt-4">
        <Link href="/creative-lab"               className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← Creative Lab</Link>
        <Link href="/creative-lab/briefs"        className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Creative Briefs</Link>
        <Link href={`/creative-lab/generation?briefId=${encodeURIComponent(brief.id)}`}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
          Generate Drafts →
        </Link>
        <Link href="/creative-lab/publish-prep"  className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
          Publish Prep →
        </Link>
        <Link href={`/experiments?clientId=${encodeURIComponent(brief.clientAccountId)}`}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
          Experiments →
        </Link>
      </div>
    </div>
  );
}
