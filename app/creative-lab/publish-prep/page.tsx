// app/creative-lab/publish-prep/page.tsx
// Creative Lab — Publish Preparation
//
// Accepts ?clientAccountId=xxx (optional) to scope the list.
// Server component — loads all prep items for the client from DB.
// Passes to PublishPrepView (client orchestrator).

export const dynamic = "force-dynamic";

import Link                         from "next/link";
import { loadPublishPrepItems, buildPublishPrepSummary } from "../../../lib/publishPrep/db";
import { PageHeader, Badge, EmptyState } from "../../../components/ui";
import { PublishPrepView }          from "./PublishPrepView";

export const metadata = {
  title: "Publish Preparation — Creative Lab",
};

type Props = {
  searchParams: Promise<{ clientAccountId?: string }>;
};

export default async function PublishPrepPage({ searchParams }: Props) {
  const params          = await searchParams;
  const clientAccountId = params.clientAccountId ?? undefined;

  const [items, summary] = await Promise.all([
    loadPublishPrepItems({ clientAccountId, limit: 50 }).catch(() => []),
    buildPublishPrepSummary(clientAccountId).catch(() => ({
      total: 0, draft: 0, blocked: 0, readyForApproval: 0,
      approvedForLaunch: 0, readyToPublish: 0, published: 0, publishFailed: 0,
    })),
  ]);

  if (items.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Publish Preparation"
          description="Validate and approve creative drafts for guarded launch."
          badge={<Badge variant="warning">Launch Prep</Badge>}
          actions={
            <Link
              href="/creative-lab/review"
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm
                font-medium text-slate-200 transition-colors hover:bg-slate-700"
            >
              ← Draft Review
            </Link>
          }
        />
        <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/30 p-10">
          <EmptyState
            icon="◈"
            title="No publish prep items yet"
            description="Approve scored draft variants from the review page to create publish prep items. Each approved variant goes through validation and guardrail checks before launch."
            action={
              <Link
                href="/creative-lab/review"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Go to Draft Review
              </Link>
            }
          />
        </div>
        <div className="flex flex-wrap gap-4 border-t border-slate-800/60 pt-4">
          <Link href="/creative-lab"        className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← Creative Lab</Link>
          <Link href="/creative-lab/briefs" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Creative Briefs</Link>
          <Link href="/creative-lab/review" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Draft Review →</Link>
        </div>
      </div>
    );
  }

  return <PublishPrepView initialItems={items} initialSummary={summary} clientAccountId={clientAccountId} />;
}
