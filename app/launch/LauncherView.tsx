"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { executeLaunchAction } from "./actions";
import type { LaunchPayload } from "../../lib/meta/launch";

// ── Types ────────────────────────────────────────────────────────────────────

interface AdAccount { id: string; externalId: string; name: string; currency: string }
interface Page { id: string; name: string }
interface Pixel { id: string; name: string }
interface IGAccount { id: string; username: string }
interface Objective { value: string; label: string; description: string }
interface ConversionEvent { event_name: string; description?: string }
interface CtaType { value: string; label: string }
interface Asset { id: string; name: string; type: string; url: string | null; thumbnailUrl: string | null; sourceType: string; headline: string | null; body: string | null; callToAction: string | null }

interface LaunchOptions {
  connected: boolean;
  adAccounts: AdAccount[];
  pages: Page[];
  pixels: Pixel[];
  instagramAccounts: IGAccount[];
  objectives: Objective[];
  conversionEvents: ConversionEvent[];
  ctaTypes: CtaType[];
}

interface Prefill {
  source?: "operator_draft" | string;
  conceptId?: string;
  assetId?: string;
  conceptTitle?: string;
  assetName?: string;
  productName?: string;
  assetType?: "image" | "video";
  assetUrl?: string | null;
  thumbnailUrl?: string | null;
  primaryText?: string;
  headline?: string;
  ctaText?: string;
  campaignName?: string;
  adSetName?: string;
  adName?: string;
  // Operator Agent draft fields
  objective?: string;
  dailyBudget?: number;
  destinationUrl?: string;
  countries?: string;
  ageMin?: number;
  ageMax?: number;
  gender?: number;
  adAccountId?: string;
  pageId?: string;
  pixelId?: string;
  mediaUrl?: string;
  mediaType?: string;
}

interface Props {
  options: LaunchOptions;
  prefill: Prefill | null;
  assets: Asset[];
}

type LaunchState = "idle" | "validating" | "launching" | "success" | "failed";
type CreativeTab = "edit" | "preview";

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_OBJECTIVES: Objective[] = [
  { value: "OUTCOME_SALES", label: "Sales", description: "Drive purchases or conversions" },
  { value: "OUTCOME_LEADS", label: "Leads", description: "Generate leads" },
  { value: "OUTCOME_TRAFFIC", label: "Traffic", description: "Drive website traffic" },
  { value: "OUTCOME_ENGAGEMENT", label: "Engagement", description: "Get more engagement" },
  { value: "OUTCOME_AWARENESS", label: "Awareness", description: "Reach people likely to remember" },
];

const DEFAULT_CTA_TYPES: CtaType[] = [
  { value: "SHOP_NOW", label: "Shop Now" },
  { value: "LEARN_MORE", label: "Learn More" },
  { value: "SIGN_UP", label: "Sign Up" },
  { value: "BUY_NOW", label: "Buy Now" },
  { value: "CONTACT_US", label: "Contact Us" },
  { value: "SUBSCRIBE", label: "Subscribe" },
  { value: "ORDER_NOW", label: "Order Now" },
  { value: "GET_OFFER", label: "Get Offer" },
  { value: "NO_BUTTON", label: "No Button" },
];

