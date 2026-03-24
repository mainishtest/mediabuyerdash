// lib/goals/service.ts
// DB CRUD for the Phase 3 goals system.
//
// Reads from existing MetaCampaignGoal and ClientGoalDefaults models.
// Adapters handle legacy field mapping so old data resolves correctly.
// Writes keep legacy fields in sync for backward compatibility with
// the existing evaluation, alert, and optimization layers.

import { prisma }                             from "../db";
import type { ClientGoal, CampaignGoal, GoalInput } from "./types";

// ---------------------------------------------------------------------------
// Legacy adapters
// Map DB rows (which may have only old fields) to the new typed models.
// Priority: new field → legacy field → null
// ---------------------------------------------------------------------------

export function mapCampaignGoal(row: {
  externalCampaignId: string;
  targetRoas:         number | null;
  targetCpa:          number | null;
  targetCtr:          number | null;
  targetCvr:          number | null;
  maxDailySpend:      number | null;
  roasGoalValue:      number;
  cpaGoalValue:       number;
}): CampaignGoal {
  return {
    externalCampaignId: row.externalCampaignId,
    // New field first; fall back to legacy value when new field is null.
    targetRoas:    row.targetRoas    ?? (row.roasGoalValue > 0 ? row.roasGoalValue : null),
    targetCpa:     row.targetCpa     ?? (row.cpaGoalValue  > 0 ? row.cpaGoalValue  : null),
    targetCtr:     row.targetCtr     ?? null,
    targetCvr:     row.targetCvr     ?? null,
    maxDailySpend: row.maxDailySpend ?? null,
  };
}

export function mapClientGoal(row: {
  clientAccountId:      string;
  targetRoas:           number | null;
  targetCpa:            number | null;
  targetCtr:            number | null;
  targetCvr:            number | null;
  maxDailySpend:        number | null;
  defaultRoasGoalValue: number;
  defaultCpaGoalValue:  number;
}): ClientGoal {
  return {
    clientAccountId: row.clientAccountId,
    targetRoas:    row.targetRoas    ?? (row.defaultRoasGoalValue > 0 ? row.defaultRoasGoalValue : null),
    targetCpa:     row.targetCpa     ?? (row.defaultCpaGoalValue  > 0 ? row.defaultCpaGoalValue  : null),
    targetCtr:     row.targetCtr     ?? null,
    targetCvr:     row.targetCvr     ?? null,
    maxDailySpend: row.maxDailySpend ?? null,
  };
}

// ---------------------------------------------------------------------------
// Single-record fetchers
// ---------------------------------------------------------------------------

export async function getClientGoal(
  clientAccountId: string
): Promise<ClientGoal | null> {
  const row = await prisma.clientGoalDefaults.findUnique({
    where: { clientAccountId },
  });
  if (!row) return null;
  return mapClientGoal(row);
}

export async function getCampaignGoal(
  externalCampaignId: string
): Promise<CampaignGoal | null> {
  const row = await prisma.metaCampaignGoal.findUnique({
    where: { externalCampaignId },
  });
  if (!row) return null;
  return mapCampaignGoal({
    externalCampaignId: row.externalCampaignId,
    targetRoas:         null,
    targetCpa:          null,
    targetCtr:          null,
    targetCvr:          null,
    maxDailySpend:      null,
    roasGoalValue:      row.roasGoalValue,
    cpaGoalValue:       row.cpaGoalValue,
  });
}

// ---------------------------------------------------------------------------
// Upserts
// Write new fields and keep legacy fields in sync.
// Legacy fields are required (non-nullable in DB), so we default to 0
// when the caller omits targetRoas/targetCpa — resolution layer handles
// the fallthrough from system defaults.
// ---------------------------------------------------------------------------

