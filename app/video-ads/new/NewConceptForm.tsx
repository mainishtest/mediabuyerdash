"use client";

import { useState, useTransition } from "react";
import { createConceptAction } from "../actions";
import {
  AD_STYLE_LABELS,
  AWARENESS_LABELS,
  PLATFORM_LABELS,
  type AdStyle,
  type Platform,
  type AwarenessStage,
} from "../../../lib/videoAdGenerator/types";

const AD_STYLE_OPTIONS = Object.keys(AD_STYLE_LABELS) as AdStyle[];
const AWARENESS_OPTIONS = Object.keys(AWARENESS_LABELS) as AwarenessStage[];
const PLATFORM_OPTIONS = Object.keys(PLATFORM_LABELS) as Platform[];

const INPUT_BASE =
  "w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 transition-colors focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600";

const LABEL_BASE = "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400";

export function NewConceptForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adStyle, setAdStyle] = useState<AdStyle>("ugc");
  const [platform, setPlatform] = useState<Platform>("facebook");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await createConceptAction(formData);
      if (!result.ok) {
        setError(result.error ?? "Generation failed. Check your API key and try again.");
      }
      // Success case redirects via the server action.
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Section 1 — The Brief */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-emerald-400">
          1. The Brief
        </h2>
        <p className="mb-5 text-xs text-slate-500">
          What are we advertising and to whom?
        </p>

        <div className="space-y-5">
          <div>
            <label className={LABEL_BASE} htmlFor="title">
              Concept Title <span className="text-slate-600">(optional)</span>
            </label>
            <input
              id="title"
              name="title"
              type="text"
              placeholder="e.g. Sleep Gummies — UGC pattern interrupt v1"
              className={INPUT_BASE}
            />
          </div>

          <div>
            <label className={LABEL_BASE} htmlFor="productName">
              Product
            </label>
            <input
              id="productName"
              name="productName"
              required
              type="text"
              placeholder="e.g. DreamDrops — natural sleep gummies"
              className={INPUT_BASE}
            />
          </div>

          <div>
            <label className={LABEL_BASE} htmlFor="offer">
              Offer
            </label>
            <textarea
              id="offer"
              name="offer"
              required
              rows={3}
              placeholder="Price, promise, bonuses, guarantee. e.g. $39/mo, 30-day money back, buy 3 get 1 free."
              className={INPUT_BASE}
            />
          </div>
        </div>
      </section>

      {/* Section 2 — Audience */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-emerald-400">
          2. Audience
        </h2>
        <p className="mb-5 text-xs text-slate-500">
          Who is this ad talking to, and what do they want?
        </p>

        <div className="space-y-5">
          <div>
            <label className={LABEL_BASE} htmlFor="audience">
              Target Audience
            </label>
            <textarea
              id="audience"
              name="audience"
              required
              rows={3}
              placeholder="Demographic, psychographic, what they already tried. e.g. Women 35–55 who can't sleep, skeptical of melatonin, have tried Ambien."
              className={INPUT_BASE}
            />
          </div>

          <div>
            <label className={LABEL_BASE} htmlFor="painPoints">
              Pain Points
            </label>
            <textarea
              id="painPoints"
              name="painPoints"
              required
              rows={3}
              placeholder="The emotional and practical pains. e.g. Wake up at 3am, groggy all day, feel old, failing at work, spouse annoyed."
              className={INPUT_BASE}
            />
          </div>

          <div>
            <label className={LABEL_BASE} htmlFor="awarenessStage">
              Awareness Stage
            </label>
            <select
              id="awarenessStage"
              name="awarenessStage"
              defaultValue="problem_aware"
              className={INPUT_BASE}
            >
              {AWARENESS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {AWARENESS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Section 3 — Creative */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-emerald-400">
          3. Creative Direction
        </h2>
        <p className="mb-5 text-xs text-slate-500">
          How should the ad feel, and where is it running?
        </p>

        <div className="space-y-5">
          <div>
            <label className={LABEL_BASE}>Ad Style</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {AD_STYLE_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setAdStyle(s)}
                  className={`rounded-lg border px-3 py-2.5 text-xs font-medium transition-all ${
                    adStyle === s
                      ? "border-emerald-600 bg-emerald-600/10 text-emerald-300"
                      : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                  }`}
                >
                  {AD_STYLE_LABELS[s]}
                </button>
              ))}
            </div>
            <input type="hidden" name="adStyle" value={adStyle} />
          </div>

          <div>
            <label className={LABEL_BASE}>Platform</label>
            <div className="grid grid-cols-3 gap-2">
              {PLATFORM_OPTIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatform(p)}
                  className={`rounded-lg border px-3 py-2.5 text-xs font-medium transition-all ${
                    platform === p
                      ? "border-emerald-600 bg-emerald-600/10 text-emerald-300"
                      : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                  }`}
                >
                  {PLATFORM_LABELS[p]}
                </button>
              ))}
            </div>
            <input type="hidden" name="platform" value={platform} />
          </div>

          <div>
            <label className={LABEL_BASE} htmlFor="brandVoice">
              Brand Voice <span className="text-slate-600">(optional)</span>
            </label>
            <textarea
              id="brandVoice"
              name="brandVoice"
              rows={2}
              placeholder="Tone, vocabulary, things to avoid. e.g. Warm, honest, zero hype. Never say 'game-changer' or 'revolutionary'."
              className={INPUT_BASE}
            />
          </div>

          <div>
            <label className={LABEL_BASE} htmlFor="extraNotes">
              Extra Notes <span className="text-slate-600">(optional)</span>
            </label>
            <textarea
              id="extraNotes"
              name="extraNotes"
              rows={2}
              placeholder="Angle direction, references, must-include proof points, compliance constraints."
              className={INPUT_BASE}
            />
          </div>
        </div>
      </section>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-rose-800 bg-rose-950/40 p-4">
          <p className="text-sm font-medium text-rose-300">Generation failed</p>
          <p className="mt-0.5 text-xs text-rose-400">{error}</p>
        </div>
      )}

      {/* Submit */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-slate-500">
          Typical generation takes 30–90 seconds.
        </p>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-700"
        >
          {isPending ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              Generating concept…
            </>
          ) : (
            <>
              Generate Concept
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
