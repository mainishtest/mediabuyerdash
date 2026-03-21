// lib/onboarding/readiness.ts
// Evaluate each readiness dimension for a client account.
// All functions are pure DB reads — no side effects.

import { prisma } from "../db";
import type {
  IntegrationReadiness,
  SyncHealthStatus,
  AttributionReadiness,
  GoalSetupReadiness,
  GovernanceReadiness,
} from "../../types/onboarding";

const STALE_HOURS = 24;

function msToHours(ms: number) {
  return ms / (1000 * 60 * 60);
}

function syncLabel(completedAt: Date | null, failed: boolean): "healthy" | "stale" | "failed" | "never" {
  if (failed) return "failed";
  if (!completedAt) return "never";
  const age = msToHours(Date.now() - completedAt.getTime());
  return age <= STALE_HOURS ? "healthy" : "stale";
}

// ── Integration readiness ─────────────────────────────────────────────────────

export async function evaluateIntegrationReadiness(
  clientId: string
): Promise<IntegrationReadiness> {
  const [metaAccounts, shopifyConnection] = await Promise.all([
    prisma.metaSelectedAdAccount.findMany({
      where:   { clientAccountId: clientId },
      include: { connection: { select: { connectionStatus: true } } },
    }),
    prisma.shopifyConnection.findFirst({
      where:  { clientAccountId: clientId },
      select: {
        shopDomain:       true,
        connectionStatus: true,
        syncLogs: {
          where:   { status: { in: ["completed", "partial"] } },
          orderBy: { completedAt: "desc" },
          take:    1,
          select:  { id: true },
        },
      },
    }),
  ]);

  const shopifyOrderCount = shopifyConnection
    ? await prisma.shopifyOrder.count({ where: { clientAccountId: clientId } })
    : 0;

  const activeMetaConnection = metaAccounts.find(
    (a) => a.connection.connectionStatus === "active"
  );

  return {
    meta: {
      connected:        metaAccounts.length > 0,
      adAccountLinked:  metaAccounts.length > 0,
      accountCount:     metaAccounts.length,
      connectionStatus: activeMetaConnection?.connection.connectionStatus ?? null,
    },
    shopify: {
      connected:        shopifyConnection !== null,
      domain:           shopifyConnection?.shopDomain ?? null,
      connectionStatus: shopifyConnection?.connectionStatus ?? null,
      synced:           (shopifyConnection?.syncLogs?.length ?? 0) > 0,
      orderCount:       shopifyOrderCount,
    },
  };
}

// ── Sync health ───────────────────────────────────────────────────────────────

export async function evaluateSyncHealth(
  clientId: string
): Promise<SyncHealthStatus> {
  const [lastMeta, lastShopify] = await Promise.all([
    prisma.clientSyncRun.findFirst({
      where:   { clientAccountId: clientId, syncType: { in: ["meta", "full"] } },
      orderBy: { startedAt: "desc" },
      select:  { status: true, completedAt: true, errorMessage: true },
    }),
    prisma.clientSyncRun.findFirst({
      where:   { clientAccountId: clientId, syncType: { in: ["shopify", "full"] } },
      orderBy: { startedAt: "desc" },
      select:  { status: true, completedAt: true, errorMessage: true },
    }),
  ]);

  const errors: string[] = [];
  if (lastMeta?.errorMessage)    errors.push(`Meta: ${lastMeta.errorMessage}`);
  if (lastShopify?.errorMessage) errors.push(`Shopify: ${lastShopify.errorMessage}`);

  return {
    lastMetaSyncAt:    lastMeta?.completedAt ?? null,
    lastShopifySyncAt: lastShopify?.completedAt ?? null,
    metaSyncStatus:    syncLabel(lastMeta?.completedAt ?? null, lastMeta?.status === "failed"),
    shopifySyncStatus: syncLabel(lastShopify?.completedAt ?? null, lastShopify?.status === "failed"),
    recentErrors:      errors,
  };
}

// ── Attribution readiness ─────────────────────────────────────────────────────

export async function evaluateAttributionReadiness(
  clientId: string
): Promise<AttributionReadiness> {
  const account = await prisma.clientAccount.findUnique({
    where:  { id: clientId },
    select: { timezone: true },
  });

  const timezone = account?.timezone ?? null;
  const defaultTimezone = "America/New_York";

  return {
    windowDays:         7,    // fixed per product rules
    timezone:           timezone,
    timezoneConfigured: Boolean(timezone && timezone !== defaultTimezone),
    windowConfigured:   true, // always configured — 7-day window is the standard
  };
}

// ── Goal setup readiness ──────────────────────────────────────────────────────

export async function evaluateGoalSetupReadiness(
  clientId: string
): Promise<GoalSetupReadiness> {
  const goals = await prisma.clientGoalDefaults.findUnique({
    where:  { clientAccountId: clientId },
    select: {
      defaultRoasGoalValue: true,
      defaultCpaGoalValue:  true,
      targetRoas:           true,
      targetCpa:            true,
      maxDailySpend:        true,
    },
  });

  if (!goals) {
    return { hasGoals: false, roasTarget: null, cpaTarget: null, maxDailySpend: null };
  }

  return {
    hasGoals:     true,
    roasTarget:   goals.targetRoas ?? goals.defaultRoasGoalValue,
    cpaTarget:    goals.targetCpa  ?? goals.defaultCpaGoalValue,
    maxDailySpend: goals.maxDailySpend ?? null,
  };
}

// ── Governance readiness ──────────────────────────────────────────────────────

export async function evaluateGovernanceReadiness(
  clientId: string
): Promise<GovernanceReadiness> {
  const autoExec = await prisma.autoExecutionSettings.findUnique({
    where:  { clientAccountId: clientId },
    select: { enabled: true },
  });

  return {
    hasAutoExecution:     autoExec !== null,
    autoExecutionEnabled: autoExec?.enabled ?? false,
  };
}
