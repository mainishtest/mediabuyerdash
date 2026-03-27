"use client";

// app/creative-lab/brand-intelligence/page.tsx
// Brand Intelligence setup page.
//
// Flow:
//   1. Select client account
//   2. Paste landing page URL → extract signals
//   3. Answer smart clarification questions (optional)
//   4. Save brand context
//   5. Generate strategy frame + prompt preview
//   6. Use for copy/image generation

import { useEffect, useState, useCallback } from "react";
import type {
  LandingPageExtraction,
  BrandMemoryData,
  BrandPromptSummary,
  BrandClarificationQuestion,
  CreativeStylePreference,
  CreativeStrategyFrame,
  PromptGenerationResult,
  VariationIntent,
  CreativeHookType,
  CreativeAngleType,
} from "../../../types/brandIntelligence";
import {
  CREATIVE_STYLE_OPTIONS,
  CREATIVE_HOOK_TYPES,
  CREATIVE_ANGLE_TYPES,
  VARIATION_INTENTS,
} from "../../../types/brandIntelligence";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// ─── Section components ──────────────────────────────────────────────────────

function SectionCard({
  title, children, className,
}: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-slate-700 bg-slate-800/60 p-5", className)}>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">{title}</h3>
      {children}
    </div>
  );
}

function Badge({ label, color }: { label: string; color: "green" | "amber" | "red" | "slate" }) {
  const colors = {
    green: "bg-emerald-900/50 text-emerald-400",
    amber: "bg-amber-900/50 text-amber-400",
    red:   "bg-red-900/50 text-red-400",
    slate: "bg-slate-700/50 text-slate-400",
  };
  return (
    <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-medium", colors[color])}>
      {label}
    </span>
  );
}

