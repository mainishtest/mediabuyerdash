// lib/metaLaunch/db.ts
// Persistence layer for MetaLaunchRecord — CRUD and queries.

import { prisma } from "../db";
import type { MetaLaunchStatus, MetaLaunchSummary } from "./types";

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createLaunchRecord(data: {
  clientAccountId:          string;
  workspaceId?:             string | null;
  prepItemId?:              string | null;
  briefId?:                 string | null;
  variantId?:               string | null;
  experimentId?:            string | null;
  launchPlanId?:            string | null;
  variantRole:              string;
  status:                   string;
  targetCampaignExternalId?: string | null;
  targetCampaignName?:      string | null;
  targetAdSetExternalId?:   string | null;
  targetAdSetName?:         string | null;
  externalAdAccountId?:     string | null;
  executionMode:            string;
  payloadJson?:             string | null;
  policyCheckJson?:         string | null;
  guardrailJson?:           string | null;
  retryOfLaunchId?:         string | null;
}) {
  return prisma.metaLaunchRecord.create({ data });
}

// ---------------------------------------------------------------------------
// Update status
// ---------------------------------------------------------------------------

export async function updateLaunchStatus(
  id: string,
  status: MetaLaunchStatus,
  extra?: {
    metaCreativeId?:  string | null;
    metaAdId?:        string | null;
    launchMessage?:   string | null;
    errorCode?:       string | null;
    errorDetail?:     string | null;
    launchedAt?:      Date | null;
    experimentId?:    string | null;
    retryCount?:      number;
    lastRetryAt?:     Date | null;
  },
) {
  return prisma.metaLaunchRecord.update({
    where: { id },
    data: {
      status,
      ...(extra?.metaCreativeId !== undefined && { metaCreativeId: extra.metaCreativeId }),
      ...(extra?.metaAdId !== undefined && { metaAdId: extra.metaAdId }),
      ...(extra?.launchMessage !== undefined && { launchMessage: extra.launchMessage }),
      ...(extra?.errorCode !== undefined && { errorCode: extra.errorCode }),
      ...(extra?.errorDetail !== undefined && { errorDetail: extra.errorDetail }),
      ...(extra?.launchedAt !== undefined && { launchedAt: extra.launchedAt }),
      ...(extra?.experimentId !== undefined && { experimentId: extra.experimentId }),
      ...(extra?.retryCount !== undefined && { retryCount: extra.retryCount }),
      ...(extra?.lastRetryAt !== undefined && { lastRetryAt: extra.lastRetryAt }),
    },
  });
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function loadLaunchRecordById(id: string) {
  return prisma.metaLaunchRecord.findUnique({ where: { id } });
}

export async function loadLaunchRecords(opts: {
  clientAccountId?: string;
  status?:          MetaLaunchStatus;
  prepItemId?:      string;
  experimentId?:    string;
  limit?:           number;
}) {
  return prisma.metaLaunchRecord.findMany({
    where: {
      ...(opts.clientAccountId && { clientAccountId: opts.clientAccountId }),
      ...(opts.status && { status: opts.status }),
      ...(opts.prepItemId && { prepItemId: opts.prepItemId }),
      ...(opts.experimentId && { experimentId: opts.experimentId }),
    },
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 50,
  });
}

export async function buildLaunchSummary(
  clientAccountId?: string,
): Promise<MetaLaunchSummary> {
  const where = clientAccountId ? { clientAccountId } : {};
  const counts = await prisma.metaLaunchRecord.groupBy({
    by: ["status"],
    where,
    _count: true,
  });

  const summary: MetaLaunchSummary = {
    total: 0, draft: 0, readyForApproval: 0, approved: 0,
    launching: 0, launched: 0, failed: 0, blocked: 0,
  };

  const statusMap: Record<string, keyof Omit<MetaLaunchSummary, "total">> = {
    draft: "draft",
    ready_for_approval: "readyForApproval",
    approved: "approved",
    launching: "launching",
    launched: "launched",
    failed: "failed",
    blocked: "blocked",
  };

  for (const row of counts) {
    const key = statusMap[row.status];
    if (key) summary[key] = row._count;
    summary.total += row._count;
  }

  return summary;
}

// ---------------------------------------------------------------------------
// Check for duplicate launch attempts
// ---------------------------------------------------------------------------

export async function hasActiveLaunchForPrepItem(prepItemId: string): Promise<boolean> {
  const existing = await prisma.metaLaunchRecord.findFirst({
    where: {
      prepItemId,
      status: { in: ["launching", "launched"] },
    },
    select: { id: true },
  });
  return !!existing;
}
