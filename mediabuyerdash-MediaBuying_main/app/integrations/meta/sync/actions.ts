"use server";

import { getServerSession }  from "next-auth";
import { revalidatePath }    from "next/cache";
import { authOptions }       from "../../../../lib/auth";
import { runMetaSync, type SyncSummary } from "../../../../lib/meta/sync";
import { isMetaConfigured }  from "../../../../lib/meta/config";

const PAGE = "/integrations/meta/sync";

export async function runMetaSyncAction(): Promise<SyncSummary> {
  if (!isMetaConfigured()) {
    return {
      status:            "failed",
      accountsProcessed: 0,
      campaignsSynced:   0,
      adSetsSynced:      0,
      adsSynced:         0,
      creativesSynced:   0,
      insightRowsSynced: 0,
      errors:            ["Meta credentials not configured (META_APP_ID / META_APP_SECRET missing)"],
      startedAt:         new Date().toISOString(),
      completedAt:       new Date().toISOString(),
    };
  }

  const session    = await getServerSession(authOptions);
  const workspaceId = session?.user?.workspaceId ?? null;

  const summary = await runMetaSync(workspaceId);
  revalidatePath(PAGE);
  return summary;
}
