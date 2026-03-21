"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { PageHeader }   from "../../../../components/ui/PageHeader";
import { SectionCard }  from "../../../../components/ui/SectionCard";
import { Badge }        from "../../../../components/ui/Badge";
import { ActionButton } from "../../../../components/ui/ActionButton";
import { StatCard }     from "../../../../components/ui/StatCard";
import {
  scoreAndRankCandidatesAction,
  selectForPublishPrepAction,
} from "../actions";
import type { ScoredSelectionResult } from "../actions";
import { IMAGE_VARIATION_INTENTS } from "../../../../lib/imageVariation/types";
import type { ImageVariationIntent } from "../../../../lib/imageVariation/types";
import {
  IMAGE_VARIATION_READINESS_LABEL,
  IMAGE_VARIATION_READINESS_BG,
  IMAGE_VARIATION_SCORE_DIMENSIONS,
} from "../../../../lib/imageVariation/scoringTypes";
import type {
  ImageVariationReadiness,
  ImageVariationRisk,
  ImageVariationRanking,
  ImageVariationScorecard,
  ImageVariationScoreDimension,
} from "../../../../lib/imageVariation/scoringTypes";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ApprovedRequest {
  id:              string;
  variationIntent: string;
  triggerType:     string;
  status:          string;
  approvedCount:   number;
  totalCount:      number;
  createdAt:       string;
  clientName:      string | null;
}

interface Props {
  initialRequests: ApprovedRequest[];
}

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

function readinessBadge(readiness: ImageVariationReadiness) {
  const label = IMAGE_VARIATION_READINESS_LABEL[readiness] ?? readiness;
  const variant: Record<string, "success" | "warning" | "danger" | "neutral"> = {
    ready_for_publish_prep: "success",
    conditionally_ready:    "warning",
    review_required:        "warning",
    not_ready:              "danger",
    blocked:                "neutral",
  };
  return <Badge variant={variant[readiness] ?? "neutral"}>{label}</Badge>;
}

function riskBadge(risk: ImageVariationRisk) {
  const v: Record<string, "success" | "warning" | "danger"> = {
    low: "success", medium: "warning", high: "danger",
  };
  return <Badge variant={v[risk] ?? "warning"}>{risk} risk</Badge>;
}

