import { prisma } from "../../lib/db";
import {
  extractCreativeSignals,
  groupSignalsByPattern,
  buildInsightsFromGroups,
  buildCreativeIntelligenceSummary,
  SAMPLE_COPY_INPUTS,
  SAMPLE_IMAGE_INPUTS,
} from "../../lib/creativeIntelligence";
import { CreativeIntelligenceView } from "./CreativeIntelligenceView";

export const dynamic = "force-dynamic";

export default async function CreativeIntelligencePage() {
  const [dbCopy, dbImage] = await Promise.all([
    prisma.generatedCopyVariation.findMany({
      include: { run: { select: { clientAccountId: true, campaignId: true } } },
    }),
    prisma.generatedImageVariation.findMany({
      include: { run: { select: { clientAccountId: true, campaignId: true } } },
    }),
  ]);

  const usingRealData = dbCopy.length > 0 || dbImage.length > 0;

  const copyInputs = usingRealData
    ? dbCopy.map((v) => ({
        id:               v.id,
        title:            v.title,
        hook:             v.hook,
        body:             v.body,
        callToAction:     v.callToAction,
        clientAccountId:  v.run.clientAccountId,
        campaignId:       v.run.campaignId,
      }))
    : SAMPLE_COPY_INPUTS;

  const imageInputs = usingRealData
    ? dbImage.map((v) => ({
        id:               v.id,
        title:            v.title,
        conceptSummary:   v.conceptSummary,
        visualChanges:    v.visualChanges,
        clientAccountId:  v.run.clientAccountId,
        campaignId:       v.run.campaignId,
      }))
    : SAMPLE_IMAGE_INPUTS;

  const signals  = extractCreativeSignals(copyInputs, imageInputs);
  const groups   = groupSignalsByPattern(signals);
  const insights = buildInsightsFromGroups(groups);
  const summary  = buildCreativeIntelligenceSummary(insights);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Creative Intelligence</h1>
            <p className="mt-1 text-sm text-slate-400">
              Pattern analysis across hooks, CTAs, body angles, and visual styles.
            </p>
          </div>
          {!usingRealData && (
            <span className="mt-1 shrink-0 rounded-lg border border-amber-700/50 bg-amber-950/30 px-3 py-1.5 text-xs text-amber-300">
              Sample data — run the Creative Lab to generate real signals
            </span>
          )}
        </div>

        <CreativeIntelligenceView summary={summary} />
      </div>
    </main>
  );
}
