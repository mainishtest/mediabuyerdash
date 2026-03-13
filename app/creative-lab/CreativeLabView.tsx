"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type {
  CreativeLabEntry,
  CopyVariation,
  ImageVariationConcept,
  RecommendationCauseType,
  RecommendationConfidence
} from "../../types/creativeDiagnosis";
import type { JobWithVariations, ApprovalMap, CreativeApprovalStatus } from "../../types/aiProvider";
import {
  generateCopyVariationsAction,
  generateImageVariationsAction,
  setApprovalAction
} from "./actions";
import { formatCurrency, formatRoas } from "../../lib/metricUtils";

// ── Style helpers ─────────────────────────────────────────────────────────────

const CAUSE_STYLES: Record<RecommendationCauseType, string> = {
  copy:    "bg-violet-900/60 text-violet-300",
  image:   "bg-blue-900/60 text-blue-300",
  mixed:   "bg-amber-900/60 text-amber-300",
  unclear: "bg-slate-800 text-slate-400",
  other:   "bg-slate-800 text-slate-400"
};

const CAUSE_LABELS: Record<RecommendationCauseType, string> = {
  copy:    "Copy Issue",
  image:   "Image Issue",
  mixed:   "Mixed",
  unclear: "Unclear",
  other:   "Other"
};

const CONFIDENCE_STYLES: Record<RecommendationConfidence, string> = {
  low:    "text-slate-500",
  medium: "text-amber-400",
  high:   "text-emerald-400"
};

const PERF_STYLES = {
  on_target:  "text-emerald-400",
  watch:      "text-amber-400",
  below_goal: "text-rose-400"
};

const APPROVAL_STYLES: Record<CreativeApprovalStatus, string> = {
  draft:    "bg-slate-700 text-slate-300",
  approved: "bg-emerald-900/60 text-emerald-300",
  rejected: "bg-rose-900/60 text-rose-300"
};

