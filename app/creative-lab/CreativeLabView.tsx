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
  setApprovalAction,
  runRealPipelineAction,
  persistGenerationRunAction,
  setGenerationApprovalAction,
  setSelectedVariantAction
} from "./actions";
import {
  assembleCopyGenerationContext,
  assembleImageGenerationContext
} from "../../lib/promptAssemblyUtils";
import { getActiveTemplate } from "../../lib/prompts/registry";
import { renderCopyPrompt, renderImagePrompt } from "../../lib/promptRenderUtils";
import {
  formatForProvider,
  toPayloadPreview
} from "../../lib/providerFormat";
import type {
  CopyGenerationContext,
  ImageGenerationContext,
  PromptAssemblyResult
} from "../../types/promptAssembly";
import type { PromptRenderResult } from "../../types/promptTemplate";
import type {
  ProviderAdapterType,
  ProviderRequestType,
  ProviderPayloadPreview
} from "../../types/providerFormat";
import {
  parseProviderResponse,
  toParsedPreview,
  MOCK_OPENAI_COPY_RESPONSE,
  MOCK_ANTHROPIC_COPY_RESPONSE,
  MOCK_PLACEHOLDER_IMAGE_RESPONSE
} from "../../lib/providerParse";
import type {
  ProviderResponseType,
  ParsedVariationPreview
} from "../../types/providerParse";
import { runMockGenerationPipeline } from "../../lib/pipeline";
import type {
  MockGenerationPipelineResult,
  PipelineExecutionStatus
} from "../../types/pipeline";
import type { PersistedGenerationRun } from "../../lib/generationPersistence";
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
          <p className="mt-0.5 italic text-slate-200">&quot;{v.hook}&quot;</p>
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

// ── AI Input Assembly Preview ─────────────────────────────────────────────────

