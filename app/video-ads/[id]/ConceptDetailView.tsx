"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  regenerateAngleAction,
  regenerateHooksAction,
  regenerateScriptAction,
  regenerateShotListAction,
  regenerateCtasAction,
  regeneratePlatformVariantsAction,
  updateConceptMetaAction,
  deleteConceptAction,
} from "../actions";
import {
  AD_STYLE_LABELS,
  AWARENESS_LABELS,
  PLATFORM_LABELS,
  STATUS_LABELS,
  type AdStyle,
  type AwarenessStage,
  type Platform,
  type ConceptStatus,
} from "../../../lib/videoAdGenerator/types";
import type { HydratedConcept } from "../../../lib/videoAdGenerator/serialize";

const STATUS_OPTIONS: ConceptStatus[] = ["draft", "approved", "shot", "live", "killed"];

interface Props {
  concept: HydratedConcept;
}

export function ConceptDetailView({ concept }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingSection, setPendingSection] = useState<string | null>(null);
  const [sectionError, setSectionError] = useState<{ section: string; message: string } | null>(null);
  const [notes, setNotes] = useState(concept.notes ?? "");
  const [title, setTitle] = useState(concept.title);
  const [status, setStatus] = useState<ConceptStatus>(concept.status as ConceptStatus);

  function runRegenerate(section: string, action: () => Promise<{ ok: boolean; error?: string }>) {
    setPendingSection(section);
    setSectionError(null);
    startTransition(async () => {
      const result = await action();
      setPendingSection(null);
      if (!result.ok) {
        setSectionError({ section, message: result.error ?? "Regenerate failed" });
      } else {
        router.refresh();
      }
    });
  }

  function saveMeta() {
    setPendingSection("meta");
    startTransition(async () => {
      await updateConceptMetaAction(concept.id, { notes, title, status });
      setPendingSection(null);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm("Delete this concept? This cannot be undone.")) return;
    startTransition(async () => {
      await deleteConceptAction(concept.id);
    });
  }

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded border border-slate-800 bg-slate-950 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                {AD_STYLE_LABELS[concept.adStyle as AdStyle] ?? concept.adStyle}
              </span>
              <span className="rounded border border-slate-800 bg-slate-950 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                {PLATFORM_LABELS[concept.platform as Platform] ?? concept.platform}
              </span>
              <span className="rounded border border-slate-800 bg-slate-950 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                {AWARENESS_LABELS[concept.awarenessStage as AwarenessStage] ?? concept.awarenessStage}
              </span>
            </div>

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-3 w-full border-none bg-transparent text-2xl font-semibold tracking-tight text-white focus:outline-none"
            />
            <p className="text-sm text-slate-500">{concept.productName}</p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ConceptStatus)}
              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-medium text-white focus:border-emerald-600 focus:outline-none"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <button
              onClick={saveMeta}
              disabled={isPending}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-400 transition-colors hover:border-rose-800 hover:text-rose-400"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Brief summary */}
        <div className="mt-5 grid gap-4 border-t border-slate-800 pt-5 sm:grid-cols-2">
          <BriefField label="Offer" value={concept.offer} />
          <BriefField label="Audience" value={concept.audience} />
          <BriefField label="Pain Points" value={concept.painPoints} />
          {concept.brandVoice && <BriefField label="Brand Voice" value={concept.brandVoice} />}
        </div>
      </div>

      {/* Angle */}
      <Section
        title="Angle"
        section="angle"
        pendingSection={pendingSection}
        onRegenerate={() => runRegenerate("angle", () => regenerateAngleAction(concept.id))}
        error={sectionError}
      >
        {concept.angle ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <AngleField label="Big Idea" value={concept.angle.bigIdea} />
            <AngleField label="Enemy" value={concept.angle.enemy} />
            <AngleField label="Mechanism" value={concept.angle.mechanism} />
            <AngleField label="Emotional Hook" value={concept.angle.emotionalHook} />
          </div>
        ) : (
          <Empty label="No angle yet. Click Regenerate to create one." />
        )}
      </Section>

      {/* Hooks */}
      <Section
        title="Hooks"
        section="hooks"
        pendingSection={pendingSection}
        onRegenerate={() => runRegenerate("hooks", () => regenerateHooksAction(concept.id))}
        error={sectionError}
      >
        {concept.hooks && concept.hooks.length > 0 ? (
          <ol className="space-y-2">
            {concept.hooks.map((h, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-800 text-xs font-semibold text-slate-300">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white">{h.text}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500">
                    {h.styleTag.replace(/_/g, " ")}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <Empty label="No hooks yet." />
        )}
      </Section>

      {/* Script */}
      <Section
        title="Script"
        section="script"
        pendingSection={pendingSection}
        onRegenerate={() => runRegenerate("script", () => regenerateScriptAction(concept.id))}
        error={sectionError}
      >
        {concept.script ? (
          <div className="space-y-4">
            <ScriptBlock label="Opening" value={concept.script.opening} />
            <ScriptBlock label="Body" value={concept.script.body} />
            <ScriptBlock label="CTA" value={concept.script.cta} />
            <p className="text-xs text-slate-500">
              Target duration: ~{concept.script.durationSeconds}s
            </p>
          </div>
        ) : (
          <Empty label="No script yet." />
        )}
      </Section>

      {/* Shot List */}
      <Section
        title="Shot List"
        section="shotList"
        pendingSection={pendingSection}
        onRegenerate={() => runRegenerate("shotList", () => regenerateShotListAction(concept.id))}
        error={sectionError}
      >
        {concept.shotList && concept.shotList.length > 0 ? (
          <div className="space-y-3">
            {concept.shotList.map((shot) => (
              <div
                key={shot.sceneNumber}
                className="rounded-lg border border-slate-800 bg-slate-950/50 p-4"
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">
                    Scene {shot.sceneNumber}
                  </p>
                  <p className="font-mono text-[11px] text-emerald-400">{shot.timecode}</p>
                </div>
                <div className="grid gap-2 text-xs sm:grid-cols-2">
                  <ShotField label="Visual" value={shot.visual} />
                  <ShotField label="On-Screen Text" value={shot.onScreenText} mono />
                  <ShotField label="B-Roll" value={shot.bRollNotes} />
                  <ShotField label="Editor Notes" value={shot.editorNotes} />
                  <ShotField label="Talent Direction" value={shot.talentDirection} fullWidth />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty label="No shot list yet." />
        )}
      </Section>

      {/* CTAs */}
      <Section
        title="CTA Variants"
        section="ctas"
        pendingSection={pendingSection}
        onRegenerate={() => runRegenerate("ctas", () => regenerateCtasAction(concept.id))}
        error={sectionError}
      >
        {concept.ctas && concept.ctas.length > 0 ? (
          <ul className="space-y-2">
            {concept.ctas.map((cta, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-3"
              >
                <p className="text-sm text-white">{cta.text}</p>
                <span className="shrink-0 rounded border border-slate-800 bg-slate-900 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  {cta.styleTag.replace(/_/g, " ")}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty label="No CTAs yet." />
        )}
      </Section>

      {/* Platform variants */}
      <Section
        title="Platform Variants"
        section="platformVariants"
        pendingSection={pendingSection}
        onRegenerate={() =>
          runRegenerate("platformVariants", () => regeneratePlatformVariantsAction(concept.id))
        }
        error={sectionError}
      >
        {concept.platformVariants ? (
          <div className="grid gap-4 md:grid-cols-2">
            {concept.platformVariants.facebook && (
              <PlatformCard platform="Facebook" variant={concept.platformVariants.facebook} />
            )}
            {concept.platformVariants.rumble && (
              <PlatformCard platform="Rumble" variant={concept.platformVariants.rumble} />
            )}
          </div>
        ) : (
          <Empty label="No platform variants yet." />
        )}
      </Section>

      {/* Notes */}
      <Section title="Notes" section="notes" pendingSection={null}>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveMeta}
          rows={4}
          placeholder="Add internal notes, revision feedback, or launch context..."
          className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
        />
      </Section>
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────────

interface SectionProps {
  title:          string;
  section:        string;
  pendingSection: string | null;
  onRegenerate?:  () => void;
  error?:         { section: string; message: string } | null;
  children:       React.ReactNode;
}

function Section({ title, section, pendingSection, onRegenerate, error, children }: SectionProps) {
  const isPending = pendingSection === section;
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-400">
          {title}
        </h2>
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-[11px] font-medium text-slate-400 transition-colors hover:border-slate-700 hover:text-white disabled:opacity-50"
          >
            {isPending ? (
              <>
                <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Regenerating…
              </>
            ) : (
              <>
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0115-5M20 15a9 9 0 01-15 5" />
                </svg>
                Regenerate
              </>
            )}
          </button>
        )}
      </div>

      {error && error.section === section && (
        <div className="mb-3 rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-xs text-rose-300">
          {error.message}
        </div>
      )}

      {children}
    </section>
  );
}

function BriefField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="text-sm text-slate-300">{value}</p>
    </div>
  );
}

function AngleField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-500">
        {label}
      </p>
      <p className="text-sm leading-relaxed text-slate-200">{value}</p>
    </div>
  );
}

function ScriptBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950/50 p-4 text-sm leading-relaxed text-slate-100">
        {value}
      </p>
    </div>
  );
}

