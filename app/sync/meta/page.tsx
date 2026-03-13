import { mockMetaSyncPayload, mockMetaSyncJob } from "../../../lib/data/mockMetaSyncPayload";
import { runMockSyncWithPersist } from "../../../lib/metaSyncOrchestrator";
import { MetaSyncView } from "./MetaSyncView";

export const metadata = {
  title: "Meta Sync Preview — Media Buying Dashboard"
};

export default async function MetaSyncPage() {
  // Run the mock sync (maps + upserts into the local SQLite DB) on every
  // page load so the page always reflects the current contract output.
  const result = await runMockSyncWithPersist(mockMetaSyncPayload, mockMetaSyncJob);

  return (
    <MetaSyncView
      payload={mockMetaSyncPayload}
      job={result.job}
      batch={result.batch}
      summary={result.summary}
    />
  );
}
