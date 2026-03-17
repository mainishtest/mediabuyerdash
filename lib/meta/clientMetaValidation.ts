// lib/meta/clientMetaValidation.ts
// Client-scoped Meta import validation service.
//
// Produces structured, user-facing status models from the raw pipeline data:
//   ClientMetaImportStatus  – boolean flags for each pipeline checkpoint
//   ClientMetaImportCounts  – entity row counts scoped to this client
//   ClientMetaImportIssue   – typed issues with severity + next action
//   ClientMetaDashboardValidation – whether the dashboard query has data
//
// Intentionally separate from sync logic. Call this after page load to
// surface the health of the Meta import pipeline without triggering any writes.

import { prisma }               from "../db";
import { getMetaImportStatus }  from "./metaImportStatus";

// ── Status checkpoint model ───────────────────────────────────────────────────

export interface ClientMetaImportStatus {
  clientId:                string;
  metaConnected:           boolean;
  accessibleAccountsCount: number;
  selectedAccountsCount:   number;
  mappedAccountsCount:     number;
  hasSuccessfulSync:       boolean;
  lastSyncStatus:          string | null; // "completed" | "partial" | "failed" | null
  lastSyncAt:              string | null; // ISO string
  dataVisibleInDashboard:  boolean;
}

// ── Import counts model ───────────────────────────────────────────────────────

export interface ClientMetaImportCounts {
  campaignsCount:   number;
  adSetsCount:      number;
  adsCount:         number;
  creativesCount:   number; // workspace-scoped (creatives have no direct account link)
  insightRowsCount: number;
}

// ── Issue model ───────────────────────────────────────────────────────────────

export type IssueSeverity = "error" | "warning" | "info";

export type IssueCode =
  | "no_meta_connection"
  | "no_accessible_ad_accounts"
  | "no_selected_ad_accounts"
  | "no_client_account_mapping"
  | "sync_not_run"
  | "sync_failed"
  | "zero_campaigns_imported"
  | "dashboard_query_empty";

export interface ClientMetaImportIssue {
  code:        IssueCode;
  label:       string;
  description: string;
  severity:    IssueSeverity;
  actionLabel: string;
  actionHref:  string;
}

// ── Dashboard validation model ────────────────────────────────────────────────

export interface ClientMetaDashboardValidation {
  hasMapping:             boolean;
  hasSyncedData:          boolean;
  campaignDataAvailable:  boolean;
}

// ── Next best action ──────────────────────────────────────────────────────────

export interface NextBestAction {
  label:       string;
  href:        string;
  description: string;
}

// ── Aggregate result ──────────────────────────────────────────────────────────

export interface ClientMetaValidation {
  status:              ClientMetaImportStatus;
  counts:              ClientMetaImportCounts;
  issues:              ClientMetaImportIssue[];
  dashboardValidation: ClientMetaDashboardValidation;
  nextBestAction:      NextBestAction | null;
  isHealthy:           boolean;
}

// ── Service function ──────────────────────────────────────────────────────────

/**
 * Returns a fully structured validation result for the Meta import pipeline
 * scoped to a single client.
 *
 * Internally reuses getMetaImportStatus() for the 7-stage pipeline check
 * (avoids duplicating DB queries) and adds creative counts + issue derivation.
 */
