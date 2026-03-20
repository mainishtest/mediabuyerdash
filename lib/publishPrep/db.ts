// lib/publishPrep/db.ts
// DB persistence layer for PublishPrepRecord.
// Wraps Prisma queries and reconstructs PublishPrepItem from DB rows.
// No business logic here — all computation lives in builder/validator/guardrails.

import { prisma }              from "../db";
import type {
  PublishPrepItem,
  PublishPrepStatus,
  PublishTargetMapping,
  PublishValidationResult,
  PublishGuardrailResult,
  PublishPayloadPreview,
  PublishPrepSummary,
  LaunchExecutionMode,
}                              from "../../types/publishPrep";

// ---------------------------------------------------------------------------
// Save a new prep item to the DB
// ---------------------------------------------------------------------------

export async function savePublishPrepItem(
  item: Omit<PublishPrepItem, "validation" | "guardrails" | "approvalRequirement">,
  validation: PublishValidationResult | null,
  guardrails: PublishGuardrailResult[],
): Promise<void> {
  await prisma.publishPrepRecord.create({
    data: {
      id:              item.id,
      briefId:         item.briefId,
      variantId:       item.variantId,
      clientAccountId: item.clientAccountId,
      status:          item.status,
      executionMode:   item.executionMode,
      variantTitle:    item.variantTitle,
      variantType:     item.variantType,
      briefIntent:     item.briefIntent,
      briefDraftType:  item.briefDraftType,
      clientName:      item.clientName,
      campaignName:    item.campaignName,
      creativeName:    item.creativeName,
      // Target mapping
      targetCampaignId:         item.targetMapping.targetCampaignId,
      targetCampaignName:       item.targetMapping.targetCampaignName,
      targetCampaignExternalId: item.targetMapping.targetCampaignExternalId,
      targetAdSetId:            item.targetMapping.targetAdSetId,
      targetAdSetName:          item.targetMapping.targetAdSetName,
      targetAdSetExternalId:    item.targetMapping.targetAdSetExternalId,
      destinationUrl:           item.targetMapping.destinationUrl,
      ctaType:                  item.targetMapping.ctaType,
      // JSON blobs
      payloadJson:   item.payloadPreview ? JSON.stringify(item.payloadPreview) : null,
      validationJson: validation ? JSON.stringify(validation) : null,
      guardrailJson:  guardrails.length > 0 ? JSON.stringify(guardrails) : null,
      // Review
      launchNotes:       item.launchNotes,
      approvedForLaunch: item.approvedForLaunch,
      approvedAt:        item.approvedAt ? new Date(item.approvedAt) : null,
      publishedAt:       item.publishedAt ? new Date(item.publishedAt) : null,
      publishError:      item.publishError,
    },
  });
}

// ---------------------------------------------------------------------------
// Load all prep items for a client, most recent first
// ---------------------------------------------------------------------------

export async function loadPublishPrepItems(opts: {
  clientAccountId?: string;
  briefId?:         string;
  status?:          PublishPrepStatus;
  limit?:           number;
}): Promise<PublishPrepItem[]> {
  const rows = await prisma.publishPrepRecord.findMany({
    where: {
      ...(opts.clientAccountId ? { clientAccountId: opts.clientAccountId } : {}),
      ...(opts.briefId         ? { briefId: opts.briefId }                 : {}),
      ...(opts.status          ? { status: opts.status }                   : {}),
    },
    orderBy: { createdAt: "desc" },
    take:    opts.limit ?? 100,
  });
  return rows.map(rowToItem);
}

// ---------------------------------------------------------------------------
// Load a single prep item by ID
// ---------------------------------------------------------------------------

export async function loadPublishPrepItemById(id: string): Promise<PublishPrepItem | null> {
  const row = await prisma.publishPrepRecord.findUnique({ where: { id } });
  return row ? rowToItem(row) : null;
}

// ---------------------------------------------------------------------------
// Update status + approval fields
// ---------------------------------------------------------------------------

export async function updatePublishPrepStatus(
  id:                string,
  status:            PublishPrepStatus,
  approvedForLaunch?: boolean,
  approvedAt?:        string | null,
  publishedAt?:       string | null,
  publishError?:      string | null,
): Promise<void> {
  await prisma.publishPrepRecord.update({
    where: { id },
    data:  {
      status,
      ...(approvedForLaunch !== undefined ? { approvedForLaunch } : {}),
      ...(approvedAt !== undefined ? { approvedAt: approvedAt ? new Date(approvedAt) : null } : {}),
      ...(publishedAt !== undefined ? { publishedAt: publishedAt ? new Date(publishedAt) : null } : {}),
      ...(publishError !== undefined ? { publishError } : {}),
      updatedAt: new Date(),
    },
  });
}

// ---------------------------------------------------------------------------
// Update target mapping + rerun validation/guardrails snapshot
// ---------------------------------------------------------------------------

