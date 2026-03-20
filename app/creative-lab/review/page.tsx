// app/creative-lab/review/page.tsx
// Creative Lab — Draft Scoring and Review
//
// Accepts ?briefId=xxx (required) — loads brief + all variants from DB.
// Scores and ranks are computed client-side via POST /api/creative-lab/scoring.
// Server component — renders ReviewView (client orchestrator) once brief loads.

export const dynamic = "force-dynamic";

import Link                      from "next/link";
import { loadCreativeBriefById } from "../../../lib/creativeBrief/db";
import { PageHeader, Badge, EmptyState } from "../../../components/ui";
import { ReviewView }            from "./ReviewView";

export const metadata = {
  title: "Draft Review — Creative Lab",
};

type Props = {
  searchParams: Promise<{ briefId?: string }>;
};

export default async function CreativeLabReviewPage({ searchParams }: Props) {
  const params  = await searchParams;
  const briefId = params.briefId ?? null;

  // ── No briefId ─────────────────────────────────────────────────────────────
  if (!briefId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Draft Review"
          description="Score, rank, and evaluate creative draft variants for approval readiness."
          badge={<Badge variant="info">Scoring</Badge>}
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
            icon="◈"
            title="Select a brief to review"
            description="Open a creative brief that has generated draft variants, then click 'Score & Review Drafts' to begin evaluation."
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
        <div className="flex flex-wrap gap-4 border-t border-slate-800/60 pt-4">
          <Link href="/creative-lab"               className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← Creative Lab</Link>
          <Link href="/creative-lab/briefs"        className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Creative Briefs</Link>
          <Link href="/creative-lab/refresh-queue" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Refresh Queue →</Link>
        </div>
      </div>
    );
  }

  // ── Load brief ─────────────────────────────────────────────────────────────
  const brief = await loadCreativeBriefById(briefId).catch(() => null);

  if (!brief) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Brief Not Found"
          description="The requested brief could not be loaded for review."
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
            It may have been deleted or the ID is incorrect.
          </p>
        </div>
      </div>
    );
  }

  return <ReviewView brief={brief} />;
}
