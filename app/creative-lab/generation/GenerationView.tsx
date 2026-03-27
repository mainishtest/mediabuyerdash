"use client";

// app/creative-lab/generation/GenerationView.tsx
// Main client orchestrator for the AI creative generation page.
//
// Responsive layout:
//   Mobile:  stacked — brief summary (collapsed) → mode selector → generate btn → variants
//   Desktop: left panel (brief context + mode selector + job history) |
//            right panel (generated variants + rationale + review actions)
//
// State flow:
//   1. Mode selected (defaults to inferred mode from brief draftType)
//   2. "Generate AI Drafts" → POST /api/creative-lab/generation
//   3. Variants rendered with AI badge + review controls
//   4. Review decision → PATCH /api/creative-lab/briefs/[id]
//   5. "Return to Brief" → /creative-lab/briefs

import { useState, useCallback, useMemo } from "react";
import Link                               from "next/link";
import type {
  CreativeBrief,
  CreativeDraftVariant,
  CreativeReviewDecision,
}                                         from "../../../types/creativeBrief";
import type {
  CreativeGenerationMode,
  CreativeGenerationJob,
}                                         from "../../../types/creativeGeneration";
import { GENERATION_MODE_INFO }           from "../../../types/creativeGeneration";
import {
  PageHeader,
  SectionCard,
  Badge,
  EmptyState,
  StatCard,
}                                         from "../../../components/ui";
import {
  DRAFT_TYPE_LABEL,
  INTENT_LABEL,
  STATUS_VARIANT,
  STATUS_LABEL,
}                                         from "../briefs/BriefCard";
import { formatCurrency }                 from "../../../lib/metricUtils";
import { GenerationModeSelector }         from "./GenerationModeSelector";
import { GeneratedVariantCard }           from "./GeneratedVariantCard";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function draftTypeToMode(draftType: CreativeBrief["draftType"]): CreativeGenerationMode {
  switch (draftType) {
    case "copy_variation":    return "copy_variations";
    case "headline_variation": return "headline_variations";
    case "angle_variation":   return "angle_variations";
    case "image_brief":       return "image_brief_variations";
    case "full_refresh_brief": return "full_refresh_package";
    default:                  return "copy_variations";
  }
}

// ---------------------------------------------------------------------------
// Brief summary panel (collapsed-friendly)
// ---------------------------------------------------------------------------

