// lib/creativeBrief/db.ts
// DB persistence for creative briefs and draft variants.
// Read/write only — generation logic is in briefs.ts.

import { prisma }                from "../db";
import type {
  CreativeBrief,
  CreativeBriefStatus,
  CreativeReviewDecision,
}                                from "../../types/creativeBrief";

// ---------------------------------------------------------------------------
// Save a complete brief (generated in-memory) to the DB.
// ---------------------------------------------------------------------------

export async function saveCreativeBrief(brief: CreativeBrief): Promise<void> {
  await prisma.$transaction([
    prisma.creativeBriefRecord.create({
      data: {
        id:              brief.id,
        clientAccountId: brief.clientAccountId,
        campaignId:      brief.campaignId,
        creativeId:      brief.creativeId,
        sourceItemId:    brief.sourceItemId,
        draftType:       brief.draftType,
        intent:          brief.intent,
        status:          brief.status,
        briefJson:       JSON.stringify({ input: brief.input, sections: brief.sections }),
        notes:           brief.notes,
      },
    }),
    ...brief.draftSet.variants.map((v) =>
      prisma.creativeDraftVariantRecord.create({
        data: {
          id:             v.id,
          briefId:        brief.id,
          variantType:    v.variantType,
          title:          v.title,
          contentJson:    JSON.stringify({
            hook:               v.hook,
            body:               v.body,
            callToAction:       v.callToAction,
            conceptSummary:     v.conceptSummary,
            visualChanges:      v.visualChanges,
            goal:               v.goal,
            directResponseAngle: v.directResponseAngle,
          }),
        },
      })
    ),
  ]);
}

// ---------------------------------------------------------------------------
// Load briefs for a workspace/client, most recent first.
// Reconstructs the CreativeBrief shape from DB rows.
// ---------------------------------------------------------------------------

export async function loadCreativeBriefs(opts: {
  clientAccountId?: string;
  status?:          CreativeBriefStatus;
  limit?:           number;
}): Promise<CreativeBrief[]> {
  const rows = await prisma.creativeBriefRecord.findMany({
    where: {
      ...(opts.clientAccountId ? { clientAccountId: opts.clientAccountId } : {}),
      ...(opts.status           ? { status: opts.status }                  : {}),
    },
    include: {
      variants: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
    take:    opts.limit ?? 100,
  });

  return rows.map(rowToBrief);
}

// ---------------------------------------------------------------------------
// Load a single brief by ID.
// ---------------------------------------------------------------------------

export async function loadCreativeBriefById(id: string): Promise<CreativeBrief | null> {
  const row = await prisma.creativeBriefRecord.findUnique({
    where:   { id },
    include: { variants: { orderBy: { createdAt: "asc" } } },
  });
  return row ? rowToBrief(row) : null;
}

// ---------------------------------------------------------------------------
// Update brief status (review decision at the brief level).
// ---------------------------------------------------------------------------

export async function updateBriefStatus(
  id:     string,
  status: CreativeBriefStatus,
  notes?: string,
): Promise<void> {
  await prisma.creativeBriefRecord.update({
    where: { id },
    data:  { status, notes: notes ?? undefined, updatedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Update review decision on a single draft variant.
// ---------------------------------------------------------------------------

export async function updateVariantReview(opts: {
  variantId:      string;
  reviewDecision: CreativeReviewDecision;
  reviewNote?:    string;
}): Promise<void> {
  await prisma.creativeDraftVariantRecord.update({
    where: { id: opts.variantId },
    data:  {
      reviewDecision: opts.reviewDecision,
      reviewNote:     opts.reviewNote ?? null,
      reviewedAt:     new Date(),
      updatedAt:      new Date(),
    },
  });
}

// ---------------------------------------------------------------------------
// Row → CreativeBrief reconstruction
// ---------------------------------------------------------------------------

type BriefRow = {
  id:              string;
  clientAccountId: string;
  campaignId:      string | null;
  creativeId:      string | null;
  sourceItemId:    string | null;
  draftType:       string;
  intent:          string;
  status:          string;
  briefJson:       string;
  notes:           string | null;
  createdAt:       Date;
  updatedAt:       Date;
  variants: Array<{
    id:             string;
    variantType:    string;
    title:          string;
    contentJson:    string;
    reviewDecision: string | null;
    reviewNote:     string | null;
    reviewedAt:     Date | null;
    createdAt:      Date;
  }>;
};

function rowToBrief(row: BriefRow): CreativeBrief {
  let parsed: { input?: unknown; sections?: unknown[] } = {};
  try { parsed = JSON.parse(row.briefJson); } catch { /* malformed JSON */ }

  return {
    id:              row.id,
    sourceItemId:    row.sourceItemId ?? "",
    draftType:       row.draftType    as CreativeBrief["draftType"],
    intent:          row.intent       as CreativeBrief["intent"],
    status:          row.status       as CreativeBrief["status"],
    clientAccountId: row.clientAccountId,
    clientName:      (parsed.input as { clientName?: string })?.clientName ?? "",
    campaignId:      row.campaignId,
    campaignName:    (parsed.input as { campaignName?: string })?.campaignName ?? null,
    creativeId:      row.creativeId,
    creativeName:    (parsed.input as { creativeName?: string })?.creativeName ?? null,
    input:           (parsed.input  as CreativeBrief["input"])   ?? ({} as CreativeBrief["input"]),
    sections:        (parsed.sections as CreativeBrief["sections"]) ?? [],
    draftSet: {
      draftType:   row.draftType as CreativeBrief["draftType"],
      intent:      row.intent    as CreativeBrief["intent"],
      generatedAt: row.createdAt.toISOString(),
      variants:    row.variants.map((v) => {
        let content: Record<string, unknown> = {};
        try { content = JSON.parse(v.contentJson); } catch { /* malformed */ }
        return {
          id:                  v.id,
          variantType:         v.variantType as "copy" | "image",
          title:               v.title,
          hook:                content.hook                as string | undefined,
          body:                content.body                as string | undefined,
          callToAction:        content.callToAction        as string | undefined,
          conceptSummary:      content.conceptSummary      as string | undefined,
          visualChanges:       content.visualChanges       as string | undefined,
          goal:                content.goal                as string | undefined,
          directResponseAngle: content.directResponseAngle as string | undefined,
          reviewDecision:      v.reviewDecision            as CreativeBrief["draftSet"]["variants"][0]["reviewDecision"],
          reviewNote:          v.reviewNote,
          reviewedAt:          v.reviewedAt?.toISOString() ?? null,
        };
      }),
    },
    notes:     row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
