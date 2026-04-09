"use client";

import { useState, useTransition } from "react";
import { createConceptV2Action } from "../actions";
import { Panel } from "../components/Panel";
import { PlatformBadge } from "../components/PlatformBadge";
import { TagPill } from "../components/TagPill";
import {
  AD_STYLE_LABELS,
  AWARENESS_LABELS,
  PLATFORM_LABELS,
  MARKET_SOPHISTICATION_LABELS,
  CTA_GOAL_LABELS,
  VISUAL_STYLE_LABELS,
  PIPELINE_MODE_LABELS,
  type AdStyle,
  type Platform,
  type AwarenessStage,
  type VisualStyle,
  type CtaGoal,
  type MarketSophistication,
  type PipelineMode,
} from "../../../lib/videoAdGenerator/types";
import { PLATFORM_COMPARISON_MATRIX } from "../../../lib/videoAdGenerator/platformRules";

const AD_STYLES = Object.keys(AD_STYLE_LABELS) as AdStyle[];
const AWARENESS_OPTS = Object.keys(AWARENESS_LABELS) as AwarenessStage[];
const PLATFORMS = Object.keys(PLATFORM_LABELS) as Platform[];
const VISUAL_STYLES = Object.keys(VISUAL_STYLE_LABELS) as VisualStyle[];
const CTA_GOALS = Object.keys(CTA_GOAL_LABELS) as CtaGoal[];
const MODES = Object.keys(PIPELINE_MODE_LABELS) as PipelineMode[];

const INPUT = "w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 transition-colors focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600";
const LABEL = "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400";

type Step = 1 | 2 | 3;
const STEP_LABELS = ["Brief", "Creative", "Generate"];

