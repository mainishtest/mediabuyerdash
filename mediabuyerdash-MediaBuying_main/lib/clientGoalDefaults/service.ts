// lib/clientGoalDefaults/service.ts
// Service layer for client-level default campaign goals.
//
// Client defaults are a fallback: they apply to campaigns that have no
// explicit MetaCampaignGoal. They are stored in ClientGoalDefaults,
// separate from per-campaign goals.
//
// applyClientDefaultsToCampaigns() writes real MetaCampaignGoal rows for
// campaigns that are missing one. The explicit goal takes priority after that.

import { prisma } from "../db";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ClientDefaultsInput {
  defaultRoasGoalType:  "high" | "low";
  defaultRoasGoalValue: number;
  defaultCpaGoalType:   "high" | "low";
  defaultCpaGoalValue:  number;
}

export interface ClientDefaultsRecord {
  id:                   string;
  clientAccountId:      string;
  defaultRoasGoalType:  "high" | "low";
  defaultRoasGoalValue: number;
  defaultCpaGoalType:   "high" | "low";
  defaultCpaGoalValue:  number;
  createdAt:            Date;
  updatedAt:            Date;
}

export interface ClientGoalCoverageSummary {
  totalCampaigns:   number;
  explicitGoals:    number;       // has MetaCampaignGoal
  usingDefault:     number;       // no explicit goal, but client has defaults
  missingGoals:     number;       // no explicit goal AND no client defaults
  hasClientDefaults: boolean;
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

/**
 * Returns the client's default goals, or null if none are set.
 */
export async function getClientGoalDefaults(
  clientId: string
): Promise<ClientDefaultsRecord | null> {
  const row = await prisma.clientGoalDefaults.findUnique({
    where: { clientAccountId: clientId },
  });
  if (!row) return null;
  return row as ClientDefaultsRecord;
}

/**
 * Creates or replaces the client default goals. Idempotent upsert.
 * Throws if the client account does not exist.
 */
export async function upsertClientGoalDefaults(
  clientId: string,
  input: ClientDefaultsInput
): Promise<ClientDefaultsRecord> {
  const client = await prisma.clientAccount.findUnique({
    where:  { id: clientId },
    select: { id: true },
  });
  if (!client) {
    throw new Error(`Client not found: ${clientId}`);
  }

  const row = await prisma.clientGoalDefaults.upsert({
    where:  { clientAccountId: clientId },
    create: {
      clientAccountId:      clientId,
      defaultRoasGoalType:  input.defaultRoasGoalType,
      defaultRoasGoalValue: input.defaultRoasGoalValue,
      defaultCpaGoalType:   input.defaultCpaGoalType,
      defaultCpaGoalValue:  input.defaultCpaGoalValue,
    },
    update: {
      defaultRoasGoalType:  input.defaultRoasGoalType,
      defaultRoasGoalValue: input.defaultRoasGoalValue,
      defaultCpaGoalType:   input.defaultCpaGoalType,
      defaultCpaGoalValue:  input.defaultCpaGoalValue,
      updatedAt:            new Date(),
    },
  });
  return row as ClientDefaultsRecord;
}

// ── Apply defaults to campaigns ───────────────────────────────────────────────

export interface ApplyDefaultsResult {
  applied:  number;   // number of MetaCampaignGoal rows created
  skipped:  number;   // campaigns that already had explicit goals
}

/**
 * Writes MetaCampaignGoal records for every campaign belonging to this client
 * that does NOT already have an explicit goal. Campaigns with existing goals
 * are never modified.
 *
 * Requires client defaults to be set — throws if none exist.
 */
export async function applyClientDefaultsToCampaigns(
  clientId: string
): Promise<ApplyDefaultsResult> {
  const defaults = await getClientGoalDefaults(clientId);
  if (!defaults) {
    throw new Error(`No default goals set for client: ${clientId}`);
  }

  // Resolve ad account IDs for this client
  const selectedAccounts = await prisma.metaSelectedAdAccount.findMany({
    where:   { clientAccountId: clientId },
    include: { accessibleAdAccount: { select: { externalAdAccountId: true } } },
  });

  const adAccountIds = selectedAccounts.map(
    (a) => a.accessibleAdAccount.externalAdAccountId
  );
  if (adAccountIds.length === 0) {
    return { applied: 0, skipped: 0 };
  }

  // All campaigns for this client
  const campaigns = await prisma.metaSyncedCampaign.findMany({
    where:  { externalAdAccountId: { in: adAccountIds } },
    select: { externalCampaignId: true },
  });
  if (campaigns.length === 0) {
    return { applied: 0, skipped: 0 };
  }

  const allCampaignIds = campaigns.map((c) => c.externalCampaignId);

  // Existing explicit goals
  const existingGoals = await prisma.metaCampaignGoal.findMany({
    where:  { externalCampaignId: { in: allCampaignIds } },
    select: { externalCampaignId: true },
  });
  const alreadyHasGoal = new Set(existingGoals.map((g) => g.externalCampaignId));

  const toCreate = allCampaignIds.filter((id) => !alreadyHasGoal.has(id));

  if (toCreate.length > 0) {
    await prisma.metaCampaignGoal.createMany({
      data: toCreate.map((externalCampaignId) => ({
        externalCampaignId,
        roasGoalType:  defaults.defaultRoasGoalType,
        roasGoalValue: defaults.defaultRoasGoalValue,
        cpaGoalType:   defaults.defaultCpaGoalType,
        cpaGoalValue:  defaults.defaultCpaGoalValue,
      })),
      skipDuplicates: true,
    });
  }

  return {
    applied:  toCreate.length,
    skipped:  alreadyHasGoal.size,
  };
}

// ── Coverage summary ──────────────────────────────────────────────────────────

/**
 * Returns goal coverage counts for a client's campaigns.
 * - explicitGoals: campaigns with a MetaCampaignGoal row
 * - usingDefault: campaigns without explicit goals, where client defaults exist
 * - missingGoals: campaigns with neither
 */
export async function buildClientGoalCoverageSummary(
  clientId: string
): Promise<ClientGoalCoverageSummary> {
  const selectedAccounts = await prisma.metaSelectedAdAccount.findMany({
    where:   { clientAccountId: clientId },
    include: { accessibleAdAccount: { select: { externalAdAccountId: true } } },
  });

  const adAccountIds = selectedAccounts.map(
    (a) => a.accessibleAdAccount.externalAdAccountId
  );

  if (adAccountIds.length === 0) {
    return { totalCampaigns: 0, explicitGoals: 0, usingDefault: 0, missingGoals: 0, hasClientDefaults: false };
  }

  const [campaigns, defaults] = await Promise.all([
    prisma.metaSyncedCampaign.findMany({
      where:  { externalAdAccountId: { in: adAccountIds } },
      select: { externalCampaignId: true },
    }),
    getClientGoalDefaults(clientId),
  ]);

  if (campaigns.length === 0) {
    return {
      totalCampaigns: 0, explicitGoals: 0, usingDefault: 0,
      missingGoals: 0, hasClientDefaults: defaults !== null,
    };
  }

  const campaignIds = campaigns.map((c) => c.externalCampaignId);

  const goals = await prisma.metaCampaignGoal.findMany({
    where:  { externalCampaignId: { in: campaignIds } },
    select: { externalCampaignId: true },
  });

  const explicitCount  = goals.length;
  const withoutGoal    = campaigns.length - explicitCount;
  const usingDefault   = defaults ? withoutGoal : 0;
  const missingGoals   = defaults ? 0           : withoutGoal;

  return {
    totalCampaigns:   campaigns.length,
    explicitGoals:    explicitCount,
    usingDefault,
    missingGoals,
    hasClientDefaults: defaults !== null,
  };
}