function BriefSummaryPanel({ brief }: { brief: CreativeBrief }) {
  const [expanded, setExpanded] = useState(false);
  const pc = brief.input;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[brief.status]}>{STATUS_LABEL[brief.status]}</Badge>
          <span className="text-xs font-semibold text-slate-300 truncate max-w-[180px]">
            {brief.creativeName ?? brief.campaignName ?? brief.clientName}
          </span>
        </div>
        <span className="text-xs text-slate-600 shrink-0">{expanded ? "▲" : "▼"} brief</span>
      </button>

      {expanded && (
        <div className="border-t border-slate-800 px-4 pb-4 pt-3 space-y-4">
          {/* Metrics */}
          <div className="grid grid-cols-2 gap-x-2 gap-y-2 sm:gap-x-4">
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

          {/* Intent + draft type */}
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-400">
              {INTENT_LABEL[brief.intent]}
            </span>
            <span className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-400">
              {DRAFT_TYPE_LABEL[brief.draftType]}
            </span>
          </div>

          {/* Priority reason */}
          {pc.priorityReason && (
            <p className="text-xs text-slate-500 leading-relaxed">{pc.priorityReason}</p>
          )}

          <p className="text-xs text-slate-700">ROAS sourced from CRM — not Meta self-reported.</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Job history row
// ---------------------------------------------------------------------------

function JobHistoryRow({ job }: { job: CreativeGenerationJob }) {
  const statusColor =
    job.status === "completed" ? "text-emerald-400" :
    job.status === "failed"    ? "text-rose-400"    :
    "text-amber-400";

  const providerLabel =
    job.provider === "anthropic_text" ? "Claude AI" :
    job.provider === "mock"           ? "Mock"       :
    job.provider;

  return (
    <div className="flex items-center justify-between py-1.5 text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`shrink-0 font-medium ${statusColor}`}>
          {job.status === "completed" ? "✓" : job.status === "failed" ? "✗" : "⋯"}
        </span>
        <span className="truncate text-slate-400">
          {job.mode.replace(/_/g, " ")}
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0 text-slate-600">
        <span>{providerLabel}</span>
        {job.variantCount > 0 && <span>{job.variantCount} outputs</span>}
        <span>{new Date(job.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  brief:        CreativeBrief;
  initialJobs:  CreativeGenerationJob[];
};

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function GenerationView({ brief, initialJobs }: Props) {
  const defaultMode = useMemo(() => draftTypeToMode(brief.draftType), [brief.draftType]);

  const [mode, setMode]             = useState<CreativeGenerationMode>(defaultMode);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError]     = useState<string | null>(null);
  const [rationale, setRationale]   = useState<string | null>(null);
  const [provider, setProvider]     = useState<string>("mock");
  const [variants, setVariants]     = useState<CreativeDraftVariant[]>([]);
  const [jobs, setJobs]             = useState<CreativeGenerationJob[]>(initialJobs);
  const [hasGenerated, setHasGenerated] = useState(false);

  // ── Generate ──────────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async (regenerate = false) => {
    if (generating) return;
    setGenerating(true);
    setGenError(null);

    try {
      const res  = await fetch("/api/creative-lab/generation", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ briefId: brief.id, mode, regenerate }),
      });
      const data = await res.json();

      if (!data.ok) {
        setGenError(data.error ?? "Generation failed — try again.");
        return;
      }

      setVariants(data.variants ?? []);
      setRationale(data.rationale ?? null);
      setProvider(data.provider ?? "unknown");
      setHasGenerated(true);

      // Prepend new job to history
      setJobs((prev) => [
        {
          id:           data.jobId,
          briefId:      brief.id,
          mode,
          provider:     data.provider,
          status:       "completed",
          variantCount: data.variantCount,
          tokensUsed:   data.tokensUsed,
          latencyMs:    data.latencyMs,
          errorMessage: null,
          createdAt:    data.generatedAt,
          completedAt:  data.generatedAt,
        },
        ...prev,
      ]);
    } catch {
      setGenError("Network error — check your connection and try again.");
    } finally {
      setGenerating(false);
    }
  }, [generating, brief.id, mode]);

  // ── Variant review ────────────────────────────────────────────────────────

  const handleVariantReview = useCallback(
    async (variantId: string, decision: CreativeReviewDecision) => {
      // Optimistic update
      setVariants((prev) =>
        prev.map((v) =>
          v.id === variantId
            ? { ...v, reviewDecision: decision, reviewedAt: new Date().toISOString() }
            : v
        ),
      );

      await fetch(`/api/creative-lab/briefs/${encodeURIComponent(brief.id)}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "variant", variantId, reviewDecision: decision }),
      }).catch((err) => console.error("[generation variant review]", err));
    },
    [brief.id],
  );

  // ── Discard ───────────────────────────────────────────────────────────────

  const handleDiscard = useCallback(() => {
    setVariants([]);
    setRationale(null);
    setHasGenerated(false);
    setGenError(null);
  }, []);

  // ── Stats ─────────────────────────────────────────────────────────────────

  const reviewed = variants.filter((v) => v.reviewDecision !== null).length;
  const approved = variants.filter((v) => v.reviewDecision === "approve").length;

  const modeInfo = GENERATION_MODE_INFO[mode];

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <PageHeader
        title="Generate AI Drafts"
        description="Turn your creative brief into ready-to-review AI-generated variants."
        badge={<Badge variant="purple">AI Generation</Badge>}
        actions={
          <Link
            href={`/creative-lab/briefs?clientId=${encodeURIComponent(brief.clientAccountId)}`}
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm
              font-medium text-slate-200 transition-colors hover:bg-slate-700"
          >
            ← Return to Brief
          </Link>
        }
      />

      {/* ── Responsive layout ── */}
      <div className="grid gap-6 lg:grid-cols-12">

        {/* ── Left panel: brief context + mode selector + history ── */}
        <div className="space-y-5 lg:col-span-4">

          {/* Brief summary */}
          <SectionCard title="Source Brief">
            <BriefSummaryPanel brief={brief} />

            {/* Navigation */}
            <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-slate-800/60">
              <Link
                href={`/creative-lab/briefs?clientId=${encodeURIComponent(brief.clientAccountId)}`}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                ↗ Brief detail
              </Link>
              <Link
                href={`/creative-lab/refresh-queue?clientId=${encodeURIComponent(brief.clientAccountId)}`}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                ↗ Refresh queue
              </Link>
              {brief.campaignId && (
                <Link
                  href={`/optimization?clientId=${encodeURIComponent(brief.clientAccountId)}`}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  ↗ Campaign
                </Link>
              )}
            </div>
          </SectionCard>

          {/* Mode selector */}
          <SectionCard
            title="Generation Mode"
            description="Select what type of creative output to generate."
          >
            <GenerationModeSelector
              selected={mode}
              onChange={setMode}
              disabled={generating}
            />
          </SectionCard>

          {/* Job history */}
          {jobs.length > 0 && (
            <SectionCard title="Generation History" description={`${jobs.length} run${jobs.length !== 1 ? "s" : ""} for this brief`}>
              <div className="divide-y divide-slate-800/60">
                {jobs.slice(0, 8).map((job) => (
                  <JobHistoryRow key={job.id} job={job} />
                ))}
              </div>
            </SectionCard>
          )}

        </div>

        {/* ── Right panel: generate controls + output variants ── */}
        <div className="space-y-5 lg:col-span-8">

          {/* Generate controls */}
          <SectionCard>
            <div className="space-y-4">
              {/* Mode summary */}
              <div>
                <p className="text-sm font-semibold text-slate-200">{modeInfo.label}</p>
                <p className="mt-0.5 text-xs text-slate-500">{modeInfo.description}</p>
              </div>

              {/* Error state */}
              {genError && (
                <div className="rounded-xl border border-rose-800/50 bg-rose-950/20 px-4 py-3">
                  <p className="text-xs text-rose-300">{genError}</p>
                </div>
              )}

              {/* Generate button row */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => handleGenerate(false)}
                  disabled={generating}
                  className="flex-1 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-medium
                    text-white transition-colors hover:bg-indigo-500 active:scale-95
                    disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {generating
                    ? "Generating…"
                    : hasGenerated
                    ? "Generate More Like This"
                    : `Generate ${modeInfo.label}`
                  }
                </button>

                {hasGenerated && (
                  <button
                    onClick={() => handleGenerate(true)}
                    disabled={generating}
                    className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm
                      font-medium text-slate-200 hover:bg-slate-700 active:scale-95
                      disabled:opacity-50"
                  >
                    Regenerate
                  </button>
                )}

                {hasGenerated && (
                  <Link
                    href={`/creative-lab/review?briefId=${encodeURIComponent(brief.id)}`}
                    className="rounded-xl border border-sky-700/50 bg-sky-950/20 px-4 py-3 text-sm
                      font-medium text-sky-200 hover:bg-sky-950/40 active:scale-95 transition-colors"
                  >
                    ◈ Score &amp; Review
                  </Link>
                )}
              </div>

              {/* Generating pulse */}
              {generating && (
                <div className="rounded-xl border border-indigo-800/40 bg-indigo-950/20 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="animate-pulse text-indigo-400">◉</span>
                    <p className="text-xs text-indigo-300">
                      Generating {modeInfo.outputCount} {modeInfo.label.toLowerCase()}…
                    </p>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Rationale */}
          {rationale && (
            <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 px-4 py-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-600">
                Generation Rationale
              </p>
              <p className="text-xs leading-relaxed text-slate-400">{rationale}</p>
              {provider && (
                <p className="mt-2 text-xs text-slate-600">
                  Provider:&nbsp;
                  <span className={provider === "anthropic_text" ? "text-indigo-400" : "text-slate-500"}>
                    {provider === "anthropic_text"          ? "Claude AI (Anthropic)"  :
                     provider === "mock"                    ? "Mock (AI not configured)" :
                     provider === "anthropic_text_fallback" ? "Claude AI — parse fallback" :
                     provider === "mock_fallback"           ? "Mock (network error)"   :
                     provider}
                  </span>
                </p>
              )}
            </div>
          )}

          {/* Variant output */}
          {variants.length > 0 && (
            <SectionCard
              title="Generated Variants"
              description={`${reviewed}/${variants.length} reviewed · ${approved} approved`}
            >
              {/* Variant stats */}
              <div className="mb-4 grid grid-cols-3 gap-3">
                <StatCard label="Generated" value={variants.length} sub="this run" />
                <StatCard label="Reviewed"  value={reviewed}        sub="decisions made" />
                <StatCard label="Approved"  value={approved}        sub="ready" />
              </div>

              {/* Variant cards — responsive grid on desktop */}
              <div className="space-y-3">
                {variants.map((v) => (
                  <GeneratedVariantCard
                    key={v.id}
                    variant={v}
                    provider={provider}
                    onReview={handleVariantReview}
                    briefId={brief.id}
                  />
                ))}
              </div>

              {/* Discard */}
              <div className="mt-4 flex justify-end border-t border-slate-800/60 pt-4">
                <button
                  onClick={handleDiscard}
                  className="text-xs text-slate-600 hover:text-rose-400 transition-colors"
                >
                  Discard this set
                </button>
              </div>
            </SectionCard>
          )}

          {/* Empty state — before first generation */}
          {!hasGenerated && !generating && (
            <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-800">
              <div className="text-center">
                <p className="text-sm text-slate-500">No variants generated yet</p>
                <p className="mt-1 text-xs text-slate-600">
                  Select a mode and click &ldquo;Generate&rdquo; to create AI-powered draft variants
                </p>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Bottom nav */}
      <div className="flex flex-wrap gap-4 border-t border-slate-800/60 pt-4">
        <Link href="/creative-lab"               className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← Creative Lab</Link>
        <Link href="/creative-lab/briefs"        className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Creative Briefs →</Link>
        <Link href="/creative-lab/refresh-queue" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Refresh Queue →</Link>
      </div>
    </div>
  );
}