export async function updatePublishPrepMapping(
  id:             string,
  mapping:        PublishTargetMapping,
  validation:     PublishValidationResult | null,
  guardrails:     PublishGuardrailResult[],
  status:         PublishPrepStatus,
  payloadPreview: PublishPayloadPreview | null,
): Promise<void> {
  await prisma.publishPrepRecord.update({
    where: { id },
    data:  {
      targetCampaignId:         mapping.targetCampaignId,
      targetCampaignName:       mapping.targetCampaignName,
      targetCampaignExternalId: mapping.targetCampaignExternalId,
      targetAdSetId:            mapping.targetAdSetId,
      targetAdSetName:          mapping.targetAdSetName,
      targetAdSetExternalId:    mapping.targetAdSetExternalId,
      destinationUrl:           mapping.destinationUrl,
      ctaType:                  mapping.ctaType,
      validationJson:  validation     ? JSON.stringify(validation)  : null,
      guardrailJson:   guardrails.length > 0 ? JSON.stringify(guardrails) : null,
      payloadJson:     payloadPreview ? JSON.stringify(payloadPreview) : null,
      status,
      updatedAt: new Date(),
    },
  });
}

// ---------------------------------------------------------------------------
// Update launch notes
// ---------------------------------------------------------------------------

export async function updatePublishPrepNotes(id: string, notes: string | null): Promise<void> {
  await prisma.publishPrepRecord.update({
    where: { id },
    data:  { launchNotes: notes, updatedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Build summary counts
// ---------------------------------------------------------------------------

export async function buildPublishPrepSummary(
  clientAccountId?: string,
): Promise<PublishPrepSummary> {
  const where = clientAccountId ? { clientAccountId } : {};
  const rows  = await prisma.publishPrepRecord.groupBy({
    by:    ["status"],
    where,
    _count: { status: true },
  });

  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.status] = r._count.status;

  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  return {
    total,
    draft:             counts["draft"]               ?? 0,
    blocked:           counts["blocked"]             ?? 0,
    held:              counts["held"]                ?? 0,
    readyForApproval:  counts["ready_for_approval"]  ?? 0,
    approvedForLaunch: counts["approved_for_launch"] ?? 0,
    readyToPublish:    counts["ready_to_publish"]    ?? 0,
    published:         counts["published"]           ?? 0,
    publishFailed:     counts["publish_failed"]      ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Row → PublishPrepItem reconstruction
// ---------------------------------------------------------------------------

type PrepRow = {
  id:               string;
  briefId:          string;
  variantId:        string;
  clientAccountId:  string;
  status:           string;
  executionMode:    string;
  variantTitle:     string;
  variantType:      string;
  briefIntent:      string;
  briefDraftType:   string;
  clientName:       string;
  campaignName:     string | null;
  creativeName:     string | null;
  targetCampaignId:         string | null;
  targetCampaignName:       string | null;
  targetCampaignExternalId: string | null;
  targetAdSetId:            string | null;
  targetAdSetName:          string | null;
  targetAdSetExternalId:    string | null;
  destinationUrl:           string | null;
  ctaType:                  string | null;
  payloadJson:     string | null;
  validationJson:  string | null;
  guardrailJson:   string | null;
  launchNotes:     string | null;
  approvedForLaunch: boolean;
  approvedAt:      Date | null;
  publishedAt:     Date | null;
  publishError:    string | null;
  createdAt:       Date;
  updatedAt:       Date;
};

function safeParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

function rowToItem(row: PrepRow): PublishPrepItem {
  const targetMapping: PublishTargetMapping = {
    targetCampaignId:         row.targetCampaignId,
    targetCampaignName:       row.targetCampaignName,
    targetCampaignExternalId: row.targetCampaignExternalId,
    targetAdSetId:            row.targetAdSetId,
    targetAdSetName:          row.targetAdSetName,
    targetAdSetExternalId:    row.targetAdSetExternalId,
    destinationUrl:           row.destinationUrl,
    ctaType:                  row.ctaType,
  };

  const validation  = safeParse<PublishValidationResult | null>(row.validationJson, null);
  const guardrails  = safeParse<PublishGuardrailResult[]>(row.guardrailJson, []);
  const payload     = safeParse<PublishPayloadPreview | null>(row.payloadJson, null);

  const approvedForLaunch = row.approvedForLaunch;
  const blockedReasons: string[] = [];
  if (!approvedForLaunch) blockedReasons.push("Human approval required before launch");
  if (guardrails.some((g) => g.required && !g.passed)) blockedReasons.push("One or more required guardrails have not passed");

  return {
    id:              row.id,
    briefId:         row.briefId,
    variantId:       row.variantId,
    clientAccountId: row.clientAccountId,
    status:          row.status as PublishPrepItem["status"],
    executionMode:   row.executionMode as LaunchExecutionMode,
    variantTitle:    row.variantTitle,
    variantType:     row.variantType as "copy" | "image",
    briefIntent:     row.briefIntent,
    briefDraftType:  row.briefDraftType,
    clientName:      row.clientName,
    campaignName:    row.campaignName,
    creativeName:    row.creativeName,
    targetMapping,
    payloadPreview:  payload,
    validation,
    guardrails,
    approvalRequirement: {
      requiresHumanApproval: true,
      approverNote: "A human reviewer must approve this item before any launch action can proceed.",
      blockedReasons,
    },
    launchNotes:       row.launchNotes,
    approvedForLaunch: row.approvedForLaunch,
    approvedAt:        row.approvedAt?.toISOString()  ?? null,
    publishedAt:       row.publishedAt?.toISOString() ?? null,
    publishError:      row.publishError,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
