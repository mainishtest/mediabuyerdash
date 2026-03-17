// lib/creativelab/db.ts
// Read queries for Creative Lab — keep separate from the write operations
// in analysis.ts and conceptGenerator.ts.

import { prisma } from "../db";

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