function CompletenessBar({ value }: { value: number }) {
  const color = value >= 80 ? "bg-emerald-500" : value >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="h-2 w-full rounded-full bg-slate-700">
      <div className={cn("h-2 rounded-full transition-all", color)} style={{ width: `${value}%` }} />
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

type Client = { id: string; name: string };

export default function BrandIntelligencePage() {
  // ── Client selection ─────────────────────────────────────────────────────
  const [clients,         setClients]         = useState<Client[]>([]);
  const [selectedClient,  setSelectedClient]  = useState<string>("");

  // ── Landing page ─────────────────────────────────────────────────────────
  const [lpUrl,           setLpUrl]           = useState("");
  const [lpExtracting,    setLpExtracting]    = useState(false);
  const [lpData,          setLpData]          = useState<LandingPageExtraction | null>(null);
  const [lpError,         setLpError]         = useState<string | null>(null);

  // ── Brand context ────────────────────────────────────────────────────────
  const [brandMemory,     setBrandMemory]     = useState<BrandMemoryData | null>(null);
  const [summary,         setSummary]         = useState<BrandPromptSummary | null>(null);
  const [saving,          setSaving]          = useState(false);

  // ── Clarification questions ──────────────────────────────────────────────
  const [questions,       setQuestions]       = useState<BrandClarificationQuestion[]>([]);
  const [answers,         setAnswers]         = useState<Record<string, string>>({});

  // ── Style preference ─────────────────────────────────────────────────────
  const [stylePreference, setStylePreference] = useState<CreativeStylePreference | "">("");

  // ── Brand inputs ─────────────────────────────────────────────────────────
  const [productName,     setProductName]     = useState("");
  const [mainProblem,     setMainProblem]     = useState("");
  const [idealCustomer,   setIdealCustomer]   = useState("");
  const [avoidList,       setAvoidList]       = useState("");

  // ── Strategy ─────────────────────────────────────────────────────────────
  const [strategy,        setStrategy]        = useState<CreativeStrategyFrame | null>(null);
  const [promptResult,    setPromptResult]    = useState<PromptGenerationResult | null>(null);
  const [generatingStrat, setGeneratingStrat] = useState(false);
  const [selectedIntent,  setSelectedIntent]  = useState<VariationIntent | "">("");

  // ── Prompt preview ───────────────────────────────────────────────────────
  const [showPrompt,      setShowPrompt]      = useState(false);
  const [promptMode,      setPromptMode]      = useState<"copy" | "image" | "both">("both");

  // ── Load clients on mount ────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.clients) ? data.clients : [];
        setClients(list.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
      })
      .catch(() => {});
  }, []);

  // ── Load existing brand context when client changes ──────────────────────
  useEffect(() => {
    if (!selectedClient) return;
    fetch(`/api/brand-intelligence/context?clientAccountId=${selectedClient}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.data) {
          setBrandMemory(res.data);
          setSummary(res.summary);
          setLpData(res.data.landingPageData ?? null);
          setLpUrl(res.data.landingPageUrl ?? "");
          setProductName(res.data.offerSummary?.productName ?? "");
          setMainProblem(res.data.offerSummary?.mainProblem ?? "");
          setIdealCustomer(res.data.audience?.description ?? "");
          setStylePreference(res.data.stylePreference ?? "");
          setAvoidList(res.data.avoidList?.join(", ") ?? "");
        } else {
          setBrandMemory(null);
          setSummary(res.summary);
        }
      })
      .catch(() => {});
  }, [selectedClient]);

  // ── Extract landing page ─────────────────────────────────────────────────
  async function extractLandingPage() {
    if (!lpUrl) return;
    setLpExtracting(true);
    setLpError(null);
    try {
      const res = await fetch("/api/brand-intelligence/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: lpUrl }),
      });
      const data = await res.json();
      if (data.error) { setLpError(data.error); return; }
      setLpData(data);
      // Auto-fill product name from headline if empty
      if (!productName && data.headline) setProductName(data.headline);
    } catch {
      setLpError("Failed to analyze landing page");
    } finally {
      setLpExtracting(false);
    }
  }

  // ── Load clarification questions ─────────────────────────────────────────
  async function loadQuestions() {
    if (!selectedClient) return;
    const res = await fetch("/api/brand-intelligence/clarification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientAccountId: selectedClient }),
    });
    const data = await res.json();
    setQuestions(data.questions ?? []);
  }

  // ── Save brand context ───────────────────────────────────────────────────
  async function saveBrandContext() {
    if (!selectedClient) return;
    setSaving(true);

    const client = clients.find((c) => c.id === selectedClient);
    const brandName = client?.name ?? "Brand";

    const memory: BrandMemoryData = {
      brandProfile: {
        clientAccountId: selectedClient,
        brandName,
        industry:        null,
        productCategory: null,
        coreBenefit:     lpData?.keyBenefits?.[0] ?? null,
        uniqueMechanism: null,
        pricePoint:      lpData?.price ?? null,
        targetGender:    null,
        targetAgeRange:  null,
      },
      offerSummary: {
        productName: productName || brandName,
        offerHeadline: lpData?.headline ?? null,
        offerDetails:  lpData?.offer ?? null,
        mainProblem:   mainProblem || answers["offerSummary.mainProblem"] || null,
        mainSolution:  lpData?.positioning ?? null,
        proofPoints:   lpData?.testimonials ?? [],
        objections:    [],
        urgencyAngle:  lpData?.discount ?? null,
      },
      voiceProfile: {
        toneKeywords:   lpData?.tone ? lpData.tone.split(/[,;]+/).map((t) => t.trim()) : ["professional", "clear"],
        formality:      stylePreference === "clean_premium" ? "formal" : stylePreference === "aggressive_dr" || stylePreference === "ugc_native" ? "casual" : "balanced",
        perspective:    stylePreference === "ugc_native" ? "first_person" : "second_person",
        vocabulary:     stylePreference === "clean_premium" ? "sophisticated" : "simple",
        avoidWords:     [],
        avoidTopics:    avoidList ? avoidList.split(",").map((s) => s.trim()).filter(Boolean) : [],
        examplePhrases: [],
      },
      audience: {
        name:           null,
        description:    idealCustomer || answers["audience.description"] || "Target customer for this product",
        painPoints:     mainProblem ? [mainProblem] : [],
        desires:        lpData?.keyBenefits?.slice(0, 3) ?? [],
        objections:     [],
        languageStyle:  null,
        awarenessLevel: "problem_aware",
      },
      landingPageUrl:  lpUrl || null,
      landingPageData: lpData,
      stylePreference: (stylePreference as CreativeStylePreference) || null,
      avoidList:       avoidList ? avoidList.split(",").map((s) => s.trim()).filter(Boolean) : [],
      referenceNotes:  answers["referenceNotes"] || null,
    };

    try {
      const res = await fetch("/api/brand-intelligence/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientAccountId: selectedClient,
          data:            memory,
          landingPageUrl:  lpUrl || null,
          landingPageData: lpData,
        }),
      });
      const result = await res.json();
      setBrandMemory(memory);
      setSummary(result.summary);
    } catch {
      // silent — user will see the summary didn't update
    } finally {
      setSaving(false);
    }
  }

  // ── Generate strategy + prompts ──────────────────────────────────────────
  async function generateStrategy() {
    if (!selectedClient) return;
    setGeneratingStrat(true);
    try {
      const res = await fetch("/api/brand-intelligence/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientAccountId: selectedClient,
          intent:          selectedIntent || null,
          mode:            promptMode,
        }),
      });
      const data = await res.json();
      if (data.error) return;
      setStrategy(data.strategy);
      setPromptResult(data.result);
    } catch {
      // silent
    } finally {
      setGeneratingStrat(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/60 px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Creative Lab</p>
          <h1 className="mt-0.5 text-xl font-bold text-white">Brand Intelligence</h1>
          <p className="mt-1 text-sm text-slate-400">
            Set up your brand once, then generate better ads with a click.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">

        {/* Client selector */}
        <SectionCard title="Client Account">
          <select
            value={selectedClient}
            onChange={(e) => {
              setSelectedClient(e.target.value);
              setLpData(null);
              setStrategy(null);
              setPromptResult(null);
            }}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-emerald-600"
          >
            <option value="">Select a client account...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </SectionCard>

        {selectedClient && (
          <>
            {/* Completeness summary */}
            {summary && (
              <SectionCard title="Brand Context Readiness">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">{summary.completeness}% complete</span>
                    <Badge
                      label={summary.strategyReady ? "Ready" : "Needs Setup"}
                      color={summary.strategyReady ? "green" : "amber"}
                    />
                  </div>
                  <CompletenessBar value={summary.completeness} />
                  {summary.missingFields.length > 0 && (
                    <p className="text-xs text-slate-500">
                      Missing: {summary.missingFields.join(", ")}
                    </p>
                  )}
                </div>
              </SectionCard>
            )}

            {/* Landing page extraction */}
            <SectionCard title="Landing Page">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={lpUrl}
                  onChange={(e) => setLpUrl(e.target.value)}
                  placeholder="https://yourbrand.com/offer"
                  className="flex-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-emerald-600"
                />
                <button
                  onClick={extractLandingPage}
                  disabled={lpExtracting || !lpUrl}
                  className="whitespace-nowrap rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
                >
                  {lpExtracting ? "Analyzing..." : "Analyze Landing Page"}
                </button>
              </div>
              {lpError && <p className="mt-2 text-sm text-red-400">{lpError}</p>}

              {lpData && (
                <div className="mt-4 space-y-3 rounded-lg border border-slate-700 bg-slate-900/60 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Extracted Signals</span>
                    <Badge
                      label={lpData.quality}
                      color={lpData.quality === "rich" ? "green" : lpData.quality === "moderate" ? "amber" : "red"}
                    />
                  </div>
                  {lpData.headline && (
                    <div>
                      <span className="text-xs text-slate-500">Headline:</span>
                      <p className="text-sm text-slate-200">{lpData.headline}</p>
                    </div>
                  )}
                  {lpData.offer && (
                    <div>
                      <span className="text-xs text-slate-500">Offer:</span>
                      <p className="text-sm text-slate-200">{lpData.offer}</p>
                    </div>
                  )}
                  {lpData.keyBenefits.length > 0 && (
                    <div>
                      <span className="text-xs text-slate-500">Key Benefits:</span>
                      <ul className="mt-1 space-y-0.5">
                        {lpData.keyBenefits.map((b, i) => (
                          <li key={i} className="text-sm text-slate-300">• {b}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {lpData.price && (
                      <div><span className="text-xs text-slate-500">Price:</span><p className="text-sm text-slate-200">{lpData.price}</p></div>
                    )}
                    {lpData.discount && (
                      <div><span className="text-xs text-slate-500">Discount:</span><p className="text-sm text-slate-200">{lpData.discount}</p></div>
                    )}
                    {lpData.tone && (
                      <div><span className="text-xs text-slate-500">Tone:</span><p className="text-sm text-slate-200">{lpData.tone}</p></div>
                    )}
                    {lpData.ctaLanguage && (
                      <div><span className="text-xs text-slate-500">CTA:</span><p className="text-sm text-slate-200">{lpData.ctaLanguage}</p></div>
                    )}
                  </div>
                  {lpData.testimonials.length > 0 && (
                    <div>
                      <span className="text-xs text-slate-500">Testimonials:</span>
                      {lpData.testimonials.map((t, i) => (
                        <p key={i} className="mt-1 text-sm italic text-slate-400">&ldquo;{t}&rdquo;</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </SectionCard>

            {/* Brand inputs */}
            <div className="grid gap-6 lg:grid-cols-2">
              <SectionCard title="Product & Offer">
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Product Name</label>
                    <input
                      type="text"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      placeholder="e.g. Glow Serum, FitPro Tracker"
                      className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Main Problem It Solves</label>
                    <input
                      type="text"
                      value={mainProblem}
                      onChange={(e) => setMainProblem(e.target.value)}
                      placeholder="The core pain point your customer feels"
                      className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Ideal Customer</label>
                    <input
                      type="text"
                      value={idealCustomer}
                      onChange={(e) => setIdealCustomer(e.target.value)}
                      placeholder="e.g. busy moms 30-45, male fitness enthusiasts"
                      className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Creative Style">
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Preferred Ad Style</label>
                    <div className="grid grid-cols-2 gap-2">
                      {CREATIVE_STYLE_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setStylePreference(opt.value)}
                          className={cn(
                            "rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                            stylePreference === opt.value
                              ? "border-emerald-600 bg-emerald-600/20 text-emerald-300"
                              : "border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Things to Avoid</label>
                    <input
                      type="text"
                      value={avoidList}
                      onChange={(e) => setAvoidList(e.target.value)}
                      placeholder="Words, topics, styles to steer away from (comma separated)"
                      className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* Save brand context */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={saveBrandContext}
                disabled={saving || !selectedClient}
                className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Brand Context"}
              </button>
              <button
                onClick={loadQuestions}
                disabled={!selectedClient}
                className="rounded-lg border border-slate-600 px-5 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
              >
                Show Smart Questions
              </button>
            </div>

            {/* Clarification questions */}
            {questions.length > 0 && (
              <SectionCard title="Brand Clarification">
                <div className="space-y-4">
                  {questions.map((q) => (
                    <div key={q.id}>
                      <label className="mb-1 block text-sm font-medium text-slate-300">{q.question}</label>
                      {q.hint && <p className="mb-1 text-xs text-slate-500">{q.hint}</p>}
                      {q.inputType === "select" && q.options ? (
                        <select
                          value={answers[q.fieldKey] ?? ""}
                          onChange={(e) => setAnswers((a) => ({ ...a, [q.fieldKey]: e.target.value }))}
                          className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-600"
                        >
                          <option value="">Select...</option>
                          {q.options.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={answers[q.fieldKey] ?? ""}
                          onChange={(e) => setAnswers((a) => ({ ...a, [q.fieldKey]: e.target.value }))}
                          className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-emerald-600"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Strategy generation */}
            <SectionCard title="Generate Prompt Strategy">
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Variation Intent (optional)</label>
                    <select
                      value={selectedIntent}
                      onChange={(e) => setSelectedIntent(e.target.value as VariationIntent | "")}
                      className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-600"
                    >
                      <option value="">Auto (default strategy)</option>
                      {VARIATION_INTENTS.map((v) => (
                        <option key={v.intent} value={v.intent}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Generation Mode</label>
                    <select
                      value={promptMode}
                      onChange={(e) => setPromptMode(e.target.value as "copy" | "image" | "both")}
                      className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-600"
                    >
                      <option value="both">Copy + Image</option>
                      <option value="copy">Copy Only</option>
                      <option value="image">Image Only</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={generateStrategy}
                      disabled={generatingStrat || !brandMemory}
                      className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {generatingStrat ? "Generating..." : "Generate Prompt Strategy"}
                    </button>
                  </div>
                </div>

                {!brandMemory && (
                  <p className="text-xs text-amber-400">
                    Save brand context first to generate strategy.
                  </p>
                )}
              </div>
            </SectionCard>

            {/* Strategy result */}
            {strategy && (
              <SectionCard title="Generated Strategy">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <span className="text-xs text-slate-500">Hook Type</span>
                    <p className="text-sm font-medium text-emerald-400">
                      {CREATIVE_HOOK_TYPES.find((h) => h.type === strategy.hookType)?.label ?? strategy.hookType}
                    </p>
                    <p className="text-xs text-slate-500">
                      {CREATIVE_HOOK_TYPES.find((h) => h.type === strategy.hookType)?.description}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Angle</span>
                    <p className="text-sm font-medium text-emerald-400">
                      {CREATIVE_ANGLE_TYPES.find((a) => a.type === strategy.angleType)?.label ?? strategy.angleType}
                    </p>
                    <p className="text-xs text-slate-500">
                      {CREATIVE_ANGLE_TYPES.find((a) => a.type === strategy.angleType)?.description}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Voice</span>
                    <p className="text-sm text-slate-300">{strategy.voiceStyle}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-xs text-slate-500">Offer Emphasis</span>
                    <p className="text-sm text-slate-300">{strategy.offerEmphasis}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Visual Direction</span>
                    <p className="text-sm text-slate-300">{strategy.visualDirection}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs italic text-slate-500">{strategy.rationale}</p>
              </SectionCard>
            )}

            {/* Prompt preview */}
            {promptResult && (
              <SectionCard title="Prompt Preview">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowPrompt(!showPrompt)}
                      className="text-xs text-emerald-400 hover:text-emerald-300"
                    >
                      {showPrompt ? "Hide Prompt Details" : "Show Prompt Details"}
                    </button>
                    <span className="text-xs text-slate-600">
                      {promptResult.sections.length} sections assembled
                    </span>
                  </div>

                  {showPrompt && (
                    <div className="space-y-4">
                      {/* Structured sections */}
                      {promptResult.sections.map((s) => (
                        <div key={s.key} className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">{s.heading}</p>
                          <pre className="whitespace-pre-wrap text-xs text-slate-300">{s.content}</pre>
                        </div>
                      ))}

                      {/* Raw prompts */}
                      {promptResult.copyPrompt && (
                        <div>
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-emerald-500">Full Copy Prompt</p>
                          <pre className="max-h-64 overflow-auto rounded-lg border border-slate-700 bg-slate-900 p-3 text-xs text-slate-400">
                            {promptResult.copyPrompt}
                          </pre>
                        </div>
                      )}
                      {promptResult.imagePrompt && (
                        <div>
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-emerald-500">Full Image Prompt</p>
                          <pre className="max-h-64 overflow-auto rounded-lg border border-slate-700 bg-slate-900 p-3 text-xs text-slate-400">
                            {promptResult.imagePrompt}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2 border-t border-slate-700 pt-3">
                    <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500">
                      Use for Copy Variations
                    </button>
                    <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500">
                      Use for Image Variations
                    </button>
                    <button className="rounded-lg border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-600/20">
                      Use for Both
                    </button>
                  </div>
                </div>
              </SectionCard>
            )}
          </>
        )}
      </div>
    </div>
  );
}
