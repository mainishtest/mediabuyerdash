"use client";

// app/creative-lab/CreativeWorkflow.tsx
// Unified Creative workflow — all 3 surfaces in one component.
//
// Surface 1: Creative Overview (ad grid with performance + actions)
// Surface 2: Quick Generate Panel (slide-out, calls creative-engine API)
// Surface 3: Review + Launch (variant review, select winner, launch test)
//
// Responsive:
//   Mobile:  stacked cards, bottom-sheet panels
//   Desktop: grid + right-side panel

import { useState, useCallback } from "react";
import Link from "next/link";
import { SectionCard } from "../../components/ui/SectionCard";
import { EmptyState } from "../../components/ui/EmptyState";
import type {
  CreativeOverviewItem,
  CreativeHealthStatus,
  QuickGenerateMode,
  GeneratedVariant,
  CreativeWorkflowStep,
  CreativeOverviewFilters,
} from "../../types/creativeWorkflow";
import { QUICK_GENERATE_MODES } from "../../types/creativeWorkflow";
import type { CreativeSourceAsset } from "../../types/creativeSourceAsset";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  items: CreativeOverviewItem[];
  clients: Array<{ id: string; name: string }>;
  selectedClientId: string | null;
  sourceAssets?: CreativeSourceAsset[];
};