function scoreRing(score: number) {
  const color = score >= 72 ? "text-emerald-400" : score >= 55 ? "text-sky-400" : score >= 35 ? "text-amber-400" : "text-rose-400";
  return (
    <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full border-2 ${
      score >= 72 ? "border-emerald-600" : score >= 55 ? "border-sky-600" : score >= 35 ? "border-amber-600" : "border-rose-700"
    } text-sm font-bold ${color}`}>
      {score}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ImageVariationSelectionView({ initialRequests }: Props) {
  const [requests] = useState(initialRequests);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [scoredResult, setScoredResult] = useState<ScoredSelectionResult | null>(null);
  const [scorePending, startScore] = useTransition();
  const [actionPending, startAction] = useTransition();
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  function handleScore(requestId: string) {
    setSelectedRequestId(requestId);
    setScoredResult(null);
    setActionMsg(null);
    startScore(async () => {
      const r = await scoreAndRankCandidatesAction(requestId);
      if (r.ok) {
        setScoredResult(r.data);
      } else {
        setActionMsg(`Error: ${r.error}`);
      }
    });
  }

  function handleSelectForPublishPrep(requestId: string, candidateId: string) {
    setActionMsg(null);
    startAction(async () => {
      const r = await selectForPublishPrepAction(requestId, candidateId);
      if (r.ok) {
        setActionMsg("Candidate selected for publish prep.");
      } else {
        setActionMsg(`Error: ${r.error}`);
      }
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6 sm:px-6 sm:py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/creative-lab" className="hover:text-slate-300">Creative Lab</Link>
        <span>/</span>
        <Link href="/creative-lab/image-variations" className="hover:text-slate-300">Image Variations</Link>
        <span>/</span>
        <span className="text-slate-400">Selection</span>
      </nav>

      <PageHeader
        title="Image Variation Selection"
        description="Score, rank, and select approved image variation candidates for publish preparation."
      />

      {/* Action message */}
      {actionMsg && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${
          actionMsg.startsWith("Error")
            ? "border-red-800 bg-red-950/40 text-red-400"
            : "border-emerald-700 bg-emerald-950/40 text-emerald-300"
        }`}>
          {actionMsg}
        </div>
      )}

      {/* Empty state */}
      {requests.length === 0 && (
        <SectionCard>
          <div className="py-10 text-center">
            <p className="text-sm text-slate-500">No approved image variation candidates available.</p>
            <p className="mt-2 text-xs text-slate-600">
              Approve candidates in the review queue first.
            </p>
            <Link
              href="/creative-lab/image-variations/review"
              className="mt-4 inline-block text-xs text-emerald-500 hover:text-emerald-400"
            >
              Go to Review Queue →
            </Link>
          </div>
        </SectionCard>
      )}

      {/* Request list + scoring view */}
      {requests.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">

          {/* Request sidebar */}
          <div className="space-y-2">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Requests with Approved Candidates
            </p>
            <div className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-x-visible lg:pb-0">
              {requests.map((req) => {
                const isActive = req.id === selectedRequestId;
                const intentLabel = IMAGE_VARIATION_INTENTS[req.variationIntent as ImageVariationIntent]?.label ?? req.variationIntent;
                return (
                  <button
                    key={req.id}
                    type="button"
                    onClick={() => handleScore(req.id)}
                    disabled={scorePending}
                    className={`shrink-0 rounded-lg border px-3 py-2.5 text-left transition-colors lg:w-full ${
                      isActive
                        ? "border-emerald-700 bg-emerald-950/30 text-white"
                        : "border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <p className="text-xs font-medium truncate">{intentLabel}</p>
                    <p className="mt-0.5 text-xs text-slate-500 truncate">
                      {req.clientName ?? "—"} · {req.approvedCount} approved / {req.totalCount} total
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600">
                      {new Date(req.createdAt).toLocaleDateString()}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scoring results */}
          <div className="space-y-5">

            {/* Loading state */}
            {scorePending && (
              <div className="flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900/40 py-20">
                <p className="text-sm text-slate-400">Scoring candidates...</p>
              </div>
            )}

            {/* No selection */}
            {!scorePending && !scoredResult && (
              <div className="flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900/40 py-20">
                <p className="text-sm text-slate-500">Select a request to score approved candidates.</p>
              </div>
            )}

            {/* Scored results */}
            {scoredResult && !scorePending && (
              <>
                {/* Summary stats */}
                <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <StatCard label="Candidates"     value={String(scoredResult.summary.totalCandidates)} />
                  <StatCard label="Ready"           value={String(scoredResult.summary.readyForPublishPrep)} />
                  <StatCard label="Conditional"     value={String(scoredResult.summary.conditionallyReady)} />
                  <StatCard label="Avg Score"       value={String(scoredResult.summary.averageScore)} />
                  <StatCard label="High Risk"       value={String(scoredResult.summary.highRisk)} />
                </section>

                {/* Launch readiness */}
                <SectionCard title="Launch Readiness">
                  <div className="flex flex-wrap items-center gap-3">
                    {scoredResult.launchReadiness.hasReadyCandidates ? (
                      <Badge variant="success">{scoredResult.launchReadiness.readyCount} ready</Badge>
                    ) : (
                      <Badge variant="warning">No candidates ready</Badge>
                    )}
                    <p className="text-xs text-slate-400">{scoredResult.launchReadiness.nextStep}</p>
                  </div>
                  {scoredResult.launchReadiness.blockers.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {scoredResult.launchReadiness.blockers.map((b, i) => (
                        <li key={i} className="text-xs text-amber-400">• {b}</li>
                      ))}
                    </ul>
                  )}
                </SectionCard>

                {/* Ranked candidates */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {scoredResult.rankings.map((ranking) => (
                    <RankedCandidateCard
                      key={ranking.candidateId}
                      ranking={ranking}
                      expanded={expandedCard === ranking.candidateId}
                      onToggleExpand={() => setExpandedCard(
                        expandedCard === ranking.candidateId ? null : ranking.candidateId,
                      )}
                      actionPending={actionPending}
                      onSelectForPublishPrep={() =>
                        handleSelectForPublishPrep(scoredResult.requestId, ranking.candidateId)
                      }
                    />
                  ))}
                </div>
              </>
            )}

            {/* Navigation */}
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/creative-lab/image-variations/launch"
                className="text-xs text-emerald-500 hover:text-emerald-400"
              >
                Experiment Launch →
              </Link>
              <Link
                href="/creative-lab/image-variations/review"
                className="text-xs text-slate-500 hover:text-slate-300"
              >
                ← Back to Review
              </Link>
              <Link
                href="/creative-lab/image-variations"
                className="text-xs text-slate-500 hover:text-slate-300"
              >
                ← Back to Generation
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-end">
        <Link href="/creative-lab" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
          ← Back to Creative Lab
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ranked candidate card
// ---------------------------------------------------------------------------

function RankedCandidateCard({
  ranking,
  expanded,
  onToggleExpand,
  actionPending,
  onSelectForPublishPrep,
}: {
  ranking:                 ImageVariationRanking;
  expanded:                boolean;
  onToggleExpand:          () => void;
  actionPending:           boolean;
  onSelectForPublishPrep:  () => void;
}) {
  const sc = ranking.scorecard;
  const bgClass = IMAGE_VARIATION_READINESS_BG[sc.readiness] ?? "border-slate-800 bg-slate-900/40";

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${bgClass}`}>
      {/* Header: rank + title + score ring */}
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-xs font-bold text-slate-500">#{ranking.rank}</span>
          {scoreRing(sc.totalScore)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white leading-tight truncate">{sc.candidateTitle}</h3>
          <p className="mt-1 text-xs text-slate-500">{ranking.rankReason}</p>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        {readinessBadge(sc.readiness)}
        {riskBadge(sc.riskLevel)}
      </div>

      {/* Strengths / risks (always visible) */}
      {sc.explanation.strengths.length > 0 && (
        <div>
          <p className="text-xs font-medium text-emerald-500 mb-1">Strengths</p>
          <ul className="space-y-0.5">
            {sc.explanation.strengths.slice(0, expanded ? undefined : 2).map((s, i) => (
              <li key={i} className="text-xs text-slate-400">{s}</li>
            ))}
          </ul>
        </div>
      )}
      {sc.explanation.risks.length > 0 && (
        <div>
          <p className="text-xs font-medium text-amber-400 mb-1">Risks</p>
          <ul className="space-y-0.5">
            {sc.explanation.risks.slice(0, expanded ? undefined : 2).map((r, i) => (
              <li key={i} className="text-xs text-slate-400">{r}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Notes */}
      {sc.explanation.notes.length > 0 && expanded && (
        <div className="rounded-lg bg-slate-800/40 px-3 py-2">
          {sc.explanation.notes.map((n, i) => (
            <p key={i} className="text-xs text-slate-500">{n}</p>
          ))}
        </div>
      )}

      {/* Dimension breakdown (expanded) */}
      {expanded && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Score Breakdown</p>
          {sc.dimensions.filter((d) => d.weight > 0).map((d) => (
            <div key={d.dimension} className="flex items-center gap-2">
              <span className="w-32 text-xs text-slate-500 truncate">{d.label}</span>
              <div className="flex-1 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    d.score >= 7 ? "bg-emerald-500" : d.score >= 4 ? "bg-sky-500" : "bg-rose-500"
                  }`}
                  style={{ width: `${d.score * 10}%` }}
                />
              </div>
              <span className={`w-8 text-right text-xs font-medium ${
                d.pass ? "text-slate-300" : "text-rose-400"
              }`}>
                {d.score}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Toggle details */}
      <button
        type="button"
        onClick={onToggleExpand}
        className="text-xs text-emerald-500 hover:text-emerald-400"
      >
        {expanded ? "Hide details" : "Show score details"}
      </button>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 pt-1">
        {sc.readiness === "ready_for_publish_prep" && (
          <ActionButton
            variant="primary"
            size="sm"
            disabled={actionPending}
            onClick={onSelectForPublishPrep}
          >
            Select for Publish Prep
          </ActionButton>
        )}
        {sc.readiness === "conditionally_ready" && (
          <ActionButton
            variant="secondary"
            size="sm"
            disabled={actionPending}
            onClick={onSelectForPublishPrep}
          >
            Select (Conditional)
          </ActionButton>
        )}
        <Link
          href="/creative-lab/image-variations/review"
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs
            text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-200"
        >
          Return to Review
        </Link>
      </div>
    </div>
  );
}
