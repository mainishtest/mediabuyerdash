// lib/onboarding/summary.ts
// Assembles all readiness evaluations into a single GoLiveSummary.

import { prisma } from "../db";
import {
  evaluateIntegrationReadiness,
  evaluateSyncHealth,
  evaluateAttributionReadiness,
  evaluateGoalSetupReadiness,
  evaluateGovernanceReadiness,
} from "./readiness";
import { buildOnboardingChecklist } from "./checklist";
import type {
  GoLiveSummary,
  OnboardingBlocker,
  OnboardingReadinessStatus,
} from "../../types/onboarding";

// ── Blocker detection ─────────────────────────────────────────────────────────

function deriveBlockers(summary: Omit<GoLiveSummary, "blockers" | "status" | "completedCount" | "totalRequiredCount" | "readyForGoLive">): OnboardingBlocker[] {
  const blockers: OnboardingBlocker[] = [];

  if (!summary.integration.meta.connected) {
    blockers.push({
      id:          "blocker_meta_missing",
      label:       "No Meta ad account linked",
      detail:      "Connect and map a Meta ad account to enable campaign sync and delivery analysis.",
      severity:    "critical",
      actionLabel: "Connect Meta",
      actionHref:  "/integrations",
    });
  } else if (summary.integration.meta.connectionStatus !== "active") {
    blockers.push({
      id:          "blocker_meta_inactive",
      label:       "Meta connection is not active",
      detail:      "Reconnect the Meta integration to restore sync access.",
      severity:    "critical",
      actionLabel: "Reconnect Meta",
      actionHref:  "/integrations",
    });
  }

  if (!summary.integration.shopify.connected) {
    blockers.push({
      id:          "blocker_shopify_missing",
      label:       "No Shopify store connected",
      detail:      "Shopify is the CRM source of truth for ROAS and CPA. Connect it to enable reconciliation.",
      severity:    "critical",
      actionLabel: "Connect Shopify",
      actionHref:  "/integrations",
    });
  } else if (summary.integration.shopify.connectionStatus !== "active") {
    blockers.push({
      id:          "blocker_shopify_inactive",
      label:       "Shopify connection is not active",
      detail:      "Reconnect the Shopify integration to restore order sync.",
      severity:    "critical",
      actionLabel: "Reconnect Shopify",
      actionHref:  "/integrations",
    });
  } else if (!summary.integration.shopify.synced) {
    blockers.push({
      id:          "blocker_shopify_not_synced",
      label:       "Shopify orders not yet imported",
      detail:      "Run a Shopify sync to import order data before going live.",
      severity:    "critical",
      actionLabel: "Run Sync",
      actionHref:  `/clients/${summary.clientId}`,
    });
  }

  if (!summary.goalSetup.hasGoals) {
    blockers.push({
      id:          "blocker_goals_missing",
      label:       "No default goals configured",
      detail:      "Set ROAS and CPA targets to enable optimization, alerting, and governance.",
      severity:    "critical",
      actionLabel: "Configure Goals",
      actionHref:  `/clients/${summary.clientId}`,
    });
  }

  if (summary.syncHealth.metaSyncStatus === "failed") {
    blockers.push({
      id:          "blocker_meta_sync_failed",
      label:       "Meta sync is failing",
      detail:      summary.syncHealth.recentErrors.find((e) => e.startsWith("Meta:")) ?? "Check sync logs for details.",
      severity:    "warning",
      actionLabel: "Retry Sync",
      actionHref:  `/clients/${summary.clientId}`,
    });
  }

  if (summary.syncHealth.shopifySyncStatus === "failed") {
    blockers.push({
      id:          "blocker_shopify_sync_failed",
      label:       "Shopify sync is failing",
      detail:      summary.syncHealth.recentErrors.find((e) => e.startsWith("Shopify:")) ?? "Check sync logs for details.",
      severity:    "warning",
      actionLabel: "Retry Sync",
      actionHref:  `/clients/${summary.clientId}`,
    });
  }

  if (!summary.attribution.timezoneConfigured) {
    blockers.push({
      id:          "blocker_timezone",
      label:       "Timezone not confirmed",
      detail:      "Verify the client timezone matches the Meta ad account timezone for accurate dayparting.",
      severity:    "warning",
      actionLabel: "Set Timezone",
      actionHref:  `/clients/${summary.clientId}`,
    });
  }

  return blockers;
}

// ── Status derivation ─────────────────────────────────────────────────────────

function deriveStatus(
  blockers: OnboardingBlocker[],
  completedCount: number,
  totalRequired: number
): OnboardingReadinessStatus {
  const criticalBlockers = blockers.filter((b) => b.severity === "critical");
  if (criticalBlockers.length > 0) return "blocked";
  if (completedCount === 0) return "not_started";
  if (completedCount < totalRequired) return "in_progress";
  if (blockers.length > 0) return "needs_review";
  return "ready_for_go_live";
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function buildGoLiveSummary(clientId: string): Promise<GoLiveSummary> {
  const account = await prisma.clientAccount.findUnique({
    where:  { id: clientId },
    select: { id: true, name: true, timezone: true },
  });

  if (!account) throw new Error(`Client ${clientId} not found`);

  const [integration, syncHealth, attribution, goalSetup, governance] =
    await Promise.all([
      evaluateIntegrationReadiness(clientId),
      evaluateSyncHealth(clientId),
      evaluateAttributionReadiness(clientId),
      evaluateGoalSetupReadiness(clientId),
      evaluateGovernanceReadiness(clientId),
    ]);

  const checklist = buildOnboardingChecklist({
    clientName:  account.name,
    timezone:    account.timezone,
    integration,
    syncHealth,
    attribution,
    goalSetup,
    governance,
  });

  const requiredItems   = checklist.filter((i) => i.required);
  const completedCount  = requiredItems.filter((i) => i.status === "complete").length;
  const totalRequired   = requiredItems.length;

  const partialSummary = {
    clientId:   account.id,
    clientName: account.name,
    timezone:   account.timezone,
    checklist,
    integration,
    syncHealth,
    attribution,
    goalSetup,
    governance,
  };

  const blockers = deriveBlockers(partialSummary);
  const status   = deriveStatus(blockers, completedCount, totalRequired);

  return {
    ...partialSummary,
    blockers,
    status,
    completedCount,
    totalRequiredCount: totalRequired,
    readyForGoLive:     status === "ready_for_go_live" || status === "live",
  };
}
