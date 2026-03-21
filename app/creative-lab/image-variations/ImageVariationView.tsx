"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { PageHeader }   from "../../../components/ui/PageHeader";
import { SectionCard }  from "../../../components/ui/SectionCard";
import { Badge }        from "../../../components/ui/Badge";
import { ActionButton } from "../../../components/ui/ActionButton";
import { StatCard }     from "../../../components/ui/StatCard";
import {
  generateImageVariationsAction,
  saveCandidatesAction,
  sendToReviewAction,
} from "./actions";
import type { GenerateImageVariationsResult } from "./actions";
import { IMAGE_VARIATION_INTENTS } from "../../../lib/imageVariation/types";
import type {
  ImageVariationIntent,
  ImageVariationCandidate,
  ImageVariationGenerationSummary,
} from "../../../lib/imageVariation/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreativeSnapshot {
  externalCreativeId: string;
  creativeName:       string | null;
  thumbnailUrl:       string | null;
  campaignName:       string;
  clientAccountId:    string;
  clientName:         string;
  avgCtr:             number;
  avgFrequency:       number | null;
  campaignRoas:       number | null;
  evaluationStatus:   string;
  spend:              number;
}

interface HistoryItem {
  id:              string;
  variationIntent: string;
  triggerType:     string;
  status:          string;
  candidateCount:  number;
  provider:        string;
  createdAt:       string;
}

interface Props {
  creatives:      CreativeSnapshot[];
  recentHistory:  HistoryItem[];
}

// ---------------------------------------------------------------------------
// Intent options
// ---------------------------------------------------------------------------

const INTENT_OPTIONS = Object.entries(IMAGE_VARIATION_INTENTS) as Array<
  [ImageVariationIntent, { label: string; description: string }]
>;

