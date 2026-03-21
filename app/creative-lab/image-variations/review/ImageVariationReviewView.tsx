"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { PageHeader }   from "../../../../components/ui/PageHeader";
import { SectionCard }  from "../../../../components/ui/SectionCard";
import { Badge }        from "../../../../components/ui/Badge";
import { ActionButton } from "../../../../components/ui/ActionButton";
import { StatCard }     from "../../../../components/ui/StatCard";
import {
  approveCandidateAction,
  rejectCandidateAction,
  requestRevisionAction,
  archiveCandidateAction,
  loadComparisonSetAction,
} from "../actions";
import { IMAGE_VARIATION_INTENTS } from "../../../../lib/imageVariation/types";
import {
  IMAGE_VARIATION_REVISION_INTENTS,
} from "../../../../lib/imageVariation/reviewTypes";
import type {
  ImageVariationReviewQueue,
  ImageVariationComparisonSet,
  ImageVariationReviewItem,
  ImageVariationReviewState,
  ImageVariationRevisionIntent,
} from "../../../../lib/imageVariation/reviewTypes";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  initialQueue: ImageVariationReviewQueue;
}

// ---------------------------------------------------------------------------
// State badge helpers
// ---------------------------------------------------------------------------

function reviewStateBadge(state: ImageVariationReviewState) {
  const map: Record<ImageVariationReviewState, { variant: "success" | "warning" | "danger" | "neutral"; label: string }> = {
    draft:              { variant: "neutral",  label: "Draft" },
    needs_review:       { variant: "warning",  label: "Needs Review" },
    revision_requested: { variant: "warning",  label: "Revision Requested" },
    approved:           { variant: "success",  label: "Approved" },
    rejected:           { variant: "danger",   label: "Rejected" },
    archived:           { variant: "neutral",  label: "Archived" },
  };
  const info = map[state] ?? { variant: "neutral" as const, label: state };
  return <Badge variant={info.variant}>{info.label}</Badge>;
}

// ---------------------------------------------------------------------------
// Revision intent options
// ---------------------------------------------------------------------------

const REVISION_OPTIONS = Object.entries(IMAGE_VARIATION_REVISION_INTENTS) as Array<
  [ImageVariationRevisionIntent, { label: string; description: string }]
