// Pure helper functions for the Meta connection flow.
// No UI logic, no side effects — safe to import from server or client code.

import type {
  MetaConnectionSession,
  MetaAccessibleAdAccount,
  MetaSyncStatus,
  MetaSyncStatusValue
} from "../types/metaConnection";

// Returns only the accessible accounts that are currently selected.
export function getSelectedAccounts(
  accessible: MetaAccessibleAdAccount[],
  selectedIds: Set<string>
): MetaAccessibleAdAccount[] {
  return accessible.filter((a) => selectedIds.has(a.id));
}

// Returns a single human-readable summary of the connection state.
export function summarizeConnection(
  isConnected: boolean,
  session: MetaConnectionSession | null,
  accessible: MetaAccessibleAdAccount[],
  selectedIds: Set<string>
): string {
  if (!isConnected || !session) return "Not connected to Meta";
  const sel = selectedIds.size;
  return (
    `Connected as ${session.userName}` +
    ` · ${accessible.length} account${accessible.length !== 1 ? "s" : ""} accessible` +
    ` · ${sel} selected`
  );
}

// Looks up the sync status for a single ad account by ID.
export function getSyncStatus(
  statuses: MetaSyncStatus[],
  accountId: string
): MetaSyncStatus | undefined {
  return statuses.find((s) => s.adAccountId === accountId);
}

// Maps a MetaSyncStatusValue to a short display label.
export function syncStatusLabel(status: MetaSyncStatusValue): string {
  switch (status) {
    case "idle":      return "Idle";
    case "pending":   return "Pending";
    case "syncing":   return "Syncing…";
    case "completed": return "Synced";
    case "failed":    return "Failed";
  }
}

// Returns true if any selected account has not yet been synced.
export function hasUnsyncedAccounts(
  accessible: MetaAccessibleAdAccount[],
  selectedIds: Set<string>,
  statuses: MetaSyncStatus[]
): boolean {
  for (const id of selectedIds) {
    const account = accessible.find((a) => a.id === id);
    if (!account) continue;
    const status = getSyncStatus(statuses, id);
    if (!status || status.status !== "completed") return true;
  }
  return false;
}