export function NewConceptFormV2() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>(1);

  // Form state
  const [title, setTitle] = useState("");
  const [brandName, setBrandName] = useState("");
  const [productName, setProductName] = useState("");
  const [offer, setOffer] = useState("");
  const [audience, setAudience] = useState("");
  const [painPoints, setPainPoints] = useState("");
  const [awarenessStage, setAwarenessStage] = useState<AwarenessStage>("problem_aware");
  const [marketSoph, setMarketSoph] = useState<MarketSophistication>(3);
  const [platform, setPlatform] = useState<Platform>("facebook");
  const [adStyle, setAdStyle] = useState<AdStyle>("ugc");
  const [visualStyle, setVisualStyle] = useState<VisualStyle>("polished_ugc");
  const [ctaGoal, setCtaGoal] = useState<CtaGoal>("purchase");
  const [brandVoice, setBrandVoice] = useState("");
  const [extraNotes, setExtraNotes] = useState("");
  const [referenceUrls, setReferenceUrls] = useState("");
  const [pipelineMode, setPipelineMode] = useState<PipelineMode>("storyboard_only");
  const [showMatrix, setShowMatrix] = useState(false);

  // Claims
  const [claims, setClaims] = useState<Array<{ claim: string; proof: string; proofType: string }>>([]);
  const [newClaim, setNewClaim] = useState("");
  const [newProof, setNewProof] = useState("");
  const [newProofType, setNewProofType] = useState("testimonial");

  function addClaim() {
    if (!newClaim.trim()) return;
    setClaims([...claims, { claim: newClaim.trim(), proof: newProof.trim(), proofType: newProofType }]);
    setNewClaim("");
    setNewProof("");
  }

  // Validation
  const step1Valid = productName.trim() && offer.trim() && audience.trim() && painPoints.trim();
  const canSubmit = step1Valid;

  function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    const fd = new FormData();
    fd.set("title", title);
    fd.set("brandName", brandName);
    fd.set("productName", productName);
    fd.set("offer", offer);
    fd.set("audience", audience);
    fd.set("painPoints", painPoints);
    fd.set("awarenessStage", awarenessStage);
    fd.set("marketSophistication", String(marketSoph));
    fd.set("platform", platform);
    fd.set("adStyle", adStyle);
    fd.set("visualStyle", visualStyle);
    fd.set("ctaGoal", ctaGoal);
    fd.set("brandVoice", brandVoice);
    fd.set("extraNotes", extraNotes);
    fd.set("referenceAssetUrls", referenceUrls);
    fd.set("keyClaims", JSON.stringify(claims));
    fd.set("pipelineMode", pipelineMode);
    fd.set("tier", "premium");

    startTransition(async () => {
      const result = await createConceptV2Action(fd);
      if (!result.ok) setError(result.error ?? "Generation failed.");
    });
  }

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="flex items-center gap-2">
        {STEP_LABELS.map((label, i) => {
          const s = (i + 1) as Step;
          const isActive = step === s;
          const isDone = step > s;
          return (
            <button
              key={s}
              onClick={() => { if (s < step || (s === 2 && step1Valid) || s === 1) setStep(s); }}
              className="flex flex-1 items-center gap-2"
              disabled={s > step && !(s === 2 && step1Valid)}
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${
                isActive ? "bg-emerald-600 text-white" : isDone ? "bg-emerald-600/20 text-emerald-400" : "bg-slate-800 text-slate-500"
              }`}>{i + 1}</span>
              <span className={`text-xs font-semibold ${isActive ? "text-white" : isDone ? "text-emerald-400" : "text-slate-500"}`}>{label}</span>
              {i < 2 && <div className={`h-px flex-1 ${isDone ? "bg-emerald-600/40" : "bg-slate-800"}`} />}
            </button>
          );
        })}
      </div>

      {/* Step 1: Brief */}
      {step === 1 && (
        <Panel>
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-emerald-400">The Brief</h2>
          <p className="mb-6 text-xs text-slate-500">What are we advertising and to whom?</p>
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Brand Name" hint="optional">
                <input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="e.g. DreamDrops" className={INPUT} />
              </Field>
              <Field label="Concept Title" hint="optional">
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Sleep Gummies — UGC v2" className={INPUT} />
              </Field>
            </div>
            <Field label="Product" required>
              <input value={productName} onChange={(e) => setProductName(e.target.value)} required placeholder="e.g. Natural sleep gummies with L-theanine + magnesium" className={INPUT} />
            </Field>
            <Field label="Offer" required>
              <textarea value={offer} onChange={(e) => setOffer(e.target.value)} required rows={2} placeholder="Price, promise, bonuses, guarantee." className={INPUT} />
            </Field>
            <Field label="Audience" required>
              <textarea value={audience} onChange={(e) => setAudience(e.target.value)} required rows={2} placeholder="Demographic, psychographic, what they've tried." className={INPUT} />
            </Field>
            <Field label="Pain Points" required>
              <textarea value={painPoints} onChange={(e) => setPainPoints(e.target.value)} required rows={2} placeholder="Emotional and practical pains." className={INPUT} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Awareness Stage">
                <select value={awarenessStage} onChange={(e) => setAwarenessStage(e.target.value as AwarenessStage)} className={INPUT}>
                  {AWARENESS_OPTS.map((s) => <option key={s} value={s}>{AWARENESS_LABELS[s]}</option>)}
                </select>
              </Field>
              <Field label="Market Sophistication">
                <select value={marketSoph} onChange={(e) => setMarketSoph(parseInt(e.target.value) as MarketSophistication)} className={INPUT}>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{MARKET_SOPHISTICATION_LABELS[n]}</option>)}
                </select>
              </Field>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button onClick={() => { if (step1Valid) setStep(2); }} disabled={!step1Valid} className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-400">
              Next: Creative Direction
            </button>
          </div>
        </Panel>
      )}

      {/* Step 2: Creative */}
      {step === 2 && (
        <Panel>
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-emerald-400">Creative Direction</h2>
          <p className="mb-6 text-xs text-slate-500">How should the ad look, feel, and where will it run?</p>
          <div className="space-y-5">
            <Field label="Platform">
              <div className="grid grid-cols-3 gap-2">
                {PLATFORMS.map((p) => <Chip key={p} label={PLATFORM_LABELS[p]} active={platform === p} onClick={() => setPlatform(p)} />)}
              </div>
              {platform === "both" && (
                <p className="mt-2 rounded-lg border border-amber-800/50 bg-amber-950/20 px-3 py-2 text-xs text-amber-300">
                  Strategy engine will optimize for Facebook first, then produce Rumble-adapted variants.
                </p>
              )}
              <button onClick={() => setShowMatrix(!showMatrix)} className="mt-2 text-[11px] font-medium text-emerald-500 hover:text-emerald-400">
                {showMatrix ? "Hide" : "Show"} platform comparison
              </button>
              {showMatrix && (
                <div className="mt-2 overflow-x-auto rounded-lg border border-slate-800">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900">
                        <th className="px-3 py-1.5 text-left font-semibold text-slate-400">Dimension</th>
                        <th className="px-3 py-1.5 text-left font-semibold text-sky-400">Facebook</th>
                        <th className="px-3 py-1.5 text-left font-semibold text-orange-400">Rumble</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PLATFORM_COMPARISON_MATRIX.map((r) => (
                        <tr key={r.dimension} className="border-b border-slate-800/50">
                          <td className="px-3 py-1 font-medium text-slate-300">{r.dimension}</td>
                          <td className="px-3 py-1 text-slate-400">{r.facebook}</td>
                          <td className="px-3 py-1 text-slate-400">{r.rumble}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Field>
            <Field label="Ad Style">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {AD_STYLES.map((s) => <Chip key={s} label={AD_STYLE_LABELS[s]} active={adStyle === s} onClick={() => setAdStyle(s)} />)}
              </div>
            </Field>
            <Field label="Visual Style">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {VISUAL_STYLES.map((v) => <Chip key={v} label={VISUAL_STYLE_LABELS[v]} active={visualStyle === v} onClick={() => setVisualStyle(v)} />)}
              </div>
            </Field>
            <Field label="CTA Goal">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {CTA_GOALS.map((c) => <Chip key={c} label={CTA_GOAL_LABELS[c]} active={ctaGoal === c} onClick={() => setCtaGoal(c)} />)}
              </div>
            </Field>

            {/* Claims */}
            <Field label="Key Claims & Proof" hint="optional">
              {claims.length > 0 && (
                <div className="mb-3 space-y-1.5">
                  {claims.map((c, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs">
                      <div>
                        <span className="text-white">{c.claim}</span>
                        <span className="text-slate-500"> — {c.proof} ({c.proofType})</span>
                      </div>
                      <button onClick={() => setClaims(claims.filter((_, j) => j !== i))} className="text-slate-600 hover:text-rose-400">Remove</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input value={newClaim} onChange={(e) => setNewClaim(e.target.value)} placeholder="Claim" className={`flex-1 ${INPUT}`} />
                <input value={newProof} onChange={(e) => setNewProof(e.target.value)} placeholder="Proof" className={`flex-1 ${INPUT}`} />
                <select value={newProofType} onChange={(e) => setNewProofType(e.target.value)} className={`w-28 ${INPUT}`}>
                  <option value="stat">Stat</option>
                  <option value="testimonial">Testimonial</option>
                  <option value="authority">Authority</option>
                  <option value="demonstration">Demo</option>
                  <option value="social_proof">Social</option>
                  <option value="guarantee">Guarantee</option>
                </select>
                <button type="button" onClick={addClaim} className="shrink-0 rounded-lg bg-slate-800 px-3 text-xs font-medium text-slate-300 hover:bg-slate-700">Add</button>
              </div>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Brand Voice" hint="optional">
                <textarea value={brandVoice} onChange={(e) => setBrandVoice(e.target.value)} rows={2} placeholder="Tone, vocabulary, things to avoid." className={INPUT} />
              </Field>
              <Field label="Extra Notes" hint="optional">
                <textarea value={extraNotes} onChange={(e) => setExtraNotes(e.target.value)} rows={2} placeholder="Angle hints, compliance constraints." className={INPUT} />
              </Field>
            </div>
            <Field label="Reference URLs" hint="optional, comma-separated">
              <input value={referenceUrls} onChange={(e) => setReferenceUrls(e.target.value)} placeholder="https://example.com/product.jpg, …" className={INPUT} />
            </Field>
          </div>
          <div className="mt-6 flex justify-between">
            <button onClick={() => setStep(1)} className="text-xs font-medium text-slate-400 hover:text-white">Back</button>
            <button onClick={() => setStep(3)} className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500">
              Next: Review & Generate
            </button>
          </div>
        </Panel>
      )}

      {/* Step 3: Review + Generate */}
      {step === 3 && (
        <div className="space-y-4">
          <Panel>
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-emerald-400">Review & Generate</h2>
            <p className="mb-6 text-xs text-slate-500">Confirm your brief, then choose generation mode.</p>

            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 text-xs">
              <ReviewField label="Product" value={brandName ? `${brandName} — ${productName}` : productName} />
              <ReviewField label="Offer" value={offer} />
              <ReviewField label="Audience" value={audience} />
              <ReviewField label="Pain Points" value={painPoints} />
              <ReviewField label="Awareness" value={AWARENESS_LABELS[awarenessStage]} />
              <ReviewField label="Market Soph." value={MARKET_SOPHISTICATION_LABELS[marketSoph]} />
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5 border-t border-slate-800 pt-4">
              <PlatformBadge platform={platform} size="md" />
              <TagPill>{AD_STYLE_LABELS[adStyle]}</TagPill>
              <TagPill>{VISUAL_STYLE_LABELS[visualStyle]}</TagPill>
              <TagPill>{CTA_GOAL_LABELS[ctaGoal]}</TagPill>
              {claims.length > 0 && <TagPill>{`${claims.length} claims`}</TagPill>}
            </div>
          </Panel>

          {/* Mode selector */}
          <Panel>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Generation Mode</p>
            <div className="grid grid-cols-3 gap-3">
              {MODES.map((m) => (
                <button
                  key={m}
                  onClick={() => setPipelineMode(m)}
                  className={`rounded-xl border p-4 text-left transition-all ${
                    pipelineMode === m ? "border-emerald-600 bg-emerald-600/10" : "border-slate-800 bg-slate-950 hover:border-slate-700"
                  }`}
                >
                  <p className={`text-xs font-semibold ${pipelineMode === m ? "text-emerald-300" : "text-slate-300"}`}>
                    {PIPELINE_MODE_LABELS[m]}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {m === "strategy_only" && "Angle + hooks + script + CTAs. ~30s."}
                    {m === "storyboard_only" && "Full strategy + shot list + editor notes. ~60s."}
                    {m === "render_ready" && "Full strategy + compiled render briefs. ~90s."}
                  </p>
                </button>
              ))}
            </div>
          </Panel>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-rose-800 bg-rose-950/40 p-4">
              <p className="text-sm font-medium text-rose-300">Generation failed</p>
              <p className="mt-0.5 text-xs text-rose-400">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <button onClick={() => setStep(2)} className="text-xs font-medium text-slate-400 hover:text-white">Back</button>
            <button
              onClick={handleSubmit}
              disabled={isPending || !canSubmit}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-700"
            >
              {isPending ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Generating Concept…
                </>
              ) : (
                "Generate Concept"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Subcomponents ───────────────────────────────────────────────────

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className={LABEL}>{label} {hint && <span className="text-slate-600">({hint})</span>}</label>
      {children}
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2.5 text-xs font-medium transition-all ${
        active ? "border-emerald-600 bg-emerald-600/10 text-emerald-300" : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-200"
      }`}
    >{label}</button>
  );
}

function ReviewField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600">{label}</p>
      <p className="mt-0.5 line-clamp-2 text-slate-200">{value}</p>
    </div>
  );
}
