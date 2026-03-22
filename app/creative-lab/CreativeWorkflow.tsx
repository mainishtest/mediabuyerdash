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

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  items: CreativeOverviewItem[];
  clients: Array<{ id: string; name: string }>;
  selectedClientId: string | null;
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

export function CreativeWorkflow({ items, clients, selectedClientId }: Props) {
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
  const [launchResult, setLaunchResult]       = useState<{ ok: boolean; error?: string } | null>(null);

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
        const engineMode =
          mode === "copy_variations"
            ? "copy_blocks"
            : mode === "image_brief_variations"
              ? "concepts"
              : "concepts";

        const triggerType =
          item.status === "fatigued"
            ? "fatigue"
            : item.status === "weak"
              ? "underperformance"
              : item.status === "strong"
                ? "opportunity"
                : "manual";

        const res = await fetch("/api/creative-lab/creative-engine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientAccountId: item.clientAccountId,
            snapshot: {
              externalCreativeId: item.externalCreativeId,
              externalCampaignId: item.externalCampaignId,
              clientAccountId:    item.clientAccountId,
              clientName:         item.clientName,
              campaignName:       item.campaignName,
              creativeName:       item.creativeName,
              spend:              item.spend,
              impressions:        item.impressions,
              clicks:             item.clicks,
              avgCtr:             item.ctr,
              avgFrequency:       item.frequency,
              campaignRoas:       item.roas,
              campaignCpa:        item.cpa,
              adCopy:             item.adCopy,
              callToAction:       item.callToAction,
              thumbnailUrl:       item.thumbnailUrl,
              imageUrl:           item.imageUrl,
              evaluationStatus:   item.status,
            },
            mode:           engineMode,
            triggerType,
            generationMode: mode,
          }),
        });

        const data = await res.json();

        if (!data.ok) {
          setGenerationError(data.error ?? "Generation failed");
          setStep("overview");
          return;
        }

        // Normalize response into GeneratedVariant[]
        const generated: GeneratedVariant[] = [];

        if (data.copyBlocks && Array.isArray(data.copyBlocks)) {
          for (const block of data.copyBlocks) {
            generated.push({
              id:        block.id ?? crypto.randomUUID(),
              type:      "copy",
              title:     block.hook?.text ?? block.title ?? `Copy Variant`,
              content:   [block.hook?.text, block.body, block.callToAction].filter(Boolean).join("\n\n"),
              rationale: block.rationale ?? block.performanceRationale ?? "",
            });
          }
        }

        if (data.concepts && Array.isArray(data.concepts)) {
          for (const concept of data.concepts) {
            if (concept.copyBlock) {
              generated.push({
                id:        concept.copyBlock.id ?? crypto.randomUUID(),
                type:      "copy",
                title:     concept.title ?? "Copy Variant",
                content:   [
                  concept.copyBlock.hook?.text,
                  concept.copyBlock.body,
                  concept.copyBlock.callToAction,
                ].filter(Boolean).join("\n\n"),
                rationale: concept.performanceRationale ?? "",
              });
            }
            if (concept.imageBrief) {
              generated.push({
                id:        crypto.randomUUID(),
                type:      "image_brief",
                title:     `${concept.title ?? "Image"} — Image Brief`,
                content:   [
                  concept.imageBrief.conceptSummary,
                  concept.imageBrief.visualChanges?.join(", "),
                  concept.imageBrief.goal,
                ].filter(Boolean).join("\n\n"),
                rationale: concept.imageBrief.directResponseAngle ?? concept.performanceRationale ?? "",
              });
            }
          }
        }

        if (data.variants && Array.isArray(data.variants)) {
          for (const v of data.variants) {
            generated.push({
              id:        v.id ?? crypto.randomUUID(),
              type:      v.variantType === "image" ? "image_brief" : "copy",
              title:     v.title ?? "Variant",
              content:   v.variantType === "image"
                ? [v.conceptSummary, v.visualChanges?.join(", "), v.goal].filter(Boolean).join("\n\n")
                : [v.hook, v.body, v.callToAction].filter(Boolean).join("\n\n"),
              rationale: v.performanceRationale ?? "",
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

  // ── Quick Launch ─────────────────────────────────────────────────────────
  const handleLaunch = useCallback(async () => {
    if (!selectedItem || !selectedVariant) return;

    setLaunching(true);
    setLaunchResult(null);

    try {
      const res = await fetch("/api/creative-lab/quick-launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overviewItemId:      selectedItem.id,
          controlCreativeId:   selectedItem.externalCreativeId,
          challengerVariantId: selectedVariant.id,
          challengerTitle:     selectedVariant.title,
          challengerType:      selectedVariant.type,
          clientAccountId:     selectedItem.clientAccountId,
          campaignId:          selectedItem.externalCampaignId,
          suggestedName:       `Test: ${selectedVariant.title} vs ${selectedItem.creativeName ?? "Control"}`,
          primaryMetric:       selectedItem.roas != null ? "roas" : "cpa",
          evaluationWindowDays: 7,
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
            href="/creative-lab/generate"
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
          >
            AI Generator
          </Link>
        </div>
      </div>

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
                <p className="text-sm font-medium text-emerald-400">Test launched successfully</p>
                <p className="mt-1 text-xs text-slate-500">
                  Your experiment plan has been created. Monitor results in the Experiment Launch section.
                </p>
                <div className="mt-4 flex gap-2">
                  <Link
                    href="/creative-lab/launch"
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500"
                  >
                    View Experiments
                  </Link>
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
          {step === "review" && variants.length > 0 && (
            <SectionCard
              title={`Generated Variants (${variants.length})`}
              description="Select a variant to launch as a challenger test"
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariant(v)}
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
                      <p className="text-[10px] italic text-slate-500 line-clamp-2">
                        {v.rationale}
                      </p>
                    )}
                  </button>
                ))}
              </div>

              {/* Launch bar */}
              {selectedVariant && (
                <div className="mt-4 flex items-center justify-between rounded-lg border border-indigo-800/50 bg-indigo-950/20 px-4 py-3">
                  <div>
                    <p className="text-xs font-medium text-white">
                      Selected: {selectedVariant.title}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {selectedVariant.type === "copy" ? "Copy test" : "Image variation test"} vs current ad
                    </p>
                  </div>
                  <button
                    onClick={handleLaunch}
                    disabled={launching}
                    className="rounded-lg bg-indigo-600 px-5 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {launching ? "Launching..." : "Launch Test"}
                  </button>
                </div>
              )}
            </SectionCard>
          )}

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

      {/* ── Surface 1: Creative Overview ────────────────────────────────── */}
      {step === "overview" && !generating && (
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