>;

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ImageVariationReviewView({ initialQueue }: Props) {
  const [queue, setQueue] = useState(initialQueue);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(
    queue.comparisonSets[0]?.requestId ?? null,
  );
  const [actionPending, startAction] = useTransition();
  const [actionMsg, setActionMsg]    = useState<string | null>(null);
  const [refreshing, startRefresh]   = useTransition();

  // Active comparison set
  const activeSet = queue.comparisonSets.find((s) => s.requestId === selectedSetId) ?? null;

  // Refresh a single set from DB
  function refreshSet(requestId: string) {
    startRefresh(async () => {
      const updated = await loadComparisonSetAction(requestId);
      if (!updated) return;
      setQueue((prev) => {
        const sets = prev.comparisonSets.map((s) =>
          s.requestId === requestId ? updated : s,
        );
        // Recount
        let total = 0, pending = 0, app = 0, rej = 0, rev = 0;
        for (const s of sets) {
          for (const item of s.items) {
            total++;
            const st = item.reviewState;
            if (st === "needs_review") pending++;
            if (st === "approved") app++;
            if (st === "rejected") rej++;
            if (st === "revision_requested") rev++;
          }
        }
        return { ...prev, comparisonSets: sets, totalCandidates: total, pendingReview: pending, approved: app, rejected: rej, revisionRequested: rev };
      });
    });
  }

  // Action handlers
  function handleApprove(requestId: string, candidateId: string, note?: string) {
    setActionMsg(null);
    startAction(async () => {
      const r = await approveCandidateAction(requestId, candidateId, note);
      setActionMsg(r.ok ? "Candidate approved." : `Error: ${r.error}`);
      refreshSet(requestId);
    });
  }

  function handleReject(requestId: string, candidateId: string, note?: string) {
    setActionMsg(null);
    startAction(async () => {
      const r = await rejectCandidateAction(requestId, candidateId, note);
      setActionMsg(r.ok ? "Candidate rejected." : `Error: ${r.error}`);
      refreshSet(requestId);
    });
  }

  function handleRevision(requestId: string, candidateId: string, intent: ImageVariationRevisionIntent, note?: string) {
    setActionMsg(null);
    startAction(async () => {
      const r = await requestRevisionAction(requestId, candidateId, intent, note);
      setActionMsg(r.ok ? "Revision requested." : `Error: ${r.error}`);
      refreshSet(requestId);
    });
  }

  function handleArchive(requestId: string, candidateId: string) {
    setActionMsg(null);
    startAction(async () => {
      const r = await archiveCandidateAction(requestId, candidateId);
      setActionMsg(r.ok ? "Candidate archived." : `Error: ${r.error}`);
      refreshSet(requestId);
    });
  }

  // Summary stats
  const stats = queue;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6 sm:px-6 sm:py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/creative-lab" className="hover:text-slate-300">Creative Lab</Link>
        <span>/</span>
        <Link href="/creative-lab/image-variations" className="hover:text-slate-300">Image Variations</Link>
        <span>/</span>
        <span className="text-slate-400">Review</span>
      </nav>

      <PageHeader
        title="Image Variation Review"
        description="Compare, review, and approve generated image variation candidates. Approved candidates advance to the next step."
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

      {/* Summary stats */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Total Candidates"    value={String(stats.totalCandidates)} />
        <StatCard label="Pending Review"      value={String(stats.pendingReview)} />
        <StatCard label="Approved"            value={String(stats.approved)} />
        <StatCard label="Rejected"            value={String(stats.rejected)} />
        <StatCard label="Revision Requested"  value={String(stats.revisionRequested)} />
      </section>

      {/* Empty state */}
      {queue.comparisonSets.length === 0 && (
        <SectionCard>
          <div className="py-10 text-center">
            <p className="text-sm text-slate-500">No image variation candidates in review.</p>
            <p className="mt-2 text-xs text-slate-600">
              Generate image variations and click "Send to Review" to start reviewing.
            </p>
            <Link
              href="/creative-lab/image-variations"
              className="mt-4 inline-block text-xs text-emerald-500 hover:text-emerald-400"
            >
              Go to Image Variations →
            </Link>
          </div>
        </SectionCard>
      )}

      {/* Set selector + comparison view */}
      {queue.comparisonSets.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">

          {/* Set list (sidebar on desktop, horizontal scroll on mobile) */}
          <div className="space-y-2 lg:space-y-1">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Generation Requests
            </p>
            <div className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-x-visible lg:pb-0">
              {queue.comparisonSets.map((set) => {
                const isActive = set.requestId === selectedSetId;
                const pendingCount = set.items.filter((i) => i.reviewState === "needs_review").length;
                return (
                  <button
                    key={set.requestId}
                    type="button"
                    onClick={() => { setSelectedSetId(set.requestId); setActionMsg(null); }}
                    className={`shrink-0 rounded-lg border px-3 py-2.5 text-left transition-colors lg:w-full ${
                      isActive
                        ? "border-emerald-700 bg-emerald-950/30 text-white"
                        : "border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <p className="text-xs font-medium truncate">{set.intentLabel}</p>
                    <p className="mt-0.5 text-xs text-slate-500 truncate">
                      {set.clientName ?? "—"} · {set.items.length} candidates
                    </p>
                    {pendingCount > 0 && (
                      <span className="mt-1 inline-block rounded-full bg-amber-800/60 px-2 py-0.5 text-xs text-amber-300">
                        {pendingCount} pending
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active comparison set */}
          {activeSet ? (
            <div className="space-y-5">

              {/* Source context */}
              <SectionCard
                title="Source Context"
                actions={
                  <Badge variant="neutral">{activeSet.triggerType}</Badge>
                }
              >
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
                  <div>
                    <dt className="text-slate-500">Intent</dt>
                    <dd className="font-medium text-slate-200">{activeSet.intentLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Client</dt>
                    <dd className="text-slate-300">{activeSet.clientName ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Campaign</dt>
                    <dd className="text-slate-300 truncate">{activeSet.campaignName ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Generated</dt>
                    <dd className="text-slate-300">{new Date(activeSet.createdAt).toLocaleDateString()}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-slate-500">{activeSet.triggerRationale}</p>
                {activeSet.sourceAssetUrl && (
                  <div className="mt-3 overflow-hidden rounded-lg border border-slate-700 max-w-xs">
                    <img
                      src={activeSet.sourceAssetUrl}
                      alt="Source creative"
                      className="h-auto w-full max-h-32 object-contain bg-slate-950"
                    />
                    <p className="px-2 py-1 text-xs text-slate-600">Source creative image</p>
                  </div>
                )}
              </SectionCard>

              {/* Candidate cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activeSet.items.map((item) => (
                  <ReviewCandidateCard
                    key={item.candidate.id}
                    item={item}
                    pending={actionPending}
                    onApprove={(note) => handleApprove(item.requestId, item.candidate.id, note)}
                    onReject={(note) => handleReject(item.requestId, item.candidate.id, note)}
                    onRevision={(intent, note) => handleRevision(item.requestId, item.candidate.id, intent, note)}
                    onArchive={() => handleArchive(item.requestId, item.candidate.id)}
                  />
                ))}
              </div>

              {/* Set-level actions */}
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/creative-lab/image-variations"
                  className="text-xs text-slate-500 hover:text-slate-300"
                >
                  ← Return to Generation
                </Link>
                {activeSet.items.some((i) => i.reviewState === "approved") && (
                  <span className="ml-auto rounded-lg border border-emerald-700 bg-emerald-950/30 px-3 py-1.5 text-xs text-emerald-300">
                    Has approved candidates — ready for next step
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900/40 py-20">
              <p className="text-sm text-slate-500">Select a generation request to review.</p>
            </div>
          )}
        </div>
      )}

      {/* Footer link */}
      <div className="flex justify-end">
        <Link
          href="/creative-lab"
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          ← Back to Creative Lab
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review candidate card — individual candidate with review actions
// ---------------------------------------------------------------------------

function ReviewCandidateCard({
  item,
  pending,
  onApprove,
  onReject,
  onRevision,
  onArchive,
}: {
  item:       ImageVariationReviewItem;
  pending:    boolean;
  onApprove:  (note?: string) => void;
  onReject:   (note?: string) => void;
  onRevision: (intent: ImageVariationRevisionIntent, note?: string) => void;
  onArchive:  () => void;
}) {
  const [expanded, setExpanded]         = useState(false);
  const [showRevision, setShowRevision] = useState(false);
  const [noteInput, setNoteInput]       = useState("");
  const [revIntent, setRevIntent]       = useState<ImageVariationRevisionIntent>("make_more_distinct");
  const c = item.candidate;

  const isDecided = item.reviewState === "approved" || item.reviewState === "rejected" || item.reviewState === "archived";

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${
      item.reviewState === "approved"
        ? "border-emerald-800 bg-emerald-950/20"
        : item.reviewState === "rejected"
        ? "border-red-900 bg-red-950/20"
        : item.reviewState === "revision_requested"
        ? "border-amber-800 bg-amber-950/20"
        : "border-slate-800 bg-slate-900/40"
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-white leading-tight">{c.title}</h3>
        {reviewStateBadge(item.reviewState)}
      </div>

      {/* Image placeholder */}
      {c.imageUrl ? (
        <div className="overflow-hidden rounded-lg border border-slate-700">
          <img src={c.imageUrl} alt={c.title} className="h-auto w-full max-h-40 object-contain bg-slate-950" />
        </div>
      ) : (
        <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-950/50">
          <p className="text-xs text-slate-600">Brief only</p>
        </div>
      )}

      {/* Concept summary */}
      <div>
        <p className="text-xs font-medium text-slate-400 mb-1">Concept</p>
        <p className={`text-xs text-slate-300 leading-relaxed ${!expanded && c.conceptSummary.length > 100 ? "line-clamp-2" : ""}`}>
          {c.conceptSummary}
        </p>
        {c.conceptSummary.length > 100 && (
          <button type="button" onClick={() => setExpanded(!expanded)} className="mt-1 text-xs text-emerald-500 hover:text-emerald-400">
            {expanded ? "Less" : "More"}
          </button>
        )}
      </div>

      {/* Visual changes + goal (collapsed on mobile) */}
      {expanded && (
        <>
          <div>
            <p className="text-xs font-medium text-slate-400 mb-1">Visual Changes</p>
            <p className="text-xs text-slate-400">{c.visualChanges}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 mb-1">Goal</p>
            <p className="text-xs text-slate-300">{c.goal}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 mb-1">DR Angle</p>
            <p className="text-xs text-slate-400">{c.directResponseAngle}</p>
          </div>
        </>
      )}

      {/* Performance signal */}
      <div className="rounded-lg bg-slate-800/40 px-3 py-2">
        <p className="text-xs text-slate-500">{c.performanceSignal}</p>
      </div>

      {/* Reviewer note (if exists) */}
      {item.reviewerNote && (
        <div className="rounded-lg border border-slate-700 bg-slate-800/30 px-3 py-2">
          <p className="text-xs text-slate-500 mb-0.5">Reviewer note</p>
          <p className="text-xs text-slate-300">{item.reviewerNote}</p>
        </div>
      )}

      {/* Revision intent (if requested) */}
      {item.revisionIntent && (
        <div className="rounded-lg border border-amber-800/50 bg-amber-950/20 px-3 py-2">
          <p className="text-xs text-amber-400">
            Revision: {IMAGE_VARIATION_REVISION_INTENTS[item.revisionIntent]?.label ?? item.revisionIntent}
          </p>
        </div>
      )}

      {/* Note input for actions */}
      {!isDecided && (
        <div>
          <textarea
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            placeholder="Add a note (optional)..."
            rows={2}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs
              text-slate-200 placeholder-slate-600 focus:border-emerald-600 focus:outline-none resize-none"
          />
        </div>
      )}

      {/* Revision intent selector */}
      {showRevision && !isDecided && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-400">Revision Intent</label>
          <select
            value={revIntent}
            onChange={(e) => setRevIntent(e.target.value as ImageVariationRevisionIntent)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs
              text-slate-200 focus:border-emerald-600 focus:outline-none"
          >
            {REVISION_OPTIONS.map(([key, info]) => (
              <option key={key} value={key}>{info.label}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <ActionButton
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => { onRevision(revIntent, noteInput || undefined); setShowRevision(false); setNoteInput(""); }}
            >
              Submit Revision
            </ActionButton>
            <ActionButton
              variant="ghost"
              size="sm"
              onClick={() => setShowRevision(false)}
            >
              Cancel
            </ActionButton>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!isDecided && !showRevision && (
        <div className="flex flex-wrap gap-2">
          <ActionButton
            variant="primary"
            size="sm"
            disabled={pending}
            onClick={() => { onApprove(noteInput || undefined); setNoteInput(""); }}
          >
            Approve
          </ActionButton>
          <ActionButton
            variant="danger"
            size="sm"
            disabled={pending}
            onClick={() => { onReject(noteInput || undefined); setNoteInput(""); }}
          >
            Reject
          </ActionButton>
          <ActionButton
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => setShowRevision(true)}
          >
            Request Revision
          </ActionButton>
          <ActionButton
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={onArchive}
          >
            Archive
          </ActionButton>
        </div>
      )}

      {/* Post-decision info */}
      {isDecided && item.reviewedAt && (
        <p className="text-xs text-slate-600">
          Reviewed {new Date(item.reviewedAt).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}
