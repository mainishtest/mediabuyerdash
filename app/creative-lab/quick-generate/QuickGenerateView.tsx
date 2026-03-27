"use client";

// Quick Generate — paste ad copy, get variations, pick winners.
// No pipeline, no briefs, no assembly. Just fast iteration.

import { useState } from "react";

type Variation = {
  title: string;
  hook: string;
  body: string;
  callToAction: string;
};

type VariationWithStatus = Variation & {
  status: "none" | "approved" | "rejected";
};

export function QuickGenerateView() {
  // Input
  const [hook, setHook]                 = useState("");
  const [bodyText, setBodyText]         = useState("");
  const [cta, setCta]                   = useState("");
  const [imageHeadline, setImageHeadline] = useState("");
  const [clientName, setClientName]     = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [notes, setNotes]               = useState("");
  const [provider, setProvider]         = useState<"anthropic" | "openai">("anthropic");

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
          hook, bodyText, cta, imageHeadline,
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

  const approved = variations.filter((v) => v.status === "approved");
  const comparing = variations.filter((_, i) => compareIds.has(i));

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white">Quick Generate</h1>
        <p className="mt-1 text-sm text-slate-500">
          Paste your current ad copy. Get 3 variations. Pick winners. Build a test.
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
            <label className="mb-1 block text-xs text-slate-500">Client (optional)</label>
            <input
              type="text" value={clientName} onChange={(e) => setClientName(e.target.value)}
              placeholder="Client name..."
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm
                text-slate-100 placeholder-slate-600 focus:border-indigo-600 focus:outline-none"
            />
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

      {/* ── Approved summary ──────────────────────────────────────────── */}
      {approved.length > 0 && (
        <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/10 p-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-500">
            Approved for Testing ({approved.length})
          </p>
          {approved.map((v, i) => (
            <div key={i} className="rounded-lg border border-emerald-800/30 bg-emerald-950/20 p-3">
              <p className="text-xs font-semibold text-emerald-400">{v.title}</p>
              <p className="mt-1 text-sm text-white">{v.hook}</p>
              <p className="mt-1 text-xs text-slate-400">{v.body}</p>
              <p className="mt-1 text-xs text-slate-500">CTA: {v.callToAction}</p>
            </div>
          ))}
          <p className="text-xs text-slate-500">
            Next step: Create a Facebook A/B test using these approved variations with the existing ad image.
            Go to Meta Ads Manager → duplicate the original ad → swap in the new copy for each variation.
          </p>
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
