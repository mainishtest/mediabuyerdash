"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { PageHeader }   from "../../../../components/ui/PageHeader";
import { SectionCard }  from "../../../../components/ui/SectionCard";
import { Badge }        from "../../../../components/ui/Badge";
import { ActionButton } from "../../../../components/ui/ActionButton";
import {
  analyzeCreativeImageAction,
  generateConceptsAction,
  updateConceptApprovalAction,
  generateConceptImageAction,
  generateAllConceptImagesAction,
} from "../actions";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ImageData {
  id:          string;
  fileName:    string;
  mimeType:    string;
  fileSize:    number;
  storagePath: string;
  uploadedAt:  Date;
}

interface AnalysisData {
  analysisStatus:             string;
  analysisEngine:             string;
  detectedStyle:              string | null;
  dominantMessage:            string | null;
  visualTheme:                string | null;
  clarityScore:               number | null;
  attentionScore:             number | null;
  directResponseObservations: string[];
}

interface ConceptData {
  id:                  string;
  title:               string;
  conceptSummary:      string;
  visualChanges:       string;
  goal:                string;
  directResponseAngle: string | null;
  approvalStatus:      string;
  generationStatus:    string;
  generatedImagePath:  string | null;
  generationError:     string | null;
}

interface Props {
  image:    ImageData;
  analysis: AnalysisData | null;
  concepts: ConceptData[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fileSizeLabel(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function scoreColor(score: number | null): string {
  if (score === null) return "text-slate-500";
  if (score >= 8) return "text-emerald-400";
  if (score >= 6) return "text-amber-400";
  return "text-rose-400";
}

function scoreBg(score: number | null): string {
  if (score === null) return "bg-slate-800";
  if (score >= 8) return "bg-emerald-950/60 border-emerald-800/40";
  if (score >= 6) return "bg-amber-950/60 border-amber-800/40";
  return "bg-rose-950/60 border-rose-800/40";
}

function analysisVariant(status: string): "success" | "warning" | "neutral" {
  if (status === "completed") return "success";
  if (status === "pending")   return "warning";
  return "neutral";
}

function approvalVariant(status: string): "success" | "danger" | "neutral" {
  if (status === "approved") return "success";
  if (status === "rejected") return "danger";
  return "neutral";
}

function humanStyle(s: string | null): string {
  if (!s) return "—";
  return s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Score gauge ────────────────────────────────────────────────────────────────

function ScoreGauge({ label, score }: { label: string; score: number | null }) {
  const pct = score !== null ? (score / 10) * 100 : 0;
  return (
    <div className={`flex flex-col gap-2 rounded-xl border p-4 ${scoreBg(score)}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400">{label}</span>
        <span className={`text-xl font-bold ${scoreColor(score)}`}>
          {score !== null ? `${score}/10` : "—"}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-700/60">
        <div
          className={`h-full rounded-full transition-all ${
            score !== null && score >= 8 ? "bg-emerald-400" :
            score !== null && score >= 6 ? "bg-amber-400" :
            "bg-rose-400"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Concept card ───────────────────────────────────────────────────────────────

function generationStatusLabel(status: string): string {
  switch (status) {
    case "generating": return "Generating…";
    case "completed":  return "Generated";
    case "failed":     return "Failed";
    default:           return "Not generated";
  }
}

function generationBadgeVariant(status: string): "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "generating": return "warning";
    case "completed":  return "success";
    case "failed":     return "danger";
    default:           return "neutral";
  }
}

function ConceptCard({
  concept,
  imageId,
  onStatusChange,
  onConceptUpdate,
}: {
  concept:        ConceptData;
  imageId:        string;
  onStatusChange: (id: string, status: "approved" | "rejected" | "draft") => void;
  onConceptUpdate: (id: string, updates: Partial<ConceptData>) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [isGenerating, startGenerateTransition] = useTransition();

  function setStatus(status: "approved" | "rejected" | "draft") {
    startTransition(async () => {
      await updateConceptApprovalAction(concept.id, status, imageId);
      onStatusChange(concept.id, status);
    });
  }

  function handleGenerateImage() {
    onConceptUpdate(concept.id, { generationStatus: "generating", generationError: null });
    startGenerateTransition(async () => {
      const result = await generateConceptImageAction(concept.id, imageId);
      if (result.success && result.imagePath) {
        onConceptUpdate(concept.id, {
          generationStatus: "completed",
          generatedImagePath: result.imagePath,
          generationError: null,
        });
      } else {
        onConceptUpdate(concept.id, {
          generationStatus: "failed",
          generationError: result.error ?? "Generation failed",
        });
      }
    });
  }

  const approved = concept.approvalStatus === "approved";
  const rejected = concept.approvalStatus === "rejected";
  const hasImage = concept.generationStatus === "completed" && concept.generatedImagePath;
  const isGen    = concept.generationStatus === "generating" || isGenerating;

  return (
    <div
      className={`flex flex-col gap-4 rounded-xl border p-5 transition-colors ${
        approved ? "border-emerald-800/60 bg-emerald-950/20" :
        rejected ? "border-slate-800 bg-slate-900/20 opacity-60" :
        "border-slate-800 bg-slate-900/40"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">{concept.title}</h3>
          {concept.directResponseAngle && (
            <p className="mt-0.5 text-xs text-slate-500 capitalize">{concept.directResponseAngle}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={generationBadgeVariant(concept.generationStatus)}>
            {generationStatusLabel(concept.generationStatus)}
          </Badge>
          <Badge variant={approvalVariant(concept.approvalStatus)}>
            {concept.approvalStatus}
          </Badge>
        </div>
      </div>

      {/* Generated image preview */}
      {hasImage && (
        <div className="relative h-48 overflow-hidden rounded-lg bg-slate-800">
          <Image
            src={concept.generatedImagePath!}
            alt={concept.title}
            fill
            className="object-contain"
            unoptimized
          />
        </div>
      )}

      {/* Generating spinner */}
      {isGen && (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-800/50">
          <div className="text-center">
            <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-emerald-400" />
            <p className="text-xs text-slate-400">Generating image…</p>
          </div>
        </div>
      )}

      {/* Generation error */}
      {concept.generationStatus === "failed" && concept.generationError && (
        <div className="rounded-lg border border-rose-800/40 bg-rose-950/20 px-3 py-2 text-xs text-rose-400">
          {concept.generationError}
        </div>
      )}

      {/* Body */}
      <div className="space-y-3 text-sm">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500">Concept</p>
          <p className="text-slate-300 leading-relaxed">{concept.conceptSummary}</p>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500">Visual Changes</p>
          <p className="text-slate-400 leading-relaxed">{concept.visualChanges}</p>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500">Goal</p>
          <p className="text-slate-400 leading-relaxed">{concept.goal}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {/* Generate / regenerate image */}
        {!isGen && (
          <ActionButton
            size="sm"
            variant={hasImage ? "ghost" : "secondary"}
            disabled={isPending || isGenerating}
            onClick={handleGenerateImage}
          >
            {hasImage ? "Regenerate Image" : concept.generationStatus === "failed" ? "Retry Image" : "Generate Image"}
          </ActionButton>
        )}
        {!approved && (
          <ActionButton
            size="sm"
            variant="primary"
            disabled={isPending}
            onClick={() => setStatus("approved")}
          >
            {isPending ? "Saving…" : "Approve"}
          </ActionButton>
        )}
        {!rejected && (
          <ActionButton
            size="sm"
            variant="danger"
            disabled={isPending}
            onClick={() => setStatus("rejected")}
          >
            {isPending ? "Saving…" : "Reject"}
          </ActionButton>
        )}
        {(approved || rejected) && (
          <ActionButton
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={() => setStatus("draft")}
          >
            Reset to Draft
          </ActionButton>
        )}
      </div>
    </div>
  );
}

// ── Why These Iterations section ───────────────────────────────────────────────

function WhyIterationsSection({ analysis }: { analysis: AnalysisData | null }) {
  const reasons = analysis
    ? [
        {
          heading: "Analysis-driven angle selection",
          body: `Each concept targets a specific direct-response weakness identified during analysis. Your creative was classified as "${humanStyle(analysis.detectedStyle)}" with a dominant message of "${analysis.dominantMessage ?? "general product"}", so the iteration angles are tailored to that format and message type.`,
        },
        {
          heading: "Score-based prioritisation",
          body: `Clarity scored ${analysis.clarityScore ?? "—"}/10 and attention scored ${analysis.attentionScore ?? "—"}/10. Iteration concepts are designed to improve the weaker dimension first — for example, an offer-clarity variant addresses low clarity, while an emotion-led or high-contrast variant addresses low attention.`,
        },
        {
          heading: "Facebook direct-response best practices",
          body: "All iteration concepts follow Facebook DR creative principles: offer visibility within 1–2 seconds, single focal point, mobile-legible type, and a visible CTA. Each concept isolates one variable so the effect of the change can be measured cleanly.",
        },
        {
          heading: "Deterministic seeding (v1 engine)",
          body: "In the current v1 engine, concept selection is deterministic per image — the same image always generates the same 3 angles. This means re-running concept generation will replace only draft concepts (approved or rejected concepts are preserved).",
        },
      ]
    : [
        {
          heading: "Run analysis first",
          body: "Iteration concepts are generated based on analysis results. Analyse the image first to see why specific iteration angles were recommended.",
        },
      ];

  return (
    <SectionCard
      title="Why These Iterations Were Suggested"
      description="Understanding the reasoning behind each concept variant."
    >
      <div className="space-y-4">
        {reasons.map((r) => (
          <div key={r.heading} className="flex gap-3">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-xs font-bold text-slate-400">
              ?
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">{r.heading}</p>
              <p className="mt-1 text-sm text-slate-400 leading-relaxed">{r.body}</p>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// ── Main view ──────────────────────────────────────────────────────────────────

export function ImageDetailView({ image, analysis: initialAnalysis, concepts: initialConcepts }: Props) {
  const [analysis,  setAnalysis]  = useState(initialAnalysis);
  const [concepts,  setConcepts]  = useState(initialConcepts);
  const [analysisPending, startAnalysisTransition]  = useTransition();
  const [conceptsPending, startConceptsTransition]  = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAnalyze() {
    setError(null);
    startAnalysisTransition(async () => {
      const result = await analyzeCreativeImageAction(image.id);
      if (!result.success) {
        setError(result.error ?? "Analysis failed.");
      }
      // Page will re-render via revalidatePath — but for instant feedback
      // we refresh by reloading
      if (result.success) window.location.reload();
    });
  }

  function handleGenerateConcepts() {
    setError(null);
    startConceptsTransition(async () => {
      const result = await generateConceptsAction(image.id);
      if (!result.success) {
        setError(result.error ?? "Concept generation failed.");
      }
      if (result.success) window.location.reload();
    });
  }

  function handleConceptStatusChange(id: string, status: "approved" | "rejected" | "draft") {
    setConcepts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, approvalStatus: status } : c))
    );
  }

  function handleConceptUpdate(id: string, updates: Partial<ConceptData>) {
    setConcepts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  }

  const [genAllPending, startGenAllTransition] = useTransition();

  function handleGenerateAllImages() {
    setError(null);
    startGenAllTransition(async () => {
      const result = await generateAllConceptImagesAction(image.id);
      if (!result.success) {
        setError(result.error ?? "Batch generation failed.");
      }
      if (result.generated > 0 || result.failed > 0) {
        window.location.reload();
      }
    });
  }

  const hasAnalysis  = analysis !== null && analysis.analysisStatus === "completed";
  const hasConcepts  = concepts.length > 0;
  const approvedCount = concepts.filter((c) => c.approvalStatus === "approved").length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6 sm:px-6 sm:py-8">

      <PageHeader
        title={image.fileName}
        description={`${fileSizeLabel(image.fileSize)} · ${image.mimeType} · Uploaded ${new Date(image.uploadedAt).toLocaleDateString()}`}
        badge={
          analysis
            ? <Badge variant={analysisVariant(analysis.analysisStatus)}>{analysis.analysisStatus}</Badge>
            : <Badge variant="neutral">Not analysed</Badge>
        }
        actions={
          <Link href="/creative-lab/images">
            <ActionButton size="sm" variant="ghost">
              ← All Images
            </ActionButton>
          </Link>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Top layout: image + analysis side by side on desktop */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Image preview */}
        <SectionCard title="Creative Preview">
          <div className="relative min-h-[280px] overflow-hidden rounded-lg bg-slate-800">
            <Image
              src={image.storagePath}
              alt={image.fileName}
              fill
              className="object-contain"
              unoptimized
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="capitalize">{humanStyle(analysis?.detectedStyle ?? null)}</span>
            {analysis?.visualTheme && (
              <span className="capitalize">{analysis.visualTheme.replace(/-/g, " ")} theme</span>
            )}
            {analysis?.dominantMessage && (
              <span>{analysis.dominantMessage}</span>
            )}
          </div>
        </SectionCard>

        {/* Analysis panel */}
        <div className="flex flex-col gap-4">
          {hasAnalysis ? (
            <>
              {/* Scores */}
              <div className="grid grid-cols-2 gap-3">
                <ScoreGauge label="Clarity Score"   score={analysis!.clarityScore} />
                <ScoreGauge label="Attention Score" score={analysis!.attentionScore} />
              </div>

              {/* Observations */}
              <SectionCard title="Direct-Response Observations">
                <ul className="space-y-2">
                  {analysis!.directResponseObservations.map((obs, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="mt-1 block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                      {obs}
                    </li>
                  ))}
                </ul>
              </SectionCard>
            </>
          ) : (
            <SectionCard
              title="Creative Analysis"
              description="Run analysis to get clarity and attention scores and direct-response observations."
            >
              <p className="mb-4 text-sm text-slate-400">
                Analysis identifies creative strengths and weaknesses against Facebook direct-response
                best practices, scores the image on clarity and attention, and prepares data for
                iteration concept generation.
              </p>
              <ActionButton
                variant="primary"
                disabled={analysisPending}
                onClick={handleAnalyze}
              >
                {analysisPending ? "Analysing…" : "Run Analysis"}
              </ActionButton>
            </SectionCard>
          )}

          {/* Re-analyse / generate concepts actions */}
          <div className="flex flex-wrap gap-2">
            {hasAnalysis && (
              <ActionButton
                size="sm"
                variant="secondary"
                disabled={analysisPending}
                onClick={handleAnalyze}
              >
                {analysisPending ? "Analysing…" : "Re-analyse"}
              </ActionButton>
            )}
            <ActionButton
              size="sm"
              variant={hasConcepts ? "secondary" : "primary"}
              disabled={conceptsPending}
              onClick={handleGenerateConcepts}
            >
              {conceptsPending
                ? "Generating…"
                : hasConcepts
                ? "Regenerate Concepts"
                : "Generate Iteration Concepts"}
            </ActionButton>
          </div>
        </div>
      </div>

      {/* Iteration concepts */}
      {hasConcepts && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
              Iteration Concepts
            </h2>
            <div className="flex items-center gap-3">
              {concepts.some((c) => c.generationStatus === "pending" || c.generationStatus === "failed") && (
                <ActionButton
                  size="sm"
                  variant="secondary"
                  disabled={genAllPending}
                  onClick={handleGenerateAllImages}
                >
                  {genAllPending ? "Generating…" : "Generate All Images"}
                </ActionButton>
              )}
              {approvedCount > 0 && (
                <Badge variant="success">{approvedCount} approved</Badge>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {concepts.map((concept) => (
              <ConceptCard
                key={concept.id}
                concept={concept}
                imageId={image.id}
                onStatusChange={handleConceptStatusChange}
                onConceptUpdate={handleConceptUpdate}
              />
            ))}
          </div>
        </section>
      )}

      {/* Why These Iterations */}
      <WhyIterationsSection analysis={analysis} />
    </div>
  );
}
