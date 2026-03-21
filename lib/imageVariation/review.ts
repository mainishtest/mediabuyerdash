// lib/imageVariation/review.ts
// Review, revision, and approval workflow for image variation candidates.
//
// Functions:
//   buildImageVariationReviewQueue()      — load all reviewable requests
//   buildImageVariationComparisonSet()    — group candidates for comparison
//   approveImageVariationCandidate()      — mark candidate as approved
//   rejectImageVariationCandidate()       — mark candidate as rejected
//   requestImageVariationRevision()       — request revision with intent
//   archiveImageVariationCandidate()      — remove from active review
//   summarizeImageVariationReview()       — aggregate review status
//
// Architecture:
//   - Review state is stored in candidatesJson (ImageVariationCandidate.reviewState)
//   - All mutations go through prisma.imageVariationRequest.update
//   - Decisions are explicit and timestamped
//   - No auto-approvals — all decisions require reviewer action

import { prisma } from "../db";
import type { ImageVariationCandidate } from "./types";
import { IMAGE_VARIATION_INTENTS } from "./types";
import type {
  ImageVariationReviewState,
  ImageVariationRevisionIntent,
  ImageVariationReviewItem,
  ImageVariationComparisonSet,
  ImageVariationReviewQueue,
  ImageVariationApprovalSummary,
  ImageVariationApprovalDecision,
} from "./reviewTypes";

// ---------------------------------------------------------------------------
// Public: buildImageVariationReviewQueue
// Loads all requests that have candidates in review.
// ---------------------------------------------------------------------------