export async function upsertClientGoal(
  clientAccountId: string,
  input: GoalInput
): Promise<ClientGoal> {
  const client = await prisma.clientAccount.findUnique({
    where: { id: clientAccountId }, select: { id: true },
  });
  if (!client) throw new Error(`Client not found: ${clientAccountId}`);

  // Fetch current values to preserve legacy fields if not overwriting.
  const existing = await prisma.clientGoalDefaults.findUnique({
    where: { clientAccountId },
  });

  const legacyRoas = input.targetRoas ?? existing?.defaultRoasGoalValue ?? 0;
  const legacyCpa  = input.targetCpa  ?? existing?.defaultCpaGoalValue  ?? 0;

  const row = await prisma.clientGoalDefaults.upsert({
    where: { clientAccountId },
    create: {
      clientAccountId,
      defaultRoasGoalType:  "high",
      defaultRoasGoalValue: legacyRoas,
      defaultCpaGoalType:   "low",
      defaultCpaGoalValue:  legacyCpa,
      targetRoas:    input.targetRoas    ?? null,
      targetCpa:     input.targetCpa     ?? null,
      targetCtr:     input.targetCtr     ?? null,
      targetCvr:     input.targetCvr     ?? null,
      maxDailySpend: input.maxDailySpend ?? null,
    },
    update: {
      targetRoas:    input.targetRoas    !== undefined ? input.targetRoas    : existing?.targetRoas    ?? null,
      targetCpa:     input.targetCpa     !== undefined ? input.targetCpa     : existing?.targetCpa     ?? null,
      targetCtr:     input.targetCtr     !== undefined ? input.targetCtr     : existing?.targetCtr     ?? null,
      targetCvr:     input.targetCvr     !== undefined ? input.targetCvr     : existing?.targetCvr     ?? null,
      maxDailySpend: input.maxDailySpend !== undefined ? input.maxDailySpend : existing?.maxDailySpend ?? null,
      // Keep legacy fields in sync when new values are provided.
      ...(input.targetRoas != null && { defaultRoasGoalValue: input.targetRoas }),
      ...(input.targetCpa  != null && { defaultCpaGoalValue:  input.targetCpa }),
      updatedAt: new Date(),
    },
  });
  return mapClientGoal(row);
}

export async function upsertCampaignGoal(
  externalCampaignId: string,
  input: GoalInput
): Promise<CampaignGoal> {
  const campaign = await prisma.metaSyncedCampaign.findUnique({
    where: { externalCampaignId }, select: { id: true },
  });
  if (!campaign) throw new Error(`Campaign not found: ${externalCampaignId}`);

  const existing = await prisma.metaCampaignGoal.findUnique({
    where: { externalCampaignId },
  });

  const legacyRoas = input.targetRoas ?? existing?.roasGoalValue ?? 0;
  const legacyCpa  = input.targetCpa  ?? existing?.cpaGoalValue  ?? 0;

  const row = await prisma.metaCampaignGoal.upsert({
    where: { externalCampaignId },
    create: {
      externalCampaignId,
      roasGoalType:  "high",
      roasGoalValue: legacyRoas,
      cpaGoalType:   "low",
      cpaGoalValue:  legacyCpa,
    },
    update: {
      ...(input.targetRoas != null && { roasGoalValue: input.targetRoas }),
      ...(input.targetCpa  != null && { cpaGoalValue:  input.targetCpa }),
      updatedAt: new Date(),
    },
  });
  return mapCampaignGoal({
    externalCampaignId: row.externalCampaignId,
    targetRoas:         input.targetRoas    ?? null,
    targetCpa:          input.targetCpa     ?? null,
    targetCtr:          input.targetCtr     ?? null,
    targetCvr:          input.targetCvr     ?? null,
    maxDailySpend:      input.maxDailySpend ?? null,
    roasGoalValue:      row.roasGoalValue,
    cpaGoalValue:       row.cpaGoalValue,
  });
}

// ---------------------------------------------------------------------------
// Batch loaders — used by query.ts and aggregators.
// ---------------------------------------------------------------------------

export async function getClientGoalsForClients(
  clientIds: string[]
): Promise<Map<string, ClientGoal>> {
  if (clientIds.length === 0) return new Map();
  const rows = await prisma.clientGoalDefaults.findMany({
    where: { clientAccountId: { in: clientIds } },
  });
  return new Map(rows.map(r => [r.clientAccountId, mapClientGoal(r)]));
}

export async function getCampaignGoalsForCampaigns(
  externalCampaignIds: string[]
): Promise<Map<string, CampaignGoal>> {
  if (externalCampaignIds.length === 0) return new Map();
  const rows = await prisma.metaCampaignGoal.findMany({
    where: { externalCampaignId: { in: externalCampaignIds } },
  });
  return new Map(rows.map(r => [r.externalCampaignId, mapCampaignGoal({
    externalCampaignId: r.externalCampaignId,
    targetRoas:         null,
    targetCpa:          null,
    targetCtr:          null,
    targetCvr:          null,
    maxDailySpend:      null,
    roasGoalValue:      r.roasGoalValue,
    cpaGoalValue:       r.cpaGoalValue,
  })]));
}