const TRIGGER_OPTIONS: Array<{
  value: "fatigue" | "underperformance" | "opportunity" | "manual";
  label: string;
}> = [
  { value: "manual",           label: "Manual"           },
  { value: "fatigue",          label: "Fatigue"          },
  { value: "underperformance", label: "Underperformance" },
  { value: "opportunity",      label: "Opportunity"      },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusVariant(s: string): "success" | "warning" | "danger" | "neutral" {
  if (s === "completed") return "success";
  if (s === "partial")   return "warning";
  if (s === "failed")    return "danger";
  return "neutral";
}

function evalVariant(s: string): "success" | "warning" | "danger" | "neutral" {
  if (s === "strong")  return "success";
  if (s === "average") return "neutral";
  if (s === "weak")    return "warning";
  if (s === "fatigued") return "danger";
  return "neutral";
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ImageVariationView({ creatives, recentHistory }: Props) {
  // Selection state
  const [selectedCreativeId, setSelectedCreativeId] = useState<string>("");
  const [selectedIntent,     setSelectedIntent]     = useState<ImageVariationIntent>("refresh_visual_hook");
  const [selectedTrigger,    setSelectedTrigger]    = useState<"fatigue" | "underperformance" | "opportunity" | "manual">("manual");
  const [candidateCount,     setCandidateCount]     = useState(3);

  // Results state
  const [result,     setResult]     = useState<GenerateImageVariationsResult | null>(null);
  const [lastRequestId, setLastRequestId] = useState<string | null>(null);

  // Transitions
  const [genPending,  startGen]   = useTransition();
  const [savePending, startSave]  = useTransition();
  const [reviewPending, startReview] = useTransition();
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const selectedCreative = creatives.find(
    (c) => c.externalCreativeId === selectedCreativeId,
  );

  const candidates: ImageVariationCandidate[] =
    result?.ok ? result.candidates : [];
  const summary: ImageVariationGenerationSummary | null =
    result?.ok ? result.summary : null;
  const errorMsg = result && !result.ok ? result.error : null;

  // ── Handlers ────────────────────────────────────────────────────────────

  function handleGenerate() {
    if (!selectedCreativeId) return;
    setResult(null);
    setActionMsg(null);
    startGen(async () => {
      const r = await generateImageVariationsAction({
        creativeId:     selectedCreativeId,
        intent:         selectedIntent,
        triggerType:    selectedTrigger,
        candidateCount,
      });
      setResult(r);
      if (r.ok) setLastRequestId(r.requestId);
    });
  }

  function handleSave() {
    if (!lastRequestId) return;
    startSave(async () => {
      const r = await saveCandidatesAction(lastRequestId);
      setActionMsg(r.ok ? "Candidates saved." : `Error: ${r.error}`);
    });
  }

  function handleSendToReview() {
    if (!lastRequestId) return;
    startReview(async () => {
      const r = await sendToReviewAction(lastRequestId);
      setActionMsg(r.ok ? "Candidates sent to review." : `Error: ${r.error}`);
    });
  }

  function handleGenerateMore() {
    handleGenerate();
  }

  function handleChangeIntent(intent: ImageVariationIntent) {
    setSelectedIntent(intent);
    setResult(null);
    setActionMsg(null);
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6 sm:px-6 sm:py-8">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/creative-lab" className="hover:text-slate-300">Creative Lab</Link>
        <span>/</span>
        <span className="text-slate-400">Image Variations</span>
      </nav>

      <PageHeader
        title="Image Variation Engine"
        description="Generate structured image variation candidates tied to creative performance signals and fatigue triggers."
      />

      {/* ── Configuration ────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">

        {/* Source creative selector */}
        <SectionCard title="Source Creative">
          {creatives.length === 0 ? (
            <p className="text-sm text-slate-500">
              No creative performance data available. Run a Meta sync first.
            </p>
          ) : (
            <>
              <label htmlFor="creative-select" className="mb-2 block text-xs font-medium text-slate-400">
                Select a creative to generate variations for
              </label>
              <select
                id="creative-select"
                value={selectedCreativeId}
                onChange={(e) => {
                  setSelectedCreativeId(e.target.value);
                  setResult(null);
                  setActionMsg(null);
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm
                  text-slate-100 focus:border-emerald-600 focus:outline-none"
              >
                <option value="">Choose a creative...</option>
                {creatives.map((c) => (
                  <option key={c.externalCreativeId} value={c.externalCreativeId}>
                    {c.creativeName ?? c.externalCreativeId} — {c.campaignName} ({c.evaluationStatus})
                  </option>
                ))}
              </select>

              {/* Selected creative summary */}
              {selectedCreative && (
                <div className="mt-4 space-y-3">
                  {selectedCreative.thumbnailUrl && (
                    <div className="overflow-hidden rounded-lg border border-slate-700">
                      <img
                        src={selectedCreative.thumbnailUrl}
                        alt={selectedCreative.creativeName ?? "Source creative"}
                        className="h-auto w-full max-h-48 object-contain bg-slate-950"
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    <div className="rounded-lg bg-slate-800/60 px-3 py-2">
                      <p className="text-slate-500">CTR</p>
                      <p className="font-medium text-slate-200">{selectedCreative.avgCtr.toFixed(2)}%</p>
                    </div>
                    <div className="rounded-lg bg-slate-800/60 px-3 py-2">
                      <p className="text-slate-500">Frequency</p>
                      <p className="font-medium text-slate-200">
                        {selectedCreative.avgFrequency?.toFixed(1) ?? "—"}x
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-800/60 px-3 py-2">
                      <p className="text-slate-500">ROAS (CRM)</p>
                      <p className="font-medium text-slate-200">
                        {selectedCreative.campaignRoas?.toFixed(2) ?? "—"}x
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-800/60 px-3 py-2">
                      <p className="text-slate-500">Status</p>
                      <Badge variant={evalVariant(selectedCreative.evaluationStatus)}>
                        {selectedCreative.evaluationStatus}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    {selectedCreative.clientName} · {selectedCreative.campaignName} · ${Math.round(selectedCreative.spend)} spend
                  </p>
                </div>
              )}
            </>
          )}
        </SectionCard>

        {/* Variation settings */}
        <SectionCard title="Variation Settings">
          {/* Intent selector */}
          <label htmlFor="intent-select" className="mb-2 block text-xs font-medium text-slate-400">
            Variation Intent
          </label>
          <select
            id="intent-select"
            value={selectedIntent}
            onChange={(e) => handleChangeIntent(e.target.value as ImageVariationIntent)}
            className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm
              text-slate-100 focus:border-emerald-600 focus:outline-none"
          >
            {INTENT_OPTIONS.map(([key, info]) => (
              <option key={key} value={key}>{info.label}</option>
            ))}
          </select>
          <p className="mb-4 text-xs text-slate-500">
            {IMAGE_VARIATION_INTENTS[selectedIntent].description}
          </p>

          {/* Trigger type */}
          <label htmlFor="trigger-select" className="mb-2 block text-xs font-medium text-slate-400">
            Trigger Type
          </label>
          <div className="mb-4 flex flex-wrap gap-2">
            {TRIGGER_OPTIONS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setSelectedTrigger(t.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedTrigger === t.value
                    ? "bg-emerald-700 text-white"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Candidate count */}
          <label htmlFor="count-select" className="mb-2 block text-xs font-medium text-slate-400">
            Number of Candidates
          </label>
          <div className="mb-4 flex gap-2">
            {[3, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCandidateCount(n)}
                className={`rounded-lg px-4 py-1.5 text-xs font-medium transition-colors ${
                  candidateCount === n
                    ? "bg-emerald-700 text-white"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                }`}
              >
                {n} variations
              </button>
            ))}
          </div>

          {/* Generate button */}
          <ActionButton
            variant="primary"
            size="lg"
            className="w-full sm:w-auto"
            disabled={!selectedCreativeId || genPending}
            onClick={handleGenerate}
          >
            {genPending ? "Generating..." : `Generate ${candidateCount} Image Variations`}
          </ActionButton>
        </SectionCard>
      </div>

      {/* ── Error banner ─────────────────────────────────────────────── */}
      {errorMsg && (
        <div className="rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">
          {errorMsg}
        </div>
      )}

      {/* ── Action message ───────────────────────────────────────────── */}
      {actionMsg && (
        <div className="rounded-lg border border-emerald-700 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">
          {actionMsg}
        </div>
      )}

      {/* ── Generation summary ───────────────────────────────────────── */}
      {summary && (
        <SectionCard
          title="Generation Summary"
          actions={<Badge variant={statusVariant(candidates.length > 0 ? "completed" : "failed")}>
            {candidates.length} candidates
          </Badge>}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Intent" value={summary.intentLabel} />
            <StatCard label="Provider" value={summary.provider} />
            <StatCard label="Data Quality" value={summary.dataQuality} />
            <StatCard label="Latency" value={summary.latencyMs ? `${summary.latencyMs}ms` : "—"} />
          </div>
          {summary.warnings.length > 0 && (
            <div className="mt-3 space-y-1">
              {summary.warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-400">⚠ {w}</p>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* ── Generated candidates ─────────────────────────────────────── */}
      {candidates.length > 0 && (
        <SectionCard
          title="Generated Image Variation Candidates"
          description="Each candidate is a structured image concept brief tied to the source creative and performance context."
        >
          {/* Desktop: grid, Mobile: stack */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {candidates.map((c, idx) => (
              <CandidateCard key={c.id} candidate={c} index={idx} />
            ))}
          </div>

          {/* Action buttons */}
          <div className="mt-6 flex flex-wrap gap-3">
            <ActionButton
              variant="primary"
              onClick={handleGenerateMore}
              disabled={genPending}
            >
              {genPending ? "Generating..." : "Generate More Like This"}
            </ActionButton>
            <ActionButton
              variant="secondary"
              onClick={handleSave}
              disabled={savePending || !lastRequestId}
            >
              {savePending ? "Saving..." : "Save Candidates"}
            </ActionButton>
            <ActionButton
              variant="secondary"
              onClick={handleSendToReview}
              disabled={reviewPending || !lastRequestId}
            >
              {reviewPending ? "Sending..." : "Send to Review"}
            </ActionButton>
            <ActionButton
              variant="ghost"
              onClick={() => {
                setResult(null);
                setActionMsg(null);
              }}
            >
              Clear Results
            </ActionButton>
          </div>
        </SectionCard>
      )}

      {/* ── Recent history ───────────────────────────────────────────── */}
      {recentHistory.length > 0 && (
        <SectionCard title="Recent Generations" description="Last 5 image variation generation runs.">
          {/* Mobile: cards */}
          <div className="space-y-3 sm:hidden">
            {recentHistory.map((h) => (
              <div key={h.id} className="rounded-lg border border-slate-800 bg-slate-900/30 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-200">
                    {IMAGE_VARIATION_INTENTS[h.variationIntent as ImageVariationIntent]?.label ?? h.variationIntent}
                  </span>
                  <Badge variant={statusVariant(h.status)}>{h.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {h.candidateCount} candidates · {h.provider} · {new Date(h.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-xs font-semibold uppercase tracking-widest text-slate-500">
                  <th className="py-2 text-left">Intent</th>
                  <th className="py-2 text-left">Trigger</th>
                  <th className="py-2 text-left">Status</th>
                  <th className="py-2 text-right">Candidates</th>
                  <th className="py-2 text-left">Provider</th>
                  <th className="py-2 text-left">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {recentHistory.map((h) => (
                  <tr key={h.id} className="text-slate-300 hover:bg-slate-800/40">
                    <td className="py-2 text-slate-100">
                      {IMAGE_VARIATION_INTENTS[h.variationIntent as ImageVariationIntent]?.label ?? h.variationIntent}
                    </td>
                    <td className="py-2 text-slate-400 capitalize">{h.triggerType}</td>
                    <td className="py-2">
                      <Badge variant={statusVariant(h.status)}>{h.status}</Badge>
                    </td>
                    <td className="py-2 text-right text-slate-400">{h.candidateCount}</td>
                    <td className="py-2 text-slate-400">{h.provider}</td>
                    <td className="py-2 text-slate-400">{new Date(h.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* ── Navigation links ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/creative-lab/image-variations/review"
          className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors"
        >
          Open Review Queue →
        </Link>
        <Link
          href="/creative-lab/image-variations/selection"
          className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors"
        >
          Score &amp; Select →
        </Link>
        <Link
          href="/creative-lab"
          className="ml-auto text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          ← Back to Creative Lab
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Candidate card component
// ---------------------------------------------------------------------------

function CandidateCard({
  candidate,
  index,
}: {
  candidate: ImageVariationCandidate;
  index:     number;
}) {
  const [expanded, setExpanded] = useState(false);
  const intentInfo = IMAGE_VARIATION_INTENTS[candidate.intent];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-white leading-tight">
          {candidate.title}
        </h3>
        <Badge variant="neutral">{intentInfo?.label ?? candidate.intent}</Badge>
      </div>

      {/* Image placeholder */}
      {candidate.imageUrl ? (
        <div className="overflow-hidden rounded-lg border border-slate-700">
          <img
            src={candidate.imageUrl}
            alt={candidate.title}
            className="h-auto w-full max-h-48 object-contain bg-slate-950"
          />
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-950/50">
          <p className="text-xs text-slate-600">Brief only — no image generated</p>
        </div>
      )}

      {/* Concept summary */}
      <div>
        <p className="text-xs font-medium text-slate-400 mb-1">Concept</p>
        <p className={`text-xs text-slate-300 leading-relaxed ${
          !expanded && candidate.conceptSummary.length > 120 ? "line-clamp-3" : ""
        }`}>
          {candidate.conceptSummary}
        </p>
        {candidate.conceptSummary.length > 120 && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="mt-1 text-xs text-emerald-500 hover:text-emerald-400"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>

      {/* Visual changes */}
      <div>
        <p className="text-xs font-medium text-slate-400 mb-1">Visual Changes</p>
        <p className="text-xs text-slate-400 leading-relaxed">{candidate.visualChanges}</p>
      </div>

      {/* Goal */}
      <div>
        <p className="text-xs font-medium text-slate-400 mb-1">Goal</p>
        <p className="text-xs text-slate-300">{candidate.goal}</p>
      </div>

      {/* DR angle */}
      <div>
        <p className="text-xs font-medium text-slate-400 mb-1">Direct Response Angle</p>
        <p className="text-xs text-slate-400">{candidate.directResponseAngle}</p>
      </div>

      {/* Performance signal */}
      <div className="rounded-lg bg-slate-800/40 px-3 py-2">
        <p className="text-xs text-slate-500">{candidate.performanceSignal}</p>
      </div>

      {/* Status */}
      <div className="flex items-center justify-between">
        <Badge variant={candidate.status === "saved" ? "success" : candidate.status === "sent_to_review" ? "warning" : "neutral"}>
          {candidate.status.replace(/_/g, " ")}
        </Badge>
        {candidate.sourceCreativeId && (
          <span className="text-xs text-slate-600 truncate max-w-[120px]">
            Source: {candidate.sourceCreativeId.slice(0, 12)}...
          </span>
        )}
      </div>
    </div>
  );
}
