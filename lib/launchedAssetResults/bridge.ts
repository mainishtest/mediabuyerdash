// lib/launchedAssetResults/bridge.ts
// Bridges MetaLaunchRecord → CreativeTestResultRecord.
//
// When a creative launch succeeds, this module auto-creates a
// CreativeTestResultRecord so the result-ingestion pipeline can
// track the launched asset through evaluation to outcome.
//
// Reuses:
//   - lib/creativeTestResults/db.ts (saveCreativeTestResult)
//   - lib/publishPrep/db.ts (loadPublishPrepItemById)
//   - MetaLaunchRecord fields for context

import { prisma } from "../db";
import { saveCreativeTestResult } from "../creativeTestResults/db";
import type { CreateCreativeTestResultInput } from "../../types/creativeTestResults";

// ---------------------------------------------------------------------------
// Types for the bridge input
// ---------------------------------------------------------------------------

export type LaunchToResultInput = {
  launchRecordId:      string;
  clientAccountId:     string;
  experimentId?:       string | null;
  launchPlanId?:       string | null;
  prepItemId?:         string | null;
  briefId?:            string | null;
  // Control mapping
  controlCreativeId?:  string | null;
  controlCreativeName?: string | null;
  controlAdExternalId?: string | null;
  // Challenger (from launch result)
  challengerVariantTitle?: string | null;
  challengerAdExternalId?: string | null;
  // Target context
  externalAdAccountId?:      string | null;
  targetCampaignExternalId?: string | null;
  targetCampaignName?:       string | null;
  targetAdSetExternalId?:    string | null;
  targetAdSetName?:          string | null;
  // Client context
  clientName?:    string | null;
  campaignName?:  string | null;
  adSetName?:     string | null;
};

// ---------------------------------------------------------------------------
// Create a CreativeTestResultRecord from a successful launch
// ---------------------------------------------------------------------------

export async function createTestResultFromLaunch(
  input: LaunchToResultInput,
): Promise<string> {
  // Prevent duplicates — check if a test result already exists for this launch
  const existing = await prisma.creativeTestResultRecord.findFirst({
    where: {
      OR: [
        // Match by experiment ID if available
        ...(input.experimentId ? [{ experimentId: input.experimentId }] : []),
        // Match by prep item if available
        ...(input.prepItemId ? [{ prepItemId: input.prepItemId, clientAccountId: input.clientAccountId }] : []),
      ],
    },
    select: { id: true },
  });

  if (existing) {
    console.log(`[LaunchBridge] Test result already exists (${existing.id}) for launch ${input.launchRecordId}`);
    return existing.id;
  }

  const id = `ctr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const name = buildTestName(input);

  const createInput: CreateCreativeTestResultInput & { id: string } = {
    id,
    clientAccountId:          input.clientAccountId,
    name,
    launchPlanId:             input.launchPlanId ?? null,
    experimentId:             input.experimentId ?? null,
    prepItemId:               input.prepItemId ?? null,
    briefId:                  input.briefId ?? null,
    controlCreativeId:        input.controlCreativeId ?? null,
    controlCreativeName:      input.controlCreativeName ?? null,
    controlAdExternalId:      input.controlAdExternalId ?? null,
    challengerVariantTitle:   input.challengerVariantTitle ?? null,
    challengerAdExternalId:   input.challengerAdExternalId ?? null,
    clientName:               input.clientName ?? null,
    campaignName:             input.campaignName ?? input.targetCampaignName ?? null,
    adSetName:                input.adSetName ?? input.targetAdSetName ?? null,
    externalAdAccountId:      input.externalAdAccountId ?? null,
    targetCampaignExternalId: input.targetCampaignExternalId ?? null,
    targetAdSetExternalId:    input.targetAdSetExternalId ?? null,
  };

  await saveCreativeTestResult(createInput);

  // Update tracking state to active since this was just launched
  const db = prisma as Record<string, any>;
  await db.creativeTestResultRecord.update({
    where: { id },
    data: {
      trackingState: "active",
      windowStartedAt: new Date(),
    },
  });

  console.log(`[LaunchBridge] Created test result ${id} from launch ${input.launchRecordId}`);
  return id;
}

// ---------------------------------------------------------------------------
// Build test name from available context
// ---------------------------------------------------------------------------

function buildTestName(input: LaunchToResultInput): string {
  const challenger = input.challengerVariantTitle ?? "Challenger";
  const control = input.controlCreativeName ?? "Control";
  const campaign = input.campaignName ?? input.targetCampaignName;
  const parts = [`${challenger} vs ${control}`];
  if (campaign) parts.push(`in ${campaign}`);
  return parts.join(" ");
}