// ---------------------------------------------------------------------------
// Status badge colours
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<CreativeHealthStatus, string> = {
  strong:            "bg-emerald-900/40 text-emerald-400 border-emerald-800/50",
  average:           "bg-slate-800/60 text-slate-300 border-slate-700/50",
  weak:              "bg-amber-900/40 text-amber-400 border-amber-800/50",
  fatigued:          "bg-red-900/40 text-red-400 border-red-800/50",
  insufficient_data: "bg-slate-800/40 text-slate-500 border-slate-700/30",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CreativeWorkflow({ items, clients, selectedClientId, sourceAssets = [] }: Props) {
  const [activeTab, setActiveTab] = useState<"ads" | "uploads">("ads");
  // ── State ────────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<CreativeOverviewFilters>({
    clientId:   selectedClientId,
    campaignId: null,
    status:     null,
    search:     "",
  });

  const [selectedItem, setSelectedItem]       = useState<CreativeOverviewItem | null>(null);
  const [step, setStep]                       = useState<CreativeWorkflowStep>("overview");
  const [generateMode, setGenerateMode]       = useState<QuickGenerateMode | null>(null);
  const [generating, setGenerating]           = useState(false);
  const [variants, setVariants]               = useState<GeneratedVariant[]>([]);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<GeneratedVariant | null>(null);
  const [launching, setLaunching]             = useState(false);
  const [launchResult, setLaunchResult]       = useState<{
    ok: boolean;
    error?: string;
    result?: { metaAdId?: string | null; experimentId?: string | null; launchRecordId?: string | null };
    summary?: { launchStatus?: string; metaAdId?: string | null };
  } | null>(null);
  const [rejectedIds, setRejectedIds]        = useState<Set<string>>(new Set());

  // ── Filtering ────────────────────────────────────────────────────────────
  const filtered = items.filter((item) => {
    if (filters.clientId && item.clientAccountId !== filters.clientId) return false;
    if (filters.status && item.status !== filters.status) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const haystack = [
        item.creativeName,
        item.campaignName,
        item.clientName,
        item.adCopy,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  // ── Unique campaigns for filter ──────────────────────────────────────────
  const campaigns = [...new Set(items.map((i) => i.campaignName))].sort();

  // ── Quick Generate ───────────────────────────────────────────────────────
  const handleGenerate = useCallback(
    async (item: CreativeOverviewItem, mode: QuickGenerateMode) => {
      setSelectedItem(item);
      setGenerateMode(mode);
      setStep("generating");
      setGenerating(true);
      setGenerationError(null);
      setVariants([]);
      setSelectedVariant(null);
      setLaunchResult(null);

      try {
        const intent =
          mode === "copy_variations"         ? "copy_only" as const
          : mode === "image_brief_variations" ? "image_only" as const
          : "copy_and_image" as const;

        const sourceType = item.externalCampaignId === "uploaded" ? "uploaded_asset" : "synced_ad";

        const res = await fetch("/api/creative-lab/quick-generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: {
              type:               sourceType,
              sourceId:           item.externalCreativeId,
              clientAccountId:    item.clientAccountId,
              clientName:         item.clientName,
              sourceCopy:         item.adCopy,
              sourceCallToAction: item.callToAction,
              imageUrl:           item.imageUrl,
              thumbnailUrl:       item.thumbnailUrl,
              spend:              item.spend,
              ctr:                item.ctr,
              roas:               item.roas,
              cpa:                item.cpa,
              frequency:          item.frequency,
              evaluationStatus:   item.status,
              creativeName:       item.creativeName,
              campaignName:       item.campaignName,
            },
            intent,
          }),
        });

        const data = await res.json();

        if (!data.ok) {
          setGenerationError(data.error ?? "Generation failed");
          setStep("overview");
          return;
        }

        // Normalize UnifiedVariationSet response into GeneratedVariant[]
        const generated: GeneratedVariant[] = [];
        const variationSet = data.set;

        if (variationSet?.copyVariations) {
          for (const v of variationSet.copyVariations) {
            generated.push({
              id:        v.id,
              type:      "copy",
              title:     v.hook || v.angle || "Copy Variant",
              content:   [v.hook, v.body, v.callToAction].filter(Boolean).join("\n\n"),
              rationale: v.rationale ?? "",
            });
          }
        }

        if (variationSet?.imageVariations) {
          for (const v of variationSet.imageVariations) {
            generated.push({
              id:        v.id,
              type:      "image_brief",
              title:     v.title || "Image Variation",
              content:   [
                v.conceptSummary,
                v.visualChanges?.join(", "),
                v.goal,
                v.generatedImagePath ? `Generated: ${v.generatedImagePath}` : null,
              ].filter(Boolean).join("\n\n"),
              rationale: v.directResponseAngle ?? "",
            });
          }
        }

        setVariants(generated.length > 0 ? generated : []);
        setStep(generated.length > 0 ? "review" : "overview");
        if (generated.length === 0) {
          setGenerationError("No variants generated. Try a different mode or check provider configuration.");
        }
      } catch (err) {
        setGenerationError(err instanceof Error ? err.message : "Network error");
        setStep("overview");
      } finally {
        setGenerating(false);
      }
    },
    [],
  );

  // ── Generate from uploaded asset ──────────────────────────────────────
  const handleGenerateFromAsset = useCallback(
    (asset: CreativeSourceAsset, mode: QuickGenerateMode) => {
      // Convert source asset into a CreativeOverviewItem-like shape for handleGenerate
      const item: CreativeOverviewItem = {
        id:                  asset.id,
        externalCreativeId:  asset.id,
        externalCampaignId:  "uploaded",
        clientAccountId:     asset.clientAccountId ?? "",
        clientName:          asset.clientName ?? "Unknown",
        creativeName:        asset.fileName,
        campaignName:        "Uploaded Creative",
        thumbnailUrl:        asset.storagePath,
        imageUrl:            asset.storagePath,
        adCopy:              asset.sourceCopy,
        callToAction:        asset.sourceCallToAction,
        spend:               0,
        impressions:         0,
        clicks:              0,
        ctr:                 0,
        frequency:           null,
        roas:                null,
        cpa:                 null,
        status:              "insufficient_data",
        statusLabel:         "Uploaded",
        canGenerateCopy:     asset.sourceCopy != null && asset.sourceCopy.length > 0,
        canGenerateImage:    asset.storagePath != null,
        canLaunchTest:       false,
      };
      handleGenerate(item, mode);
    },
    [handleGenerate],
  );

  // ── Reject variant ──────────────────────────────────────────────────────
  const handleReject = useCallback((variantId: string) => {
    setRejectedIds((prev) => new Set(prev).add(variantId));
    if (selectedVariant?.id === variantId) {
      setSelectedVariant(null);
    }
  }, [selectedVariant]);

  // ── Launch to Meta ─────────────────────────────────────────────────────
  const handleLaunch = useCallback(async () => {
    if (!selectedItem || !selectedVariant) return;

    setLaunching(true);
    setLaunchResult(null);

    try {
      const res = await fetch("/api/creative-lab/review-launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate: {
            id:              selectedVariant.id,
            variantType:     selectedVariant.type === "image_brief" ? "image" : "copy",
            title:           selectedVariant.title,
            content:         selectedVariant.content,
            rationale:       selectedVariant.rationale ?? "",
            sourceId:        selectedItem.externalCreativeId,
            sourceType:      selectedItem.externalCampaignId === "uploaded" ? "uploaded_asset" : "synced_ad",
            generationJobId: null,
          },
          clientAccountId:   selectedItem.clientAccountId,
          clientName:        selectedItem.clientName,
          campaignName:      selectedItem.campaignName,
          creativeName:      selectedItem.creativeName,
          controlExternalId: selectedItem.externalCreativeId,
          target: {
            campaignExternalId: selectedItem.externalCampaignId !== "uploaded" ? selectedItem.externalCampaignId : null,
            campaignName:       selectedItem.campaignName,
            adSetExternalId:    null,
            adSetName:          null,
            destinationUrl:     null,
            ctaType:            selectedItem.callToAction ?? "SHOP_NOW",
          },
        }),
      });

      const data = await res.json();
      setLaunchResult(data);

      if (data.ok) {
        setStep("launched");
      }
    } catch (err) {
      setLaunchResult({
        ok:    false,
        error: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setLaunching(false);
    }
  }, [selectedItem, selectedVariant]);

  // ── Reset to overview ────────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    setStep("overview");
    setSelectedItem(null);
    setVariants([]);
    setSelectedVariant(null);
    setGenerationError(null);
    setLaunchResult(null);
    setRejectedIds(new Set());
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Creative Lab</h1>
          <p className="text-xs text-slate-500">
            Find an ad, generate tests, launch experiments
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/creative-lab/images"
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
          >
            Upload Image
          </Link>
          <Link
            href="/creative-lab/generate"
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
          >
            AI Generator
          </Link>
        </div>
      </div>

      {/* Tabs — only visible on overview */}
      {step === "overview" && !generating && (
        <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900/40 p-1">
          <button
            onClick={() => setActiveTab("ads")}
            className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "ads"
                ? "bg-slate-700 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Synced Ads {items.length > 0 && `(${items.length})`}
          </button>
          <button
            onClick={() => setActiveTab("uploads")}
            className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "uploads"
                ? "bg-slate-700 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Uploaded Assets {sourceAssets.length > 0 && `(${sourceAssets.length})`}
          </button>
        </div>
      )}

      {/* Generating overlay */}
      {step === "generating" && generating && (
        <SectionCard>
          <div className="flex flex-col items-center py-12">
            <div className="mb-3 h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            <p className="text-sm text-slate-300">
              Generating {generateMode ? QUICK_GENERATE_MODES[generateMode].label.toLowerCase() : "variants"}...
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {selectedItem?.creativeName ?? "Selected ad"}
            </p>
          </div>
        </SectionCard>
      )}

      {/* Error toast */}
      {generationError && step === "overview" && (
        <div className="rounded-lg border border-amber-800/50 bg-amber-900/20 px-4 py-3 text-sm text-amber-300">
          {generationError}
          <button
            className="ml-3 text-xs underline hover:text-amber-200"
            onClick={() => setGenerationError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Surface 3: Review + Launch ──────────────────────────────────── */}
      {(step === "review" || step === "launch_setup" || step === "launched") && selectedItem && (
        <div className="space-y-4">
          <button
            onClick={handleBack}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            ← Back to all ads
          </button>

          {/* Source ad context */}
          <SectionCard
            title={`Source: ${selectedItem.creativeName ?? selectedItem.externalCreativeId}`}
            description={`${selectedItem.campaignName} · ${selectedItem.clientName}`}
          >
            <div className="flex flex-wrap gap-4 text-xs text-slate-400">
              <span>Spend ${selectedItem.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              <span>CTR {selectedItem.ctr.toFixed(2)}%</span>
              {selectedItem.roas != null && <span>ROAS {selectedItem.roas.toFixed(2)}x</span>}
              {selectedItem.cpa != null && <span>CPA ${selectedItem.cpa.toFixed(2)}</span>}
              {selectedItem.frequency != null && <span>Freq {selectedItem.frequency.toFixed(1)}x</span>}
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[selectedItem.status]}`}>
                {selectedItem.statusLabel}
              </span>
            </div>
          </SectionCard>

          {/* Launched success */}
          {step === "launched" && launchResult?.ok && (
            <SectionCard>
              <div className="flex flex-col items-center py-8">
                <div className="mb-2 text-2xl">✓</div>
                <p className="text-sm font-medium text-emerald-400">Test launched to Meta</p>
                <p className="mt-1 text-xs text-slate-500">
                  Your challenger ad has been created in Meta. Monitor results in the Experiment Launch section.
                </p>
                {launchResult.result?.metaAdId && (
                  <p className="mt-1 text-xs text-slate-500">
                    Meta Ad ID: {launchResult.result.metaAdId}
                  </p>
                )}
                {launchResult.result?.experimentId && (
                  <p className="text-xs text-slate-500">
                    Experiment: {launchResult.result.experimentId}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href="/creative-lab/launch"
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500"
                  >
                    View Experiments
                  </Link>
                  {launchResult.result?.metaAdId && (
                    <a
                      href={`https://www.facebook.com/adsmanager/manage/ads?act=${selectedItem?.clientAccountId ?? ""}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs text-slate-300 hover:bg-slate-700"
                    >
                      Open in Meta
                    </a>
                  )}
                  <button
                    onClick={handleBack}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs text-slate-300 hover:bg-slate-700"
                  >
                    Back to Ads
                  </button>
                </div>
              </div>
            </SectionCard>
          )}

          {/* Launch error */}
          {launchResult && !launchResult.ok && (
            <div className="rounded-lg border border-red-800/50 bg-red-900/20 px-4 py-3 text-sm text-red-300">
              {launchResult.error ?? "Launch failed"}
            </div>
          )}

          {/* Variant cards */}
          {step === "review" && variants.length > 0 && (() => {
            const activeVariants = variants.filter((v) => !rejectedIds.has(v.id));
            return (
            <SectionCard
              title={`Generated Variants (${activeVariants.length})`}
              description="Select a variant to approve and launch as a challenger test"
            >
              {/* Side-by-side comparison grid */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {activeVariants.map((v) => (
                  <div
                    key={v.id}
                    className={`rounded-lg border p-4 text-left transition-all ${
                      selectedVariant?.id === v.id
                        ? "border-indigo-500 bg-indigo-950/30 ring-1 ring-indigo-500/30"
                        : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-white">{v.title}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          v.type === "copy"
                            ? "bg-violet-900/40 text-violet-400"
                            : "bg-cyan-900/40 text-cyan-400"
                        }`}
                      >
                        {v.type === "copy" ? "Copy" : "Image Brief"}
                      </span>
                    </div>
                    <p className="mb-2 text-xs leading-relaxed text-slate-300 line-clamp-4">
                      {v.content}
                    </p>
                    {v.rationale && (
                      <p className="mb-3 text-[10px] italic text-slate-500 line-clamp-2">
                        {v.rationale}
                      </p>
                    )}
                    {/* Action buttons per card */}
                    <div className="flex gap-2 border-t border-slate-700/50 pt-3">
                      <button
                        onClick={() => setSelectedVariant(v)}
                        className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors ${
                          selectedVariant?.id === v.id
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-700 text-slate-300 hover:bg-emerald-700 hover:text-white"
                        }`}
                      >
                        {selectedVariant?.id === v.id ? "Approved" : "Approve"}
                      </button>
                      <button
                        onClick={() => handleReject(v.id)}
                        className="rounded-md bg-slate-700 px-2 py-1.5 text-[11px] text-slate-400 hover:bg-red-900/40 hover:text-red-400"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Rejected count */}
              {rejectedIds.size > 0 && (
                <p className="mt-2 text-[10px] text-slate-500">
                  {rejectedIds.size} variant{rejectedIds.size > 1 ? "s" : ""} rejected
                </p>
              )}

              {/* No active variants left */}
              {activeVariants.length === 0 && (
                <div className="py-6 text-center">
                  <p className="text-sm text-slate-400">All variants rejected.</p>
                  <button
                    onClick={() => {
                      setRejectedIds(new Set());
                      setSelectedVariant(null);
                    }}
                    className="mt-2 text-xs text-indigo-400 underline hover:text-indigo-300"
                  >
                    Reset rejections
                  </button>
                </div>
              )}

              {/* Launch bar — only shows when a variant is approved */}
              {selectedVariant && !rejectedIds.has(selectedVariant.id) && (
                <div className="mt-4 flex flex-col gap-3 rounded-lg border border-indigo-800/50 bg-indigo-950/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-medium text-white">
                      Approved: {selectedVariant.title}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {selectedVariant.type === "copy" ? "Copy challenger" : "Image challenger"} vs {selectedItem?.creativeName ?? "current ad"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleLaunch}
                      disabled={launching}
                      className="rounded-lg bg-indigo-600 px-5 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                    >
                      {launching ? "Launching to Meta..." : "Launch Test"}
                    </button>
                    <button
                      onClick={handleBack}
                      className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-400 hover:bg-slate-700"
                    >
                      Return to Source
                    </button>
                  </div>
                </div>
              )}
            </SectionCard>
          );
          })()}

          {/* Re-generate options */}
          {step === "review" && (
            <div className="flex gap-2">
              {Object.entries(QUICK_GENERATE_MODES).map(([mode, info]) => (
                <button
                  key={mode}
                  onClick={() => handleGenerate(selectedItem, mode as QuickGenerateMode)}
                  disabled={generating}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-700 hover:text-slate-200 disabled:opacity-50"
                >
                  Regenerate {info.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Surface 1a: Uploaded Assets ───────────────────────────────── */}
      {step === "overview" && !generating && activeTab === "uploads" && (
        <>
          {sourceAssets.length === 0 ? (
            <SectionCard>
              <EmptyState
                icon="◇"
                title="No uploaded assets yet"
                description="Upload an image with optional source copy to use as the basis for variation generation."
                action={
                  <Link
                    href="/creative-lab/images"
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                  >
                    Upload Image
                  </Link>
                }
              />
            </SectionCard>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {sourceAssets.map((asset) => (
                <SourceAssetCard
                  key={asset.id}
                  asset={asset}
                  onGenerate={handleGenerateFromAsset}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Surface 1b: Creative Overview (synced ads) ──────────────────── */}
      {step === "overview" && !generating && activeTab === "ads" && (
        <>
          {/* Filters */}
          <SectionCard>
            <div className="flex flex-wrap items-end gap-3">
              {/* Search */}
              <div className="w-full sm:w-auto sm:min-w-[200px]">
                <p className="mb-1 text-xs text-slate-500">Search</p>
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                  placeholder="Ad name, campaign, copy..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Client */}
              {clients.length > 1 && (
                <FilterSelect
                  label="Client"
                  value={filters.clientId ?? ""}
                  onChange={(v) => setFilters((f) => ({ ...f, clientId: v || null }))}
                  options={[
                    { value: "", label: "All Clients" },
                    ...clients.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                />
              )}

              {/* Status */}
              <FilterSelect
                label="Status"
                value={filters.status ?? ""}
                onChange={(v) =>
                  setFilters((f) => ({ ...f, status: (v as CreativeHealthStatus) || null }))
                }
                options={[
                  { value: "", label: "All Statuses" },
                  { value: "strong", label: "Strong" },
                  { value: "average", label: "Average" },
                  { value: "weak", label: "Weak" },
                  { value: "fatigued", label: "Fatigued" },
                  { value: "insufficient_data", label: "Low Data" },
                ]}
              />

              {/* Count */}
              <span className="ml-auto pb-0.5 text-xs text-slate-500">
                {filtered.length} of {items.length} ads
              </span>
            </div>
          </SectionCard>

          {/* Ad grid */}
          {filtered.length === 0 ? (
            <SectionCard>
              <EmptyState
                icon="◇"
                title={items.length === 0 ? "No ads synced yet" : "No ads match filters"}
                description={
                  items.length === 0
                    ? "Connect your Meta account and sync to see your ads here with performance data."
                    : "Try adjusting the filters or search terms."
                }
                action={
                  items.length === 0 ? (
                    <Link
                      href="/integrations"
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                    >
                      Connect Meta
                    </Link>
                  ) : undefined
                }
              />
            </SectionCard>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((item) => (
                <AdCard
                  key={item.id}
                  item={item}
                  onGenerate={handleGenerate}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ad Card — one creative in the overview grid
// ---------------------------------------------------------------------------

function AdCard({
  item,
  onGenerate,
}: {
  item: CreativeOverviewItem;
  onGenerate: (item: CreativeOverviewItem, mode: QuickGenerateMode) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition-colors hover:border-slate-700">
      {/* Header row */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">
            {item.creativeName ?? `Creative ${item.externalCreativeId.slice(-6)}`}
          </p>
          <p className="truncate text-xs text-slate-500">{item.campaignName}</p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[item.status]}`}
        >
          {item.statusLabel}
        </span>
      </div>

      {/* Thumbnail */}
      {(item.thumbnailUrl || item.imageUrl) && (
        <div className="mb-3 h-28 overflow-hidden rounded-lg border border-slate-800 bg-slate-800/50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.thumbnailUrl ?? item.imageUrl ?? ""}
            alt={item.creativeName ?? "Creative thumbnail"}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Copy preview */}
      {item.adCopy && (
        <p className="mb-3 text-xs leading-relaxed text-slate-400 line-clamp-2">
          {item.adCopy}
        </p>
      )}

      {/* Metrics */}
      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        <MetricCell label="Spend" value={`$${item.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
        <MetricCell label="CTR" value={`${item.ctr.toFixed(2)}%`} />
        <MetricCell
          label="ROAS"
          value={item.roas != null ? `${item.roas.toFixed(2)}x` : "—"}
        />
      </div>
      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        <MetricCell
          label="CPA"
          value={item.cpa != null ? `$${item.cpa.toFixed(2)}` : "—"}
        />
        <MetricCell
          label="Freq"
          value={item.frequency != null ? `${item.frequency.toFixed(1)}x` : "—"}
        />
        <MetricCell label="Clicks" value={item.clicks.toLocaleString()} />
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-1.5">
        {item.canGenerateCopy && (
          <button
            onClick={() => onGenerate(item, "copy_variations")}
            className="flex-1 rounded-lg bg-violet-600/80 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-violet-600"
          >
            Copy Tests
          </button>
        )}
        {item.canGenerateImage && (
          <button
            onClick={() => onGenerate(item, "image_brief_variations")}
            className="flex-1 rounded-lg bg-cyan-600/80 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-cyan-600"
          >
            Image Vars
          </button>
        )}
        <button
          onClick={() => onGenerate(item, "full_refresh_package")}
          className="flex-1 rounded-lg border border-indigo-700/50 bg-indigo-950/30 px-2.5 py-1.5 text-xs font-medium text-indigo-300 hover:bg-indigo-900/30"
        >
          Full Refresh
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metric cell
// ---------------------------------------------------------------------------

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-800/40 px-2 py-1.5">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className="text-xs font-medium text-slate-200">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter select
// ---------------------------------------------------------------------------

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <p className="mb-1 text-xs text-slate-500">{label}</p>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Source Asset Card — one uploaded asset in the uploads grid
// ---------------------------------------------------------------------------

function SourceAssetCard({
  asset,
  onGenerate,
}: {
  asset: CreativeSourceAsset;
  onGenerate: (asset: CreativeSourceAsset, mode: QuickGenerateMode) => void;
}) {
  const fileSizeLabel = asset.fileSize
    ? asset.fileSize < 1024 * 1024
      ? `${(asset.fileSize / 1024).toFixed(0)} KB`
      : `${(asset.fileSize / 1024 / 1024).toFixed(1)} MB`
    : null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition-colors hover:border-slate-700">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">
            {asset.fileName ?? "Uploaded Asset"}
          </p>
          <p className="truncate text-xs text-slate-500">
            {asset.clientName ?? "No client"} · Uploaded
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-indigo-800/50 bg-indigo-900/30 px-2 py-0.5 text-[10px] font-medium text-indigo-400">
          {asset.type === "uploaded_image_and_copy" ? "Image + Copy" : "Image"}
        </span>
      </div>

      {/* Thumbnail */}
      {asset.storagePath && (
        <div className="mb-3 h-28 overflow-hidden rounded-lg border border-slate-800 bg-slate-800/50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={asset.storagePath}
            alt={asset.fileName ?? "Uploaded creative"}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Copy preview */}
      {asset.sourceCopy && (
        <p className="mb-3 text-xs leading-relaxed text-slate-400 line-clamp-2">
          {asset.sourceCopy}
        </p>
      )}

      {/* Metadata */}
      <div className="mb-3 flex flex-wrap gap-2 text-xs text-slate-500">
        {fileSizeLabel && <span>{fileSizeLabel}</span>}
        {asset.detectedStyle && <span className="capitalize">{asset.detectedStyle.replace("-", " ")}</span>}
        {asset.analysisStatus === "completed" && (
          <>
            {asset.clarityScore != null && <span>Clarity {asset.clarityScore}/10</span>}
            {asset.attentionScore != null && <span>Attention {asset.attentionScore}/10</span>}
          </>
        )}
        {asset.iterationCount > 0 && <span>{asset.iterationCount} concepts</span>}
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-1.5">
        {asset.sourceCopy && (
          <button
            onClick={() => onGenerate(asset, "copy_variations")}
            className="flex-1 rounded-lg bg-violet-600/80 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-violet-600"
          >
            Copy Tests
          </button>
        )}
        {asset.storagePath && (
          <button
            onClick={() => onGenerate(asset, "image_brief_variations")}
            className="flex-1 rounded-lg bg-cyan-600/80 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-cyan-600"
          >
            Image Vars
          </button>
        )}
        <button
          onClick={() => onGenerate(asset, "full_refresh_package")}
          className="flex-1 rounded-lg border border-indigo-700/50 bg-indigo-950/30 px-2.5 py-1.5 text-xs font-medium text-indigo-300 hover:bg-indigo-900/30"
        >
          Full Refresh
        </button>
      </div>

      {/* Link to detail */}
      <Link
        href={`/creative-lab/images/${asset.id}`}
        className="mt-2 block text-center text-[10px] text-slate-500 hover:text-slate-300"
      >
        View details →
      </Link>
    </div>
  );
}
