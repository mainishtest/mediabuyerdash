"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  regenerateStrategyV2Action,
  compileRenderBriefAction,
  updateConceptMetaAction,
  deleteConceptAction,
  advanceStatusAction,
  setStatusAction,
  duplicateConceptAction,
  updateFavoritesAction,
  updateHandoffAction,
  regenV2AngleAction,
  regenV2HooksAction,
  regenV2ScriptAction,
  regenV2ShotListAction,
  regenV2OSTAction,
  regenV2CtasAction,
  regenV2EditorNotesAction,
  regenV2PlatformAction,
  promoteToAssetAction,
} from "../actions";
import { Panel } from "../components/Panel";
import { SectionHeader } from "../components/SectionHeader";
import { StatusBadge } from "../components/StatusBadge";
import { PlatformBadge } from "../components/PlatformBadge";
import { TagPill } from "../components/TagPill";
import { EmptyState } from "../components/EmptyState";
import { StatusStepper } from "../components/StatusStepper";
import {
  AD_STYLE_LABELS,
  AWARENESS_LABELS,
  VISUAL_STYLE_LABELS,
  CTA_GOAL_LABELS,
  STATUS_LABELS,
  PIPELINE_MODE_LABELS,
  MARKET_SOPHISTICATION_LABELS,
  type AdStyle,
  type AwarenessStage,
  type ConceptStatus,
  type VisualStyle,
  type CtaGoal,
  type PipelineMode,
  type StrategyAngleSet,
  type StrategyHookSet,
  type StrategyScript,
  type StrategyShotListItem,
  type StrategyOnScreenText,
  type StrategyCtaVariant,
  type StrategyEditorNotes,
  type StrategyPlatformAdjustment,
  type FullRenderBrief,
  type SceneRenderBrief,
} from "../../../lib/videoAdGenerator/types";

type WorkspaceTab = "strategy" | "production" | "render" | "handoff";

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

interface StrategyRunData {
  id: string; version: number; status: string; mode: string; tier: string;
  model: string; durationMs: number | null; createdAt: string;
  angleSet: StrategyAngleSet | null; hookSet: StrategyHookSet | null;
  script: StrategyScript | null; shotList: StrategyShotListItem[] | null;
  onScreenText: StrategyOnScreenText[] | null; ctaVariants: StrategyCtaVariant[] | null;
  editorNotes: StrategyEditorNotes | null; platformAdjustments: StrategyPlatformAdjustment[] | null;
}

interface RenderPreview {
  scenes: Array<SceneRenderBrief & { veoPromptPreview: string }>;
  globalMetadata: FullRenderBrief["globalMetadata"];
}

interface ConceptData {
  id: string; title: string; status: string; platform: string; adStyle: string;
  productName: string; offer: string; audience: string; painPoints: string;
  awarenessStage: string; brandVoice: string | null; brandName: string | null;
  marketSophistication: number; visualStyle: string | null; ctaGoal: string | null;
  notes: string | null; favoriteHookIndex: number | null; favoriteCtaIndex: number | null;
  winningTags: string | null; editorHandoffNotes: string | null; creatorHandoffNotes: string | null;
  approvedStructure: string | null; createdAt: Date;
}

interface Props {
  concept: ConceptData;
  strategyRun: StrategyRunData | null;
  renderPreview: RenderPreview | null;
  runHistory: Array<{ id: string; version: number; status: string; mode: string; durationMs: number | null; createdAt: Date }>;
}

// ═══════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════

