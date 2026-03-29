"use client";

// Quick Generate — paste ad copy, get variations, pick winners, launch test.
// No pipeline, no briefs, no assembly. Just fast iteration → Facebook launch.

import { useState, useEffect } from "react";

type Variation = {
  title: string;
  hook: string;
  body: string;
  callToAction: string;
};

type VariationWithStatus = Variation & {
  status: "none" | "approved" | "rejected";
};

type AdAccount = {
  id: string;
  externalAdAccountId: string;
  accountName: string;
};

type LaunchResult = {
  ok: boolean;
  campaignId?: string;
  adSetId?: string;
  ads?: Array<{ adId: string; creativeId: string; title: string }>;
  errors?: string[];
  summary?: string;
  error?: string;
};

type ClientOption = { id: string; name: string; copywritingPrompt: string | null };

export function QuickGenerateView() {
  // Input
  const [hook, setHook]                 = useState("");
  const [bodyText, setBodyText]         = useState("");
  const [cta, setCta]                   = useState("");
  const [imageHeadline, setImageHeadline] = useState("");
  const [clientAccountId, setClientAccountId] = useState("");
  const [clientName, setClientName]     = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [notes, setNotes]               = useState("");
  const [provider, setProvider]         = useState<"anthropic" | "openai">("anthropic");
  const [clients, setClients]           = useState<ClientOption[]>([]);
  const [copywritingPrompt, setCopywritingPrompt] = useState<string | null>(null);

  // Load clients on mount
  useEffect(() => {
    fetch("/api/creative-lab/quick-generate/clients")
      .then((r) => r.json())
      .then((data) => { if (data.ok) setClients(data.clients ?? []); })
      .catch(() => {});
  }, []);

  const [campaignDefaults, setCampaignDefaults] = useState<Record<string, string | null>>({});
  const [clientImages, setClientImages] = useState<Array<{ id: string; label: string; imageUrl: string }>>([]);

  // When client changes, load their copywriting prompt, campaign defaults, and images
  function handleClientChange(id: string) {
    setClientAccountId(id);
    const client = clients.find((c) => c.id === id);
    if (client) {
      setClientName(client.name);
      setCopywritingPrompt(client.copywritingPrompt);
    } else {
      setClientName("");
      setCopywritingPrompt(null);
      setCampaignDefaults({});
      setClientImages([]);
      return;
    }
    // Load campaign defaults
    fetch(`/api/clients/${id}/campaign-defaults`)
      .then((r) => r.json())
      .then((data) => { if (data.ok && data.defaults) setCampaignDefaults(data.defaults); })
      .catch(() => {});
    // Load image library
    fetch(`/api/clients/${id}/images`)
      .then((r) => r.json())
      .then((data) => { if (data.ok) setClientImages(data.images ?? []); })
      .catch(() => {});
  }

  // Imported ad image
  const [importedImageUrl, setImportedImageUrl] = useState("");

  // Image test mode
  const [imageTestUrls, setImageTestUrls] = useState<string[]>([""]);
  const [showImageTest, setShowImageTest] = useState(false);
  const [imageConcepts, setImageConcepts] = useState<Array<{
    title: string; concept: string; whyItWorks: string; textOverlay: string; colorDirection: string;
  }>>([]);
  const [generatingImages, setGeneratingImages] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<Record<number, { url: string; loading: boolean; error?: string }>>({});

  // Output
  const [variations, setVariations] = useState<VariationWithStatus[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [rawText, setRawText]       = useState<string | null>(null);

  // Comparison
  const [compareIds, setCompareIds] = useState<Set<number>>(new Set());

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setRawText(null);

    try {
      const res = await fetch("/api/creative-lab/quick-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hook, bodyText, cta, imageHeadline, clientAccountId,
          provider, clientName, campaignName, notes,
        }),
      });
      const data = await res.json();

      if (!data.ok) {
        setError(data.error);
        if (data.rawText) setRawText(data.rawText);
        return;
      }

      setVariations(
        data.variations.map((v: Variation) => ({ ...v, status: "none" as const }))
      );
      setCompareIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  function setStatus(idx: number, status: VariationWithStatus["status"]) {
    setVariations((prev) =>
      prev.map((v, i) => i === idx ? { ...v, status } : v)
    );
  }

  function toggleCompare(idx: number) {
    setCompareIds((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  // Ad importer
  const [showAdPicker, setShowAdPicker] = useState(false);
  const [existingAds, setExistingAds]   = useState<Array<{
    adId: string; adName: string; status: string; campaignName: string;
    hook: string; body: string; cta: string; hasCopy: boolean; imageUrl: string | null;
  }>>([]);
  const [loadingAds, setLoadingAds] = useState(false);
  const [adSearch, setAdSearch]     = useState("");

  function handleLoadAds(searchTerm = "") {
    if (!clientAccountId) return;
    setLoadingAds(true);
    const params = new URLSearchParams({ clientId: clientAccountId });
    if (searchTerm) params.set("search", searchTerm);
    fetch(`/api/creative-lab/quick-generate/ads?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setExistingAds(data.ads ?? []);
        setShowAdPicker(true);
      })
      .catch(() => {})
      .finally(() => setLoadingAds(false));
  }

  function handleImportAd(ad: typeof existingAds[0]) {
    setHook(ad.hook);
    setBodyText(ad.body);
    setCta(ad.cta);
    setCampaignName(ad.campaignName);
    if (ad.imageUrl) setImportedImageUrl(ad.imageUrl);
    setShowAdPicker(false);
  }

  const approved = variations.filter((v) => v.status === "approved");
  const comparing = variations.filter((_, i) => compareIds.has(i));

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white">Quick Generate</h1>
        <p className="mt-1 text-sm text-slate-500">
          Paste your current ad copy or import from an existing ad. Get 3 variations. Pick winners. Build a test.
        </p>
      </div>

      {/* ── Input section ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Current Ad Copy
          </p>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as "anthropic" | "openai")}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs
              text-slate-200 focus:border-indigo-500 focus:outline-none"
          >
            <option value="anthropic">Claude (Anthropic)</option>
            <option value="openai">GPT-4o (OpenAI)</option>
          </select>
        </div>

        {/* Hook + CTA row */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Hook (opening line)</label>
            <input
              type="text"
              value={hook}
              onChange={(e) => setHook(e.target.value)}
              placeholder="The first thing people see..."
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm
                text-slate-100 placeholder-slate-600 focus:border-indigo-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">CTA button</label>
            <input
              type="text"
              value={cta}
              onChange={(e) => setCta(e.target.value)}
              placeholder="Shop Now, Learn More..."
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm
                text-slate-100 placeholder-slate-600 focus:border-indigo-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Body */}
        <div>
          <label className="mb-1 block text-xs text-slate-500">Full ad text (primary text)</label>
          <textarea
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            placeholder="Paste the full Facebook ad primary text here..."
            rows={5}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm
              text-slate-100 placeholder-slate-600 focus:border-indigo-600 focus:outline-none resize-y"
          />
        </div>

        {/* Optional context row */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Client</label>
            {clients.length > 0 ? (
              <select
                value={clientAccountId}
                onChange={(e) => handleClientChange(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm
                  text-slate-100 focus:border-indigo-600 focus:outline-none"
              >
                <option value="">Select client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            ) : (
              <input
                type="text" value={clientName} onChange={(e) => setClientName(e.target.value)}
                placeholder="Client name..."
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm
                  text-slate-100 placeholder-slate-600 focus:border-indigo-600 focus:outline-none"
              />
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Campaign (optional)</label>
            <input
              type="text" value={campaignName} onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Campaign name..."
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm
                text-slate-100 placeholder-slate-600 focus:border-indigo-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Image headline (optional)</label>
            <input
              type="text" value={imageHeadline} onChange={(e) => setImageHeadline(e.target.value)}
              placeholder="Text on the image..."
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm
                text-slate-100 placeholder-slate-600 focus:border-indigo-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Import existing ad */}
        {clientAccountId && (
          <div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleLoadAds(adSearch)}
                disabled={loadingAds}
                className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-medium
                  text-slate-300 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50"
              >
                {loadingAds ? "Loading..." : showAdPicker ? "Refresh" : "Import Existing Ad →"}
              </button>
              {showAdPicker && (
                <button
                  type="button"
                  onClick={() => setShowAdPicker(false)}
                  className="text-xs text-slate-600 hover:text-slate-400"
                >
                  Close
                </button>
              )}
            </div>

            {showAdPicker && (
              <div className="mt-3 rounded-xl border border-slate-700 bg-slate-800/40 overflow-hidden">
                {/* Search bar */}
                <div className="border-b border-slate-700 p-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={adSearch}
                      onChange={(e) => setAdSearch(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleLoadAds(adSearch); }}
                      placeholder="Search by ad name, campaign, or ID..."
                      className="flex-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm
                        text-slate-200 placeholder-slate-600 focus:border-indigo-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleLoadAds(adSearch)}
                      disabled={loadingAds}
                      className="rounded-lg bg-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-600 disabled:opacity-50"
                    >
                      Search
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-600">
                    {existingAds.length} ad{existingAds.length !== 1 ? "s" : ""} found
                    {existingAds.filter((a) => a.hasCopy).length > 0 && ` · ${existingAds.filter((a) => a.hasCopy).length} with copy`}
                  </p>
                </div>

                {/* Ad list */}
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-800">
                  {existingAds.map((ad) => (
                    <button
                      key={ad.adId}
                      type="button"
                      onClick={() => handleImportAd(ad)}
                      className={`w-full px-4 py-3 text-left transition-colors
                        ${ad.hasCopy ? "hover:bg-indigo-950/30" : "hover:bg-slate-700/30 opacity-60"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-white truncate">{ad.adName}</p>
                            <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ${
                              ad.status === "ACTIVE" ? "bg-emerald-900/40 text-emerald-400" :
                              ad.status === "PAUSED" ? "bg-amber-900/40 text-amber-400" :
                              "bg-slate-800 text-slate-500"
                            }`}>
                              {ad.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 truncate">{ad.campaignName}</p>
                          {ad.hasCopy ? (
                            <p className="mt-1 text-xs text-slate-400 line-clamp-2">{ad.hook}</p>
                          ) : (
                            <p className="mt-1 text-xs text-slate-600 italic">No copy synced — paste manually after import</p>
                          )}
                        </div>
                        {ad.hasCopy && (
                          <span className="shrink-0 mt-1 text-xs text-indigo-400">Import →</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {existingAds.length === 0 && !loadingAds && (
                  <div className="px-4 py-6 text-center">
                    <p className="text-xs text-slate-600">
                      {adSearch ? `No ads matching "${adSearch}"` : "No ads found. Run a Meta sync first."}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Imported image preview */}
        {importedImageUrl && (
          <div className="flex items-start gap-3 rounded-lg border border-slate-700 bg-slate-800/40 p-3">
            <div className="h-20 w-20 shrink-0 rounded-lg border border-slate-600 overflow-hidden bg-slate-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={importedImageUrl} alt="Imported ad" className="h-full w-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-400">Imported Ad Image</p>
              <p className="mt-0.5 text-xs text-slate-600 truncate">{importedImageUrl}</p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => setShowImageTest(true)}
                  className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500">
                  Test Image Variations
                </button>
                <button type="button" onClick={() => setImportedImageUrl("")}
                  className="text-xs text-slate-600 hover:text-slate-400">Clear</button>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="mb-1 block text-xs text-slate-500">Notes for AI (optional)</label>
          <textarea
            value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Keep the religious angle, make hook more urgent, target women 45+..."
            rows={2}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm
              text-slate-100 placeholder-slate-600 focus:border-indigo-600 focus:outline-none resize-y"
          />
        </div>

        {/* Copywriting prompt indicator */}
        {copywritingPrompt && (
          <div className="rounded-lg border border-indigo-800/50 bg-indigo-950/15 p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-indigo-400">Client Copywriting Prompt Active</p>
              <a
                href={`/clients/${clientAccountId}/settings`}
                className="text-xs text-slate-500 hover:text-slate-300"
              >
                Edit →
              </a>
            </div>
            <p className="text-xs text-slate-500 line-clamp-3 whitespace-pre-line">{copywritingPrompt}</p>
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={loading || (!hook && !bodyText)}
          className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white
            transition-colors hover:bg-indigo-500 disabled:opacity-50 active:scale-[0.98] sm:w-auto"
        >
          {loading ? "Generating..." : "Generate 3 Variations"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-rose-800/50 bg-rose-950/20 px-4 py-3">
          <p className="text-sm text-rose-300">{error}</p>
          {rawText && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-slate-600">Raw AI response</summary>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-slate-500">
                {rawText}
              </pre>
            </details>
          )}
        </div>
      )}

      {/* ── Variations output ─────────────────────────────────────────── */}
      {variations.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Generated Variations
          </p>

          <div className="grid gap-4 md:grid-cols-3">
            {variations.map((v, i) => (
              <div
                key={i}
                className={`rounded-xl border p-4 transition-all
                  ${v.status === "approved"
                    ? "border-emerald-600 bg-emerald-950/20 ring-1 ring-emerald-600/30"
                    : v.status === "rejected"
                    ? "border-slate-800 bg-slate-900/30 opacity-40"
                    : "border-slate-800 bg-slate-900/60"
                  }`}
              >
                <p className="text-xs font-semibold text-slate-500 mb-2">{v.title}</p>
                <p className="text-sm font-medium text-indigo-300 leading-relaxed">{v.hook}</p>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">{v.body}</p>
                <p className="mt-2 text-xs text-slate-500">CTA: {v.callToAction}</p>

                {/* Actions */}
                <div className="mt-3 flex items-center gap-2 border-t border-slate-800/60 pt-3">
                  <button
                    onClick={() => setStatus(i, v.status === "approved" ? "none" : "approved")}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors
                      ${v.status === "approved"
                        ? "bg-emerald-600 text-white"
                        : "border border-slate-700 bg-slate-800 text-slate-400 hover:text-emerald-300"
                      }`}
                  >
                    {v.status === "approved" ? "Approved" : "Approve"}
                  </button>
                  <button
                    onClick={() => setStatus(i, v.status === "rejected" ? "none" : "rejected")}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors
                      ${v.status === "rejected"
                        ? "bg-rose-800 text-white"
                        : "border border-slate-700 bg-slate-800 text-slate-400 hover:text-rose-300"
                      }`}
                  >
                    {v.status === "rejected" ? "Rejected" : "Reject"}
                  </button>
                  <button
                    onClick={() => toggleCompare(i)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors
                      ${compareIds.has(i)
                        ? "bg-indigo-600 text-white"
                        : "border border-slate-700 bg-slate-800 text-slate-400 hover:text-indigo-300"
                      }`}
                  >
                    Compare
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Side-by-side comparison ───────────────────────────────────── */}
      {comparing.length >= 2 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Comparison ({comparing.length} selected)
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {comparing.map((v, i) => (
              <div key={i} className="rounded-xl border border-indigo-800/50 bg-indigo-950/10 p-4">
                <p className="text-xs font-semibold text-indigo-400 mb-2">{v.title}</p>
                <p className="text-sm font-medium text-white leading-relaxed">{v.hook}</p>
                <p className="mt-2 text-xs text-slate-300 leading-relaxed">{v.body}</p>
                <p className="mt-2 text-xs text-slate-500">CTA: {v.callToAction}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Approved + Launch Test ─────────────────────────────────────── */}
      {approved.length > 0 && (
        <LaunchTestSection
          approved={approved}
          clientName={clientName}
          clientAccountId={clientAccountId}
          campaignName={campaignName}
          destinationUrl=""
          campaignDefaults={campaignDefaults}
          clientImages={clientImages}
        />
      )}

      {/* ── Image Test Section ──────────────────────────────────────────── */}
      {showImageTest && (
        <div className="rounded-xl border border-blue-800/50 bg-blue-950/10 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
                Image Variation Test
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Test different images with the same copy, headline, targeting, and landing page.
              </p>
            </div>
            <button type="button" onClick={() => setShowImageTest(false)}
              className="text-xs text-slate-600 hover:text-slate-400">Close</button>
          </div>

          {/* Current copy that will be used for all image variations */}
          {(hook || bodyText) && (
            <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-3">
              <p className="text-xs text-slate-600 mb-1">Copy (same for all image variations):</p>
              <p className="text-sm text-slate-300 line-clamp-3">{hook}</p>
              {cta && <p className="mt-1 text-xs text-slate-500">CTA: {cta}</p>}
            </div>
          )}

          {/* AI-generated image concepts */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={async () => {
                  setGeneratingImages(true);
                  try {
                    const res = await fetch("/api/creative-lab/quick-generate/images", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        currentImageDescription: importedImageUrl ? "Product bottle image — supplement/tincture" : undefined,
                        productName: clientName,
                        adCopy: hook ? `${hook}\n\n${bodyText}` : undefined,
                        clientAccountId,
                        clientName,
                        notes,
                      }),
                    });
                    const data = await res.json();
                    if (data.ok) setImageConcepts(data.concepts);
                    else setError(data.error);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Failed to generate");
                  } finally {
                    setGeneratingImages(false);
                  }
                }}
                disabled={generatingImages}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white
                  hover:bg-blue-500 disabled:opacity-50 active:scale-[0.98]"
              >
                {generatingImages ? "Generating..." : "Generate 3 Image Concepts"}
              </button>
              {imageConcepts.length > 0 && (
                <span className="text-xs text-slate-500">{imageConcepts.length} concepts generated</span>
              )}
            </div>

            {imageConcepts.length > 0 && (
              <div className="grid gap-3 md:grid-cols-3">
                {imageConcepts.map((concept, i) => {
                  const gen = generatedImages[i];
                  return (
                    <div key={i} className="rounded-xl border border-blue-800/30 bg-blue-950/15 p-4 space-y-2">
                      {/* Generated image preview */}
                      {gen?.url && (
                        <div className="rounded-lg overflow-hidden border border-blue-700/30">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={gen.url} alt={concept.title} className="w-full aspect-square object-cover" />
                        </div>
                      )}

                      <p className="text-sm font-semibold text-blue-300">{concept.title}</p>
                      <p className="text-xs text-slate-300 leading-relaxed">{concept.concept}</p>
                      <div className="space-y-1 pt-1 border-t border-blue-800/20">
                        <p className="text-xs"><span className="text-slate-600">Why: </span><span className="text-slate-400">{concept.whyItWorks}</span></p>
                        {concept.textOverlay && concept.textOverlay !== "none" && (
                          <p className="text-xs"><span className="text-slate-600">Text overlay: </span><span className="text-indigo-300">&ldquo;{concept.textOverlay}&rdquo;</span></p>
                        )}
                        <p className="text-xs"><span className="text-slate-600">Colors: </span><span className="text-slate-400">{concept.colorDirection}</span></p>
                      </div>

                      {/* Generate / Use buttons */}
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-blue-800/20">
                        {!gen?.url ? (
                          <button
                            type="button"
                            disabled={gen?.loading}
                            onClick={async () => {
                              setGeneratedImages((prev) => ({ ...prev, [i]: { url: "", loading: true } }));
                              try {
                                const res = await fetch("/api/creative-lab/quick-generate/images/generate", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    concept: concept.concept,
                                    title: concept.title,
                                    textOverlay: concept.textOverlay,
                                    colorDirection: concept.colorDirection,
                                    productName: clientName,
                                  }),
                                });
                                const data = await res.json();
                                if (data.ok && data.imageUrl) {
                                  setGeneratedImages((prev) => ({ ...prev, [i]: { url: data.imageUrl, loading: false } }));
                                } else {
                                  setGeneratedImages((prev) => ({ ...prev, [i]: { url: "", loading: false, error: data.error } }));
                                }
                              } catch (err) {
                                setGeneratedImages((prev) => ({ ...prev, [i]: { url: "", loading: false, error: String(err) } }));
                              }
                            }}
                            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white
                              hover:bg-blue-500 disabled:opacity-50"
                          >
                            {gen?.loading ? "Generating..." : "Generate Image"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              // Add to image test URLs
                              const emptyIdx = imageTestUrls.findIndex((u) => !u);
                              if (emptyIdx >= 0) {
                                setImageTestUrls((prev) => prev.map((u, j) => j === emptyIdx ? gen.url : u));
                              } else {
                                setImageTestUrls((prev) => [...prev, gen.url]);
                              }
                            }}
                            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white
                              hover:bg-emerald-500"
                          >
                            Use for Test
                          </button>
                        )}
                        {gen?.error && (
                          <p className="text-xs text-rose-400">{gen.error}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Image URL inputs */}
          <div className="space-y-2">
            <p className="text-xs text-slate-500">Add image URLs to test (one per variation):</p>
            {imageTestUrls.map((url, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2">
                  {url && (
                    <div className="h-10 w-10 shrink-0 rounded border border-slate-600 overflow-hidden bg-slate-800">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-full w-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    </div>
                  )}
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setImageTestUrls((prev) => prev.map((u, j) => j === i ? e.target.value : u))}
                    placeholder={`Image ${i + 1} URL...`}
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm
                      text-slate-100 placeholder-slate-600 focus:border-blue-600 focus:outline-none"
                  />
                </div>
                {imageTestUrls.length > 1 && (
                  <button type="button"
                    onClick={() => setImageTestUrls((prev) => prev.filter((_, j) => j !== i))}
                    className="text-xs text-rose-500 hover:text-rose-400">✕</button>
                )}
              </div>
            ))}

            {/* Image library picker for image test */}
            {clientImages.length > 0 && (
              <div className="grid gap-2 grid-cols-4 sm:grid-cols-6 lg:grid-cols-8">
                {clientImages.map((img) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => {
                      // Add to the first empty slot, or add a new one
                      const emptyIdx = imageTestUrls.findIndex((u) => !u);
                      if (emptyIdx >= 0) {
                        setImageTestUrls((prev) => prev.map((u, j) => j === emptyIdx ? img.imageUrl : u));
                      } else {
                        setImageTestUrls((prev) => [...prev, img.imageUrl]);
                      }
                    }}
                    className={`rounded-lg border overflow-hidden transition-all
                      ${imageTestUrls.includes(img.imageUrl)
                        ? "border-blue-500 ring-1 ring-blue-500/30"
                        : "border-slate-700 hover:border-slate-600"
                      }`}
                  >
                    <div className="aspect-square bg-slate-800">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.imageUrl} alt={img.label} className="h-full w-full object-cover" />
                    </div>
                    <p className="px-1 py-0.5 text-[9px] text-slate-500 truncate">{img.label}</p>
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button type="button"
                onClick={() => setImageTestUrls((prev) => [...prev, ""])}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-400 hover:text-white">
                + Add Image
              </button>
            </div>
          </div>

          {/* Launch image test */}
          {imageTestUrls.filter((u) => u).length >= 2 && (
            <div className="pt-2 border-t border-blue-800/30">
              <p className="text-xs text-slate-500 mb-3">
                {imageTestUrls.filter((u) => u).length} image(s) ready. Each will be created as a separate ad
                with identical copy, headline, targeting, and landing page.
              </p>
              <LaunchImageTestButton
                imageUrls={imageTestUrls.filter((u) => u)}
                hook={hook}
                bodyText={bodyText}
                cta={cta}
                clientAccountId={clientAccountId}
                clientName={clientName}
                campaignName={campaignName}
                campaignDefaults={campaignDefaults}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Original copy reference ───────────────────────────────────── */}
      {variations.length > 0 && (hook || bodyText) && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-600 mb-2">
            Original Copy (for reference)
          </p>
          {hook && <p className="text-sm text-slate-400">{hook}</p>}
          {bodyText && <p className="mt-1 text-xs text-slate-500">{bodyText}</p>}
          {cta && <p className="mt-1 text-xs text-slate-600">CTA: {cta}</p>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Launch Test Section — full campaign setup + launch to Facebook
// ---------------------------------------------------------------------------

function LaunchTestSection({
  approved,
  clientName,
  clientAccountId,
  campaignName: inputCampaignName,
  destinationUrl: inputUrl,
  campaignDefaults: cd,
  clientImages,
}: {
  approved: VariationWithStatus[];
  clientName: string;
  clientAccountId: string;
  campaignName: string;
  destinationUrl: string;
  campaignDefaults: Record<string, string | null>;
  clientImages: Array<{ id: string; label: string; imageUrl: string }>;
}) {
  // Steps: configure → review → launched
  const [step, setStep] = useState<"configure" | "review" | "launching" | "done">("configure");
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  // Config state — pre-filled from client campaign defaults
  const [adAccountId, setAdAccountId]     = useState(cd.defaultAdAccountId ?? "");
  const [pageId, setPageId]               = useState(cd.defaultPageId ?? "");
  const [testName, setTestName]           = useState(
    inputCampaignName ? `${inputCampaignName} — Copy Test` : "Copy Test"
  );
  const [objective, setObjective]         = useState(cd.defaultObjective ?? "OUTCOME_TRAFFIC");
  const [dailyBudget, setDailyBudget]     = useState(cd.defaultDailyBudget ?? "20");
  const [destinationUrl, setDestinationUrl] = useState(cd.defaultDestinationUrl ?? inputUrl);
  const [adHeadline, setAdHeadline]       = useState(cd.defaultHeadline ?? "");
  const [imageUrl, setImageUrl]           = useState("");
  const [pixelId, setPixelId]             = useState(cd.defaultPixelId ?? "");
  const [optimizationGoal, setOptGoal]    = useState(cd.defaultOptGoal ?? "LINK_CLICKS");
  const [showImagePicker, setShowImagePicker] = useState(false);

  // Targeting — pre-filled from client defaults
  const [countries, setCountries] = useState(cd.defaultTargetCountries ?? "US");
  const [ageMin, setAgeMin]       = useState(cd.defaultAgeMin ?? "18");
  const [ageMax, setAgeMax]       = useState(cd.defaultAgeMax ?? "65");
  const [gender, setGender]       = useState(cd.defaultGender ?? "0");

  // Result
  const [launchResult, setLaunchResult] = useState<LaunchResult | null>(null);
  const [launchError, setLaunchError]   = useState<string | null>(null);

  // Load ad accounts on mount
  useEffect(() => {
    setLoadingAccounts(true);
    fetch("/api/creative-lab/launch-test/accounts")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setAdAccounts(data.accounts ?? []);
          if (data.accounts?.length === 1) {
            setAdAccountId(data.accounts[0].externalAdAccountId);
          }
          if (data.pageId) setPageId(data.pageId);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingAccounts(false));
  }, []);

  async function handleLaunch() {
    setStep("launching");
    setLaunchError(null);

    try {
      const res = await fetch("/api/creative-lab/launch-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adAccountId,
          pageId,
          clientAccountId: clientAccountId || undefined,
          campaignName: testName,
          objective,
          dailyBudget: parseFloat(dailyBudget),
          destinationUrl,
          headline: adHeadline || undefined,
          imageUrl: imageUrl || undefined,
          pixelId: pixelId || undefined,
          optimizationGoal: optimizationGoal,
          targetCountries: countries.split(",").map((c) => c.trim().toUpperCase()),
          targetAgeMin: parseInt(ageMin),
          targetAgeMax: parseInt(ageMax),
          targetGenders: [parseInt(gender)],
          variations: approved.map((v) => ({
            title:        v.title,
            hook:         v.hook,
            body:         v.body,
            callToAction: v.callToAction,
          })),
        }),
      });

      const data = await res.json();
      setLaunchResult(data);
      if (data.ok) {
        setStep("done");
      } else {
        setLaunchError(data.error ?? "Launch failed");
        setStep("review");
      }
    } catch (err) {
      setLaunchError(err instanceof Error ? err.message : "Network error");
      setStep("review");
    }
  }

  const INPUT = "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-600 focus:outline-none";
  const LABEL = "mb-1 block text-xs text-slate-500";

  // ── Done state ──────────────────────────────────────────────────────
  if (step === "done" && launchResult?.ok) {
    return (
      <div className="rounded-xl border border-emerald-700 bg-emerald-950/20 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">✓</span>
          <div>
            <p className="text-lg font-semibold text-emerald-300">Test Launched Successfully</p>
            <p className="text-sm text-slate-400">{launchResult.summary}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {launchResult.campaignId && (
            <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-3">
              <p className="text-xs text-slate-500">Campaign ID</p>
              <p className="mt-1 font-mono text-xs text-slate-200">{launchResult.campaignId}</p>
            </div>
          )}
          {launchResult.adSetId && (
            <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-3">
              <p className="text-xs text-slate-500">Ad Set ID</p>
              <p className="mt-1 font-mono text-xs text-slate-200">{launchResult.adSetId}</p>
            </div>
          )}
          <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-3">
            <p className="text-xs text-slate-500">Ads Created</p>
            <p className="mt-1 text-sm font-semibold text-white">{launchResult.ads?.length ?? 0}</p>
          </div>
        </div>

        {launchResult.ads && launchResult.ads.length > 0 && (
          <div className="space-y-2">
            {launchResult.ads.map((ad, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-slate-800/30 px-3 py-2">
                <span className="text-xs text-emerald-400">✓</span>
                <span className="text-sm text-white">{ad.title}</span>
                <span className="ml-auto font-mono text-xs text-slate-500">{ad.adId}</span>
              </div>
            ))}
          </div>
        )}

        {launchResult.errors && launchResult.errors.length > 0 && (
          <div className="rounded-lg border border-amber-800/50 bg-amber-950/20 p-3">
            <p className="text-xs font-semibold text-amber-400 mb-1">Warnings</p>
            {launchResult.errors.map((e, i) => (
              <p key={i} className="text-xs text-amber-300">{e}</p>
            ))}
          </div>
        )}

        <p className="text-xs text-slate-500">
          Campaign launched as PAUSED. Go to Meta Ads Manager to review and activate.
        </p>
      </div>
    );
  }

  // ── Review state ────────────────────────────────────────────────────
  if (step === "review" || step === "launching") {
    const missingFields: string[] = [];
    if (!adAccountId) missingFields.push("Ad Account");
    if (!pageId)      missingFields.push("Facebook Page ID");
    if (!destinationUrl) missingFields.push("Destination URL");
    if (!testName)    missingFields.push("Test Name");

    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Pre-Launch Review</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {approved.length} ad variation(s) will be created in Meta Ads Manager
            </p>
          </div>
          <button onClick={() => setStep("configure")}
            className="text-xs text-slate-500 hover:text-slate-300">
            ← Edit Config
          </button>
        </div>

        {launchError && (
          <div className="rounded-lg border border-rose-800/50 bg-rose-950/20 px-4 py-3 text-sm text-rose-300">
            {launchError}
          </div>
        )}

        {missingFields.length > 0 && (
          <div className="rounded-lg border border-amber-800/50 bg-amber-950/20 px-4 py-3">
            <p className="text-xs text-amber-300">Missing: {missingFields.join(", ")}</p>
          </div>
        )}

        {/* Summary grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Campaign", value: testName },
            { label: "Objective", value: objective.replace("OUTCOME_", "") },
            { label: "Budget", value: `$${dailyBudget}/day` },
            { label: "Targeting", value: `${countries} · ${ageMin}-${ageMax}` },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border border-slate-700 bg-slate-800/40 p-3">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="mt-1 text-sm text-white">{value}</p>
            </div>
          ))}
        </div>

        {/* Ad previews */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Ads to Create ({approved.length})
          </p>
          <div className="space-y-3">
            {approved.map((v, i) => (
              <div key={i} className="rounded-xl border border-slate-700 bg-slate-800/30 p-4">
                <div className="flex items-center gap-3 mb-2">
                  {imageUrl ? (
                    <div className="h-16 w-16 shrink-0 rounded-lg bg-slate-700 overflow-hidden border border-slate-600">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imageUrl}
                        alt="Ad creative"
                        className="h-full w-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-700 border border-slate-600 text-xs text-slate-500">
                      No img
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-semibold text-indigo-400">{v.title}</p>
                    <p className="text-xs text-slate-600">{destinationUrl}</p>
                  </div>
                </div>
                <p className="text-sm font-medium text-white">{v.hook}</p>
                <p className="mt-1 text-xs text-slate-400">{v.body}</p>
                <p className="mt-2 inline-block rounded-md border border-indigo-600/50 bg-indigo-600/20 px-2.5 py-1 text-xs text-indigo-300">
                  {v.callToAction}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Launch button */}
        <button
          onClick={handleLaunch}
          disabled={step === "launching" || missingFields.length > 0}
          className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white
            transition-colors hover:bg-emerald-500 disabled:opacity-50 active:scale-[0.98]"
        >
          {step === "launching" ? "Launching to Facebook..." : `Launch ${approved.length} Ad(s) to Facebook`}
        </button>
        <p className="text-center text-xs text-slate-600">
          Ads will be created as PAUSED. You can review and activate in Ads Manager.
        </p>
      </div>
    );
  }

  // ── Configure state ─────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/10 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-500">
            Launch Test to Facebook
          </p>
          <p className="mt-1 text-sm text-slate-400">
            {approved.length} approved variation(s) ready to launch
          </p>
        </div>
      </div>

      {/* Approved variations summary */}
      <div className="space-y-2">
        {approved.map((v, i) => (
          <div key={i} className="rounded-lg border border-emerald-800/30 bg-emerald-950/20 p-3">
            <p className="text-xs font-semibold text-emerald-400">{v.title}</p>
            <p className="mt-1 text-sm text-white">{v.hook}</p>
            <p className="mt-1 text-xs text-slate-400 line-clamp-2">{v.body}</p>
          </div>
        ))}
      </div>

      {/* Campaign setup */}
      <div className="space-y-4 rounded-xl border border-slate-700 bg-slate-800/30 p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Campaign Setup</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={LABEL}>Ad Account</label>
            {loadingAccounts ? (
              <p className="text-xs text-slate-600">Loading accounts...</p>
            ) : adAccounts.length > 0 ? (
              <select value={adAccountId} onChange={(e) => setAdAccountId(e.target.value)} className={INPUT}>
                <option value="">Select account...</option>
                {adAccounts.map((a) => (
                  <option key={a.id} value={a.externalAdAccountId}>
                    {a.accountName} ({a.externalAdAccountId})
                  </option>
                ))}
              </select>
            ) : (
              <input type="text" value={adAccountId} onChange={(e) => setAdAccountId(e.target.value)}
                placeholder="act_123456789" className={INPUT} />
            )}
          </div>
          <div>
            <label className={LABEL}>Facebook Page ID</label>
            <input type="text" value={pageId} onChange={(e) => setPageId(e.target.value)}
              placeholder="Your Facebook Page ID" className={INPUT} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={LABEL}>Test Name</label>
            <input type="text" value={testName} onChange={(e) => setTestName(e.target.value)}
              placeholder="Copy Test — March 2026" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Objective</label>
            <select value={objective} onChange={(e) => setObjective(e.target.value)} className={INPUT}>
              <option value="OUTCOME_TRAFFIC">Traffic</option>
              <option value="OUTCOME_SALES">Sales</option>
              <option value="OUTCOME_ENGAGEMENT">Engagement</option>
              <option value="OUTCOME_LEADS">Leads</option>
              <option value="OUTCOME_AWARENESS">Awareness</option>
            </select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className={LABEL}>Daily Budget ($)</label>
            <input type="number" value={dailyBudget} onChange={(e) => setDailyBudget(e.target.value)}
              placeholder="20" min="1" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Optimization Goal</label>
            <select value={optimizationGoal} onChange={(e) => setOptGoal(e.target.value)} className={INPUT}>
              <option value="LINK_CLICKS">Link Clicks</option>
              <option value="LANDING_PAGE_VIEWS">Landing Page Views</option>
              <option value="OFFSITE_CONVERSIONS">Conversions</option>
              <option value="IMPRESSIONS">Impressions</option>
              <option value="REACH">Reach</option>
            </select>
          </div>
          <div>
            <label className={LABEL}>Pixel ID (for conversions)</label>
            <input type="text" value={pixelId} onChange={(e) => setPixelId(e.target.value)}
              placeholder="Optional" className={INPUT} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={LABEL}>Destination URL</label>
            <input type="url" value={destinationUrl} onChange={(e) => setDestinationUrl(e.target.value)}
              placeholder="https://yoursite.com/landing-page" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Ad Headline</label>
            <input type="text" value={adHeadline} onChange={(e) => setAdHeadline(e.target.value)}
              placeholder="Headline shown below image" className={INPUT} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-slate-500">Ad Image</label>
            {clientImages.length > 0 && (
              <button type="button" onClick={() => setShowImagePicker((v) => !v)}
                className="text-xs text-indigo-400 hover:text-indigo-300">
                {showImagePicker ? "Hide Library" : `Choose from Library (${clientImages.length})`}
              </button>
            )}
          </div>
          <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://... (paste URL or select from library below)" className={INPUT} />

          {/* Image library picker */}
          {showImagePicker && clientImages.length > 0 && (
            <div className="mt-2 grid gap-2 grid-cols-3 sm:grid-cols-4 lg:grid-cols-6">
              {clientImages.map((img) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => { setImageUrl(img.imageUrl); setShowImagePicker(false); }}
                  className={`rounded-lg border overflow-hidden text-left transition-all
                    ${imageUrl === img.imageUrl
                      ? "border-indigo-500 ring-1 ring-indigo-500/30"
                      : "border-slate-700 hover:border-slate-600"
                    }`}
                >
                  <div className="aspect-square bg-slate-800">
                    <img src={img.imageUrl} alt={img.label} className="h-full w-full object-cover" />
                  </div>
                  <p className="px-1.5 py-1 text-[10px] text-slate-400 truncate">{img.label}</p>
                </button>
              ))}
            </div>
          )}

          {imageUrl && (
            <div className="mt-2 h-20 w-20 rounded-lg border border-slate-700 overflow-hidden">
              <img src={imageUrl} alt="Selected" className="h-full w-full object-cover" />
            </div>
          )}
        </div>
      </div>

      {/* Targeting */}
      <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-800/30 p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Targeting</p>
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className={LABEL}>Countries</label>
            <input type="text" value={countries} onChange={(e) => setCountries(e.target.value)}
              placeholder="US,CA,GB" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Age Min</label>
            <input type="number" value={ageMin} onChange={(e) => setAgeMin(e.target.value)}
              min="13" max="65" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Age Max</label>
            <input type="number" value={ageMax} onChange={(e) => setAgeMax(e.target.value)}
              min="13" max="65" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Gender</label>
            <select value={gender} onChange={(e) => setGender(e.target.value)} className={INPUT}>
              <option value="0">All</option>
              <option value="1">Male</option>
              <option value="2">Female</option>
            </select>
          </div>
        </div>
      </div>

      {/* Review button */}
      <button
        onClick={() => setStep("review")}
        disabled={!adAccountId || !pageId || !destinationUrl}
        className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white
          transition-colors hover:bg-indigo-500 disabled:opacity-50 active:scale-[0.98]"
      >
        Review & Launch →
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Launch Image Test Button — creates one campaign with N ads, each a different image
// ---------------------------------------------------------------------------

function LaunchImageTestButton({
  imageUrls, hook, bodyText, cta, clientAccountId, clientName, campaignName, campaignDefaults: cd,
}: {
  imageUrls: string[];
  hook: string; bodyText: string; cta: string;
  clientAccountId: string; clientName: string; campaignName: string;
  campaignDefaults: Record<string, string | null>;
}) {
  const [launching, setLaunching] = useState(false);
  const [result, setResult]       = useState<LaunchResult | null>(null);
  const [error, setError]         = useState<string | null>(null);

  async function handleLaunch() {
    setLaunching(true);
    setError(null);
    try {
      // Create one variation per image, all with the same copy
      const variations = imageUrls.map((url, i) => ({
        title:        `Image ${String.fromCharCode(65 + i)}`,
        hook,
        body:         bodyText,
        callToAction: cta || "Learn More",
        imageUrl:     url,
      }));

      // Launch each image as a separate ad creative
      const res = await fetch("/api/creative-lab/launch-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adAccountId:      cd.defaultAdAccountId ?? "",
          pageId:           cd.defaultPageId ?? "",
          clientAccountId,
          campaignName:     `${campaignName || clientName} — Image Test`,
          objective:        cd.defaultObjective ?? "OUTCOME_SALES",
          dailyBudget:      parseFloat(cd.defaultDailyBudget ?? "50"),
          destinationUrl:   cd.defaultDestinationUrl ?? "",
          headline:         cd.defaultHeadline ?? "",
          pixelId:          cd.defaultPixelId ?? "",
          optimizationGoal: cd.defaultOptGoal ?? "OFFSITE_CONVERSIONS",
          targetCountries:  (cd.defaultTargetCountries ?? "US").split(",").map((c: string) => c.trim().toUpperCase()),
          targetAgeMin:     parseInt(cd.defaultAgeMin ?? "18"),
          targetAgeMax:     parseInt(cd.defaultAgeMax ?? "65"),
          targetGenders:    [parseInt(cd.defaultGender ?? "0")],
          variations,
        }),
      });
      const data = await res.json();
      setResult(data);
      if (!data.ok) setError(data.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLaunching(false);
    }
  }

  if (result?.ok) {
    return (
      <div className="rounded-lg border border-emerald-700 bg-emerald-950/20 p-4">
        <p className="text-sm font-semibold text-emerald-300">Image test launched!</p>
        <p className="mt-1 text-xs text-slate-400">{result.summary}</p>
        {result.ads && result.ads.length > 0 && (
          <p className="mt-1 text-xs text-emerald-500">{result.ads.length} ad(s) created</p>
        )}
        {result.errors && result.errors.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-amber-400">Warnings:</p>
            {result.errors.map((e: string, i: number) => <p key={i} className="text-xs text-amber-300">{e}</p>)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {error && <p className="mb-2 text-xs text-rose-400">{error}</p>}
      <button
        onClick={handleLaunch}
        disabled={launching || !cd.defaultAdAccountId || !cd.defaultPageId || !cd.defaultDestinationUrl}
        className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white
          hover:bg-blue-500 disabled:opacity-50 active:scale-[0.98]"
      >
        {launching ? "Launching image test..." : `Launch Image Test (${imageUrls.length} images)`}
      </button>
      {(!cd.defaultAdAccountId || !cd.defaultPageId || !cd.defaultDestinationUrl) && (
        <p className="mt-1 text-xs text-amber-400">
          Set Ad Account ID, Page ID, and Destination URL in Client Settings first.
        </p>
      )}
      <p className="mt-1 text-center text-xs text-slate-600">
        Same copy, headline, targeting, and URL. Only the image changes per ad.
      </p>
    </div>
  );
}