interface ShotFieldProps {
  label:     string;
  value:     string;
  mono?:     boolean;
  fullWidth?: boolean;
}

function ShotField({ label, value, mono, fullWidth }: ShotFieldProps) {
  return (
    <div className={fullWidth ? "sm:col-span-2" : ""}>
      <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className={`text-xs text-slate-300 ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function PlatformCard({
  platform,
  variant,
}: {
  platform: string;
  variant: {
    hook:         string;
    opening:      string;
    pacing:       string;
    onScreenText: string;
    cta:          string;
    notes:        string;
  };
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        <h3 className="text-sm font-semibold text-white">{platform}</h3>
      </div>
      <div className="space-y-3 text-xs">
        <PlatformField label="Hook" value={variant.hook} />
        <PlatformField label="Opening" value={variant.opening} />
        <PlatformField label="Pacing" value={variant.pacing} />
        <PlatformField label="On-Screen Text" value={variant.onScreenText} />
        <PlatformField label="CTA" value={variant.cta} />
        {variant.notes && <PlatformField label="Notes" value={variant.notes} />}
      </div>
    </div>
  );
}

function PlatformField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="text-slate-300">{value}</p>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <p className="rounded-lg border border-dashed border-slate-800 bg-slate-950/30 px-4 py-6 text-center text-xs text-slate-500">
      {label}
    </p>
  );
}