const DEFAULT_EVENTS: ConversionEvent[] = [
  { event_name: "PURCHASE", description: "Purchase" },
  { event_name: "LEAD", description: "Lead" },
  { event_name: "COMPLETE_REGISTRATION", description: "Complete Registration" },
  { event_name: "ADD_TO_CART", description: "Add to Cart" },
  { event_name: "INITIATED_CHECKOUT", description: "Initiate Checkout" },
  { event_name: "CONTENT_VIEW", description: "View Content" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// LauncherView
// ═══════════════════════════════════════════════════════════════════════════════

export function LauncherView({ options, prefill, assets }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // ── Form state (prefilled from operator agent draft, concept, or asset) ─
  const [campaignName, setCampaignName] = useState(prefill?.campaignName ?? "");
  const [adAccountId, setAdAccountId] = useState(prefill?.adAccountId || options.adAccounts[0]?.externalId ?? "");
  const [pageId, setPageId] = useState(prefill?.pageId || options.pages[0]?.id ?? "");
  const [igAccountId, setIgAccountId] = useState(options.instagramAccounts[0]?.id ?? "");
  const [objective, setObjective] = useState(prefill?.objective || "OUTCOME_SALES");
  const [specialAdCategories, setSpecialAdCategories] = useState<string[]>(["NONE"]);

  // Conversion & destination
  const [adSetName, setAdSetName] = useState(prefill?.adSetName ?? "");
  const [optimizationGoal, setOptimizationGoal] = useState("OFFSITE_CONVERSIONS");
  const [pixelId, setPixelId] = useState(prefill?.pixelId || options.pixels[0]?.id ?? "");
  const [conversionEvent, setConversionEvent] = useState("PURCHASE");
  const [destinationUrl, setDestinationUrl] = useState(prefill?.destinationUrl ?? "");

  // Audience
  const [advantageAudience, setAdvantageAudience] = useState(true);
  const [countries, setCountries] = useState(prefill?.countries ?? "US");
  const [ageMin, setAgeMin] = useState(prefill?.ageMin ?? 18);
  const [ageMax, setAgeMax] = useState(prefill?.ageMax ?? 65);
  const [gender, setGender] = useState(prefill?.gender ?? 0); // 0 = all

  // Budget
  const [dailyBudget, setDailyBudget] = useState(prefill?.dailyBudget ?? 20);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");

  // Ad creative
  const [adName, setAdName] = useState(prefill?.adName ?? "");
  const [primaryText, setPrimaryText] = useState(prefill?.primaryText ?? "");
  const [headline, setHeadline] = useState(prefill?.headline ?? "");
  const [ctaType, setCtaType] = useState("SHOP_NOW");
  const [creativeTab, setCreativeTab] = useState<CreativeTab>("edit");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(prefill?.assetId ?? null);
  const [showAssetPicker, setShowAssetPicker] = useState(false);

  // Launch state
  const [launchState, setLaunchState] = useState<LaunchState>("idle");
  const [launchErrors, setLaunchErrors] = useState<Array<{ message: string }>>([]);
  const [launchResult, setLaunchResult] = useState<{ campaignId?: string; adId?: string } | null>(null);

  // ── Derived ────────────────────────────────────────────────────────────
  const objectives = options.objectives.length > 0 ? options.objectives : DEFAULT_OBJECTIVES;
  const ctaTypes = options.ctaTypes.length > 0 ? options.ctaTypes : DEFAULT_CTA_TYPES;
  const events = options.conversionEvents.length > 0 ? options.conversionEvents : DEFAULT_EVENTS;
  const selectedAsset = assets.find((a) => a.id === selectedAssetId) ?? null;
  const mediaCount = selectedAsset ? 1 : 0;

  // ── Launch handler ─────────────────────────────────────────────────────
  const handleLaunch = useCallback(() => {
    startTransition(async () => {
      setLaunchState("validating");
      setLaunchErrors([]);

      // Build payload — access token is injected server-side by the action
      const payload: LaunchPayload = {
        campaignName,
        objective: objective as LaunchPayload["objective"],
        specialAdCategories: specialAdCategories as LaunchPayload["specialAdCategories"],
        campaignStatus: "PAUSED",
        adSetName,
        optimizationGoal: optimizationGoal as LaunchPayload["optimizationGoal"],
        billingEvent: "IMPRESSIONS",
        dailyBudget,
        startTime: startDate ? new Date(startDate).toISOString() : undefined,
        endTime: endDate ? new Date(endDate).toISOString() : undefined,
        targeting: {
          geo_locations: { countries: countries.split(",").map((c) => c.trim().toUpperCase()) },
          age_min: ageMin,
          age_max: ageMax,
          genders: gender === 0 ? undefined : [gender],
          ...(advantageAudience ? { advantage_audience: 1 } : {}),
        },
        pixelId: pixelId || undefined,
        conversionEvent: conversionEvent || undefined,
        pageId,
        instagramAccountId: igAccountId || undefined,
        primaryText,
        headline: headline || undefined,
        ctaType,
        destinationUrl,
        mediaUrl: selectedAsset?.url ?? undefined,
        mediaType: (selectedAsset?.type as "image" | "video") ?? undefined,
        adName,
        adStatus: "PAUSED",
        adAccountId,
        accessToken: "", // Server action will inject this
      };

      setLaunchState("launching");
      const result = await executeLaunchAction(payload);

      if (result.ok) {
        setLaunchState("success");
        setLaunchResult({ campaignId: result.campaignId, adId: result.adId });
      } else {
        setLaunchState("failed");
        setLaunchErrors(result.errors ?? [{ message: "Launch failed" }]);
      }
    });
  }, [campaignName, objective, specialAdCategories, adSetName, optimizationGoal, dailyBudget, startDate, endDate, countries, ageMin, ageMax, gender, advantageAudience, pixelId, conversionEvent, pageId, igAccountId, primaryText, headline, ctaType, destinationUrl, selectedAsset, adName, adAccountId]);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/video-ads" className="text-slate-500 hover:text-slate-300 transition-colors">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </Link>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Campaign Launcher</p>
              <h1 className="text-lg font-semibold text-white">
                {prefill?.conceptTitle ?? prefill?.assetName ?? "New Campaign"}
              </h1>
            </div>
          </div>
          {!options.connected && (
            <Link href="/integrations/meta" className="rounded-lg border border-amber-700 bg-amber-950/40 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-900/40">
              Connect Meta Account
            </Link>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">

        {/* ══ Success state ══ */}
        {launchState === "success" && (
          <div className="rounded-xl border border-emerald-700 bg-emerald-950/40 p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600">
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 className="text-lg font-semibold text-white">Campaign Launched</h2>
            <p className="mt-1 text-sm text-slate-400">Your campaign has been created on Meta (paused). Review it in Ads Manager to go live.</p>
            {launchResult?.campaignId && <p className="mt-2 text-xs text-slate-500">Campaign ID: {launchResult.campaignId}</p>}
            <div className="mt-4 flex justify-center gap-3">
              <button onClick={() => { setLaunchState("idle"); setLaunchResult(null); }} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:text-white">
                Launch Another
              </button>
              <Link href="/video-ads" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500">
                Back to Library
              </Link>
            </div>
          </div>
        )}

        {launchState !== "success" && (
          <>
            {/* ══ Section 1: Campaign Setup ══ */}
            <Section title="Campaign Setup" number={1}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Campaign Name" required>
                  <input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="e.g. Summer Sale — Video Ads" className={INPUT} />
                </Field>
                <Field label="Ad Account">
                  <select value={adAccountId} onChange={(e) => setAdAccountId(e.target.value)} className={INPUT}>
                    {options.adAccounts.length === 0 && <option value="">No accounts connected</option>}
                    {options.adAccounts.map((a) => <option key={a.externalId} value={a.externalId}>{a.name} ({a.currency})</option>)}
                  </select>
                </Field>
                <Field label="Facebook Page" required>
                  <select value={pageId} onChange={(e) => setPageId(e.target.value)} className={INPUT}>
                    {options.pages.length === 0 && <option value="">No pages found — sync required</option>}
                    {options.pages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </Field>
                <Field label="Instagram Account">
                  <select value={igAccountId} onChange={(e) => setIgAccountId(e.target.value)} className={INPUT}>
                    <option value="">None</option>
                    {options.instagramAccounts.map((a) => <option key={a.id} value={a.id}>@{a.username}</option>)}
                  </select>
                </Field>
                <Field label="Campaign Objective" required>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {objectives.map((o) => (
                      <button key={o.value} onClick={() => setObjective(o.value)}
                        className={`rounded-lg border px-3 py-2 text-left transition-all ${objective === o.value ? "border-emerald-700 bg-emerald-950/40 text-emerald-300" : "border-slate-800 text-slate-400 hover:border-slate-700"}`}>
                        <p className="text-xs font-semibold">{o.label}</p>
                        <p className="mt-0.5 text-[10px] text-slate-500">{o.description}</p>
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Special Ad Categories">
                  <select value={specialAdCategories[0]} onChange={(e) => setSpecialAdCategories([e.target.value])} className={INPUT}>
                    <option value="NONE">None</option>
                    <option value="CREDIT">Credit</option>
                    <option value="EMPLOYMENT">Employment</option>
                    <option value="HOUSING">Housing</option>
                    <option value="SOCIAL_ISSUES_ELECTIONS_POLITICS">Social Issues / Politics</option>
                  </select>
                </Field>
              </div>
            </Section>

            {/* ══ Section 2: Conversion & Destination ══ */}
            <Section title="Conversion & Destination" number={2}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Ad Set Name" required>
                  <input value={adSetName} onChange={(e) => setAdSetName(e.target.value)} placeholder="e.g. Broad — 18-65 — US" className={INPUT} />
                </Field>
                <Field label="Performance Goal">
                  <select value={optimizationGoal} onChange={(e) => setOptimizationGoal(e.target.value)} className={INPUT}>
                    <option value="OFFSITE_CONVERSIONS">Conversions</option>
                    <option value="LANDING_PAGE_VIEWS">Landing Page Views</option>
                    <option value="LINK_CLICKS">Link Clicks</option>
                    <option value="IMPRESSIONS">Impressions</option>
                    <option value="REACH">Reach</option>
                    <option value="LEAD_GENERATION">Lead Generation</option>
                    <option value="VALUE">Value (ROAS)</option>
                  </select>
                </Field>
                <Field label="Dataset / Pixel">
                  <select value={pixelId} onChange={(e) => setPixelId(e.target.value)} className={INPUT}>
                    {options.pixels.length === 0 && <option value="">No pixels found</option>}
                    {options.pixels.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </Field>
                <Field label="Conversion Event">
                  <select value={conversionEvent} onChange={(e) => setConversionEvent(e.target.value)} className={INPUT}>
                    {events.map((e) => <option key={e.event_name} value={e.event_name}>{e.description ?? e.event_name}</option>)}
                  </select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Destination URL" required>
                    <input value={destinationUrl} onChange={(e) => setDestinationUrl(e.target.value)} placeholder="https://yoursite.com/offer" className={INPUT} />
                  </Field>
                </div>
              </div>
            </Section>

            {/* ══ Section 3: Audience ══ */}
            <Section title="Audience" number={3}>
              <div className="mb-4 flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-white">Advantage+ Audience</p>
                  <p className="text-[11px] text-slate-500">Let Meta optimize targeting with AI</p>
                </div>
                <button onClick={() => setAdvantageAudience(!advantageAudience)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${advantageAudience ? "bg-emerald-600" : "bg-slate-700"}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${advantageAudience ? "left-[22px]" : "left-0.5"}`} />
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Locations">
                  <input value={countries} onChange={(e) => setCountries(e.target.value)} placeholder="US, CA, GB" className={INPUT} />
                  <p className="mt-1 text-[10px] text-slate-600">Comma-separated country codes</p>
                </Field>
                <Field label="Age Range">
                  <div className="flex items-center gap-2">
                    <input type="number" value={ageMin} onChange={(e) => setAgeMin(Number(e.target.value))} min={13} max={65} className={`${INPUT} w-20`} />
                    <span className="text-slate-600">—</span>
                    <input type="number" value={ageMax} onChange={(e) => setAgeMax(Number(e.target.value))} min={13} max={65} className={`${INPUT} w-20`} />
                  </div>
                </Field>
                <Field label="Gender">
                  <div className="flex gap-1">
                    {([{ v: 0, l: "All" }, { v: 1, l: "Male" }, { v: 2, l: "Female" }] as const).map((g) => (
                      <button key={g.v} onClick={() => setGender(g.v)}
                        className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${gender === g.v ? "border-emerald-700 bg-emerald-950/40 text-emerald-300" : "border-slate-800 text-slate-400 hover:border-slate-700"}`}>
                        {g.l}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
            </Section>

            {/* ══ Section 4: Budget ══ */}
            <Section title="Budget" number={4}>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Daily Budget" required>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">$</span>
                    <input type="number" value={dailyBudget} onChange={(e) => setDailyBudget(Number(e.target.value))} min={1} step={1}
                      className={`${INPUT} pl-7`} />
                  </div>
                </Field>
                <Field label="Start Date">
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={INPUT} />
                </Field>
                <Field label="End Date (optional)">
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={INPUT} />
                </Field>
              </div>
              <p className="mt-3 text-[11px] text-slate-600">Budget will be managed directly on Meta after launch. Campaign launches in PAUSED state.</p>
            </Section>

            {/* ══ Section 5: Ad Creative ══ */}
            <Section title="Ad Creative" number={5}>
              {/* Tab bar */}
              <div className="mb-4 flex items-center justify-between">
                <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900/50 p-0.5">
                  {(["edit", "preview"] as const).map((t) => (
                    <button key={t} onClick={() => setCreativeTab(t)}
                      className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-all ${creativeTab === t ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"}`}>
                      {t === "edit" ? "Edit" : "Preview"}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-slate-500">{mediaCount} media attached</span>
              </div>

              {creativeTab === "edit" ? (
                <div className="space-y-4">
                  {/* Media section */}
                  <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/30 p-4">
                    {selectedAsset ? (
                      <div className="flex items-center gap-4">
                        <div className="h-20 w-20 shrink-0 rounded-lg border border-slate-700 bg-slate-950 flex items-center justify-center overflow-hidden">
                          {selectedAsset.thumbnailUrl || selectedAsset.url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={selectedAsset.thumbnailUrl ?? selectedAsset.url ?? ""} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <svg className="h-8 w-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white truncate">{selectedAsset.name}</p>
                          <p className="text-[11px] text-slate-500 uppercase">{selectedAsset.type} &middot; {selectedAsset.sourceType}</p>
                        </div>
                        <button onClick={() => setSelectedAssetId(null)} className="text-xs text-slate-500 hover:text-red-400">Remove</button>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <svg className="mx-auto h-8 w-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="mt-2 text-sm text-slate-400">No media attached</p>
                        <button onClick={() => setShowAssetPicker(true)}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700">
                          Select from Asset Library
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Asset picker modal */}
                  {showAssetPicker && (
                    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-semibold text-white">Select Asset</p>
                        <button onClick={() => setShowAssetPicker(false)} className="text-xs text-slate-500 hover:text-white">Close</button>
                      </div>
                      {assets.length === 0 ? (
                        <p className="py-4 text-center text-sm text-slate-500">No ready assets. <Link href="/video-ads/assets" className="text-emerald-400 hover:underline">Import one first</Link>.</p>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 max-h-60 overflow-y-auto">
                          {assets.map((a) => (
                            <button key={a.id} onClick={() => { setSelectedAssetId(a.id); setShowAssetPicker(false); if (a.body && !primaryText) setPrimaryText(a.body); if (a.headline && !headline) setHeadline(a.headline); }}
                              className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${selectedAssetId === a.id ? "border-emerald-700 bg-emerald-950/30" : "border-slate-800 hover:border-slate-700"}`}>
                              <div className="h-10 w-10 shrink-0 rounded border border-slate-700 bg-slate-950 flex items-center justify-center text-[10px] font-bold text-slate-500 uppercase">
                                {a.type.slice(0, 3)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-white truncate">{a.name}</p>
                                <p className="text-[10px] text-slate-500">{a.sourceType}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Copy fields */}
                  <Field label="Ad Name" required>
                    <input value={adName} onChange={(e) => setAdName(e.target.value)} placeholder="Ad name..." className={INPUT} />
                  </Field>
                  <Field label="Primary Text" required>
                    <textarea value={primaryText} onChange={(e) => setPrimaryText(e.target.value)} rows={4} placeholder="The main copy your audience sees..."
                      className={`${INPUT} resize-none`} />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Headline">
                      <input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Short attention-grabbing headline" className={INPUT} />
                    </Field>
                    <Field label="Call to Action">
                      <select value={ctaType} onChange={(e) => setCtaType(e.target.value)} className={INPUT}>
                        {ctaTypes.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </Field>
                  </div>
                </div>
              ) : (
                /* Preview mode */
                <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-6">
                  <div className="mx-auto max-w-sm">
                    {/* Mock ad card */}
                    <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
                      {/* Media placeholder */}
                      <div className="aspect-square bg-slate-900 flex items-center justify-center">
                        {selectedAsset?.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={selectedAsset.thumbnailUrl ?? selectedAsset.url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="text-center">
                            <svg className="mx-auto h-12 w-12 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            <p className="mt-2 text-xs text-slate-600">No media</p>
                          </div>
                        )}
                      </div>
                      {/* Copy preview */}
                      <div className="p-4 space-y-2">
                        <p className="text-sm text-slate-300 leading-relaxed">{primaryText || <span className="text-slate-600 italic">Primary text...</span>}</p>
                        <div className="border-t border-slate-800 pt-2">
                          <p className="text-[11px] text-slate-600 truncate">{destinationUrl || "yoursite.com"}</p>
                          <p className="text-sm font-semibold text-white">{headline || <span className="text-slate-600 italic">Headline...</span>}</p>
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <span className="rounded bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white">
                            {ctaTypes.find((c) => c.value === ctaType)?.label ?? "Shop Now"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Section>

            {/* ══ Errors ══ */}
            {launchErrors.length > 0 && (
              <div className="rounded-xl border border-rose-800 bg-rose-950/40 p-4">
                <p className="mb-2 text-sm font-semibold text-rose-300">Launch Failed</p>
                <ul className="space-y-1">
                  {launchErrors.map((e, i) => <li key={i} className="text-xs text-rose-400">{e.message}</li>)}
                </ul>
              </div>
            )}
          </>
        )}
      </div>

      {/* ══ Sticky Bottom Summary Bar ══ */}
      {launchState !== "success" && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800 bg-slate-950/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
            {/* Summary chips */}
            <div className="flex items-center gap-4">
              <SummaryChip label="Ad Sets" value="1" />
              <SummaryChip label="Creatives" value={String(mediaCount)} />
              <SummaryChip label="Daily Budget" value={`$${dailyBudget}`} highlight />
              <SummaryChip label="Objective" value={objectives.find((o) => o.value === objective)?.label ?? "—"} />
            </div>
            {/* Actions */}
            <div className="flex items-center gap-3">
              <Link href="/video-ads" className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors">
                Back
              </Link>
              <button
                onClick={handleLaunch}
                disabled={isPending || !options.connected || !campaignName || !pageId || !primaryText || !destinationUrl}
                className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-bold text-white transition-all hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {launchState === "launching" || isPending ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Launching...
                  </span>
                ) : (
                  "Launch Campaign"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════════

const INPUT = "w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-emerald-600 focus:outline-none transition-colors";

function Section({ title, number, children }: { title: string; number: number; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-400">{number}</span>
        <h2 className="text-base font-semibold text-white">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-medium text-slate-400">
        {label}{required && <span className="ml-0.5 text-emerald-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function SummaryChip({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">{label}</p>
      <p className={`text-sm font-bold tabular-nums ${highlight ? "text-emerald-400" : "text-white"}`}>{value}</p>
    </div>
  );
}
