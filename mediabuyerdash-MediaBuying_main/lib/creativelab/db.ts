// lib/creativelab/db.ts
// Read and write queries for Creative Lab.
// Workflow state persistence lives here, separate from the generation
// pipeline in analysis.ts and conceptGenerator.ts.

import { prisma } from "../db";
import type { CreativeLabStatus } from "../../types/creativeLab";

// ---------------------------------------------------------------------------
// Workflow item persistence
// ---------------------------------------------------------------------------

/**
 * Build a stable, deterministic item ID from the three entity identifiers.
 * Format: cl_{clientAccountId}_{creativeId}_{campaignId}
 * Uses "_none" for any missing component so the ID stays consistent.
 */
export function buildWorkflowItemId(
  clientAccountId: string,
  creativeId:      string | null | undefined,
  campaignId:      string | null | undefined,
): string {
  const c = creativeId ?? "none";
  const p = campaignId ?? "none";
  return `cl_${clientAccountId}_${c}_${p}`;
}

/**
 * Load persisted workflow state for a set of item IDs.
 * Returns a Map keyed by item ID for O(1) merge on the page.
 */
export async function getWorkflowStates(
  itemIds: string[],
): Promise<Map<string, { status: string; notes: string | null; activityLog: Array<{ id: string; action: string; fromStatus: string | null; toStatus: string | null; note: string | null; createdAt: Date }> }>> {
  if (itemIds.length === 0) return new Map();

  const rows = await prisma.creativeLabWorkflowItem.findMany({
    where:   { id: { in: itemIds } },
    include: { activityLog: { orderBy: { createdAt: "asc" } } },
  });

  return new Map(rows.map((r) => [r.id, { status: r.status, notes: r.notes, activityLog: r.activityLog }]));
}

/**
 * Persist a status transition.
 * Creates the workflow item row if it does not yet exist (first transition).
 * Appends a CreativeLabActivityLog entry.
 */
export async function upsertWorkflowItemStatus(opts: {
  id:             string;
  clientAccountId: string;
  fromStatus:     string | null;
  toStatus:       CreativeLabStatus;
  note?:          string;
}): Promise<void> {
  const { id, clientAccountId, fromStatus, toStatus, note } = opts;

  await prisma.$transaction([
    prisma.creativeLabWorkflowItem.upsert({
      where:  { id },
      create: { id, clientAccountId, status: toStatus },
      update: { status: toStatus, updatedAt: new Date() },
    }),
    prisma.creativeLabActivityLog.create({
      data: {
        itemId:     id,
        action:     `Status changed to "${toStatus.replace(/_/g, " ")}"`,
        fromStatus: fromStatus ?? null,
        toStatus,
        note:       note ?? null,
      },
    }),
  ]);
}

/**
 * Save buyer notes for an item.
 * Creates the workflow item row if it does not yet exist.
 */
export async function upsertWorkflowItemNotes(opts: {
  id:             string;
  clientAccountId: string;
  notes:          string;
}): Promise<void> {
  const { id, clientAccountId, notes } = opts;

  await prisma.creativeLabWorkflowItem.upsert({
    where:  { id },
    create: { id, clientAccountId, notes },
    update: { notes, updatedAt: new Date() },
  });
}

export async function getUploadedImages(workspaceId?: string | null) {
  return prisma.uploadedCreativeImage.findMany({
    where:   workspaceId ? { workspaceId } : undefined,
    include: {
      analysis:   true,
      iterations: { orderBy: { createdAt: "asc" } },
      _count:     { select: { iterations: true } },
    },
    orderBy: { uploadedAt: "desc" },
  });
}

export async function getUploadedImageById(id: string) {
  return prisma.uploadedCreativeImage.findUnique({
    where:   { id },
    include: {
      analysis:   true,
      iterations: { orderBy: { createdAt: "asc" } },
    },
  });
}

export async function updateConceptApproval(
  conceptId: string,
  status: "approved" | "rejected" | "draft"
) {
  return prisma.generatedImageIterationConcept.update({
    where: { id: conceptId },
    data:  { approvalStatus: status, updatedAt: new Date() },
  });
}