export function ConceptDetailViewV2({ concept, strategyRun: sr, renderPreview, runHistory }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<WorkspaceTab>("strategy");
  const [notes, setNotes] = useState(concept.notes ?? "");
  const [title, setTitle] = useState(concept.title);
  const [editorNotes, setEditorNotes] = useState(concept.editorHandoffNotes ?? "");
  const [creatorNotes, setCreatorNotes] = useState(concept.creatorHandoffNotes ?? "");

  function run(label: string, action: () => Promise<{ ok: boolean; error?: string }>) {
    setPending(label); setError(null);
    startTransition(async () => {
      const r = await action();
      setPending(null);
      if (!r.ok) setError(r.error ?? "Action failed");
      else router.refresh();
    });
  }

  function saveMeta() {
    startTransition(async () => {
      await updateConceptMetaAction(concept.id, { notes, title });
      router.refresh();
    });
  }

  function saveHandoff() {
    startTransition(async () => {
      await updateHandoffAction(concept.id, { editorHandoffNotes: editorNotes, creatorHandoffNotes: creatorNotes });
      router.refresh();
    });
  }

  function toggleFavoriteHook(i: number) {
    const next = concept.favoriteHookIndex === i ? null : i;
    startTransition(async () => {
      await updateFavoritesAction(concept.id, { favoriteHookIndex: next });
      router.refresh();
    });
  }

  function toggleFavoriteCta(i: number) {
    const next = concept.favoriteCtaIndex === i ? null : i;
    startTransition(async () => {
      await updateFavoritesAction(concept.id, { favoriteCtaIndex: next });
      router.refresh();
    });
  }

  function handleDuplicate() {
    startTransition(async () => {
      const result = await duplicateConceptAction(concept.id);
      if (result.ok && result.id) router.push(`/video-ads/${result.id}`);
    });
  }

  function handlePromoteToAsset() {
    startTransition(async () => {
      const result = await promoteToAssetAction(concept.id);
      if (result.ok) router.push("/video-ads/assets");
    });
  }

  const tabs: { key: WorkspaceTab; label: string }[] = [
    { key: "strategy",   label: "Strategy" },
    { key: "production", label: "Production" },
    { key: "render",     label: "Render" },
    { key: "handoff",    label: "Handoff" },
  ];

  return (
    <div className="flex gap-6">
      {/* ── Main ── */}
      <div className="min-w-0 flex-1 space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 rounded-xl border border-slate-800 bg-slate-900/50 p-1">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`flex-1 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
              tab === t.key ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
            }`}>{t.label}</button>
          ))}
        </div>

        {error && <div className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-xs text-rose-300">{error}</div>}

        {!sr && tab !== "handoff" ? (
          <EmptyState title="No strategy yet" message="Generate a strategy to start building this concept."
            action={<button onClick={() => run("strategy", () => regenerateStrategyV2Action(concept.id))} disabled={isPending}
              className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
              {pending === "strategy" ? "Generating…" : "Generate Strategy"}</button>} />
        ) : (
          <>
            {tab === "strategy" && sr && (
              <div className="space-y-4">
                {/* Angle */}
                {sr.angleSet && (
                  <Panel>
                    <SectionHeader title="Angle" onRegenerate={() => run("angle", () => regenV2AngleAction(concept.id))} isPending={pending === "angle"} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <DC label="Big Idea" value={sr.angleSet.primary.bigIdea} accent />
                      <DC label="Enemy" value={sr.angleSet.primary.enemy} accent />
                      <DC label="Mechanism" value={sr.angleSet.primary.mechanism} accent />
                      <DC label="Emotional Hook" value={sr.angleSet.primary.emotionalHook} accent />
                    </div>
                    {sr.angleSet.alternates.length > 0 && (
                      <div className="mt-3 border-t border-slate-800 pt-3">
                        <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-slate-600">Alternates</p>
                        {sr.angleSet.alternates.map((a, i) => (
                          <div key={i} className="mb-2 rounded-lg border border-slate-800/50 bg-slate-950/30 p-3 text-sm text-slate-300">{a.bigIdea}</div>
                        ))}
                      </div>
                    )}
                  </Panel>
                )}

                {/* Hooks with favorites */}
                {sr.hookSet && (
                  <Panel>
                    <SectionHeader title="Hooks" count={sr.hookSet.hooks.length} onRegenerate={() => run("hooks", () => regenV2HooksAction(concept.id))} isPending={pending === "hooks"} />
                    <div className="space-y-2">
                      {sr.hookSet.hooks.map((h, i) => {
                        const isFav = concept.favoriteHookIndex === i;
                        return (
                          <div key={i} className={`flex items-start gap-3 rounded-lg border p-3 ${isFav ? "border-amber-700/50 bg-amber-950/10" : "border-slate-800 bg-slate-950/50"}`}>
                            <button onClick={() => toggleFavoriteHook(i)} className={`mt-0.5 text-sm ${isFav ? "text-amber-400" : "text-slate-700 hover:text-amber-400"}`} title={isFav ? "Remove favorite" : "Set as favorite"}>
                              {isFav ? "\u2605" : "\u2606"}
                            </button>
                            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-800 text-xs font-bold tabular-nums text-slate-300">{i + 1}</span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-white">{h.text}</p>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                <TagPill>{h.styleTag.replace(/_/g, " ")}</TagPill>
                                <span className="text-[10px] tabular-nums text-slate-500">{h.targetDurationSec}s</span>
                                <span className={`text-[10px] ${h.soundRequired ? "text-amber-400" : "text-emerald-400"}`}>
                                  {h.soundRequired ? "Sound req." : "Sound-off OK"}
                                </span>
                                {isFav && <span className="text-[10px] font-semibold text-amber-400">WINNER</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Panel>
                )}

                {/* Script */}
                {sr.script && (
                  <Panel>
                    <SectionHeader title="Script" onRegenerate={() => run("script", () => regenV2ScriptAction(concept.id, concept.favoriteHookIndex ?? 0))} isPending={pending === "script"} />
                    <SB label="Opening" value={sr.script.opening} />
                    <SB label="Body" value={sr.script.body} />
                    <SB label="CTA" value={sr.script.cta} />
                    <p className="mt-2 text-[10px] text-slate-500">~{sr.script.durationSeconds}s · {sr.script.toneNotes}</p>
                  </Panel>
                )}

                {/* CTAs with favorites */}
                {sr.ctaVariants && sr.ctaVariants.length > 0 && (
                  <Panel>
                    <SectionHeader title="CTA Variants" count={sr.ctaVariants.length} onRegenerate={() => run("ctas", () => regenV2CtasAction(concept.id))} isPending={pending === "ctas"} />
                    <div className="space-y-2">
                      {sr.ctaVariants.map((c, i) => {
                        const isFav = concept.favoriteCtaIndex === i;
                        return (
                          <div key={i} className={`flex items-start gap-3 rounded-lg border p-3 ${isFav ? "border-amber-700/50 bg-amber-950/10" : "border-slate-800 bg-slate-950/50"}`}>
                            <button onClick={() => toggleFavoriteCta(i)} className={`mt-0.5 text-sm ${isFav ? "text-amber-400" : "text-slate-700 hover:text-amber-400"}`}>
                              {isFav ? "\u2605" : "\u2606"}
                            </button>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-white">{c.text}</p>
                              <p className="mt-1 font-mono text-[10px] text-slate-600">OST: {c.onScreenText}</p>
                            </div>
                            <div className="flex shrink-0 gap-1.5">
                              <TagPill>{c.styleTag.replace(/_/g, " ")}</TagPill>
                              {isFav && <span className="rounded bg-amber-900/30 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">WINNER</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Panel>
                )}
              </div>
            )}

            {tab === "production" && sr && (
              <div className="space-y-4">
                {sr.shotList && sr.shotList.length > 0 && (
                  <Panel>
                    <SectionHeader title="Shot List" count={sr.shotList.length} onRegenerate={() => run("shotList", () => regenV2ShotListAction(concept.id))} isPending={pending === "shotList"} />
                    <div className="space-y-3">
                      {sr.shotList.map((s) => (
                        <div key={s.sceneNumber} className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                          <div className="mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2"><span className="text-sm font-semibold text-white">Scene {s.sceneNumber}</span><TagPill>{s.moodTag}</TagPill></div>
                            <span className="font-mono text-[11px] text-emerald-400">{s.timecode}</span>
                          </div>
                          {s.spokenDialogue && <p className="mb-2 rounded border border-slate-800/50 bg-slate-900/50 p-2 text-xs italic text-slate-300">&ldquo;{s.spokenDialogue}&rdquo;</p>}
                          <div className="grid gap-2 text-xs sm:grid-cols-2">
                            <MF label="Visual" value={s.visual} /><MF label="OST" value={s.onScreenText} mono />
                            <MF label="B-Roll" value={s.bRollNotes} /><MF label="Editor" value={s.editorNotes} />
                            <MF label="Talent" value={s.talentDirection} /><MF label="Audio" value={s.audioNotes} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                )}

                {sr.onScreenText && sr.onScreenText.length > 0 && (
                  <Panel>
                    <SectionHeader title="On-Screen Text" count={sr.onScreenText.length} onRegenerate={() => run("ost", () => regenV2OSTAction(concept.id))} isPending={pending === "ost"} />
                    {sr.onScreenText.map((s) => (
                      <div key={s.sceneNumber} className="mb-2 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                        <p className="mb-1.5 text-xs font-semibold text-slate-300">Scene {s.sceneNumber}</p>
                        {s.texts.map((t, i) => (
                          <div key={i} className="mb-1 flex items-center gap-2 text-[11px]">
                            <span className="font-mono text-slate-600">{t.timing}</span>
                            <TagPill>{t.style}</TagPill>
                            <span className="text-white">{t.text}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </Panel>
                )}

                {sr.editorNotes && (
                  <Panel>
                    <SectionHeader title="Editor Notes" onRegenerate={() => run("editorNotes", () => regenV2EditorNotesAction(concept.id))} isPending={pending === "editorNotes"} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <DC label="Pacing" value={sr.editorNotes.overallPacing} />
                      <DC label="Color" value={sr.editorNotes.colorGrading} />
                      <DC label="Music" value={sr.editorNotes.musicDirection} />
                      <DC label="Sound" value={sr.editorNotes.soundDesign} />
                      <DC label="Graphics" value={sr.editorNotes.graphicsStyle} />
                    </div>
                    {sr.editorNotes.complianceNotes.length > 0 && (
                      <div className="mt-3 border-t border-slate-800 pt-2">
                        {sr.editorNotes.complianceNotes.map((n, i) => <p key={i} className="text-[11px] text-amber-400/80">• {n}</p>)}
                      </div>
                    )}
                  </Panel>
                )}

                {sr.platformAdjustments && sr.platformAdjustments.length > 0 && (
                  <Panel>
                    <SectionHeader title="Platform Adjustments" onRegenerate={() => run("platform", () => regenV2PlatformAction(concept.id))} isPending={pending === "platform"} />
                    <div className={`grid gap-4 ${sr.platformAdjustments.length > 1 ? "md:grid-cols-2" : ""}`}>
                      {sr.platformAdjustments.map((a) => (
                        <div key={a.platform} className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                          <PlatformBadge platform={a.platform} size="md" />
                          <div className="mt-3 space-y-2 text-xs">
                            <MF label="Aspect" value={`${a.aspectRatio} · ${a.durationTarget}s`} />
                            <MF label="Pacing" value={a.pacingNotes} />
                            <MF label="OST" value={a.ostDensity} />
                            <MF label="CTA" value={a.ctaStyle} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                )}

                {!sr.shotList && !sr.editorNotes && (
                  <EmptyState title="No production data" message="Run a Full Storyboard strategy to generate shot lists and editor notes." />
                )}
              </div>
            )}

            {tab === "render" && (
              <RenderTab preview={renderPreview} onCompile={() => run("render", () => compileRenderBriefAction(concept.id))} isPending={pending === "render"} />
            )}

            {tab === "handoff" && (
              <div className="space-y-4">
                {/* Approved structure summary */}
                <Panel>
                  <SectionHeader title="Approved Structure" />
                  {sr?.hookSet && concept.favoriteHookIndex !== null ? (
                    <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/20 p-4">
                      <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-emerald-500">Winning Hook #{(concept.favoriteHookIndex ?? 0) + 1}</p>
                      <p className="text-sm text-emerald-200">{sr.hookSet.hooks[concept.favoriteHookIndex ?? 0]?.text ?? "—"}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No favorite hook selected. Go to Strategy tab and star a hook.</p>
                  )}
                  {sr?.ctaVariants && concept.favoriteCtaIndex !== null && (
                    <div className="mt-3 rounded-lg border border-emerald-800/50 bg-emerald-950/20 p-4">
                      <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-emerald-500">Winning CTA #{(concept.favoriteCtaIndex ?? 0) + 1}</p>
                      <p className="text-sm text-emerald-200">{sr.ctaVariants[concept.favoriteCtaIndex ?? 0]?.text ?? "—"}</p>
                    </div>
                  )}
                </Panel>

                {/* Editor handoff */}
                <Panel>
                  <SectionHeader title="Editor Handoff Notes" />
                  <textarea value={editorNotes} onChange={(e) => setEditorNotes(e.target.value)} onBlur={saveHandoff} rows={5}
                    placeholder="Production notes for the editor: pacing preferences, mandatory scenes, music references, compliance requirements…"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-emerald-600 focus:outline-none" />
                </Panel>

                {/* Creator handoff */}
                <Panel>
                  <SectionHeader title="Creator / UGC Handoff Notes" />
                  <textarea value={creatorNotes} onChange={(e) => setCreatorNotes(e.target.value)} onBlur={saveHandoff} rows={5}
                    placeholder="Notes for the talent/creator: wardrobe, setting, delivery style, do's and don'ts, hook delivery instructions…"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-emerald-600 focus:outline-none" />
                </Panel>

                {/* Script for handoff */}
                {sr?.script && (
                  <Panel>
                    <SectionHeader title="Final Script (for handoff)" />
                    <SB label="Opening" value={sr.script.opening} />
                    <SB label="Body" value={sr.script.body} />
                    <SB label="CTA" value={sr.script.cta} />
                  </Panel>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Sidebar ── */}
      <aside className="hidden w-80 shrink-0 space-y-4 lg:block">
        {/* Title */}
        <Panel>
          <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveMeta}
            className="w-full border-none bg-transparent text-lg font-semibold tracking-tight text-white focus:outline-none" />
          <div className="mt-3 flex flex-wrap gap-1.5">
            <PlatformBadge platform={concept.platform} />
            <TagPill>{AD_STYLE_LABELS[concept.adStyle as AdStyle] ?? concept.adStyle}</TagPill>
            <TagPill>{VISUAL_STYLE_LABELS[concept.visualStyle as VisualStyle] ?? "UGC"}</TagPill>
          </div>
        </Panel>

        {/* Status stepper */}
        <Panel>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Pipeline Status</p>
          <StatusStepper currentStatus={concept.status} onAdvance={() => run("advance", () => advanceStatusAction(concept.id))} isPending={pending === "advance"} />
        </Panel>

        {/* Brief */}
        <Panel>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Brief</p>
          <div className="space-y-2 text-xs">
            <SF label="Product" value={concept.brandName ? `${concept.brandName} — ${concept.productName}` : concept.productName} />
            <SF label="Offer" value={concept.offer} truncate />
            <SF label="Audience" value={concept.audience} truncate />
            <SF label="Awareness" value={AWARENESS_LABELS[concept.awarenessStage as AwarenessStage] ?? concept.awarenessStage} />
            <SF label="Soph." value={MARKET_SOPHISTICATION_LABELS[concept.marketSophistication] ?? `${concept.marketSophistication}`} />
            <SF label="CTA Goal" value={CTA_GOAL_LABELS[concept.ctaGoal as CtaGoal] ?? "Purchase"} />
          </div>
        </Panel>

        {/* Run info */}
        {sr && (
          <Panel>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Strategy Run</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">Version</span><span className="font-medium text-white">v{sr.version}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Model</span><span className="font-mono text-slate-300">{sr.model}</span></div>
              {sr.durationMs && <div className="flex justify-between"><span className="text-slate-500">Duration</span><span className="tabular-nums text-slate-300">{(sr.durationMs / 1000).toFixed(1)}s</span></div>}
            </div>
            {runHistory.length > 1 && (
              <div className="mt-2 border-t border-slate-800 pt-2 space-y-1">
                {runHistory.map((r) => (
                  <div key={r.id} className={`flex items-center justify-between rounded px-2 py-0.5 text-[10px] ${r.id === sr.id ? "bg-emerald-900/20 text-emerald-300" : "text-slate-500"}`}>
                    <span>v{r.version}</span><StatusBadge status={r.status} />
                  </div>
                ))}
              </div>
            )}
          </Panel>
        )}

        {/* Actions */}
        <Panel>
          <div className="space-y-2">
            <button onClick={() => run("strategy", () => regenerateStrategyV2Action(concept.id))} disabled={isPending}
              className="flex w-full items-center justify-center rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-300 hover:border-slate-700 hover:text-white disabled:opacity-50">
              {pending === "strategy" ? "Generating…" : "New Strategy Run"}
            </button>
            <button onClick={() => run("render", () => compileRenderBriefAction(concept.id))} disabled={isPending || !sr}
              className="flex w-full items-center justify-center rounded-lg border border-emerald-800 bg-emerald-950/30 px-3 py-2 text-xs font-medium text-emerald-400 hover:bg-emerald-900/30 disabled:opacity-50">
              Compile Render Brief
            </button>
            <button onClick={handleDuplicate} disabled={isPending}
              className="flex w-full items-center justify-center rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-400 hover:text-white disabled:opacity-50">
              Duplicate Concept
            </button>
            <a href={`/launch?conceptId=${concept.id}`}
              className="flex w-full items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition-colors">
              Launch Campaign
            </a>
            <button onClick={handlePromoteToAsset} disabled={isPending}
              className="flex w-full items-center justify-center rounded-lg border border-sky-800 bg-sky-950/30 px-3 py-2 text-xs font-medium text-sky-400 hover:bg-sky-900/30 disabled:opacity-50">
              Promote to Asset
            </button>
            <button onClick={() => { if (confirm("Delete?")) startTransition(() => { deleteConceptAction(concept.id); }); }} disabled={isPending}
              className="flex w-full items-center justify-center rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-[11px] text-slate-500 hover:border-rose-800 hover:text-rose-400">
              Delete
            </button>
          </div>
        </Panel>

        {/* Notes */}
        <Panel>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Notes</p>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveMeta} rows={3}
            placeholder="Internal notes…" className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-emerald-600 focus:outline-none" />
        </Panel>
      </aside>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Render tab
// ═══════════════════════════════════════════════════════════════════

function RenderTab({ preview, onCompile, isPending }: { preview: RenderPreview | null; onCompile: () => void; isPending: boolean }) {
  const [exp, setExp] = useState<number | null>(null);
  if (!preview) return <EmptyState title="No render brief" message="Compile a render brief to see Veo prompts."
    action={<button onClick={onCompile} disabled={isPending} className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">{isPending ? "Compiling…" : "Compile Render Brief"}</button>} />;

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="font-semibold text-white">Render Brief</span>
          <span className="text-slate-500">v{preview.globalMetadata.compilerVersion}</span>
          <span className="text-slate-500">{preview.scenes.length} scenes</span>
          <span className="text-slate-500">{preview.globalMetadata.totalDurationSec}s</span>
          <PlatformBadge platform={preview.globalMetadata.platform} />
        </div>
      </Panel>
      {preview.scenes.map((sc) => (
        <Panel key={sc.sceneNumber} noPadding>
          <button onClick={() => setExp(exp === sc.sceneNumber ? null : sc.sceneNumber)} className="flex w-full items-center justify-between p-4">
            <div className="flex items-center gap-2">
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                sc.renderPriority === "critical" ? "bg-rose-900/40 text-rose-300" : sc.renderPriority === "high" ? "bg-amber-900/40 text-amber-300" : "bg-slate-800 text-slate-400"
              }`}>{sc.renderPriority}</span>
              <span className="text-sm font-semibold text-white">Scene {sc.sceneNumber}</span>
              <span className="text-xs text-slate-500">{sc.durationSec}s</span>
            </div>
            <svg className={`h-4 w-4 text-slate-500 transition-transform ${exp === sc.sceneNumber ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          {exp === sc.sceneNumber && (
            <div className="border-t border-slate-800 p-4 space-y-3">
              <div className="grid gap-2 text-xs sm:grid-cols-2">
                <MF label="Camera" value={`${sc.cameraFraming.shotType.replace(/_/g, " ")}, ${sc.cameraFraming.verticalAngle.replace(/_/g, " ")}`} />
                <MF label="Movement" value={`${sc.cameraMovement.type.replace(/_/g, " ")}, ${sc.cameraMovement.speed}`} />
                <MF label="Lighting" value={sc.visualTone.lighting} />
                <MF label="Environment" value={sc.environment.setting} />
              </div>
              <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/20 p-3">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-500">Veo Prompt</p>
                <pre className="whitespace-pre-wrap text-xs leading-relaxed text-emerald-200/80">{sc.veoPromptPreview}</pre>
              </div>
            </div>
          )}
        </Panel>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Primitives
// ═══════════════════════════════════════════════════════════════════

function DC({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
      <p className={`mb-1 text-[10px] font-semibold uppercase tracking-wider ${accent ? "text-emerald-500" : "text-slate-500"}`}>{label}</p>
      <p className="text-sm leading-relaxed text-slate-200">{value}</p>
    </div>
  );
}
function SB({ label, value }: { label: string; value: string }) {
  return <div className="mb-3"><p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p><div className="whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950/50 p-4 text-sm leading-relaxed text-slate-100">{value}</div></div>;
}
function MF({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return <div><p className="mb-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500">{label}</p><p className={`text-xs text-slate-300 ${mono ? "font-mono" : ""}`}>{value}</p></div>;
}
function SF({ label, value, truncate }: { label: string; value: string; truncate?: boolean }) {
  return <div><p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600">{label}</p><p className={`text-slate-300 ${truncate ? "line-clamp-2" : ""}`}>{value}</p></div>;
}
