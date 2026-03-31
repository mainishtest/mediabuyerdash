"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

// ── Types ────────────────────────────────────────────────────────────────────

interface Client {
  id: string;
  name: string;
}

interface SourceAsset {
  id: string;
  label: string | null;
  hook: string | null;
  bodyText: string | null;
  callToAction: string | null;
  imageHeadline: string | null;
  imageUrl: string | null;
  assetType: string;
  clientAccountId: string;
}

interface CopyCandidate {
  id?: string;
  title: string;
  hook: string;
  body: string;
  callToAction: string;
  angle?: string;
}

interface ImageCandidate {
  id?: string;
  title: string;
  conceptSummary: string;
  visualChanges: string;
  goal: string;
  textOverlay?: string;
  colorDirection?: string;
  generatedImageUrl?: string;
  rendered: boolean;
}

interface GenerationResult {
  requestId: string;
  generationRunId?: string;
  status: string;
  provider: string;
  copyVariations: CopyCandidate[];
  imageVariations: ImageCandidate[];
  latencyMs?: number;
  tokensUsed?: number;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

type GenerationIntent = "copy_variations" | "image_variations" | "both";
type SourceMode = "upload" | "existing_ad" | "source_asset";

// ── Main View ────────────────────────────────────────────────────────────────

export function VariationGeneratorView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Source state ──
  const [sourceMode, setSourceMode] = useState<SourceMode>("source_asset");
  const [clientAccountId, setClientAccountId] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [sourceAssets, setSourceAssets] = useState<SourceAsset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState("");

  // Source creative fields (editable)
  const [imageUrl, setImageUrl] = useState("");
  const [hook, setHook] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [cta, setCta] = useState("");
  const [imageHeadline, setImageHeadline] = useState("");
  const [sourceAdId, setSourceAdId] = useState("");
  const [sourceAdName, setSourceAdName] = useState("");

