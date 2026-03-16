// lib/clientSetup/evaluator.ts
// Pure function that evaluates client setup state and returns a ClientSetupSummary.
//
// Design rules:
//  - No DB calls — takes pre-fetched data, returns a summary.
//  - Reuses existing data types from clientIntegrations and clientSync.
//  - Steps are evaluated sequentially: "current" = first incomplete step
//    where all prior steps are complete.
//  - Keep this separate from auth, sync internals, and reconciliation.

import type { ClientIntegrationStatus } from "../clientIntegrations";
import type { ClientSyncStatusSummary }  from "../clientSync/types";
import type {
  ClientSetupStep,
  ClientSetupStepId,
  ClientSetupStepStatus,
  ClientSetupSummary,
  ClientSetupAction,
} from "../../types/clientSetup";

// ── Internal step builder ─────────────────────────────────────────────────────

function makeStep(
  id:               ClientSetupStepId,
  label:            string,
  description:      string,
  status:           ClientSetupStepStatus,
  ctaLabel:         string,
  ctaHref:          string,
  completionDetail?: string,
): ClientSetupStep {
  return { id, label, description, status, ctaLabel, ctaHref, completionDetail };
}

// ── Completion flag helper ────────────────────────────────────────────────────

/** Returns "complete" | "current" | "pending" for a step, given whether it is
 *  done and whether the previous step is done. */
function stepStatus(isDone: boolean, prevDone: boolean): ClientSetupStepStatus {
  if (isDone)     return "complete";
  if (prevDone)   return "current";
  return "pending";
}

// ── Evaluator ─────────────────────────────────────────────────────────────────

