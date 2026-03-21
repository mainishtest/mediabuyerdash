// lib/onboarding/data.ts
// Data fetching layer for the onboarding readiness flow.
//
// Collects all data needed by the pure evaluators in a single function.
// This is the only file in the onboarding module that touches the DB.

import { prisma }                        from "../db";
import { getClientIntegrationStatus }    from "../clientIntegrations";
import { getClientReadiness }            from "../clientSync/readiness";
import { getClientGoal }                 from "../goals/service";
import type { ClientSyncStatusSummary }  from "../clientSync/types";
import type { GovernanceInput }          from "./evaluator";
import {
  evaluateIntegrationReadiness,
  evaluateSyncHealth,
  evaluateAttributionReadiness,
  evaluateGoalSetupReadiness,
  evaluateGovernanceReadiness,
  buildGoLiveSummary,
} from "./evaluator";
import { buildOnboardingChecklist }      from "./checklist";
import type { OnboardingAccount }        from "../../types/onboarding";

// ── Sync status helper (reused from clientSync/db pattern) ──────────────────

async function getClientSyncStatus(clientId: string): Promise<ClientSyncStatusSummary> {
  const lastSyncRun = await prisma.clientSyncRun.findFirst({
    where:   { clientAccountId: clientId },
    orderBy: { startedAt: "desc" },
    include: { steps: true },
  });

  const lastMetaSync = await prisma.clientSyncRun.findFirst({
    where:   { clientAccountId: clientId, syncType: "meta" },
    orderBy: { startedAt: "desc" },
    include: { steps: true },
  });

  const lastShopifySync = await prisma.clientSyncRun.findFirst({
    where:   { clientAccountId: clientId, syncType: "shopify" },
    orderBy: { startedAt: "desc" },
    include: { steps: true },
  });

  function serialize(run: typeof lastSyncRun) {
    if (!run) return null;
    return {
      id:              run.id,
      clientAccountId: run.clientAccountId,
      syncType:        run.syncType as "meta" | "shopify" | "full",
      status:          run.status as "running" | "completed" | "failed" | "partial",
      startedAt:       run.startedAt.toISOString(),
      completedAt:     run.completedAt?.toISOString() ?? null,
      errorMessage:    run.errorMessage,
      steps:           run.steps.map(s => ({
        id:              s.id,
        clientSyncRunId: s.clientSyncRunId,
        stepType:        s.stepType,
        status:          s.status as "running" | "completed" | "failed" | "partial",
        summaryJson:     s.summaryJson,
        errorMessage:    s.errorMessage,
        startedAt:       s.startedAt.toISOString(),
        completedAt:     s.completedAt?.toISOString() ?? null,
      })),
    };
  }

  return {
    lastSyncRun:     serialize(lastSyncRun),
    lastMetaSync:    serialize(lastMetaSync),
    lastShopifySync: serialize(lastShopifySync),
    hasEverSynced:   lastSyncRun !== null,
  };
}

// ── Governance summary helper ───────────────────────────────────────────────

async function getGovernanceInput(workspaceId: string): Promise<GovernanceInput> {
  const [stopCount, overrideCount] = await Promise.all([
    prisma.governanceStop.count({
      where: { workspaceId, isActive: true },
    }).catch(() => 0),
    prisma.automationOverride.count({
      where: { workspaceId, isActive: true },
    }).catch(() => 0),
  ]);

  // Check for global stop (automation paused)
  const globalStop = await prisma.governanceStop.findFirst({
    where: { workspaceId, isActive: true, scope: "global" },
  }).catch(() => null);

  return {
    automationPaused:    globalStop !== null,
    activeStopCount:     stopCount,
    activeOverrideCount: overrideCount,
  };
}

// ── Main data fetcher ───────────────────────────────────────────────────────

export async function fetchOnboardingAccount(
  clientId:    string,
  workspaceId: string,
): Promise<OnboardingAccount | null> {
  // 1. Load client
  const client = await prisma.clientAccount.findFirst({
    where: { id: clientId, workspaceId },
    select: {
      id:        true,
      name:      true,
      brandName: true,
      timezone:  true,
      currency:  true,
      status:    true,
      createdAt: true,
    },
  });
  if (!client) return null;

  // 2. Fetch all readiness data in parallel
  const [integrations, syncStatus, syncReadiness, clientGoal, governanceInput] =
    await Promise.all([
      getClientIntegrationStatus(clientId),
      getClientSyncStatus(clientId),
      getClientReadiness(clientId),
      getClientGoal(clientId),
      getGovernanceInput(workspaceId),
    ]);

  // 3. Evaluate each readiness dimension (pure functions)
  const integration = evaluateIntegrationReadiness(integrations, clientId);
  const syncHealth  = evaluateSyncHealth(syncStatus, syncReadiness, clientId);
  const attribution = evaluateAttributionReadiness(client.timezone, clientId);
  const goalSetup   = evaluateGoalSetupReadiness(clientGoal, clientId);
  const governance  = evaluateGovernanceReadiness(governanceInput);

  // 4. Build checklist
  const checklist = buildOnboardingChecklist(
    clientId, integration, syncHealth, attribution, goalSetup, governance,
  );

  // 5. Build go-live summary
  const isAlreadyLive = syncHealth.dataFlowing && integration.readyForSync;
  const goLive = buildGoLiveSummary(
    integration, syncHealth, attribution, goalSetup, governance,
    isAlreadyLive, checklist,
  );

  return {
    clientId:    client.id,
    clientName:  client.name,
    brandName:   client.brandName,
    timezone:    client.timezone,
    currency:    client.currency,
    status:      client.status,
    createdAt:   client.createdAt.toISOString(),
    integration,
    syncHealth,
    attribution,
    goalSetup,
    governance,
    checklist,
    goLive,
  };
}

// ── List all accounts with readiness state (for account list page) ──────────

export async function fetchOnboardingAccountList(
  workspaceId: string,
): Promise<OnboardingAccount[]> {
  const clients = await prisma.clientAccount.findMany({
    where:   { workspaceId },
    select:  { id: true },
    orderBy: { createdAt: "desc" },
  });

  const results = await Promise.all(
    clients.map(c => fetchOnboardingAccount(c.id, workspaceId)),
  );

  return results.filter((r): r is OnboardingAccount => r !== null);
}
