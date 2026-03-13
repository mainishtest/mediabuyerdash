"use client";

import { useState } from "react";
import Link from "next/link";
import type {
  CreativeLabEntry,
  CopyVariation,
  ImageVariationConcept,
  RecommendationCauseType,
  RecommendationConfidence
} from "../../types/creativeDiagnosis";
import { generateCopyVariations }  from "../../lib/copyVariationGenerator";
import { generateImageVariations } from "../../lib/imageVariationGenerator";
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

function CauseBadge({ cause }: { cause: RecommendationCauseType }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CAUSE_STYLES[cause]}`}>
      {CAUSE_LABELS[cause]}
    </span>
  );
}

// ── Copy variation card ───────────────────────────────────────────────────────

function CopyVariationCard({ v }: { v: CopyVariation }) {
  return (
    <div className="rounded-xl border border-violet-800/40 bg-violet-950/20 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-violet-400">
        {v.title}
      </p>
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
    </div>
  );
}

// ── Image variation card ──────────────────────────────────────────────────────

function ImageVariationCard({ v }: { v: ImageVariationConcept }) {
  return (
    <div className="rounded-xl border border-blue-800/40 bg-blue-950/20 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-blue-400">
        {v.title}
      </p>
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
    </div>
  );
}

// ── Ad entry card ─────────────────────────────────────────────────────────────

function AdEntryCard({ entry }: { entry: CreativeLabEntry }) {
  const { input, diagnosis, copyRecommendation, imageRecommendation } = entry;

  const [copyVars,  setCopyVars]  = useState<CopyVariation[]>([]);
  const [imageVars, setImageVars] = useState<ImageVariationConcept[]>([]);
  const [genCopy,   setGenCopy]   = useState(false);
  const [genImage,  setGenImage]  = useState(false);

  function handleGenerateCopy() {
    setGenCopy(true);
    setCopyVars(generateCopyVariations(input));
  }

  function handleGenerateImage() {
    setGenImage(true);
    setImageVars(generateImageVariations(input));
  }

  const showCopyAction  = diagnosis.causeType === "copy"  || diagnosis.causeType === "mixed";
  const showImageAction = diagnosis.causeType === "image" || diagnosis.causeType === "mixed";

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

        {/* Performance metrics row */}
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
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Diagnosis
        </p>
        <p className="text-sm text-slate-300">{diagnosis.shortReason}</p>
        <p className="mt-2 text-sm text-slate-400">{diagnosis.recommendationSummary}</p>
      </div>

      {/* Recommendations (if copy or image cause) */}
      {(copyRecommendation || imageRecommendation) && (
        <div className="border-b border-slate-800 p-5 space-y-4">
          {copyRecommendation && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-violet-400">
                Copy Recommendation
              </p>
              <p className="text-sm text-slate-300">
                <span className="font-medium text-slate-200">What to change: </span>
                {copyRecommendation.whatToChange}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                <span className="font-medium text-slate-300">Why it matters: </span>
                {copyRecommendation.whyItMatters}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                <span className="font-medium text-slate-300">Suggested focus: </span>
                {copyRecommendation.suggestedFocus}
              </p>
            </div>
          )}
          {imageRecommendation && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-blue-400">
                Image Recommendation
              </p>
              <p className="text-sm text-slate-300">
                <span className="font-medium text-slate-200">What to change: </span>
                {imageRecommendation.whatToChange}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                <span className="font-medium text-slate-300">Why it matters: </span>
                {imageRecommendation.whyItMatters}
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
          {showCopyAction && !genCopy && (
            <button
              onClick={handleGenerateCopy}
              className="rounded-lg border border-violet-700/60 bg-violet-900/30 px-4 py-2 text-sm font-medium text-violet-300 transition-colors hover:bg-violet-800/40 hover:text-violet-100"
            >
              Generate 3 Copy Variations
            </button>
          )}
          {showImageAction && !genImage && (
            <button
              onClick={handleGenerateImage}
              className="rounded-lg border border-blue-700/60 bg-blue-900/30 px-4 py-2 text-sm font-medium text-blue-300 transition-colors hover:bg-blue-800/40 hover:text-blue-100"
            >
              Generate 3 Image Variations
            </button>
          )}
        </div>
      )}

      {/* Generated copy variations */}
      {copyVars.length > 0 && (
        <div className="border-t border-slate-800 p-5">
          <div className="mb-3 flex items-center gap-2">
            <p className="text-sm font-semibold text-violet-300">Copy Variations</p>
            <span className="rounded-full bg-violet-900/40 px-2 py-0.5 text-xs text-violet-400">
              Mock — not AI generated
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {copyVars.map((v) => <CopyVariationCard key={v.id} v={v} />)}
          </div>
        </div>
      )}

      {/* Generated image variation concepts */}
      {imageVars.length > 0 && (
        <div className="border-t border-slate-800 p-5">
          <div className="mb-3 flex items-center gap-2">
            <p className="text-sm font-semibold text-blue-300">Image Variation Concepts</p>
            <span className="rounded-full bg-blue-900/40 px-2 py-0.5 text-xs text-blue-400">
              Mock — not AI generated
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {imageVars.map((v) => <ImageVariationCard key={v.id} v={v} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

type Props = { entries: CreativeLabEntry[] };

export function CreativeLabView({ entries }: Props) {
  return (
    <>
      {/* Page header */}
      <header className="mb-10">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200"
        >
          ← Back to Dashboard
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
          Creative Optimization Lab
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">
          Diagnoses whether poor ad performance is most likely caused by copy,
          image, or other factors — and surfaces actionable variation concepts.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <div className="inline-flex items-center gap-2 rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
            <span aria-hidden>⚠</span>
            <span>Diagnosis uses deterministic rules — not live AI</span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
            <span>Copy and image variations are mock placeholders, not LLM or image-gen output</span>
          </div>
        </div>
      </header>

      {/* Summary bar */}
      <section className="mb-8 flex flex-wrap gap-3">
        {(["copy", "image", "mixed", "unclear", "other"] as RecommendationCauseType[]).map((cause) => {
          const count = entries.filter((e) => e.diagnosis.causeType === cause).length;
          if (count === 0) return null;
          return (
            <div
              key={cause}
              className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2"
            >
              <CauseBadge cause={cause} />
              <span className="text-sm font-semibold text-slate-200">{count}</span>
            </div>
          );
        })}
      </section>

      {/* Ad entry cards */}
      <section className="space-y-6">
        {entries.map((entry) => (
          <AdEntryCard key={entry.input.adId} entry={entry} />
        ))}
      </section>
    </>
  );
}