function AIAssemblyPreviewSection({ entries }: { entries: CreativeLabEntry[] }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copyResult, setCopyResult] = useState<PromptAssemblyResult<CopyGenerationContext> | null>(null);
  const [imageResult, setImageResult] = useState<PromptAssemblyResult<ImageGenerationContext> | null>(null);

  const entry = entries[selectedIndex] ?? null;

  function handleAssembleCopy() {
    if (!entry) return;
    setCopyResult(assembleCopyGenerationContext(entry));
  }

  function handleAssembleImage() {
    if (!entry) return;
    setImageResult(assembleImageGenerationContext(entry));
  }

  return (
    <section className="mb-10 rounded-xl border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="mb-2 text-xl font-semibold text-slate-50">
        AI Input Assembly Preview
      </h2>
      <p className="mb-4 text-sm text-slate-400">
        Assemble structured context for copy and image generation. This context will later be passed into real AI provider requests.
      </p>

      {entries.length === 0 ? (
        <p className="text-sm text-slate-500">No ads available to assemble.</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <label className="text-sm text-slate-400">Select ad:</label>
            <select
              value={selectedIndex}
              onChange={(e) => {
                setSelectedIndex(Number(e.target.value));
                setCopyResult(null);
                setImageResult(null);
              }}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-slate-600 focus:outline-none"
            >
              {entries.map((e, i) => (
                <option key={e.input.adId} value={i}>
                  {e.input.adName} ({e.input.adId})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAssembleCopy}
              className="rounded-lg border border-violet-700/60 bg-violet-900/30 px-4 py-2 text-sm font-medium text-violet-300 transition-colors hover:bg-violet-800/40 hover:text-violet-100"
            >
              Assemble Copy Input
            </button>
            <button
              type="button"
              onClick={handleAssembleImage}
              className="rounded-lg border border-blue-700/60 bg-blue-900/30 px-4 py-2 text-sm font-medium text-blue-300 transition-colors hover:bg-blue-800/40 hover:text-blue-100"
            >
              Assemble Image Input
            </button>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Copy assembly result */}
            <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-4">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-violet-400">
                Copy Generation Context
              </h3>
              {copyResult ? (
                <AssemblyResultDisplay result={copyResult} type="copy" />
              ) : (
                <p className="text-sm text-slate-500">Click &quot;Assemble Copy Input&quot; to build context.</p>
              )}
            </div>

            {/* Image assembly result */}
            <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-4">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-400">
                Image Generation Context
              </h3>
              {imageResult ? (
                <AssemblyResultDisplay result={imageResult} type="image" />
              ) : (
                <p className="text-sm text-slate-500">Click &quot;Assemble Image Input&quot; to build context.</p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function AssemblyResultDisplay<T extends CopyGenerationContext | ImageGenerationContext>({
  result,
  type
}: {
  result: PromptAssemblyResult<T>;
  type: "copy" | "image";
}) {
  const readyColor = result.ready ? "text-emerald-400" : "text-amber-400";
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={`text-sm font-medium ${readyColor}`}>
          {result.ready ? "Ready" : "Not ready"}
        </span>
        <span className="text-xs text-slate-500">
          Source: ad {result.sourceIds.adId}, campaign {result.sourceIds.campaignId}
        </span>
      </div>
      {result.missingFields.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-amber-400">Missing fields:</p>
          <ul className="list-inside list-disc text-xs text-slate-400">
            {result.missingFields.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}
      {result.warnings.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-amber-400">Warnings:</p>
          <ul className="list-inside list-disc text-xs text-slate-400">
            {result.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <p className="mb-2 text-xs font-medium text-slate-500">Assembled context (JSON):</p>
        <pre className="max-h-64 overflow-auto rounded border border-slate-800 bg-slate-900/80 p-3 font-mono text-xs text-slate-300">
          {JSON.stringify(result.context, null, 2)}
        </pre>
      </div>
    </div>
  );
}

// ── Prompt Template Preview ──────────────────────────────────────────────────

function PromptTemplatePreviewSection({ entries }: { entries: CreativeLabEntry[] }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copyRenderResult, setCopyRenderResult] = useState<PromptRenderResult | null>(null);
  const [imageRenderResult, setImageRenderResult] = useState<PromptRenderResult | null>(null);

  const entry = entries[selectedIndex] ?? null;
  const copyTemplate = getActiveTemplate("copy_generation");
  const imageTemplate = getActiveTemplate("image_variation_generation");

  function handleRenderCopy() {
    if (!entry || !copyTemplate || copyTemplate.version.templateType !== "copy_generation") return;
    const assembly = assembleCopyGenerationContext(entry);
    const result = renderCopyPrompt(copyTemplate, assembly.context);
    setCopyRenderResult(result);
  }

  function handleRenderImage() {
    if (!entry || !imageTemplate || imageTemplate.version.templateType !== "image_variation_generation") return;
    const assembly = assembleImageGenerationContext(entry);
    const result = renderImagePrompt(imageTemplate, assembly.context);
    setImageRenderResult(result);
  }

  return (
    <section className="mb-10 rounded-xl border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="mb-2 text-xl font-semibold text-slate-50">
        Prompt Template Preview
      </h2>
      <p className="mb-4 text-sm text-slate-400">
        Rendered prompts from versioned templates. This prompt layer will later feed provider-specific AI generation requests.
      </p>

      {entries.length === 0 ? (
        <p className="text-sm text-slate-500">No ads available.</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <label className="text-sm text-slate-400">Select ad:</label>
            <select
              value={selectedIndex}
              onChange={(e) => {
                setSelectedIndex(Number(e.target.value));
                setCopyRenderResult(null);
                setImageRenderResult(null);
              }}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-slate-600 focus:outline-none"
            >
              {entries.map((e, i) => (
                <option key={e.input.adId} value={i}>
                  {e.input.adName} ({e.input.adId})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleRenderCopy}
              disabled={!copyTemplate}
              className="rounded-lg border border-violet-700/60 bg-violet-900/30 px-4 py-2 text-sm font-medium text-violet-300 transition-colors hover:bg-violet-800/40 hover:text-violet-100 disabled:opacity-50"
            >
              Render Copy Prompt
            </button>
            <button
              type="button"
              onClick={handleRenderImage}
              disabled={!imageTemplate}
              className="rounded-lg border border-blue-700/60 bg-blue-900/30 px-4 py-2 text-sm font-medium text-blue-300 transition-colors hover:bg-blue-800/40 hover:text-blue-100 disabled:opacity-50"
            >
              Render Image Prompt
            </button>
          </div>

          <div className="mb-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-4">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-widest text-violet-400">
                Active Copy Template
              </h3>
              {copyTemplate ? (
                <div className="space-y-1 text-xs text-slate-400">
                  <p><span className="text-slate-500">Title:</span> {copyTemplate.version.title}</p>
                  <p><span className="text-slate-500">Version:</span> {copyTemplate.version.version}</p>
                  <p><span className="text-slate-500">Principles:</span> {copyTemplate.metadata.creativePrinciplesIncluded.join(", ")}</p>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No copy template available.</p>
              )}
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-4">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-widest text-blue-400">
                Active Image Template
              </h3>
              {imageTemplate ? (
                <div className="space-y-1 text-xs text-slate-400">
                  <p><span className="text-slate-500">Title:</span> {imageTemplate.version.title}</p>
                  <p><span className="text-slate-500">Version:</span> {imageTemplate.version.version}</p>
                  <p><span className="text-slate-500">Principles:</span> {imageTemplate.metadata.creativePrinciplesIncluded.join(", ")}</p>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No image template available.</p>
              )}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-4">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-violet-400">
                Rendered Copy Prompt
              </h3>
              {copyRenderResult ? (
                <PromptRenderResultDisplay result={copyRenderResult} />
              ) : (
                <p className="text-sm text-slate-500">Click &quot;Render Copy Prompt&quot; to generate.</p>
              )}
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-4">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-400">
                Rendered Image Prompt
              </h3>
              {imageRenderResult ? (
                <PromptRenderResultDisplay result={imageRenderResult} />
              ) : (
                <p className="text-sm text-slate-500">Click &quot;Render Image Prompt&quot; to generate.</p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function PromptRenderResultDisplay({ result }: { result: PromptRenderResult }) {
  const hasIssues = result.missingFields.length > 0 || result.warnings.length > 0;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={`text-sm font-medium ${hasIssues ? "text-amber-400" : "text-emerald-400"}`}>
          {hasIssues ? "Rendered with warnings" : "Ready"}
        </span>
        <span className="text-xs text-slate-500">v{result.templateVersion}</span>
      </div>
      {result.missingFields.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-amber-400">Missing fields:</p>
          <ul className="list-inside list-disc text-xs text-slate-400">
            {result.missingFields.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}
      {result.warnings.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-amber-400">Warnings:</p>
          <ul className="list-inside list-disc text-xs text-slate-400">
            {result.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <p className="mb-2 text-xs font-medium text-slate-500">Full prompt:</p>
        <pre className="max-h-80 overflow-auto rounded border border-slate-800 bg-slate-900/80 p-3 font-mono text-xs text-slate-300 whitespace-pre-wrap">
          {result.fullPrompt}
        </pre>
      </div>
    </div>
  );
}

// ── Provider Payload Preview ───────────────────────────────────────────────────

const PROVIDER_OPTIONS: { value: ProviderAdapterType; label: string }[] = [
  { value: "openai_text", label: "OpenAI (text)" },
  { value: "anthropic_text", label: "Anthropic (text)" },
  { value: "image_provider_placeholder", label: "Image (placeholder)" }
];

const REQUEST_TYPE_OPTIONS: { value: ProviderRequestType; label: string }[] = [
  { value: "copy_generation", label: "Copy generation" },
  { value: "image_variation_generation", label: "Image variation" }
];

function ProviderPayloadPreviewSection({ entries }: { entries: CreativeLabEntry[] }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [provider, setProvider] = useState<ProviderAdapterType>("openai_text");
  const [requestType, setRequestType] = useState<ProviderRequestType>("copy_generation");
  const [preview, setPreview] = useState<ProviderPayloadPreview | null>(null);

  const entry = entries[selectedIndex] ?? null;
  const copyTemplate = getActiveTemplate("copy_generation");
  const imageTemplate = getActiveTemplate("image_variation_generation");

  function handleFormatCopy() {
    if (!entry || !copyTemplate || copyTemplate.version.templateType !== "copy_generation") return;
    const assembly = assembleCopyGenerationContext(entry);
    const renderResult = renderCopyPrompt(copyTemplate, assembly.context);
    const result = formatForProvider(renderResult, assembly.context, provider, "copy_generation");
    if (result) {
      setPreview(toPayloadPreview(result, renderResult.fullPrompt));
    } else {
      setPreview(null);
    }
  }

  function handleFormatImage() {
    if (!entry || !imageTemplate || imageTemplate.version.templateType !== "image_variation_generation") return;
    const assembly = assembleImageGenerationContext(entry);
    const renderResult = renderImagePrompt(imageTemplate, assembly.context);
    const result = formatForProvider(renderResult, assembly.context, provider, "image_variation_generation");
    if (result) {
      setPreview(toPayloadPreview(result, renderResult.fullPrompt));
    } else {
      setPreview(null);
    }
  }

  return (
    <section className="mb-10 rounded-xl border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="mb-2 text-xl font-semibold text-slate-50">
        Provider Payload Preview
      </h2>
      <p className="mb-4 text-sm text-slate-400">
        This layer keeps internal prompt logic separate from provider-specific request formatting. No real API calls.
      </p>

      {entries.length === 0 ? (
        <p className="text-sm text-slate-500">No ads available.</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <label className="text-sm text-slate-400">Select ad:</label>
            <select
              value={selectedIndex}
              onChange={(e) => {
                setSelectedIndex(Number(e.target.value));
                setPreview(null);
              }}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-slate-600 focus:outline-none"
            >
              {entries.map((e, i) => (
                <option key={e.input.adId} value={i}>
                  {e.input.adName} ({e.input.adId})
                </option>
              ))}
            </select>
            <label className="text-sm text-slate-400">Provider:</label>
            <select
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value as ProviderAdapterType);
                setPreview(null);
              }}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-slate-600 focus:outline-none"
            >
              {PROVIDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <label className="text-sm text-slate-400">Request type:</label>
            <select
              value={requestType}
              onChange={(e) => {
                setRequestType(e.target.value as ProviderRequestType);
                setPreview(null);
              }}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-slate-600 focus:outline-none"
            >
              {REQUEST_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleFormatCopy}
              disabled={!copyTemplate}
              className="rounded-lg border border-violet-700/60 bg-violet-900/30 px-4 py-2 text-sm font-medium text-violet-300 transition-colors hover:bg-violet-800/40 hover:text-violet-100 disabled:opacity-50"
            >
              Format Copy Request
            </button>
            <button
              type="button"
              onClick={handleFormatImage}
              disabled={!imageTemplate}
              className="rounded-lg border border-blue-700/60 bg-blue-900/30 px-4 py-2 text-sm font-medium text-blue-300 transition-colors hover:bg-blue-800/40 hover:text-blue-100 disabled:opacity-50"
            >
              Format Image Request
            </button>
          </div>

          {preview ? (
            <ProviderPayloadDisplay preview={preview} />
          ) : (
            <p className="text-sm text-slate-500">
              Select an ad, provider, and request type, then click &quot;Format Copy Request&quot; or &quot;Format Image Request&quot;.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function ProviderPayloadDisplay({ preview }: { preview: ProviderPayloadPreview }) {
  const hasIssues = preview.missingFields.length > 0 || preview.warnings.length > 0;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-sm font-medium ${hasIssues ? "text-amber-400" : "text-emerald-400"}`}>
          {preview.readiness ? "Ready" : "Not ready"}
        </span>
        <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-400">
          {preview.provider} · {preview.requestType}
        </span>
      </div>
      {preview.warnings.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-amber-400">Warnings:</p>
          <ul className="list-inside list-disc text-xs text-slate-400">
            {preview.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      {preview.missingFields.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-amber-400">Missing fields:</p>
          <ul className="list-inside list-disc text-xs text-slate-400">
            {preview.missingFields.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-4">
        <p className="mb-2 text-xs font-medium text-slate-500">Internal prompt (rendered):</p>
        <pre className="max-h-40 overflow-auto rounded border border-slate-800 bg-slate-900/80 p-3 font-mono text-xs text-slate-300 whitespace-pre-wrap">
          {preview.internalPrompt}
        </pre>
      </div>
      <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-4">
        <p className="mb-2 text-xs font-medium text-slate-500">Formatted provider payload:</p>
        <pre className="max-h-64 overflow-auto rounded border border-slate-800 bg-slate-900/80 p-3 font-mono text-xs text-slate-300">
          {preview.payloadJson}
        </pre>
      </div>
    </div>
  );
}

// ── Provider Response Parsing Preview ──────────────────────────────────────────

const PARSE_PROVIDER_OPTIONS: { value: ProviderResponseType; label: string }[] = [
  { value: "openai_text_response", label: "OpenAI (text)" },
  { value: "anthropic_text_response", label: "Anthropic (text)" },
  { value: "image_provider_placeholder_response", label: "Image (placeholder)" }
];

const PARSE_REQUEST_OPTIONS = [
  { value: "copy_generation" as const, label: "Copy generation" },
  { value: "image_variation_generation" as const, label: "Image variation" }
];

function ProviderResponseParsingSection() {
  const [provider, setProvider] = useState<ProviderResponseType>("openai_text_response");
  const [requestType, setRequestType] = useState<"copy_generation" | "image_variation_generation">("copy_generation");
  const [preview, setPreview] = useState<ParsedVariationPreview | null>(null);

  function handleParseCopy() {
    const raw = provider === "openai_text_response" ? MOCK_OPENAI_COPY_RESPONSE : MOCK_ANTHROPIC_COPY_RESPONSE;
    const result = parseProviderResponse(raw, provider, "copy_generation");
    if (result) setPreview(toParsedPreview(result));
    else setPreview(null);
  }

  function handleParseImage() {
    const result = parseProviderResponse(MOCK_PLACEHOLDER_IMAGE_RESPONSE, "image_provider_placeholder_response", "image_variation_generation");
    if (result) setPreview(toParsedPreview(result));
    else setPreview(null);
  }

  return (
    <section className="mb-10 rounded-xl border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="mb-2 text-xl font-semibold text-slate-50">
        Provider Response Parsing Preview
      </h2>
      <p className="mb-4 text-sm text-slate-400">
        This parsing layer keeps provider-specific output handling separate from internal app models. No real API calls.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-400">Provider:</label>
        <select
          value={provider}
          onChange={(e) => {
            setProvider(e.target.value as ProviderResponseType);
            setPreview(null);
          }}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-slate-600 focus:outline-none"
        >
          {PARSE_PROVIDER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <label className="text-sm text-slate-400">Response type:</label>
        <select
          value={requestType}
          onChange={(e) => {
            setRequestType(e.target.value as "copy_generation" | "image_variation_generation");
            setPreview(null);
          }}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-slate-600 focus:outline-none"
        >
          {PARSE_REQUEST_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleParseCopy}
          disabled={requestType !== "copy_generation" || provider === "image_provider_placeholder_response"}
          className="rounded-lg border border-violet-700/60 bg-violet-900/30 px-4 py-2 text-sm font-medium text-violet-300 transition-colors hover:bg-violet-800/40 hover:text-violet-100 disabled:opacity-50"
        >
          Parse Copy Response
        </button>
        <button
          type="button"
          onClick={handleParseImage}
          disabled={requestType !== "image_variation_generation" || provider !== "image_provider_placeholder_response"}
          className="rounded-lg border border-blue-700/60 bg-blue-900/30 px-4 py-2 text-sm font-medium text-blue-300 transition-colors hover:bg-blue-800/40 hover:text-blue-100 disabled:opacity-50"
        >
          Parse Image Response
        </button>
      </div>

      {preview ? (
        <ParsedVariationDisplay preview={preview} />
      ) : (
        <p className="text-sm text-slate-500">
          Select provider and response type, then click &quot;Parse Copy Response&quot; or &quot;Parse Image Response&quot;.
        </p>
      )}
    </section>
  );
}

function ParsedVariationDisplay({ preview }: { preview: ParsedVariationPreview }) {
  const hasIssues = preview.errors.length > 0 || preview.warnings.length > 0;
  const isCopy = preview.requestType === "copy_generation";
  const variations = preview.variations;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-sm font-medium ${hasIssues ? "text-amber-400" : "text-emerald-400"}`}>
          {preview.readiness ? "Ready" : "Not ready"}
        </span>
        <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-400">
          {preview.provider} · {preview.requestType}
        </span>
      </div>
      {preview.errors.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-rose-400">Errors:</p>
          <ul className="list-inside list-disc text-xs text-slate-400">
            {preview.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {preview.warnings.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-amber-400">Warnings:</p>
          <ul className="list-inside list-disc text-xs text-slate-400">
            {preview.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-4">
        <p className="mb-2 text-xs font-medium text-slate-500">Raw provider response:</p>
        <pre className="max-h-48 overflow-auto rounded border border-slate-800 bg-slate-900/80 p-3 font-mono text-xs text-slate-300">
          {preview.rawPreview}
        </pre>
      </div>
      <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-4">
        <p className="mb-2 text-xs font-medium text-slate-500">Parsed normalized output:</p>
        <div className="grid gap-3 md:grid-cols-3">
          {isCopy
            ? (variations as CopyVariation[]).map((v) => (
                <div key={v.id} className="rounded-lg border border-violet-800/40 bg-violet-950/20 p-3">
                  <p className="mb-2 text-xs font-semibold text-violet-400">{v.title}</p>
                  <p className="mb-1 text-xs text-slate-400">Hook:</p>
                  <p className="mb-2 text-sm italic text-slate-200">&quot;{v.hook}&quot;</p>
                  <p className="mb-1 text-xs text-slate-400">Body:</p>
                  <p className="mb-2 text-sm text-slate-300">{v.body}</p>
                  <p className="text-xs font-medium text-violet-300">CTA: {v.callToAction}</p>
                </div>
              ))
            : (variations as ImageVariationConcept[]).map((v) => (
                <div key={v.id} className="rounded-lg border border-blue-800/40 bg-blue-950/20 p-3">
                  <p className="mb-2 text-xs font-semibold text-blue-400">{v.title}</p>
                  <p className="mb-1 text-xs text-slate-400">Concept:</p>
                  <p className="mb-2 text-sm text-slate-200">{v.conceptSummary}</p>
                  <p className="mb-1 text-xs text-slate-400">Visual changes:</p>
                  <p className="mb-2 text-sm text-slate-300">{v.visualChanges}</p>
                  <p className="text-xs font-medium text-blue-300">Goal: {v.goal}</p>
                </div>
              ))}
        </div>
      </div>
    </div>
  );
}

// ── End-to-End Generation Pipeline ───────────────────────────────────────────

const PIPELINE_PROVIDER_OPTIONS: { value: ProviderAdapterType; label: string }[] = [
  { value: "openai_text", label: "Mock OpenAI-style" },
  { value: "anthropic_text", label: "Mock Anthropic-style" },
  { value: "image_provider_placeholder", label: "Placeholder image provider" }
];

const PIPELINE_REQUEST_OPTIONS = [
  { value: "copy_generation" as const, label: "Copy generation" },
  { value: "image_variation_generation" as const, label: "Image variation" }
];

const STATUS_STYLES: Record<PipelineExecutionStatus, string> = {
  idle:      "text-slate-400",
  running:   "text-amber-400",
  completed: "text-emerald-400",
  failed:    "text-rose-400",
  partial:   "text-amber-400"
};

function EndToEndPipelineSection({
  entries,
  providerConfig
}: {
  entries: CreativeLabEntry[];
  providerConfig: ProviderConfig;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [requestType, setRequestType] = useState<"copy_generation" | "image_variation_generation">("copy_generation");
  const [provider, setProvider] = useState<ProviderAdapterType>("openai_text");
  const [mode, setMode] = useState<"mock" | "real">("mock");
  const [result, setResult] = useState<MockGenerationPipelineResult | null>(null);
  const [persistedRun, setPersistedRun] = useState<PersistedGenerationRun | null>(null);
  const [approvalMap, setApprovalMap] = useState<Record<string, CreativeApprovalStatus>>({});
  const [selectedCopyId, setSelectedCopyId] = useState<string | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [traceOpen, setTraceOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const entry = entries[selectedIndex] ?? null;
  const openaiReady = providerConfig.openai.ready;
  const anthropicReady = providerConfig.anthropic.ready;
  const providerReady =
    provider === "openai_text" ? openaiReady :
    provider === "anthropic_text" ? anthropicReady :
    true;

  async function handleRunCopy() {
    if (!entry) return;
    setApprovalMap({});
    setPersistedRun(null);
    setSelectedCopyId(null);
    let r: MockGenerationPipelineResult;
    if (mode === "mock") {
      r = runMockGenerationPipeline({ entry, requestType: "copy_generation", provider });
      setResult(r);
    } else {
      setLoading(true);
      try {
        r = await runRealPipelineAction(entry, "copy_generation", provider);
        setResult(r);
      } finally {
        setLoading(false);
      }
    }
    const persisted = await persistGenerationRunAction(r, entry, mode);
    if (persisted) setPersistedRun(persisted);
  }

  async function handleRunImage() {
    if (!entry) return;
    setApprovalMap({});
    setPersistedRun(null);
    setSelectedImageId(null);
    let r: MockGenerationPipelineResult;
    if (mode === "mock") {
      r = runMockGenerationPipeline({ entry, requestType: "image_variation_generation", provider });
      setResult(r);
    } else {
      setLoading(true);
      try {
        r = await runRealPipelineAction(entry, "image_variation_generation", provider);
        setResult(r);
      } finally {
        setLoading(false);
      }
    }
    const persisted = await persistGenerationRunAction(r, entry, mode);
    if (persisted) setPersistedRun(persisted);
  }

  async function handleApprovalChange(runId: string, variationId: string, variationType: "copy" | "image", status: CreativeApprovalStatus) {
    if (status !== "approved" && status !== "rejected") return;
    await setGenerationApprovalAction(runId, variationId, variationType, status);
    setApprovalMap((prev) => ({ ...prev, [variationId]: status }));
  }

  async function handleSelectVariant(runId: string, variationId: string, variationType: "copy" | "image") {
    await setSelectedVariantAction(runId, variationId, variationType);
    if (variationType === "copy") setSelectedCopyId(variationId);
    else setSelectedImageId(variationId);
  }

  return (
    <section className="mb-10 rounded-xl border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="mb-2 text-xl font-semibold text-slate-50">
        End-to-End Generation Pipeline
      </h2>
      <p className="mb-4 text-sm text-slate-400">
        {mode === "mock"
          ? "Mock flow: diagnosis → assembly → render → format → mock response → parse. No live API calls."
          : "Real flow: same pipeline with live provider execution. Requires API keys in .env.local."}
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-400">Mode:</label>
        <select
          value={mode}
          onChange={(e) => {
            setMode(e.target.value as "mock" | "real");
            setResult(null);
            setPersistedRun(null);
          }}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-slate-600 focus:outline-none"
        >
          <option value="mock">Mock</option>
          <option value="real">Real</option>
        </select>
        <span className="text-xs text-slate-500">
          OpenAI: {openaiReady ? "✓" : "✗"} · Anthropic: {anthropicReady ? "✓" : "✗"}
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-slate-500">No ads available.</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <label className="text-sm text-slate-400">Select ad:</label>
            <select
              value={selectedIndex}
              onChange={(e) => {
                setSelectedIndex(Number(e.target.value));
                setResult(null);
                setPersistedRun(null);
              }}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-slate-600 focus:outline-none"
            >
              {entries.map((e, i) => (
                <option key={e.input.adId} value={i}>
                  {e.input.adName} ({e.input.adId})
                </option>
              ))}
            </select>
            <label className="text-sm text-slate-400">Request type:</label>
            <select
              value={requestType}
          onChange={(e) => {
            setRequestType(e.target.value as "copy_generation" | "image_variation_generation");
            setResult(null);
            setPersistedRun(null);
          }}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-slate-600 focus:outline-none"
            >
              {PIPELINE_REQUEST_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <label className="text-sm text-slate-400">Provider:</label>
            <select
              value={provider}
          onChange={(e) => {
            setProvider(e.target.value as ProviderAdapterType);
            setResult(null);
            setPersistedRun(null);
          }}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-slate-600 focus:outline-none"
            >
              {PIPELINE_PROVIDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleRunCopy}
              disabled={
                !entry ||
                requestType !== "copy_generation" ||
                provider === "image_provider_placeholder" ||
                (mode === "real" && !providerReady) ||
                loading
              }
              className="rounded-lg border border-violet-700/60 bg-violet-900/30 px-4 py-2 text-sm font-medium text-violet-300 transition-colors hover:bg-violet-800/40 hover:text-violet-100 disabled:opacity-50"
            >
              {loading ? "Running…" : mode === "mock" ? "Run Mock Copy" : "Run Real Copy"}
            </button>
            <button
              type="button"
              onClick={handleRunImage}
              disabled={
                !entry ||
                requestType !== "image_variation_generation" ||
                provider !== "image_provider_placeholder" ||
                loading
              }
              className="rounded-lg border border-blue-700/60 bg-blue-900/30 px-4 py-2 text-sm font-medium text-blue-300 transition-colors hover:bg-blue-800/40 hover:text-blue-100 disabled:opacity-50"
            >
              {loading ? "Running…" : mode === "mock" ? "Run Mock Image" : "Run Real Image"}
            </button>
          </div>

          {mode === "real" && !providerReady && (provider === "openai_text" || provider === "anthropic_text") && (
            <div className="mb-4 rounded-lg border border-amber-800/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-300">
              {provider === "openai_text" && !openaiReady && providerConfig.openai.message}
              {provider === "anthropic_text" && !anthropicReady && providerConfig.anthropic.message}
            </div>
          )}

          {result && (
            <PipelineResultDisplay
              result={result}
              persistedRun={persistedRun}
              approvalMap={approvalMap}
              onApprovalChange={handleApprovalChange}
              onSelectVariant={handleSelectVariant}
              selectedCopyId={selectedCopyId}
              selectedImageId={selectedImageId}
              traceOpen={traceOpen}
              onTraceToggle={() => setTraceOpen((v) => !v)}
              mode={mode}
            />
          )}
        </>
      )}
    </section>
  );
}

function PipelineResultDisplay({
  result,
  persistedRun,
  approvalMap,
  onApprovalChange,
  onSelectVariant,
  selectedCopyId,
  selectedImageId,
  traceOpen,
  onTraceToggle,
  mode
}: {
  result: MockGenerationPipelineResult;
  persistedRun: PersistedGenerationRun | null;
  approvalMap: Record<string, CreativeApprovalStatus>;
  onApprovalChange: (runId: string, variationId: string, variationType: "copy" | "image", status: CreativeApprovalStatus) => void;
  onSelectVariant: (runId: string, variationId: string, variationType: "copy" | "image") => void;
  selectedCopyId: string | null;
  selectedImageId: string | null;
  traceOpen: boolean;
  onTraceToggle: () => void;
  mode?: "mock" | "real";
}) {
  const status = result.status;
  const isCopy = result.requestType === "copy_generation";
  const runId = persistedRun?.runId ?? null;
  const copyVariations = persistedRun?.copyVariations ?? result.copyOutput ?? [];
  const imageVariations = persistedRun?.imageVariations ?? result.imageOutput ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-sm font-medium ${STATUS_STYLES[status]}`}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
        <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-400">
          {result.provider} · {result.requestType}
        </span>
        {mode && (
          <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-400">
            {mode}
          </span>
        )}
      </div>

      {result.errors.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-rose-400">Errors:</p>
          <ul className="list-inside list-disc text-xs text-slate-400">
            {result.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {result.warnings.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-amber-400">Warnings:</p>
          <ul className="list-inside list-disc text-xs text-slate-400">
            {result.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-medium text-slate-500">Pipeline steps:</p>
        <div className="flex flex-wrap gap-2">
          {result.stepResults.map((s) => (
            <span
              key={s.step}
              className={`rounded-full px-2 py-0.5 text-xs ${
                s.status === "ok" ? "bg-emerald-900/60 text-emerald-300" :
                s.status === "failed" ? "bg-rose-900/60 text-rose-300" :
                "bg-slate-700 text-slate-400"
              }`}
            >
              {s.step.replace(/_/g, " ")}: {s.status}
            </span>
          ))}
        </div>
      </div>

      {isCopy && copyVariations.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-slate-500">Final normalized copy output (approval-ready):</p>
          <div className="grid gap-4 md:grid-cols-3">
            {copyVariations.map((v) => {
              const approvalStatus = approvalMap[v.id] ?? v.approvalStatus ?? "draft";
              const isSelected = selectedCopyId === v.id;
              return (
                <div key={v.id} className="rounded-xl border border-violet-800/40 bg-violet-950/20 p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">{v.title}</p>
                    <div className="flex items-center gap-2">
                      {isSelected && (
                        <span className="rounded-full bg-amber-900/60 px-2 py-0.5 text-xs text-amber-300">Selected</span>
                      )}
                      <ApprovalBadge status={approvalStatus} />
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">Hook</p>
                      <p className="mt-0.5 italic text-slate-200">&quot;{v.hook}&quot;</p>
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
                  {runId && (approvalStatus === "draft" || approvalStatus === "approved") && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {approvalStatus === "draft" && (
                        <>
                          <button
                            type="button"
                            onClick={() => onApprovalChange(runId, v.id, "copy", "approved")}
                            className="rounded-lg bg-emerald-900/50 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-800/50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => onApprovalChange(runId, v.id, "copy", "rejected")}
                            className="rounded-lg bg-rose-900/50 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-800/50"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {approvalStatus === "approved" && (
                        <button
                          type="button"
                          onClick={() => onSelectVariant(runId, v.id, "copy")}
                          className="rounded-lg bg-amber-900/50 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-800/50"
                        >
                          Select as test candidate
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!isCopy && imageVariations.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-slate-500">Final normalized image output (approval-ready):</p>
          <div className="grid gap-4 md:grid-cols-3">
            {imageVariations.map((v) => {
              const approvalStatus = approvalMap[v.id] ?? v.approvalStatus ?? "draft";
              const isSelected = selectedImageId === v.id;
              return (
                <div key={v.id} className="rounded-xl border border-blue-800/40 bg-blue-950/20 p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">{v.title}</p>
                    <div className="flex items-center gap-2">
                      {isSelected && (
                        <span className="rounded-full bg-amber-900/60 px-2 py-0.5 text-xs text-amber-300">Selected</span>
                      )}
                      <ApprovalBadge status={approvalStatus} />
                    </div>
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
                  {runId && (approvalStatus === "draft" || approvalStatus === "approved") && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {approvalStatus === "draft" && (
                        <>
                          <button
                            type="button"
                            onClick={() => onApprovalChange(runId, v.id, "image", "approved")}
                            className="rounded-lg bg-emerald-900/50 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-800/50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => onApprovalChange(runId, v.id, "image", "rejected")}
                            className="rounded-lg bg-rose-900/50 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-800/50"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {approvalStatus === "approved" && (
                        <button
                          type="button"
                          onClick={() => onSelectVariant(runId, v.id, "image")}
                          className="rounded-lg bg-amber-900/50 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-800/50"
                        >
                          Select as test candidate
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={onTraceToggle}
          className="text-sm text-slate-400 hover:text-slate-200"
        >
          {traceOpen ? "▼ Hide" : "▶ Show"} pipeline trace
        </button>
        {traceOpen && (
          <div className="mt-3 space-y-3 rounded-lg border border-slate-700 bg-slate-950/60 p-4">
            {result.trace.diagnosis != null && (
              <div>
                <p className="mb-1 text-xs font-medium text-slate-500">Diagnosis:</p>
                <pre className="max-h-24 overflow-auto rounded border border-slate-800 bg-slate-900/80 p-2 font-mono text-xs text-slate-300">
                  {JSON.stringify(result.trace.diagnosis, null, 2)}
                </pre>
              </div>
            )}
            {result.trace.assembledContext != null && (
              <div>
                <p className="mb-1 text-xs font-medium text-slate-500">Assembled context:</p>
                <pre className="max-h-24 overflow-auto rounded border border-slate-800 bg-slate-900/80 p-2 font-mono text-xs text-slate-300">
                  {JSON.stringify(result.trace.assembledContext, null, 2)}
                </pre>
              </div>
            )}
            {result.trace.renderedPrompt && (
              <div>
                <p className="mb-1 text-xs font-medium text-slate-500">Rendered prompt:</p>
                <pre className="max-h-32 overflow-auto rounded border border-slate-800 bg-slate-900/80 p-2 font-mono text-xs text-slate-300 whitespace-pre-wrap">
                  {result.trace.renderedPrompt}
                </pre>
              </div>
            )}
            {result.trace.formattedPayload != null && (
              <div>
                <p className="mb-1 text-xs font-medium text-slate-500">Formatted provider payload:</p>
                <pre className="max-h-24 overflow-auto rounded border border-slate-800 bg-slate-900/80 p-2 font-mono text-xs text-slate-300">
                  {JSON.stringify(result.trace.formattedPayload, null, 2)}
                </pre>
              </div>
            )}
            {result.trace.rawMockResponse != null && (
              <div>
                <p className="mb-1 text-xs font-medium text-slate-500">Raw mock response:</p>
                <pre className="max-h-32 overflow-auto rounded border border-slate-800 bg-slate-900/80 p-2 font-mono text-xs text-slate-300">
                  {JSON.stringify(result.trace.rawMockResponse, null, 2)}
                </pre>
              </div>
            )}
            {result.trace.parsedOutput != null && (
              <div>
                <p className="mb-1 text-xs font-medium text-slate-500">Parsed normalized output:</p>
                <pre className="max-h-32 overflow-auto rounded border border-slate-800 bg-slate-900/80 p-2 font-mono text-xs text-slate-300">
                  {JSON.stringify(result.trace.parsedOutput, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

type ProviderConfig = {
  openai:   { ready: boolean; message: string };
  anthropic: { ready: boolean; message: string };
  image:   { ready: boolean; message: string };
};

type Props = {
  entries:        CreativeLabEntry[];
  jobsByAd:       Record<string, { copyJobs: JobWithVariations[]; imageJobs: JobWithVariations[] }>;
  approvalMap:    ApprovalMap;
  allJobs:        JobWithVariations[];
  providerConfig: ProviderConfig;
};

export function CreativeLabView({ entries, jobsByAd, approvalMap, allJobs, providerConfig }: Props) {
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
          <Link
            href="/creative-history"
            className="rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700/60 hover:text-slate-100"
          >
            Generation History
          </Link>
          {providerConfig.anthropic.ready ? (
            <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-800/60 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300">
              <span aria-hidden>✓</span>
              <span>Anthropic connected</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
              <span aria-hidden>⚠</span>
              <span>{providerConfig.anthropic.message}</span>
            </div>
          )}
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

      {/* AI Input Assembly Preview */}
      <AIAssemblyPreviewSection entries={entries} />

      {/* Prompt Template Preview */}
      <PromptTemplatePreviewSection entries={entries} />

      {/* Provider Payload Preview */}
      <ProviderPayloadPreviewSection entries={entries} />

      {/* Provider Response Parsing Preview */}
      <ProviderResponseParsingSection />

      {/* End-to-End Generation Pipeline */}
      <EndToEndPipelineSection entries={entries} providerConfig={providerConfig} />

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
