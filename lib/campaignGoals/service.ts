// lib/campaignGoals/service.ts
// Service layer for campaign goal management.
//
// Goals are stored in MetaCampaignGoal, keyed on externalCampaignId.
// They are internal dashboard goals only — never written back to Meta.
// Used by the aggregator for evaluation and by the UI for display/editing.

import { prisma } from "../db";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GoalInput {
  roasGoalType:  "high" | "low";
  roasGoalValue: number;
  cpaGoalType:   "high" | "low";
  cpaGoalValue:  number;
}

export interface CampaignGoalRecord {
  id:                string;
  externalCampaignId: string;
  roasGoalType:       "high" | "low";
  roasGoalValue:      number;
  cpaGoalType:        "high" | "low";
  cpaGoalValue:       number;
  createdAt:          Date;
  updatedAt:          Date;
}

export interface CampaignGoalSummary {
  totalCampaigns:   number;
  withGoals:        number;
  missingGoals:     number;
  missingGoalNames: string[];  // campaign names that have no goal set
}

// ── Core CRUD ─────────────────────────────────────────────────────────────────

/**
 * Returns the goal for a single imported Meta campaign, or null if not set.
 */
export async function getCampaignGoal(
  externalCampaignId: string
): Promise<CampaignGoalRecord | null> {
  const row = await prisma.metaCampaignGoal.findUnique({
    where: { externalCampaignId },
  });
  if (!row) return null;
  return row as CampaignGoalRecord;
}

/**
 * Creates or replaces the goal for a campaign.
 * Safe to call multiple times — idempotent upsert.
 * Throws if the campaign does not exist in MetaSyncedCampaign.
 */
export async function upsertCampaignGoal(
  externalCampaignId: string,
  input: GoalInput
): Promise<CampaignGoalRecord> {
  // Validate campaign exists
  const campaign = await prisma.metaSyncedCampaign.findUnique({
    where:  { externalCampaignId },
    select: { id: true },
  });
  if (!campaign) {
    throw new Error(`Campaign not found: ${externalCampaignId}`);
  }

  const row = await prisma.metaCampaignGoal.upsert({
    where:  { externalCampaignId },
    create: {
      externalCampaignId,
      roasGoalType:  input.roasGoalType,
      roasGoalValue: input.roasGoalValue,
      cpaGoalType:   input.cpaGoalType,
      cpaGoalValue:  input.cpaGoalValue,
    },
    update: {
      roasGoalType:  input.roasGoalType,
      roasGoalValue: input.roasGoalValue,
      cpaGoalType:   input.cpaGoalType,
      cpaGoalValue:  input.cpaGoalValue,
      updatedAt:     new Date(),
    },
  });
  return row as CampaignGoalRecord;
}

/**
 * Returns all MetaCampaignGoal records for the campaigns belonging to a client.
 * Goals are keyed by externalCampaignId for O(1) lookup in the aggregator.
 */
export async function getCampaignsWithGoals(
  clientId: string
): Promise<Map<string, CampaignGoalRecord>> {
  const selectedAccounts = await prisma.metaSelectedAdAccount.findMany({
    where:   { clientAccountId: clientId },
    include: { accessibleAdAccount: { select: { externalAdAccountId: true } } },
  });

  const externalAdAccountIds = selectedAccounts.map(
    (a) => a.accessibleAdAccount.externalAdAccountId
  );
  if (externalAdAccountIds.length === 0) return new Map();

  const campaigns = await prisma.metaSyncedCampaign.findMany({
    where:   { externalAdAccountId: { in: externalAdAccountIds } },
    select:  { externalCampaignId: true },
  });

  const externalCampaignIds = campaigns.map((c) => c.externalCampaignId);
  if (externalCampaignIds.length === 0) return new Map();

  const goals = await prisma.metaCampaignGoal.findMany({
    where: { externalCampaignId: { in: externalCampaignIds } },
  });

  return new Map(goals.map((g) => [g.externalCampaignId, g as CampaignGoalRecord]));
}

/**
 * Builds a summary of goal coverage for a client's campaigns.
 * Used by the Missing Goals banner on the campaign list page.
 */
export async function buildCampaignGoalSummary(
  clientId: string
): Promise<CampaignGoalSummary> {
  const selectedAccounts = await prisma.metaSelectedAdAccount.findMany({
    where:   { clientAccountId: clientId },
    include: { accessibleAdAccount: { select: { externalAdAccountId: true } } },
  });

  const externalAdAccountIds = selectedAccounts.map(
    (a) => a.accessibleAdAccount.externalAdAccountId
  );
  if (externalAdAccountIds.length === 0) {
    return { totalCampaigns: 0, withGoals: 0, missingGoals: 0, missingGoalNames: [] };
  }

  const campaigns = await prisma.metaSyncedCampaign.findMany({
    where:   { externalAdAccountId: { in: externalAdAccountIds } },
    select:  { externalCampaignId: true, name: true },
  });

  if (campaigns.length === 0) {
    return { totalCampaigns: 0, withGoals: 0, missingGoals: 0, missingGoalNames: [] };
  }

  const externalCampaignIds = campaigns.map((c) => c.externalCampaignId);

  const goals = await prisma.metaCampaignGoal.findMany({
    where:  { externalCampaignId: { in: externalCampaignIds } },
    select: { externalCampaignId: true },
  });

  const withGoalIds = new Set(goals.map((g) => g.externalCampaignId));

  const missingGoalNames = campaigns
    .filter((c) => !withGoalIds.has(c.externalCampaignId))
    .map((c) => c.name);

  return {
    totalCampaigns:   campaigns.length,
    withGoals:        withGoalIds.size,
    missingGoals:     missingGoalNames.length,
    missingGoalNames,
  };
}
