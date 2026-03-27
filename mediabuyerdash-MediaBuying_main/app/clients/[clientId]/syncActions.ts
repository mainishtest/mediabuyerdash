"use server";

// app/clients/[clientId]/syncActions.ts
// Server actions for triggering client-scoped sync runs.
// Kept separate from actions.ts (which owns integration mapping only).

import { getServerSession } from "next-auth";
import { revalidatePath }   from "next/cache";
import { authOptions }      from "../../../lib/auth";
import { prisma }           from "../../../lib/db";
import { runClientSync }    from "../../../lib/clientSync/orchestrator";
import type { SyncType }    from "../../../lib/clientSync/types";
import type { ClientSyncResult } from "../../../lib/clientSync/types";

// ── Auth guard ────────────────────────────────────────────────────────────────

async function assertClientOwnership(clientId: string): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.workspaceId) throw new Error("Not authenticated");

  const client = await prisma.clientAccount.findFirst({
    where: { id: clientId, workspaceId: session.user.workspaceId },
  });
  if (!client) throw new Error("Client not found or access denied");
}

// ── Sync action ───────────────────────────────────────────────────────────────

export type SyncActionResponse =
  | { success: true;  result: ClientSyncResult }
  | { success: false; error: string };

/**
 * Trigger a client-scoped sync run (meta | shopify | full).
 * Returns a serializable result object the client component can display inline.
 * Also revalidates the client page so background data refreshes.
 */
export async function runClientSyncAction(
  clientId: string,
  syncType: SyncType
): Promise<SyncActionResponse> {
  try {
    await assertClientOwnership(clientId);

    const result = await runClientSync(clientId, syncType);

    revalidatePath(`/clients/${clientId}`);
    revalidatePath(`/clients/${clientId}/sync`);

    return { success: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected sync error";
    console.error("[syncAction]", clientId, syncType, err);
    return { success: false, error: message };
  }
}
