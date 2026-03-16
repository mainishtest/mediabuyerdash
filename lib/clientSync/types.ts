// lib/clientSync/types.ts
// Shared types for client-scoped sync orchestration.

export type SyncStatus = "running" | "completed" | "failed" | "partial";

export type SyncType = "meta" | "shopify" | "full";

// ── Step-level summary shapes (stored as summaryJson in DB) ──────────────────

export interface MetaStepSummary {
  accountsProcessed: number;
  campaignsSynced:   number;
  adSetsSynced:      number;
  adsSynced:         number;
  creativesSynced:   number;
  insightRowsSynced: number;
}

export interface ShopifyStepSummary {
  ordersSynced:    number;
  lineItemsSynced: number;
}

// ── Run + Step records (serialized — safe for client component props) ────────

export interface ClientSyncRunStepRecord {
  id:              string;
  clientSyncRunId: string;
  stepType:        string;  // "meta_account" | "shopify_orders"
  status:          SyncStatus;
  summaryJson:     string | null;
  errorMessage:    string | null;
  startedAt:       string;
  completedAt:     string | null;
}

export interface ClientSyncRunRecord {
  id:              string;
  clientAccountId: string;
  syncType:        SyncType;
  status:          SyncStatus;
  startedAt:       string;
  completedAt:     string | null;
  errorMessage:    string | null;
  steps:           ClientSyncRunStepRecord[];
}

// ── Orchestrator result (returned to the server action caller) ───────────────

export interface ClientSyncResult {
  syncRunId:      string;
  status:         SyncStatus;
  syncType:       SyncType;
  metaSummary:    MetaStepSummary | null;
  shopifySummary: ShopifyStepSummary | null;
  errors:         string[];
  startedAt:      string;
  completedAt:    string;
}

// ── Aggregated status for client detail page ─────────────────────────────────

export interface ClientSyncStatusSummary {
  lastSyncRun:     ClientSyncRunRecord | null;  // most recent of any type
  lastMetaSync:    ClientSyncRunRecord | null;
  lastShopifySync: ClientSyncRunRecord | null;
  hasEverSynced:   boolean;
}
