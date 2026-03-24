"use client";

// app/creative-lab/creative-engine/CreativeEngineView.tsx
// Performance-Driven AI Creative Generation Engine — main client view.
//
// Responsive layout:
//   Mobile:  stacked — client selector → context panel → generate controls →
//            concept cards (full-width) → variant tabs
//   Desktop: left 4/12 context + controls | right 8/12 concept grid (1–3 col)
//
// Data flow:
//   1. User selects client + creative from snapshot list
//   2. triggerType is auto-derived from evaluationStatus (or manual)
//   3. "Generate" → POST /api/creative-lab/creative-engine
//   4. Response renders: context summary + concept cards + variant cards
//   5. Variant action buttons update local status (saved_draft / sent_to_scoring / etc.)
//   6. "Regenerate" clears and re-triggers generation

import { useState, useCallback, useMemo }    from "react";
import Link                                  from "next/link";
import type { CreativeConcept, CreativeVariant, CreativeGenerationRunSummary } from "../../../types/creativeGeneration";
import type { CreativePerformanceSnapshot }  from "../../../lib/creativelab/types";
import { PageHeader, SectionCard, Badge, EmptyState } from "../../../components/ui";
import { ContextSummaryPanel }               from "./ContextSummaryPanel";
import { ConceptCard }                       from "./ConceptCard";
import { VariantOutputCard }                 from "./VariantOutputCard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ClientOption = { id: string; name: string };

type ContextMeta = {
  clientName:       string;
  evaluationStatus: string;
  fatigueStatus:    string | null;
  dataQuality:      "sparse" | "moderate" | "rich";
  triggerType:      string;
  triggerRationale: string;
  currentCtr:       number;
  currentRoas:      number | null;
  winningPatterns:  number;
  losingPatterns:   number;
  builtAt:          string;
};

type GenerationResult = {
  concepts:  CreativeConcept[];
  variants:  CreativeVariant[];
  summary:   CreativeGenerationRunSummary;
  warnings:  string[];
  context:   ContextMeta;
  provider:  string;
};

type Props = {
  clients:   ClientOption[];
  snapshots: CreativePerformanceSnapshot[];
  selectedClientId:  string | null;
  initialCreativeId?: string | null;
  initialCampaignId?: string | null;
};

// ---------------------------------------------------------------------------
// Trigger type auto-derivation
// ---------------------------------------------------------------------------

function deriveTrigger(
  status: CreativePerformanceSnapshot["evaluationStatus"],
): "fatigue" | "underperformance" | "opportunity" | "manual" {
  if (status === "fatigued") return "fatigue";
  if (status === "strong")   return "opportunity";
  if (status === "weak")     return "underperformance";
  return "manual";
}

const TRIGGER_LABELS: Record<string, string> = {
  fatigue:          "Fatigue",
  underperformance: "Underperformance",
  opportunity:      "Opportunity",
  manual:           "Manual",
};

const EVAL_STYLES: Record<string, string> = {
  strong:            "text-emerald-400",
  average:           "text-slate-300",
  weak:              "text-rose-400",
  fatigued:          "text-amber-400",
  insufficient_data: "text-slate-600",
};

// ---------------------------------------------------------------------------
// Snapshot selector sub-component
// ---------------------------------------------------------------------------