function CauseBadge({ cause }: { cause: RecommendationCauseType }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CAUSE_STYLES[cause]}`}>
      {CAUSE_LABELS[cause]}
    </span>
  );
}

function ApprovalBadge({ status }: { status: CreativeApprovalStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${APPROVAL_STYLES[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ── Copy variation card (with approval) ───────────────────────────────────────

function CopyVariationCard({
  v,
  jobId,
  adId,
  approvalStatus,
  onApprove,
  onReject
}: {
  v: CopyVariation;
  jobId: string;
  adId: string;
  approvalStatus: CreativeApprovalStatus;
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  return (
    <div className="rounded-xl border border-violet-800/40 bg-violet-950/20 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">
          {v.title}
        </p>
        <ApprovalBadge status={approvalStatus} />
      </div>
      <div className="space-y-2 text-sm">
        <div>
          <p className="text-xs text-slate-500">Hook</p>
          <p className="mt-0.5 italic text-slate-200">"{v.hook}"</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Body</p>
          <p className="mt-0.5 text-slate-300">{v.body}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Call to Action</p>
          <p className="mt-0.5 font-medium text-violet-300">{v.callToAction}</p>
        </div>
      </div>
      {approvalStatus === "draft" && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={async () => { setLoading(true); await onApprove(); setLoading(false); }}
            disabled={loading}
            className="rounded-lg bg-emerald-900/50 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-800/50 disabled:opacity-50"
          >
            Approve
          </button>
          <button
            onClick={async () => { setLoading(true); await onReject(); setLoading(false); }}
            disabled={loading}
            className="rounded-lg bg-rose-900/50 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-800/50 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

// ── Image variation card (with approval) ───────────────────────────────────────

function ImageVariationCard({
  v,
  jobId,
  adId,
  approvalStatus,
  onApprove,
  onReject
}: {
  v: ImageVariationConcept;
  jobId: string;
  adId: string;
  approvalStatus: CreativeApprovalStatus;
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  return (
    <div className="rounded-xl border border-blue-800/40 bg-blue-950/20 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
          {v.title}
        </p>
        <ApprovalBadge status={approvalStatus} />
      </div>
      <div className="space-y-2 text-sm">
        <div>
          <p className="text-xs text-slate-500">Concept</p>
          <p className="mt-0.5 text-slate-200">{v.conceptSummary}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Visual Changes</p>
          <p className="mt-0.5 text-slate-300">{v.visualChanges}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Goal</p>
          <p className="mt-0.5 font-medium text-blue-300">{v.goal}</p>
        </div>
      </div>
      {approvalStatus === "draft" && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={async () => { setLoading(true); await onApprove(); setLoading(false); }}
            disabled={loading}
            className="rounded-lg bg-emerald-900/50 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-800/50 disabled:opacity-50"
          >
            Approve
          </button>
          <button
            onClick={async () => { setLoading(true); await onReject(); setLoading(false); }}
            disabled={loading}
            className="rounded-lg bg-rose-900/50 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-800/50 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

// ── Ad entry card ─────────────────────────────────────────────────────────────

function AdEntryCard({
  entry,
  jobsByAd,
  approvalMap,
  onGenerateCopy,
  onGenerateImage,
  onApprovalChange
}: {
  entry: CreativeLabEntry;
  jobsByAd: Record<string, { copyJobs: JobWithVariations[]; imageJobs: JobWithVariations[] }>;
  approvalMap: ApprovalMap;
  onGenerateCopy: (entry: CreativeLabEntry) => Promise<void>;
  onGenerateImage: (entry: CreativeLabEntry) => Promise<void>;
  onApprovalChange: (jobId: string, variationId: string, entityType: "copy" | "image", adId: string, status: CreativeApprovalStatus) => Promise<void>;
}) {
  const { input, diagnosis, copyRecommendation, imageRecommendation } = entry;
  const { copyJobs, imageJobs } = jobsByAd[input.adId] ?? { copyJobs: [], imageJobs: [] };

  const [copyLoading,  setCopyLoading]  = useState(false);
  const [imageLoading, setImageLoading] = useState(false);

  const latestCopyJob  = copyJobs[0];
  const latestImageJob = imageJobs[0];

  const showCopyAction  = (diagnosis.causeType === "copy" || diagnosis.causeType === "mixed") && !latestCopyJob;
  const showImageAction = (diagnosis.causeType === "image" || diagnosis.causeType === "mixed") && !latestImageJob;

  async function handleGenerateCopy() {
    setCopyLoading(true);
    try {
      await onGenerateCopy(entry);
    } finally {
      setCopyLoading(false);
    }
  }

  async function handleGenerateImage() {
    setImageLoading(true);
    try {
      await onGenerateImage(entry);
    } finally {
      setImageLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm shadow-slate-900/40">
      {/* Header */}
      <div className="border-b border-slate-800 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-50">{input.adName}</h3>
            <p className="mt-0.5 text-sm text-slate-400">{input.campaignName}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CauseBadge cause={diagnosis.causeType} />
            <span className={`text-xs font-medium ${CONFIDENCE_STYLES[diagnosis.confidence]}`}>
              {diagnosis.confidence.charAt(0).toUpperCase() + diagnosis.confidence.slice(1)} confidence
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-500">Actual CPA</p>
            <p className={`font-semibold ${PERF_STYLES[diagnosis.performanceStatus]}`}>
              {formatCurrency(input.actualCpa)}
            </p>
            {diagnosis.cpaOverGoalPct > 0 && (
              <p className="text-xs text-rose-400">+{diagnosis.cpaOverGoalPct}% over goal</p>
            )}
          </div>
          <div>
            <p className="text-xs text-slate-500">Goal CPA</p>
            <p className="font-semibold text-slate-300">{formatCurrency(input.cpaGoalValue)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Actual ROAS</p>
            <p className={`font-semibold ${PERF_STYLES[diagnosis.performanceStatus]}`}>
              {formatRoas(input.actualRoas)}
            </p>
            {diagnosis.roasBelowGoalPct > 0 && (
              <p className="text-xs text-rose-400">–{diagnosis.roasBelowGoalPct}% below goal</p>
            )}
          </div>
          <div>
            <p className="text-xs text-slate-500">Goal ROAS</p>
            <p className="font-semibold text-slate-300">{formatRoas(input.roasGoalValue)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Spend</p>
            <p className="font-semibold text-slate-300">{formatCurrency(input.spend)}</p>
          </div>
        </div>
      </div>

      {/* Diagnosis */}
      <div className="border-b border-slate-800 p-5">
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-500">Diagnosis</p>
        <p className="text-sm text-slate-300">{diagnosis.shortReason}</p>
        <p className="mt-2 text-sm text-slate-400">{diagnosis.recommendationSummary}</p>
      </div>

      {/* Recommendations */}
      {(copyRecommendation || imageRecommendation) && (
        <div className="border-b border-slate-800 p-5 space-y-4">
          {copyRecommendation && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-violet-400">Copy Recommendation</p>
              <p className="text-sm text-slate-300">
                <span className="font-medium text-slate-200">What to change: </span>
                {copyRecommendation.whatToChange}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                <span className="font-medium text-slate-300">Suggested focus: </span>
                {copyRecommendation.suggestedFocus}
              </p>
            </div>
          )}
          {imageRecommendation && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-blue-400">Image Recommendation</p>
              <p className="text-sm text-slate-300">
                <span className="font-medium text-slate-200">What to change: </span>
                {imageRecommendation.whatToChange}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                <span className="font-medium text-slate-300">Suggested focus: </span>
                {imageRecommendation.suggestedFocus}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      {(showCopyAction || showImageAction) && (
        <div className="flex flex-wrap gap-3 p-5">
          {showCopyAction && (
            <button
              onClick={handleGenerateCopy}
              disabled={copyLoading}
              className="rounded-lg border border-violet-700/60 bg-violet-900/30 px-4 py-2 text-sm font-medium text-violet-300 transition-colors hover:bg-violet-800/40 hover:text-violet-100 disabled:opacity-50"
            >
              {copyLoading ? "Generating…" : "Generate 3 Copy Variations"}
            </button>
          )}
          {showImageAction && (
            <button
              onClick={handleGenerateImage}
              disabled={imageLoading}
              className="rounded-lg border border-blue-700/60 bg-blue-900/30 px-4 py-2 text-sm font-medium text-blue-300 transition-colors hover:bg-blue-800/40 hover:text-blue-100 disabled:opacity-50"
            >
              {imageLoading ? "Generating…" : "Generate 3 Image Variations"}
            </button>
          )}
        </div>
      )}

      {/* Generated copy variations */}
      {latestCopyJob && (
        <div className="border-t border-slate-800 p-5">
          <div className="mb-3 flex items-center gap-2">
            <p className="text-sm font-semibold text-violet-300">Copy Variations</p>
            <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-400">
              Provider: {latestCopyJob.provider} · Status: {latestCopyJob.status}
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {(latestCopyJob.variations as CopyVariation[]).map((v) => (
              <CopyVariationCard
                key={v.id}
                v={v}
                jobId={latestCopyJob.id}
                adId={input.adId}
                approvalStatus={approvalMap[`${latestCopyJob.id}_${v.id}`] ?? "draft"}
                onApprove={() => onApprovalChange(latestCopyJob.id, v.id, "copy", input.adId, "approved")}
                onReject={() => onApprovalChange(latestCopyJob.id, v.id, "copy", input.adId, "rejected")}
              />
            ))}
          </div>
        </div>
      )}

      {/* Generated image variation concepts */}
      {latestImageJob && (
        <div className="border-t border-slate-800 p-5">
          <div className="mb-3 flex items-center gap-2">
            <p className="text-sm font-semibold text-blue-300">Image Variation Concepts</p>
            <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-400">
              Provider: {latestImageJob.provider} · Status: {latestImageJob.status}
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {(latestImageJob.variations as ImageVariationConcept[]).map((v) => (
              <ImageVariationCard
                key={v.id}
                v={v}
                jobId={latestImageJob.id}
                adId={input.adId}
                approvalStatus={approvalMap[`${latestImageJob.id}_${v.id}`] ?? "draft"}
                onApprove={() => onApprovalChange(latestImageJob.id, v.id, "image", input.adId, "approved")}
                onReject={() => onApprovalChange(latestImageJob.id, v.id, "image", input.adId, "rejected")}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

type Props = {
  entries:     CreativeLabEntry[];
  jobsByAd:    Record<string, { copyJobs: JobWithVariations[]; imageJobs: JobWithVariations[] }>;
  approvalMap: ApprovalMap;
  allJobs:     JobWithVariations[];
};

export function CreativeLabView({ entries, jobsByAd, approvalMap, allJobs }: Props) {
  const router = useRouter();

  async function handleGenerateCopy(entry: CreativeLabEntry) {
    await generateCopyVariationsAction(entry);
    router.refresh();
  }

  async function handleGenerateImage(entry: CreativeLabEntry) {
    await generateImageVariationsAction(entry);
    router.refresh();
  }

  return (
    <>
      <header className="mb-10">
        <Link href="/" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200">
          ← Back to Dashboard
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
          Creative Optimization Lab
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">
          Diagnoses whether poor ad performance is likely caused by copy, image, or other factors —
          and surfaces actionable variation concepts. All variations require human approval before use.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <div className="inline-flex items-center gap-2 rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
            <span aria-hidden>⚠</span>
            <span>Mock provider — not connected to real LLM or image APIs</span>
          </div>
        </div>
      </header>

      {/* Generation Jobs and Approvals */}
      <section className="mb-10">
        <h2 className="mb-4 text-xl font-semibold text-slate-50">
          Generation Jobs and Approvals
        </h2>
        <p className="mb-4 text-sm text-slate-400">
          Request type, provider, status, and created time for each generation job.
        </p>
        {allJobs.length === 0 ? (
          <p className="rounded-xl border border-slate-800 bg-slate-900/60 px-6 py-8 text-sm text-slate-500">
            No generation jobs yet. Generate copy or image variations for an ad below.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400">Request Type</th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400">Provider</th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400">Status</th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400">Created</th>
                </tr>
              </thead>
              <tbody>
                {allJobs.map((job) => (
                  <tr key={job.id} className="border-b border-slate-800 last:border-0">
                    <td className="px-3 py-3 text-slate-300 capitalize">{job.requestType}</td>
                    <td className="px-3 py-3 font-mono text-xs text-slate-400">{job.provider}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${
                        job.status === "completed" ? "bg-emerald-900/60 text-emerald-300" :
                        job.status === "failed" ? "bg-rose-900/60 text-rose-300" :
                        "bg-slate-700 text-slate-400"
                      }`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-500">
                      {new Date(job.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Summary bar */}
      <section className="mb-8 flex flex-wrap gap-3">
        {(["copy", "image", "mixed", "unclear", "other"] as RecommendationCauseType[]).map((cause) => {
          const count = entries.filter((e) => e.diagnosis.causeType === cause).length;
          if (count === 0) return null;
          return (
            <div key={cause} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
              <CauseBadge cause={cause} />
              <span className="text-sm font-semibold text-slate-200">{count}</span>
            </div>
          );
        })}
      </section>

      {/* Ad entry cards */}
      <section className="space-y-6">
        {entries.map((entry) => (
          <AdEntryCard
            key={entry.input.adId}
            entry={entry}
            jobsByAd={jobsByAd}
            approvalMap={approvalMap}
            onGenerateCopy={handleGenerateCopy}
            onGenerateImage={handleGenerateImage}
            onApprovalChange={async (jobId, variationId, entityType, adId, status) => {
              await setApprovalAction(jobId, variationId, entityType, adId, status);
              router.refresh();
            }}
          />
        ))}
      </section>
    </>
  );
}
