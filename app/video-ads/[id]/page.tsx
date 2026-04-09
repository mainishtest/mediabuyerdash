import Link from "next/link";
import { notFound } from "next/navigation";
import { getConcept, getLatestStrategyRun, getStrategyRunHistory, getRenderBriefPreview } from "../actions";
import { ConceptDetailView } from "./ConceptDetailView";
import { ConceptDetailViewV2 } from "./ConceptDetailViewV2";
import type {
  StrategyAngleSet,
  StrategyHookSet,
  StrategyScript,
  StrategyShotListItem,
  StrategyOnScreenText,
  StrategyCtaVariant,
  StrategyEditorNotes,
  StrategyPlatformAdjustment,
} from "../../../lib/videoAdGenerator/types";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const concept = await getConcept(id);
  return {
    title: concept ? `${concept.title} — Video Ads` : "Concept — Video Ads",
  };
}

function safeParse<T>(val: string | null | undefined): T | null {
  if (!val) return null;
  try { return JSON.parse(val) as T; } catch { return null; }
}

export default async function ConceptDetailPage({ params }: Props) {
  const { id } = await params;
  const concept = await getConcept(id);

  if (!concept) {
    notFound();
  }

  // Check engine version from the raw DB row
  const rawConcept = await import("../../../lib/db").then((m) =>
    m.prisma.videoAdConcept.findUnique({ where: { id } })
  );
  const engineVersion = (rawConcept as Record<string, unknown>)?.engineVersion ?? "v1";
  const isV2 = engineVersion === "v2";

  let strategyRunData = null;
  let renderPreview = null;
  let runHistory: Array<{ id: string; version: number; status: string; mode: string; durationMs: number | null; createdAt: Date }> = [];

  if (isV2) {
    const [latestRun, history, render] = await Promise.all([
      getLatestStrategyRun(id),
      getStrategyRunHistory(id),
      getRenderBriefPreview(id),
    ]);

    runHistory = history.map((r) => ({
      id: r.id,
      version: r.version,
      status: r.status,
      mode: r.mode,
      durationMs: r.durationMs,
      createdAt: r.createdAt,
    }));

    if (latestRun) {
      strategyRunData = {
        id: latestRun.id,
        version: latestRun.version,
        status: latestRun.status,
        mode: latestRun.mode,
        tier: latestRun.tier,
        model: latestRun.model,
        durationMs: latestRun.durationMs,
        createdAt: latestRun.createdAt.toISOString(),
        angleSet:            safeParse<StrategyAngleSet>(latestRun.angleSet),
        hookSet:             safeParse<StrategyHookSet>(latestRun.hookSet),
        script:              safeParse<StrategyScript>(latestRun.scriptSet),
        shotList:            safeParse<StrategyShotListItem[]>(latestRun.shotList),
        onScreenText:        safeParse<StrategyOnScreenText[]>(latestRun.onScreenText),
        ctaVariants:         safeParse<StrategyCtaVariant[]>(latestRun.ctaVariants),
        editorNotes:         safeParse<StrategyEditorNotes>(latestRun.editorNotes),
        platformAdjustments: safeParse<StrategyPlatformAdjustment[]>(latestRun.platformAdjustments),
      };
    }

    renderPreview = render;
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 lg:px-10">
      <Link
        href="/video-ads"
        className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-300"
      >
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
        </svg>
        Back to library
      </Link>

      {isV2 ? (
        <ConceptDetailViewV2
          concept={{
            id: concept.id,
            title: concept.title,
            status: concept.status,
            platform: concept.platform,
            adStyle: concept.adStyle,
            productName: concept.productName,
            offer: concept.offer,
            audience: concept.audience,
            painPoints: concept.painPoints,
            awarenessStage: concept.awarenessStage,
            brandVoice: concept.brandVoice,
            brandName: (rawConcept as Record<string, unknown>)?.brandName as string | null ?? null,
            marketSophistication: ((rawConcept as Record<string, unknown>)?.marketSophistication as number) ?? 3,
            visualStyle: (rawConcept as Record<string, unknown>)?.visualStyle as string | null ?? null,
            ctaGoal: (rawConcept as Record<string, unknown>)?.ctaGoal as string | null ?? null,
            notes: concept.notes,
            favoriteHookIndex: (rawConcept as Record<string, unknown>)?.favoriteHookIndex as number | null ?? null,
            favoriteCtaIndex: (rawConcept as Record<string, unknown>)?.favoriteCtaIndex as number | null ?? null,
            winningTags: (rawConcept as Record<string, unknown>)?.winningTags as string | null ?? null,
            editorHandoffNotes: (rawConcept as Record<string, unknown>)?.editorHandoffNotes as string | null ?? null,
            creatorHandoffNotes: (rawConcept as Record<string, unknown>)?.creatorHandoffNotes as string | null ?? null,
            approvedStructure: (rawConcept as Record<string, unknown>)?.approvedStructure as string | null ?? null,
            createdAt: concept.createdAt,
          }}
          strategyRun={strategyRunData}
          renderPreview={renderPreview}
          runHistory={runHistory}
        />
      ) : (
        <ConceptDetailView concept={concept} />
      )}
    </div>
  );
}