export async function buildImageVariationReviewQueue(): Promise<ImageVariationReviewQueue> {
  const records = await prisma.imageVariationRequest.findMany({
    where: {
      status: { in: ["completed", "partial"] },
      candidateCount: { gt: 0 },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const comparisonSets: ImageVariationComparisonSet[] = [];
  let totalCandidates = 0;
  let pendingReview = 0;
  let approved = 0;
  let rejected = 0;
  let revisionRequested = 0;

  for (const record of records) {
    let candidates: ImageVariationCandidate[] = [];
    try { candidates = JSON.parse(record.candidatesJson); } catch { continue; }

    // Only include requests that have candidates sent to review or with review states
    const hasReviewable = candidates.some(
      (c) => c.status === "sent_to_review" || c.reviewState != null,
    );
    if (!hasReviewable) continue;

    let context: { clientName?: string; campaignName?: string } | null = null;
    try { context = JSON.parse(record.contextJson); } catch { /* empty */ }

    const intentKey = record.variationIntent as keyof typeof IMAGE_VARIATION_INTENTS;
    const intentInfo = IMAGE_VARIATION_INTENTS[intentKey];

    const items: ImageVariationReviewItem[] = candidates.map((c) => {
      const reviewState = resolveReviewState(c);
      totalCandidates++;
      if (reviewState === "needs_review") pendingReview++;
      if (reviewState === "approved") approved++;
      if (reviewState === "rejected") rejected++;
      if (reviewState === "revision_requested") revisionRequested++;

      return {
        candidate:        c,
        reviewState,
        reviewerNote:     c.reviewerNote ?? null,
        revisionIntent:   (c.revisionIntent as ImageVariationRevisionIntent) ?? null,
        reviewedAt:       c.reviewedAt ?? null,
        reviewedBy:       c.reviewedBy ?? null,
        requestId:        record.id,
        sourceCreativeId: c.sourceCreativeId ?? record.creativeId,
        sourceAssetUrl:   c.sourceAssetUrl ?? record.sourceAssetUrl,
        variationIntent:  intentKey,
        triggerType:      record.triggerType,
        triggerRationale: record.triggerRationale,
      };
    });

    comparisonSets.push({
      requestId:        record.id,
      variationIntent:  intentKey,
      intentLabel:      intentInfo?.label ?? record.variationIntent,
      triggerType:      record.triggerType,
      triggerRationale: record.triggerRationale,
      sourceAssetUrl:   record.sourceAssetUrl,
      sourceCreativeId: record.creativeId,
      clientName:       context?.clientName ?? null,
      campaignName:     context?.campaignName ?? null,
      items,
      createdAt:        record.createdAt.toISOString(),
    });
  }

  return {
    comparisonSets,
    totalCandidates,
    pendingReview,
    approved,
    rejected,
    revisionRequested,
  };
}

// ---------------------------------------------------------------------------
// Public: buildImageVariationComparisonSet
// Load a single request's candidates as a comparison set.
// ---------------------------------------------------------------------------

export async function buildImageVariationComparisonSet(
  requestId: string,
): Promise<ImageVariationComparisonSet | null> {
  const record = await prisma.imageVariationRequest.findUnique({
    where: { id: requestId },
  });
  if (!record) return null;

  let candidates: ImageVariationCandidate[] = [];
  try { candidates = JSON.parse(record.candidatesJson); } catch { return null; }

  let context: { clientName?: string; campaignName?: string } | null = null;
  try { context = JSON.parse(record.contextJson); } catch { /* empty */ }

  const intentKey = record.variationIntent as keyof typeof IMAGE_VARIATION_INTENTS;
  const intentInfo = IMAGE_VARIATION_INTENTS[intentKey];

  const items: ImageVariationReviewItem[] = candidates.map((c) => ({
    candidate:        c,
    reviewState:      resolveReviewState(c),
    reviewerNote:     c.reviewerNote ?? null,
    revisionIntent:   (c.revisionIntent as ImageVariationRevisionIntent) ?? null,
    reviewedAt:       c.reviewedAt ?? null,
    reviewedBy:       c.reviewedBy ?? null,
    requestId:        record.id,
    sourceCreativeId: c.sourceCreativeId ?? record.creativeId,
    sourceAssetUrl:   c.sourceAssetUrl ?? record.sourceAssetUrl,
    variationIntent:  intentKey,
    triggerType:      record.triggerType,
    triggerRationale: record.triggerRationale,
  }));

  return {
    requestId:        record.id,
    variationIntent:  intentKey,
    intentLabel:      intentInfo?.label ?? record.variationIntent,
    triggerType:      record.triggerType,
    triggerRationale: record.triggerRationale,
    sourceAssetUrl:   record.sourceAssetUrl,
    sourceCreativeId: record.creativeId,
    clientName:       context?.clientName ?? null,
    campaignName:     context?.campaignName ?? null,
    items,
    createdAt:        record.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Public: approveImageVariationCandidate
// ---------------------------------------------------------------------------

export async function approveImageVariationCandidate(
  requestId:   string,
  candidateId: string,
  note?:       string | null,
  reviewedBy?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  return applyCandidateDecision(requestId, candidateId, {
    candidateId,
    decision:     "approve",
    note:         note ?? null,
    reviewedBy:   reviewedBy ?? null,
    reviewedAt:   new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Public: rejectImageVariationCandidate
// ---------------------------------------------------------------------------

export async function rejectImageVariationCandidate(
  requestId:   string,
  candidateId: string,
  note?:       string | null,
  reviewedBy?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  return applyCandidateDecision(requestId, candidateId, {
    candidateId,
    decision:     "reject",
    note:         note ?? null,
    reviewedBy:   reviewedBy ?? null,
    reviewedAt:   new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Public: requestImageVariationRevision
// ---------------------------------------------------------------------------

export async function requestImageVariationRevision(
  requestId:      string,
  candidateId:    string,
  revisionIntent: ImageVariationRevisionIntent,
  note?:          string | null,
  reviewedBy?:    string | null,
): Promise<{ ok: boolean; error?: string }> {
  return applyCandidateDecision(requestId, candidateId, {
    candidateId,
    decision:       "request_revision",
    revisionIntent,
    note:           note ?? null,
    reviewedBy:     reviewedBy ?? null,
    reviewedAt:     new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Public: archiveImageVariationCandidate
// ---------------------------------------------------------------------------

export async function archiveImageVariationCandidate(
  requestId:   string,
  candidateId: string,
): Promise<{ ok: boolean; error?: string }> {
  return updateCandidateField(requestId, candidateId, {
    reviewState: "archived",
    reviewedAt:  new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Public: summarizeImageVariationReview
// ---------------------------------------------------------------------------

export function summarizeImageVariationReview(
  requestId:  string,
  candidates: ImageVariationCandidate[],
): ImageVariationApprovalSummary {
  let approvedCount = 0;
  let rejectedCount = 0;
  let needsReviewCount = 0;
  let revisionCount = 0;
  let archivedCount = 0;

  for (const c of candidates) {
    const state = resolveReviewState(c);
    switch (state) {
      case "approved":           approvedCount++;     break;
      case "rejected":           rejectedCount++;     break;
      case "needs_review":       needsReviewCount++;  break;
      case "revision_requested": revisionCount++;     break;
      case "archived":           archivedCount++;     break;
    }
  }

  const total = candidates.length;
  const decided = approvedCount + rejectedCount + archivedCount;
  const isComplete = decided === total;
  const hasApproved = approvedCount > 0;
  const readyForNextStep = hasApproved && needsReviewCount === 0 && revisionCount === 0;

  return {
    requestId,
    totalCandidates:   total,
    approved:          approvedCount,
    rejected:          rejectedCount,
    needsReview:       needsReviewCount,
    revisionRequested: revisionCount,
    archived:          archivedCount,
    isComplete,
    hasApproved,
    readyForNextStep,
    completedAt:       isComplete ? new Date().toISOString() : null,
  };
}

// ---------------------------------------------------------------------------
// Internal: resolve review state from candidate fields
// ---------------------------------------------------------------------------

function resolveReviewState(c: ImageVariationCandidate): ImageVariationReviewState {
  if (c.reviewState) return c.reviewState;
  if (c.status === "sent_to_review") return "needs_review";
  return "draft";
}

// ---------------------------------------------------------------------------
// Internal: apply a decision to a candidate within a request
// ---------------------------------------------------------------------------

async function applyCandidateDecision(
  requestId:   string,
  candidateId: string,
  decision:    ImageVariationApprovalDecision,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const record = await prisma.imageVariationRequest.findUnique({
      where: { id: requestId },
    });
    if (!record) return { ok: false, error: "Request not found." };

    let candidates: ImageVariationCandidate[] = [];
    try { candidates = JSON.parse(record.candidatesJson); } catch {
      return { ok: false, error: "Could not parse candidates." };
    }

    const idx = candidates.findIndex((c) => c.id === candidateId);
    if (idx === -1) return { ok: false, error: "Candidate not found." };

    const stateMap: Record<string, ImageVariationCandidate["reviewState"]> = {
      approve:          "approved",
      reject:           "rejected",
      request_revision: "revision_requested",
    };

    candidates[idx] = {
      ...candidates[idx],
      reviewState:    stateMap[decision.decision] ?? "needs_review" as const,
      reviewerNote:   decision.note ?? null,
      revisionIntent: decision.revisionIntent ?? null,
      reviewedAt:     decision.reviewedAt,
      reviewedBy:     decision.reviewedBy ?? null,
    };

    await prisma.imageVariationRequest.update({
      where: { id: requestId },
      data:  { candidatesJson: JSON.stringify(candidates) },
    });

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

// ---------------------------------------------------------------------------
// Internal: update arbitrary fields on a candidate
// ---------------------------------------------------------------------------

async function updateCandidateField(
  requestId:   string,
  candidateId: string,
  fields:      Partial<ImageVariationCandidate>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const record = await prisma.imageVariationRequest.findUnique({
      where: { id: requestId },
    });
    if (!record) return { ok: false, error: "Request not found." };

    let candidates: ImageVariationCandidate[] = [];
    try { candidates = JSON.parse(record.candidatesJson); } catch {
      return { ok: false, error: "Could not parse candidates." };
    }

    const idx = candidates.findIndex((c) => c.id === candidateId);
    if (idx === -1) return { ok: false, error: "Candidate not found." };

    candidates[idx] = { ...candidates[idx], ...fields };

    await prisma.imageVariationRequest.update({
      where: { id: requestId },
      data:  { candidatesJson: JSON.stringify(candidates) },
    });

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