export async function getClientMetaValidation(
  clientId:     string,
  workspaceId?: string | null
): Promise<ClientMetaValidation> {
  // ── 1. Fetch base pipeline status (7 stages) ──────────────────────────────
  const importStatus = await getMetaImportStatus(clientId, workspaceId);

  // ── 2. Creative count — workspace-scoped (no direct account ↔ creative link) ──
  const creativesCount = workspaceId
    ? await prisma.metaSyncedCreative.count({
        where: { OR: [{ workspaceId }, { workspaceId: null }] },
      })
    : await prisma.metaSyncedCreative.count();

  // ── 3. Build ClientMetaImportStatus ──────────────────────────────────────
  const status: ClientMetaImportStatus = {
    clientId,
    metaConnected:           importStatus.connectionOk,
    accessibleAccountsCount: importStatus.accessibleCount,
    selectedAccountsCount:   importStatus.selectedAccounts.length,
    mappedAccountsCount:     importStatus.mappedAccounts.length,
    hasSuccessfulSync:
      importStatus.lastSync !== null &&
      ["completed", "partial"].includes(importStatus.lastSync.status),
    lastSyncStatus: importStatus.lastSync?.status       ?? null,
    lastSyncAt:     importStatus.lastSync?.completedAt  ?? null,
    dataVisibleInDashboard: importStatus.dashboardHasSynced,
  };

  // ── 4. Build ClientMetaImportCounts ──────────────────────────────────────
  const counts: ClientMetaImportCounts = {
    campaignsCount:   importStatus.syncedCampaigns,
    adSetsCount:      importStatus.syncedAdSets,
    adsCount:         importStatus.syncedAds,
    creativesCount,
    insightRowsCount: importStatus.syncedInsights,
  };

  // ── 5. Build issue list (ordered: errors first, then warnings) ────────────
  const issues: ClientMetaImportIssue[] = [];

  if (!status.metaConnected) {
    issues.push({
      code:        "no_meta_connection",
      label:       "No Meta connection",
      description: "No active Meta OAuth connection found for this workspace. Connect Meta to start importing campaign data.",
      severity:    "error",
      actionLabel: "Connect Meta",
      actionHref:  "/integrations/meta",
    });
  }

  if (status.metaConnected && status.accessibleAccountsCount === 0) {
    issues.push({
      code:        "no_accessible_ad_accounts",
      label:       "No accessible ad accounts",
      description: "Connected to Meta but no ad accounts are accessible. Click Refresh Accounts on the Meta integration page.",
      severity:    "error",
      actionLabel: "Refresh Ad Accounts",
      actionHref:  "/integrations/meta",
    });
  }

  if (
    status.metaConnected &&
    status.accessibleAccountsCount > 0 &&
    status.selectedAccountsCount === 0
  ) {
    issues.push({
      code:        "no_selected_ad_accounts",
      label:       "No ad accounts selected",
      description: "Ad accounts are accessible but none are selected for the workspace. Visit Meta Integration and tick the accounts you want to include.",
      severity:    "error",
      actionLabel: "Select Ad Accounts",
      actionHref:  "/integrations/meta",
    });
  }

  if (status.selectedAccountsCount > 0 && status.mappedAccountsCount === 0) {
    issues.push({
      code:        "no_client_account_mapping",
      label:       "No ad account mapped to this client",
      description: "Selected ad accounts exist in the workspace but none are assigned to this client. Use the Client Integrations section to map an account.",
      severity:    "error",
      actionLabel: "Map Ad Account",
      actionHref:  "#integrations",
    });
  }

  if (
    status.mappedAccountsCount > 0 &&
    !status.hasSuccessfulSync &&
    status.lastSyncStatus === null
  ) {
    issues.push({
      code:        "sync_not_run",
      label:       "Sync has not been run",
      description: "An ad account is mapped to this client but no Meta sync has run yet. Trigger a sync to import campaign data.",
      severity:    "warning",
      actionLabel: "Run Meta Sync",
      actionHref:  "#sync",
    });
  }

  if (status.lastSyncStatus === "failed") {
    issues.push({
      code:        "sync_failed",
      label:       "Last sync failed",
      description: "The most recent Meta sync did not complete successfully. Expand the Debug Panel below to see error details.",
      severity:    "error",
      actionLabel: "View Debug Panel",
      actionHref:  "#debug",
    });
  }

  if (status.hasSuccessfulSync && counts.campaignsCount === 0) {
    issues.push({
      code:        "zero_campaigns_imported",
      label:       "Sync ran but no campaigns imported",
      description: "The sync completed but no campaigns were found for this client's mapped ad accounts. Verify the mapped account ID matches what Meta returned in the Debug Panel.",
      severity:    "warning",
      actionLabel: "View Debug Panel",
      actionHref:  "#debug",
    });
  }

  if (
    status.hasSuccessfulSync &&
    counts.campaignsCount > 0 &&
    !status.dataVisibleInDashboard
  ) {
    issues.push({
      code:        "dashboard_query_empty",
      label:       "Data imported but not visible in dashboard",
      description: "Campaigns exist in the database but the dashboard query returned no results. This may indicate a workspaceId or account-ID mismatch — check the Debug Panel.",
      severity:    "warning",
      actionLabel: "View Debug Panel",
      actionHref:  "#debug",
    });
  }

  // ── 6. Dashboard validation ───────────────────────────────────────────────
  const dashboardValidation: ClientMetaDashboardValidation = {
    hasMapping:            importStatus.dashboardHasMapping,
    hasSyncedData:         importStatus.dashboardHasSynced,
    campaignDataAvailable: importStatus.dashboardHasSynced && counts.campaignsCount > 0,
  };

  // ── 7. Next best action — first error, then first warning ─────────────────
  const nextIssue =
    issues.find((i) => i.severity === "error")   ??
    issues.find((i) => i.severity === "warning")  ??
    null;

  const nextBestAction: NextBestAction | null = nextIssue
    ? {
        label:       nextIssue.actionLabel,
        href:        nextIssue.actionHref,
        description: nextIssue.description,
      }
    : null;

  return {
    status,
    counts,
    issues,
    dashboardValidation,
    nextBestAction,
    isHealthy: issues.length === 0,
  };
}
