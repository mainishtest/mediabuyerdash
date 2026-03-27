import Link from "next/link";
import { listLaunchDrafts } from "../../lib/launchDraftUtils";
import { LaunchDraftsView } from "./LaunchDraftsView";

export const dynamic = "force-dynamic";

export default async function LaunchDraftsPage() {
  const drafts = await listLaunchDrafts();

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Launch Drafts</h1>
            <p className="mt-1 text-sm text-slate-400">
              Approved creative variants packaged for future creative testing.
            </p>
          </div>
          <Link
            href="/creative-history"
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
          >
            ← Generation History
          </Link>
        </div>

        <section className="rounded-xl border border-sky-800/40 bg-sky-950/20 p-4">
          <p className="text-sm text-sky-200">
            <strong>Preparation layer only.</strong> Launch drafts let you review
            approved copy and image concepts before they become live tests. Meta
            publishing is not connected yet.
          </p>
        </section>

        <LaunchDraftsView drafts={drafts} />
      </div>
    </main>
  );
}
