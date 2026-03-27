// lib/brandIntelligence/db.ts
// Prisma persistence for brand context / memory.
// One BrandContext record per ClientAccount — upserted on each save.

import { prisma } from "../db";
import type { BrandMemoryData, LandingPageExtraction } from "../../types/brandIntelligence";

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getBrandContext(clientAccountId: string): Promise<{
  id: string;
  clientAccountId: string;
  data: BrandMemoryData;
  landingPageUrl: string | null;
  landingPageData: LandingPageExtraction | null;
  updatedAt: Date;
} | null> {
  const row = await prisma.brandContext.findUnique({
    where: { clientAccountId },
  });
  if (!row) return null;

  return {
    id:              row.id,
    clientAccountId: row.clientAccountId,
    data:            JSON.parse(row.data) as BrandMemoryData,
    landingPageUrl:  row.landingPageUrl,
    landingPageData: row.landingPageData
      ? (JSON.parse(row.landingPageData) as LandingPageExtraction)
      : null,
    updatedAt:       row.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Upsert
// ---------------------------------------------------------------------------

export async function saveBrandContext(
  clientAccountId: string,
  data: BrandMemoryData,
  landingPageUrl?: string | null,
  landingPageData?: LandingPageExtraction | null,
): Promise<{ id: string }> {
  const row = await prisma.brandContext.upsert({
    where:  { clientAccountId },
    create: {
      clientAccountId,
      data:            JSON.stringify(data),
      landingPageUrl:  landingPageUrl ?? null,
      landingPageData: landingPageData ? JSON.stringify(landingPageData) : null,
    },
    update: {
      data:            JSON.stringify(data),
      landingPageUrl:  landingPageUrl ?? undefined,
      landingPageData: landingPageData !== undefined
        ? (landingPageData ? JSON.stringify(landingPageData) : null)
        : undefined,
    },
    select: { id: true },
  });
  return row;
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteBrandContext(clientAccountId: string): Promise<void> {
  await prisma.brandContext.deleteMany({ where: { clientAccountId } });
}
