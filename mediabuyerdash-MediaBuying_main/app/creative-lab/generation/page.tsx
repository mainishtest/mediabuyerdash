// app/creative-lab/generation/page.tsx
// Creative Lab — AI Creative Generation Engine
//
// Accepts ?briefId=xxx to load a specific brief for generation context.
// When no briefId is provided, shows an entry point with a link to pick a brief.
//
// Server component — loads brief + generation job history from DB.
// Passes to GenerationView (client component).

export const dynamic = "force-dynamic";

import Link                    from "next/link";
import { loadCreativeBriefById } from "../../../lib/creativeBrief/db";
import { loadGenerationJobs }   from "../../../lib/creativeGeneration/db";
import { PageHeader, Badge, EmptyState } from "../../../components/ui";
import { GenerationView }       from "./GenerationView";

export const metadata = {
  title: "AI Creative Generation — Creative Lab",
};

type Props = {
  searchParams: Promise<{ briefId?: string }>;
};

export default async function CreativeLabGenerationPage({ searchParams }: Props) {
  const params  = await searchParams;
  const briefId = params.briefId ?? null;

  // ── No briefId — show entry point ─────────────────────────────────────────
  if (!briefId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="AI Creative Generation"
          description="Generate structured creative draft variants from performance-aware briefs."
          badge={<Badge variant="purple">AI Generation</Badge>}
          actions={
            <Link
              href="/creative-lab/briefs"
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm
                font-medium text-slate-200 transition-colors hover:bg-slate-700"
            >
              ← Creative Briefs
            </Link>
          }
        />
        <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/30 p-10">
          <EmptyState
            icon="◉"
            title="Select a brief to generate"
            description="Open a creative brief from the refresh queue and click 'Generate AI Drafts' to start the generation engine."
            action={
              <Link
                href="/creative-lab/briefs"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Open Creative Briefs
              </Link>
            }
          />
        </div>

        {/* Bottom nav */}
        <div className="flex flex-wrap gap-4 border-t border-slate-800/60 pt-4">
          <Link href="/creative-lab"               className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← Creative Lab</Link>
          <Link href="/creative-lab/briefs"        className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Creative Briefs</Link>
          <Link href="/creative-lab/refresh-queue" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Refresh Queue →</Link>
        </div>
      </div>
    );
  }

  // ── Load brief ─────────────────────────────────────────────────────────────
  const [brief, jobs] = await Promise.all([
    loadCreativeBriefById(briefId).catch(() => null),
    loadGenerationJobs(briefId).catch(() => []),
  ]);

  if (!brief) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Brief Not Found"
          description="The requested brief could not be loaded."
          badge={<Badge variant="danger">Error</Badge>}
          actions={
            <Link
              href="/creative-lab/briefs"
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm
                font-medium text-slate-200 transition-colors hover:bg-slate-700"
            >
              ← Creative Briefs
            </Link>
          }
        />
        <div className="rounded-xl border border-dashed border-rose-900/50 bg-rose-950/10 p-10">
          <p className="text-center text-sm text-rose-400">
            Brief ID <code className="font-mono text-xs">{briefId}</code> was not found.
          </p>
          <p className="mt-1 text-center text-xs text-slate-600">
            It may have been deleted, or the sync data may be stale.
          </p>
        </div>
      </div>
    );
  }

  return <GenerationView brief={brief} initialJobs={jobs} />;
}