function SnapshotSelector({
  snapshots,
  selectedId,
  onChange,
}: {
  snapshots:  CreativePerformanceSnapshot[];
  selectedId: string | null;
  onChange:   (s: CreativePerformanceSnapshot) => void;
}) {
  if (snapshots.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-800 px-4 py-6 text-center">
        <p className="text-sm text-slate-500">No creative snapshots available for this client.</p>
        <p className="mt-1 text-xs text-slate-600">Sync Meta data and run reconciliation to load creatives.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
      {snapshots.map((s) => {
        const isSelected = s.externalCreativeId === selectedId;
        const trigger    = deriveTrigger(s.evaluationStatus);
        const evalColor  = EVAL_STYLES[s.evaluationStatus] ?? "text-slate-400";

        return (
          <button
            key={s.externalCreativeId}
            onClick={() => onChange(s)}
            className={`w-full rounded-xl border text-left px-3 py-3 transition-colors ${
              isSelected
                ? "border-indigo-700 bg-indigo-950/30"
                : "border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-200 truncate">
                  {s.creativeName ?? s.externalCreativeId}
                </p>
                <p className="text-xs text-slate-500 truncate">{s.campaignName}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`text-xs font-semibold ${evalColor}`}>
                  {s.evaluationStatus}
                </span>
                <span className="text-xs text-slate-600">
                  CTR {s.avgCtr.toFixed(2)}%
                </span>
              </div>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="text-xs text-slate-600">Trigger:</span>
              <span className="text-xs font-medium text-slate-400">{TRIGGER_LABELS[trigger]}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Run summary sub-component
// ---------------------------------------------------------------------------

function RunSummaryBar({ summary, warnings }: { summary: CreativeGenerationRunSummary; warnings: string[] }) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 px-4 py-3 space-y-2">
      <div className="flex flex-wrap gap-4 text-xs">
        <span className="text-slate-400">
          <span className="font-medium text-slate-200">{summary.conceptsGenerated}</span> concepts
        </span>
        <span className="text-slate-400">
          <span className="font-medium text-slate-200">{summary.variantsGenerated}</span> variants
        </span>
        <span className="text-slate-400">
          Data quality: <span className={`font-medium ${
            summary.dataQuality === "rich"     ? "text-emerald-400" :
            summary.dataQuality === "moderate" ? "text-amber-400"   : "text-rose-400"
          }`}>{summary.dataQuality}</span>
        </span>
        <span className="text-slate-400">
          Provider: <span className="font-medium text-slate-300">{summary.provider}</span>
        </span>
      </div>
      {warnings.length > 0 && (
        <div className="space-y-0.5">
          {warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-400">⚠ {w}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function CreativeEngineView({ clients, snapshots, selectedClientId, initialCreativeId, initialCampaignId }: Props) {
  // Auto-select snapshot if creativeId or campaignId provided (from Creative Lab approval flow)
  const autoSnap = useMemo(() => {
    if (!initialCreativeId && !initialCampaignId) return null;
    return snapshots.find((s) =>
      (initialCreativeId && s.externalCreativeId === initialCreativeId) ||
      (initialCampaignId && s.externalCampaignId === initialCampaignId)
    ) ?? null;
  }, [snapshots, initialCreativeId, initialCampaignId]);

  const [clientId,       setClientId]       = useState(
    autoSnap?.clientAccountId ?? selectedClientId ?? clients[0]?.id ?? ""
  );
  const [selectedSnap,   setSelectedSnap]   = useState<CreativePerformanceSnapshot | null>(autoSnap);
  const [generating,     setGenerating]     = useState(false);
  const [genError,       setGenError]       = useState<string | null>(null);
  const [result,         setResult]         = useState<GenerationResult | null>(null);
  const [activeTab,      setActiveTab]      = useState<"concepts" | "variants">("concepts");
  const [variantActions, setVariantActions] = useState<Record<string, CreativeVariant["status"]>>({});
  const fromApproval = !!(initialCreativeId || initialCampaignId);

  // Filter snapshots by selected client
  const clientSnapshots = useMemo(
    () => snapshots.filter((s) => s.clientAccountId === clientId),
    [snapshots, clientId],
  );

  // Auto-select first snapshot when client changes
  const handleClientChange = useCallback((id: string) => {
    setClientId(id);
    setSelectedSnap(null);
    setResult(null);
    setGenError(null);
  }, []);

  const handleSnapChange = useCallback((s: CreativePerformanceSnapshot) => {
    setSelectedSnap(s);
    setResult(null);
    setGenError(null);
  }, []);

  // ── Generate ──────────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!selectedSnap || generating) return;
    setGenerating(true);
    setGenError(null);
    setResult(null);

    const triggerType = deriveTrigger(selectedSnap.evaluationStatus);

    try {
      const res  = await fetch("/api/creative-lab/creative-engine", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          clientAccountId: selectedSnap.clientAccountId,
          snapshot:        selectedSnap,
          mode:            "concepts",
          triggerType,
        }),
      });
      const data = await res.json();

      if (!data.ok) {
        setGenError(data.error ?? "Generation failed — please try again.");
        return;
      }

      setResult({
        concepts: data.concepts  ?? [],
        variants: data.variants  ?? [],
        summary:  data.summary,
        warnings: data.warnings  ?? [],
        context:  data.contextMeta,
        provider: data.summary?.provider ?? "engine",
      });
      setActiveTab("concepts");
    } catch {
      setGenError("Network error — check your connection and try again.");
    } finally {
      setGenerating(false);
    }
  }, [selectedSnap, generating]);

  // ── Variant action handler ─────────────────────────────────────────────────

  const handleVariantAction = useCallback(
    (variantId: string, action: CreativeVariant["status"]) => {
      setVariantActions((prev) => ({ ...prev, [variantId]: action }));
    },
    [],
  );

  // ── Concept action handlers ───────────────────────────────────────────────

  const handleConceptSaveDraft  = useCallback(() => {}, []);
  const handleConceptToScoring  = useCallback(() => {}, []);
  const handleConceptToApproval = useCallback(() => {}, []);

  const selectedClient = clients.find((c) => c.id === clientId);

  return (
    <div className="space-y-6">

      {/* ── Workflow stepper (when coming from approval) ── */}
      {fromApproval && (
        <div className="flex items-center gap-2 rounded-xl border border-indigo-800/40 bg-indigo-950/20 px-4 py-3 text-xs">
          <Link href="/creative-lab" className="text-slate-500 hover:text-slate-300">Approve</Link>
          <span className="text-slate-600">→</span>
          <span className={`rounded-full px-2 py-0.5 font-medium ${
            !result ? "border border-indigo-500 bg-indigo-950/40 text-indigo-300" : "text-emerald-400"
          }`}>
            {result ? "✓ Generated" : "Generate Concepts"}
          </span>
          <span className="text-slate-600">→</span>
          <span className={`${result ? "rounded-full border border-indigo-500 bg-indigo-950/40 px-2 py-0.5 font-medium text-indigo-300" : "text-slate-600"}`}>
            Create Test
          </span>
          <span className="text-slate-600">→</span>
          <span className="text-slate-600">Launch</span>
        </div>
      )}

      {/* ── Header ── */}
      <PageHeader
        title="Creative Engine"
        description="Generate high-quality, performance-grounded creative concepts from real data and learning memory."
        badge={<Badge variant="purple">AI Engine</Badge>}
        actions={
          <Link
            href="/creative-lab"
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm
              font-medium text-slate-200 transition-colors hover:bg-slate-700"
          >
            ← Creative Lab
          </Link>
        }
      />

      {/* ── Responsive layout ── */}
      <div className="grid gap-6 lg:grid-cols-12">

        {/* ── Left panel: client + snapshot selector + generate controls ── */}
        <div className="space-y-5 lg:col-span-4">

          {/* Client selector */}
          {clients.length > 1 && (
            <SectionCard title="Client">
              <select
                value={clientId}
                onChange={(e) => handleClientChange(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5
                  text-sm text-slate-200 focus:border-slate-600 focus:outline-none"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </SectionCard>
          )}

          {/* Snapshot selector */}
          <SectionCard
            title="Select Creative"
            description={`${clientSnapshots.length} creative${clientSnapshots.length !== 1 ? "s" : ""} available`}
          >
            <SnapshotSelector
              snapshots={clientSnapshots}
              selectedId={selectedSnap?.externalCreativeId ?? null}
              onChange={handleSnapChange}
            />
          </SectionCard>

          {/* Generate controls */}
          <SectionCard>
            <div className="space-y-3">
              {selectedSnap ? (
                <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2.5 space-y-1.5">
                  <p className="text-xs text-slate-500">Selected creative</p>
                  <p className="text-sm font-medium text-slate-200 truncate">
                    {selectedSnap.creativeName ?? selectedSnap.externalCreativeId}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{selectedSnap.campaignName}</p>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${EVAL_STYLES[selectedSnap.evaluationStatus] ?? ""}`}>
                      {selectedSnap.evaluationStatus}
                    </span>
                    <span className="text-xs text-slate-600">·</span>
                    <span className="text-xs text-slate-500">
                      Trigger: {TRIGGER_LABELS[deriveTrigger(selectedSnap.evaluationStatus)]}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">Select a creative above to enable generation.</p>
              )}

              {genError && (
                <div className="rounded-lg border border-rose-800/50 bg-rose-950/20 px-3 py-2.5">
                  <p className="text-xs text-rose-300">{genError}</p>
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={!selectedSnap || generating}
                className="w-full rounded-xl bg-indigo-600 px-5 py-3.5 text-sm font-medium
                  text-white transition-colors hover:bg-indigo-500 active:scale-95
                  disabled:cursor-not-allowed disabled:opacity-50 min-h-[48px]"
              >
                {generating ? "Generating concepts…" : result ? "Regenerate concepts" : "Generate creative concepts"}
              </button>

              {generating && (
                <div className="flex items-center gap-2 text-xs text-indigo-300">
                  <span className="animate-pulse">◉</span>
                  <span>Building context from performance signals and learning memory…</span>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Navigation */}
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 px-4 py-3">
            <p className="mb-2 text-xs font-medium text-slate-500">Related workflows</p>
            <div className="space-y-1.5">
              <Link href="/creative-lab/briefs"
                className="block text-xs text-slate-500 hover:text-slate-300 transition-colors">
                ↗ Creative Briefs
              </Link>
              <Link href="/creative-lab/review"
                className="block text-xs text-slate-500 hover:text-slate-300 transition-colors">
                ↗ Scoring & Review
              </Link>
              <Link href="/creative-lab/refresh-queue"
                className="block text-xs text-slate-500 hover:text-slate-300 transition-colors">
                ↗ Refresh Queue
              </Link>
              <Link href="/insights/learning-memory"
                className="block text-xs text-slate-500 hover:text-slate-300 transition-colors">
                ↗ Learning Memory
              </Link>
            </div>
          </div>
        </div>

        {/* ── Right panel: context + output ── */}
        <div className="space-y-5 lg:col-span-8">

          {/* Context summary */}
          {result?.context && (
            <SectionCard title="Generation Context" description="Assembled from performance signals and learning memory">
              <ContextSummaryPanel
                context={result.context}
                clientName={selectedClient?.name ?? ""}
                selectedClientId={clientId}
              />
            </SectionCard>
          )}

          {/* Run summary + warnings */}
          {result && (
            <RunSummaryBar summary={result.summary} warnings={result.warnings} />
          )}

          {/* Output tabs */}
          {result && (result.concepts.length > 0 || result.variants.length > 0) && (
            <>
              {/* Tab selector */}
              <div className="flex gap-1 rounded-xl bg-slate-800/60 p-1 w-fit">
                <button
                  onClick={() => setActiveTab("concepts")}
                  className={`rounded-lg px-4 py-2 text-xs font-medium transition-colors ${
                    activeTab === "concepts"
                      ? "bg-slate-700 text-slate-100"
                      : "text-slate-400 hover:text-slate-300"
                  }`}
                >
                  Concepts ({result.concepts.length})
                </button>
                <button
                  onClick={() => setActiveTab("variants")}
                  className={`rounded-lg px-4 py-2 text-xs font-medium transition-colors ${
                    activeTab === "variants"
                      ? "bg-slate-700 text-slate-100"
                      : "text-slate-400 hover:text-slate-300"
                  }`}
                >
                  Variants ({result.variants.length})
                </button>
              </div>

              {/* Concept cards */}
              {activeTab === "concepts" && (
                <div className="space-y-4">
                  {result.concepts.map((concept, idx) => (
                    <ConceptCard
                      key={concept.id}
                      concept={concept}
                      index={idx}
                      onSaveDraft={handleConceptSaveDraft}
                      onToScoring={handleConceptToScoring}
                      onToApproval={handleConceptToApproval}
                      onRegenerate={handleGenerate}
                    />
                  ))}
                </div>
              )}

              {/* Variant cards */}
              {activeTab === "variants" && (
                <div className="space-y-3">
                  {result.variants.map((variant, idx) => (
                    <VariantOutputCard
                      key={variant.id}
                      variant={{
                        ...variant,
                        status: variantActions[variant.id] ?? variant.status,
                      }}
                      provider={result.provider}
                      onAction={handleVariantAction}
                      onRegenerate={handleGenerate}
                      index={idx}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Create A/B Test CTA — after concepts generated ── */}
          {result && result.concepts.length > 0 && (
            <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-emerald-200">Ready to test these concepts?</h3>
                  <p className="mt-1 text-xs text-slate-400">
                    Create an A/B test to run the best concept against your current creative on Meta.
                    You&apos;ll set the control, budget, and success metrics in the next step.
                  </p>
                </div>
                <Link
                  href={`/creative-lab/launch?clientId=${encodeURIComponent(clientId)}${
                    selectedSnap ? `&creativeId=${encodeURIComponent(selectedSnap.externalCreativeId)}&campaignId=${encodeURIComponent(selectedSnap.externalCampaignId ?? "")}` : ""
                  }`}
                  className="shrink-0 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold
                    text-white transition-colors hover:bg-emerald-500 active:scale-95"
                >
                  Create A/B Test →
                </Link>
              </div>
            </div>
          )}

          {/* Empty state — before generation */}
          {!result && !generating && (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-800">
              <div className="text-center max-w-xs px-4">
                <p className="text-sm font-medium text-slate-400">No concepts generated yet</p>
                <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                  Select a creative from the list, then click &ldquo;Generate creative concepts&rdquo; to create
                  AI-powered, performance-grounded ad variations.
                </p>
              </div>
            </div>
          )}

          {/* Empty result — generation ran but returned nothing */}
          {result && result.concepts.length === 0 && result.variants.length === 0 && (
            <EmptyState
              title="No concepts generated"
              description="The engine returned no output — this may be due to sparse data or a generation error. Try a different creative or check the warnings above."
            />
          )}
        </div>
      </div>

      {/* Bottom nav */}
      <div className="flex flex-wrap gap-4 border-t border-slate-800/60 pt-4">
        <Link href="/creative-lab"               className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← Creative Lab</Link>
        <Link href="/creative-lab/generation"    className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Brief-Level Generation →</Link>
        <Link href="/creative-lab/review"        className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Scoring & Review →</Link>
        <Link href="/creative-lab/publish-prep"  className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Publish Prep →</Link>
      </div>
    </div>
  );
}
