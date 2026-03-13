import { mockMetaSyncPayload, mockMetaSyncJob } from "../../../lib/data/mockMetaSyncPayload";
import { runMockSyncWithPersist } from "../../../lib/metaSyncOrchestrator";
import { MetaSyncView } from "./MetaSyncView";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Meta Sync Preview — Media Buying Dashboard"
};

export default async function MetaSyncPage() {
  // Run the mock sync (maps + upserts into the local SQLite DB) on every
  // page load so the page always reflects the current contract output.
  const result = await runMockSyncWithPersist(mockMetaSyncPayload, mockMetaSyncJob)
    .catch(() => null);

  if (!result) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
        <div className="mx-auto max-w-3xl rounded-xl border border-amber-800/40 bg-amber-950/20 p-6">
          <h1 className="text-lg font-semibold text-amber-300">Database unavailable</h1>
          <p className="mt-2 text-sm text-amber-200">
            DATABASE_URL is not configured. Add it in Vercel project settings to enable sync.
          </p>
        </div>
      </main>
    );
  }

  return (
    <MetaSyncView
      payload={mockMetaSyncPayload}
      job={result.job}
      batch={result.batch}
      summary={result.summary}
    />
  );
}