  // ── Generation state ──
  const [intent, setIntent] = useState<GenerationIntent>("both");
  const [provider, setProvider] = useState<"anthropic" | "openai">("anthropic");
  const [notes, setNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Image rendering state ──
  const [renderingImages, setRenderingImages] = useState<Record<number, boolean>>({});

  // ── Load clients on mount ──
  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((data) => {
        if (data.clients) setClients(data.clients);
      })
      .catch(() => {});
  }, []);

  // ── Pre-populate from URL params ──
  useEffect(() => {
    const pHook = searchParams.get("hook");
    const pBody = searchParams.get("body");
    const pCta = searchParams.get("cta");
    const pImageUrl = searchParams.get("imageUrl");
    const pHeadline = searchParams.get("imageHeadline");
    const pAdId = searchParams.get("adId");
    const pAdName = searchParams.get("adName");
    const pClientId = searchParams.get("clientId");
    const pAssetId = searchParams.get("assetId");

    if (pHook) setHook(pHook);
    if (pBody) setBodyText(pBody);
    if (pCta) setCta(pCta);
    if (pImageUrl) setImageUrl(pImageUrl);
    if (pHeadline) setImageHeadline(pHeadline);
    if (pAdId) { setSourceAdId(pAdId); setSourceMode("existing_ad"); }
    if (pAdName) setSourceAdName(pAdName);
    if (pClientId) setClientAccountId(pClientId);
    if (pAssetId) { setSelectedAssetId(pAssetId); setSourceMode("source_asset"); }
  }, [searchParams]);

  // ── Load source assets when client changes ──
  useEffect(() => {
    if (!clientAccountId) { setSourceAssets([]); return; }
    fetch(`/api/creative-source-assets?clientId=${clientAccountId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.assets) setSourceAssets(data.assets);
      })
      .catch(() => {});
  }, [clientAccountId]);

  // ── Select a source asset ──
  const selectAsset = useCallback((asset: SourceAsset) => {
    setSelectedAssetId(asset.id);
    if (asset.imageUrl) setImageUrl(asset.imageUrl);
    if (asset.hook) setHook(asset.hook);
    if (asset.bodyText) setBodyText(asset.bodyText);
    if (asset.callToAction) setCta(asset.callToAction);
    if (asset.imageHeadline) setImageHeadline(asset.imageHeadline);
  }, []);

  // ── Generate variations ──
  const handleGenerate = async () => {
    if (!clientAccountId) { setError("Select a client first"); return; }

    const hasImage = !!imageUrl;
    const hasCopy = !!(hook || bodyText || cta);

    if (intent === "image_variations" && !hasImage) {
      setError("Image variations require a source image");
      return;
    }
    if (intent === "copy_variations" && !hasCopy) {
      setError("Copy variations require source copy");
      return;
    }
    if (intent === "both" && !hasImage && !hasCopy) {
      setError("Provide source image or copy (or both)");
      return;
    }

    setGenerating(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/creative-lab/variations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: {
            sourceType: sourceMode === "existing_ad"
              ? "existing_ad"
              : hasImage && hasCopy
                ? "uploaded_image_and_copy"
                : hasImage
                  ? "uploaded_image"
                  : "uploaded_copy",
            sourceAssetId: selectedAssetId || undefined,
            sourceAdId: sourceAdId || undefined,
            sourceAdName: sourceAdName || undefined,
            imageUrl: imageUrl || undefined,
            hook: hook || undefined,
            bodyText: bodyText || undefined,
            callToAction: cta || undefined,
            imageHeadline: imageHeadline || undefined,
            clientAccountId,
            clientName: clients.find((c) => c.id === clientAccountId)?.name,
          },
          intent,
          provider,
          notes: notes || undefined,
          includePerformanceContext: true,
          includeLearningMemory: true,
          includeFatigueSignals: true,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setError(data.error || "Generation failed");
      } else {
        setResult(data.result);
      }
    } catch {
      setError("An error occurred during generation");
    } finally {
      setGenerating(false);
    }
  };

  // ── Render a single image concept ──
  const handleRenderImage = async (index: number) => {
    if (!result) return;
    const concept = result.imageVariations[index];
    if (!concept || concept.rendered) return;

    setRenderingImages((prev) => ({ ...prev, [index]: true }));

    try {
      const response = await fetch("/api/creative-lab/quick-generate/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concept: concept.conceptSummary,
          title: concept.title,
          textOverlay: concept.textOverlay || "",
          colorDirection: concept.colorDirection || "",
          productName: clients.find((c) => c.id === clientAccountId)?.name || "Product",
          productImageUrl: imageUrl || "",
          clientAccountId,
        }),
      });

      const data = await response.json();

      if (data.imageUrl) {
        setResult((prev) => {
          if (!prev) return prev;
          const updated = [...prev.imageVariations];
          updated[index] = {
            ...updated[index],
            generatedImageUrl: data.imageUrl,
            rendered: true,
          };
          return { ...prev, imageVariations: updated };
        });
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      setRenderingImages((prev) => ({ ...prev, [index]: false }));
    }
  };

  // ── Send to review ──
  const handleSendToReview = () => {
    if (result?.generationRunId) {
      router.push(`/creative-lab/quick-review?runId=${result.generationRunId}`);
    } else {
      router.push("/creative-lab/workspace");
    }
  };

  // ── Determine what the user can generate ──
  const hasImage = !!imageUrl;
  const hasCopy = !!(hook || bodyText || cta);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6 sm:px-6 sm:py-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
          Generate Variations
        </h1>
        <p className="text-sm text-slate-400">
          Select a source creative, choose what to generate, and create real copy and image
          variations in a few clicks.
        </p>
      </div>

      {/* ── Source Selection ──────────────────────────────────────────────── */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
          Source Creative
        </h2>

        {/* Client selector */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-400">Client</label>
          <select
            value={clientAccountId}
            onChange={(e) => setClientAccountId(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-indigo-600 focus:outline-none"
          >
            <option value="">— Select a client —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Source mode tabs */}
        <div className="flex gap-2">
          {(["source_asset", "existing_ad"] as SourceMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setSourceMode(mode)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                sourceMode === mode
                  ? "bg-indigo-900 text-indigo-100"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              {mode === "source_asset" ? "Uploaded Asset" : "Existing Ad"}
            </button>
          ))}
        </div>

        {/* Source asset picker */}
        {sourceMode === "source_asset" && clientAccountId && sourceAssets.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sourceAssets.map((asset) => (
              <button
                key={asset.id}
                onClick={() => selectAsset(asset)}
                className={`text-left rounded-lg border p-3 transition-colors ${
                  selectedAssetId === asset.id
                    ? "border-indigo-500 bg-indigo-950/30"
                    : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
                }`}
              >
                {asset.imageUrl && (
                  <div className="relative mb-2 aspect-video w-full overflow-hidden rounded-lg bg-slate-800">
                    <Image
                      src={asset.imageUrl}
                      alt={asset.label || "Asset"}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                )}
                <p className="truncate text-sm font-medium text-slate-200">
                  {asset.label || "Untitled"}
                </p>
                {asset.hook && (
                  <p className="mt-1 line-clamp-1 text-xs text-slate-500">{asset.hook}</p>
                )}
              </button>
            ))}
          </div>
        )}

        {sourceMode === "source_asset" && clientAccountId && sourceAssets.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-700 py-8 text-center">
            <p className="text-sm text-slate-500">
              No assets for this client.{" "}
              <Link href="/creative-lab/upload" className="text-indigo-400 underline">
                Upload one
              </Link>
            </p>
          </div>
        )}

        {/* Existing ad fields */}
        {sourceMode === "existing_ad" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Ad ID</label>
              <input
                type="text"
                value={sourceAdId}
                onChange={(e) => setSourceAdId(e.target.value)}
                placeholder="Meta ad ID"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Ad Name</label>
              <input
                type="text"
                value={sourceAdName}
                onChange={(e) => setSourceAdName(e.target.value)}
                placeholder="Ad name"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-600 focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Editable source fields */}
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Source Image URL
            </label>
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="/uploads/creatives/image.jpg or https://..."
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-600 focus:outline-none"
            />
          </div>

          {imageUrl && (
            <div className="relative h-32 w-48 overflow-hidden rounded-lg bg-slate-800">
              <Image
                src={imageUrl}
                alt="Source"
                fill
                className="object-contain"
                unoptimized
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Hook</label>
              <input
                type="text"
                value={hook}
                onChange={(e) => setHook(e.target.value)}
                placeholder="Opening hook line"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">CTA</label>
              <input
                type="text"
                value={cta}
                onChange={(e) => setCta(e.target.value)}
                placeholder="Call to action"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Body Text</label>
            <textarea
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder="Main ad body text"
              rows={3}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-600 focus:outline-none"
            />
          </div>
        </div>
      </section>

      {/* ── Generation Controls ──────────────────────────────────────────── */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
          Generation Mode
        </h2>

        <div className="flex flex-wrap gap-2">
          {([
            { value: "copy_variations", label: "Copy Variations", disabled: !hasCopy },
            { value: "image_variations", label: "Image Variations", disabled: !hasImage },
            { value: "both", label: "Both", disabled: !hasCopy && !hasImage },
          ] as { value: GenerationIntent; label: string; disabled: boolean }[]).map((opt) => (
            <button
              key={opt.value}
              onClick={() => !opt.disabled && setIntent(opt.value)}
              disabled={opt.disabled}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                intent === opt.value
                  ? "bg-emerald-900 text-emerald-100"
                  : opt.disabled
                    ? "bg-slate-800/50 text-slate-600 cursor-not-allowed"
                    : "bg-slate-800 text-slate-300 hover:text-white"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">AI Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as "anthropic" | "openai")}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-indigo-600 focus:outline-none"
            >
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai">OpenAI (GPT-4o)</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Notes for AI <span className="text-slate-600">(optional)</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Extra direction for the generator"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Generate buttons */}
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={handleGenerate}
            disabled={generating || !clientAccountId}
            className={`rounded-lg px-5 py-2.5 text-sm font-medium transition-colors ${
              generating || !clientAccountId
                ? "bg-emerald-950/30 text-emerald-300/50 cursor-not-allowed"
                : "bg-emerald-900 text-emerald-100 hover:bg-emerald-800"
            }`}
          >
            {generating ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating…
              </span>
            ) : (
              intent === "both"
                ? "Generate Copy + Image Variations"
                : intent === "copy_variations"
                  ? "Generate 3 Copy Tests"
                  : "Generate 3 Image Variations"
            )}
          </button>

          {result && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="rounded-lg px-4 py-2 text-sm font-medium bg-slate-800 text-slate-300 hover:text-white transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      </section>

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* ── Generation Results ───────────────────────────────────────────── */}
      {result && (
        <>
          {/* Status bar */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className={`rounded-full px-2 py-0.5 font-medium ${
              result.status === "completed"
                ? "bg-emerald-950/50 text-emerald-300"
                : result.status === "partial"
                  ? "bg-amber-950/50 text-amber-300"
                  : "bg-red-950/50 text-red-300"
            }`}>
              {result.status}
            </span>
            <span>Provider: {result.provider}</span>
            {result.latencyMs && <span>{(result.latencyMs / 1000).toFixed(1)}s</span>}
            {result.tokensUsed && <span>{result.tokensUsed} tokens</span>}
          </div>

          {result.error && (
            <div className="rounded-lg border border-amber-800 bg-amber-950/30 px-4 py-3 text-sm text-amber-300">
              {result.error.message}
              {result.error.retryable && (
                <button
                  onClick={handleGenerate}
                  className="ml-3 text-amber-200 underline"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {/* Copy Variations */}
          {result.copyVariations.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
                Copy Variations ({result.copyVariations.length})
              </h2>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {result.copyVariations.map((cv, i) => (
                  <div
                    key={cv.id || i}
                    className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <h3 className="text-sm font-medium text-white">{cv.title}</h3>
                      {cv.angle && (
                        <span className="rounded-full bg-indigo-950/50 px-2 py-0.5 text-xs text-indigo-300">
                          {cv.angle}
                        </span>
                      )}
                    </div>
                    <div className="space-y-2 text-sm">
                      <div>
                        <p className="text-xs text-slate-500 mb-0.5">Hook</p>
                        <p className="text-slate-200">{cv.hook}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-0.5">Body</p>
                        <p className="text-slate-300 text-xs leading-relaxed">{cv.body}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-0.5">CTA</p>
                        <p className="font-medium text-emerald-300">{cv.callToAction}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Image Variations */}
          {result.imageVariations.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
                Image Variations ({result.imageVariations.length})
              </h2>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {result.imageVariations.map((iv, i) => (
                  <div
                    key={iv.id || i}
                    className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3"
                  >
                    <h3 className="text-sm font-medium text-white">{iv.title}</h3>

                    {iv.rendered && iv.generatedImageUrl ? (
                      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-slate-800">
                        <Image
                          src={iv.generatedImageUrl}
                          alt={iv.title}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="aspect-square w-full rounded-lg bg-slate-800 flex items-center justify-center">
                        <button
                          onClick={() => handleRenderImage(i)}
                          disabled={renderingImages[i]}
                          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                            renderingImages[i]
                              ? "bg-indigo-950/30 text-indigo-300/50 cursor-not-allowed"
                              : "bg-indigo-900 text-indigo-100 hover:bg-indigo-800"
                          }`}
                        >
                          {renderingImages[i] ? "Rendering…" : "Generate Image"}
                        </button>
                      </div>
                    )}

                    <div className="space-y-2 text-xs">
                      <div>
                        <p className="text-slate-500 mb-0.5">Concept</p>
                        <p className="text-slate-300">{iv.conceptSummary}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 mb-0.5">Why it works</p>
                        <p className="text-slate-400">{iv.visualChanges}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Action bar */}
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={handleSendToReview}
              className="rounded-lg px-5 py-2.5 text-sm font-medium bg-emerald-900 text-emerald-100 hover:bg-emerald-800 transition-colors"
            >
              Send to Review
            </button>
            <Link
              href="/creative-lab"
              className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
            >
              Return to Creative Lab
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