export function evaluateClientSetup(
  clientId:     string,
  clientName:   string,
  integrations: ClientIntegrationStatus,
  syncStatus:   ClientSyncStatusSummary,
): ClientSetupSummary {
  const base = `/clients/${clientId}`;

  // ── Completion flags ────────────────────────────────────────────────────────

  // Step 1: client exists — always true (we only call this if the client loaded)
  const clientExists = true;

  // Step 2: at least one Meta connection exists at the workspace level
  // metaState "available" means accounts exist but none mapped to this client yet
  const metaConnected = integrations.metaState !== "not_connected";

  // Step 3: at least one Shopify connection exists at the workspace level
  const shopifyConnected = integrations.shopifyState !== "not_connected";

  // Step 4: this client has both a Meta account AND a Shopify store mapped to it
  const metaMapped    = integrations.metaState    === "mapped";
  const shopifyMapped = integrations.shopifyState === "mapped";
  const fullyMapped   = metaMapped && shopifyMapped;

  // Step 5: at least one successful (or partial) sync run exists
  const hasSynced =
    syncStatus.hasEverSynced &&
    syncStatus.lastSyncRun !== null &&
    syncStatus.lastSyncRun.status !== "failed";

  // Step 6: dashboard ready — currently equivalent to hasSynced
  // (extensible: could require metrics rows to exist in future)
  const dashboardReady = hasSynced;

  // ── Sequential step statuses ────────────────────────────────────────────────

  const s1 = stepStatus(clientExists,     true);
  const s2 = stepStatus(metaConnected,    clientExists);
  const s3 = stepStatus(shopifyConnected, metaConnected);
  const s4 = stepStatus(fullyMapped,      shopifyConnected);
  const s5 = stepStatus(hasSynced,        fullyMapped);
  const s6 = stepStatus(dashboardReady,   hasSynced);

  // ── Completion detail strings (shown when a step is complete) ───────────────

  const metaAccountCount =
    integrations.mappedMetaAccounts.length +
    integrations.availableMetaAccounts.length;

  const metaConnectedDetail = metaConnected
    ? `${metaAccountCount} account${metaAccountCount !== 1 ? "s" : ""} in workspace`
    : undefined;

  const metaMappedDetail = metaMapped
    ? `${integrations.mappedMetaAccounts.length} account${integrations.mappedMetaAccounts.length !== 1 ? "s" : ""} mapped`
    : undefined;

  const shopifyConnectedDetail =
    integrations.mappedShopifyConnection?.shopDomain ??
    integrations.availableShopifyConnections[0]?.shopDomain;

  const lastSyncAt = syncStatus.lastSyncRun?.completedAt ?? null;

  const syncDetail = lastSyncAt
    ? `Last synced ${new Date(lastSyncAt).toLocaleString()}`
    : undefined;

  // For the mapping step, show what's been done
  const mappingDetail = fullyMapped
    ? "Meta + Shopify mapped"
    : metaMapped
    ? "Meta mapped — Shopify pending"
    : shopifyMapped
    ? "Shopify mapped — Meta pending"
    : undefined;

  // ── Steps ───────────────────────────────────────────────────────────────────

  const steps: ClientSetupStep[] = [
    makeStep(
      "create_client",
      "Create Client",
      "Set up the client account in your workspace to begin tracking performance.",
      s1,
      "View Client",
      base,
      clientName,
    ),
    makeStep(
      "connect_meta",
      "Connect Meta",
      "Connect a Meta (Facebook Ads) account to your workspace via OAuth. This only needs to be done once per Meta user — all clients in the workspace share the same connection.",
      s2,
      metaConnected ? "Manage Meta" : "Connect Meta",
      "/integrations/meta",
      metaConnectedDetail,
    ),
    makeStep(
      "connect_shopify",
      "Connect Shopify",
      "Connect your Shopify store to your workspace via OAuth. Shopify is the source of truth for ROAS and CPA using a 7-day attribution window.",
      s3,
      shopifyConnected ? "Manage Shopify" : "Connect Shopify",
      "/integrations/shopify",
      shopifyConnectedDetail,
    ),
    makeStep(
      "map_integrations",
      "Map Integrations",
      "Assign the Meta ad account and Shopify store to this specific client. Mapping tells the dashboard which Meta account and Shopify data belong to this client.",
      s4,
      "Map Integrations",
      `${base}#integrations`,
      mappingDetail,
    ),
    makeStep(
      "run_first_sync",
      "Run First Sync",
      "Pull Meta campaign data and Shopify orders into the dashboard. This brings the client live with real performance metrics.",
      s5,
      "Run First Sync",
      `${base}#sync`,
      syncDetail,
    ),
    makeStep(
      "dashboard_ready",
      "View Live Dashboard",
      "Client is live — view performance metrics, campaign evaluation, and optimization opportunities.",
      s6,
      "View Dashboard",
      base,
      dashboardReady ? "Client is live" : undefined,
    ),
  ];

  // ── Counts ──────────────────────────────────────────────────────────────────

  const completedCount = steps.filter((s) => s.status === "complete").length;
  const totalCount     = steps.length;
  const currentStepId  = steps.find((s) => s.status === "current")?.id ?? null;

  // ── Next action ─────────────────────────────────────────────────────────────

  let nextAction: ClientSetupAction;

  if (dashboardReady) {
    nextAction = {
      label:    "Client is live — your dashboard is ready",
      ctaLabel: "View Dashboard",
      ctaHref:  base,
      stepId:   null,
    };
  } else if (fullyMapped) {
    nextAction = {
      label:    "Integrations are mapped — run your first sync to bring data live",
      ctaLabel: "Run First Sync",
      ctaHref:  `${base}#sync`,
      stepId:   "run_first_sync",
    };
  } else if (metaConnected && shopifyConnected && !metaMapped && !shopifyMapped) {
    nextAction = {
      label:    "Map a Meta ad account and Shopify store to this client",
      ctaLabel: "Map Integrations",
      ctaHref:  `${base}#integrations`,
      stepId:   "map_integrations",
    };
  } else if (metaConnected && shopifyConnected && !metaMapped) {
    nextAction = {
      label:    "Map a Meta ad account to this client",
      ctaLabel: "Map Integrations",
      ctaHref:  `${base}#integrations`,
      stepId:   "map_integrations",
    };
  } else if (metaConnected && shopifyConnected && !shopifyMapped) {
    nextAction = {
      label:    "Map a Shopify store to this client",
      ctaLabel: "Map Integrations",
      ctaHref:  `${base}#integrations`,
      stepId:   "map_integrations",
    };
  } else if (metaConnected && !shopifyConnected) {
    nextAction = {
      label:    "Connect Shopify to continue",
      ctaLabel: "Connect Shopify",
      ctaHref:  "/integrations/shopify",
      stepId:   "connect_shopify",
    };
  } else if (!metaConnected) {
    nextAction = {
      label:    "Connect Meta to continue",
      ctaLabel: "Connect Meta",
      ctaHref:  "/integrations/meta",
      stepId:   "connect_meta",
    };
  } else {
    // Fallback: something is mapped but not fully — send to mapping
    nextAction = {
      label:    "Complete integration mapping for this client",
      ctaLabel: "Map Integrations",
      ctaHref:  `${base}#integrations`,
      stepId:   "map_integrations",
    };
  }

  // ── Readiness label ─────────────────────────────────────────────────────────

  let readinessLabel: string;
  if (dashboardReady)  readinessLabel = "Live";
  else if (fullyMapped) readinessLabel = "Ready for sync";
  else                  readinessLabel = `${completedCount}/${totalCount} complete`;

  // ── Return ──────────────────────────────────────────────────────────────────

  return {
    clientId,
    clientName,
    steps,
    completedCount,
    totalCount,
    currentStepId,
    nextAction,
    readinessLabel,
    isLive: dashboardReady,
    lastSyncAt,
  };
}
