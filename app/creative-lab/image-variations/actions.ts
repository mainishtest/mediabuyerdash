"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions }      from "../../../lib/auth";
import { prisma } from "../../../lib/db";
import {
  buildImageVariationRequest,
  generateImageVariationCandidates,
  getImageVariationHistory,
  getImageVariationRequestById,
} from "../../../lib/imageVariation";
import type {
  ImageVariationIntent,
  ImageVariationCandidate,
  ImageVariationGenerationSummary,
} from "../../../lib/imageVariation";
import {
  loadCreativePerformanceData,
  buildCreativePerformanceSnapshots,
} from "../../../lib/creativelab/performance";

// ---------------------------------------------------------------------------
// Load snapshots for the selector
// ---------------------------------------------------------------------------

export async function loadCreativeSnapshotsAction(): Promise<
  Array<{
    externalCreativeId: string;
    creativeName:       string | null;
    thumbnailUrl:       string | null;
    campaignName:       string;
    clientAccountId:    string;
    clientName:         string;
    avgCtr:             number;
    avgFrequency:       number | null;
    campaignRoas:       number | null;
    evaluationStatus:   string;
    spend:              number;
  }>
> {
  try {
    const session     = await getServerSession(authOptions);
    const workspaceId = session?.user?.workspaceId ?? null;
    const perfData = await loadCreativePerformanceData(workspaceId);
    const snapshots = buildCreativePerformanceSnapshots(perfData);
    return snapshots.map((s) => ({
      externalCreativeId: s.externalCreativeId,
      creativeName:       s.creativeName,
      thumbnailUrl:       s.thumbnailUrl,
      campaignName:       s.campaignName,
      clientAccountId:    s.clientAccountId,
      clientName:         s.clientName,
      avgCtr:             s.avgCtr,
      avgFrequency:       s.avgFrequency,
      campaignRoas:       s.campaignRoas,
      evaluationStatus:   s.evaluationStatus,
      spend:              s.spend,
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Generate image variation candidates
// ---------------------------------------------------------------------------

export type GenerateImageVariationsResult = {
  ok:          true;
  requestId:   string;
  candidates:  ImageVariationCandidate[];
  summary:     ImageVariationGenerationSummary;
} | {
  ok:          false;
  error:       string;
};

export async function generateImageVariationsAction(opts: {
  creativeId:      string;
  intent:          ImageVariationIntent;
  triggerType:     "fatigue" | "underperformance" | "opportunity" | "manual";
  candidateCount?: number;
}): Promise<GenerateImageVariationsResult> {
  try {
    // Load snapshot for this creative
    const session     = await getServerSession(authOptions);
    const workspaceId = session?.user?.workspaceId ?? null;
    const perfData = await loadCreativePerformanceData(workspaceId);
    const snapshots = buildCreativePerformanceSnapshots(perfData);
    const snapshot = snapshots.find(
      (s) => s.externalCreativeId === opts.creativeId,
    );

    if (!snapshot) {
      return { ok: false, error: "Creative not found in performance data." };
    }

    const request = buildImageVariationRequest({
      clientAccountId: snapshot.clientAccountId,
      campaignId:      snapshot.externalCampaignId,
      creativeId:      opts.creativeId,
      intent:          opts.intent,
      triggerType:     opts.triggerType,
      candidateCount:  opts.candidateCount ?? 3,
      sourceAssetUrl:  snapshot.thumbnailUrl,
    });

    const result = await generateImageVariationCandidates(request, snapshot);

    revalidatePath("/creative-lab/image-variations");

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    return {
      ok:         true,
      requestId:  result.requestId,
      candidates: result.candidates,
      summary:    result.summary,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

// ---------------------------------------------------------------------------
// Save candidates (update status)
// ---------------------------------------------------------------------------

export async function saveCandidatesAction(
  requestId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const record = await prisma.imageVariationRequest.findUnique({
      where: { id: requestId },
    });
    if (!record) return { ok: false, error: "Request not found." };

    let candidates: ImageVariationCandidate[] = [];
    try { candidates = JSON.parse(record.candidatesJson); } catch { /* empty */ }

    const updated = candidates.map((c) => ({
      ...c,
      status: "saved" as const,
    }));

    await prisma.imageVariationRequest.update({
      where: { id: requestId },
      data:  { candidatesJson: JSON.stringify(updated) },
    });

    revalidatePath("/creative-lab/image-variations");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

// ---------------------------------------------------------------------------
// Send candidates to review
// ---------------------------------------------------------------------------

export async function sendToReviewAction(
  requestId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const record = await prisma.imageVariationRequest.findUnique({
      where: { id: requestId },
    });
    if (!record) return { ok: false, error: "Request not found." };

    let candidates: ImageVariationCandidate[] = [];
    try { candidates = JSON.parse(record.candidatesJson); } catch { /* empty */ }

    const updated = candidates.map((c) => ({
      ...c,
      status: "sent_to_review" as const,
    }));

    await prisma.imageVariationRequest.update({
      where: { id: requestId },
      data:  { candidatesJson: JSON.stringify(updated) },
    });

    revalidatePath("/creative-lab/image-variations");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

// ---------------------------------------------------------------------------
// Load history
// ---------------------------------------------------------------------------

export async function loadImageVariationHistoryAction(opts?: {
  clientAccountId?: string;
  limit?: number;
}) {
  return getImageVariationHistory({
    clientAccountId: opts?.clientAccountId,
    limit:           opts?.limit ?? 10,
  });
}

// ---------------------------------------------------------------------------
// Load a specific request with candidates
// ---------------------------------------------------------------------------

export async function loadImageVariationRequestAction(requestId: string) {
  return getImageVariationRequestById(requestId);
}

// ---------------------------------------------------------------------------
// Review workflow actions
// ---------------------------------------------------------------------------

import {
  buildImageVariationReviewQueue,
  buildImageVariationComparisonSet,
  approveImageVariationCandidate,
  rejectImageVariationCandidate,
  requestImageVariationRevision,
  archiveImageVariationCandidate,
  summarizeImageVariationReview,
} from "../../../lib/imageVariation/review";
import type { ImageVariationRevisionIntent } from "../../../lib/imageVariation/reviewTypes";

export async function loadReviewQueueAction() {
  return buildImageVariationReviewQueue();
}

export async function loadComparisonSetAction(requestId: string) {
  return buildImageVariationComparisonSet(requestId);
}

export async function approveCandidateAction(
  requestId:   string,
  candidateId: string,
  note?:       string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await approveImageVariationCandidate(requestId, candidateId, note);
  revalidatePath("/creative-lab/image-variations/review");
  return result;
}

export async function rejectCandidateAction(
  requestId:   string,
  candidateId: string,
  note?:       string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await rejectImageVariationCandidate(requestId, candidateId, note);
  revalidatePath("/creative-lab/image-variations/review");
  return result;
}

export async function requestRevisionAction(
  requestId:      string,
  candidateId:    string,
  revisionIntent: ImageVariationRevisionIntent,
  note?:          string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await requestImageVariationRevision(requestId, candidateId, revisionIntent, note);
  revalidatePath("/creative-lab/image-variations/review");
  return result;
}

export async function archiveCandidateAction(
  requestId:   string,
  candidateId: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await archiveImageVariationCandidate(requestId, candidateId);
  revalidatePath("/creative-lab/image-variations/review");
  return result;
}

export async function loadReviewSummaryAction(requestId: string) {
  const record = await prisma.imageVariationRequest.findUnique({ where: { id: requestId } });
  if (!record) return null;
  let candidates: ImageVariationCandidate[] = [];
  try { candidates = JSON.parse(record.candidatesJson); } catch { return null; }
  return summarizeImageVariationReview(requestId, candidates);
}

// ---------------------------------------------------------------------------
// Scoring and selection workflow actions
// ---------------------------------------------------------------------------

import {
  scoreImageVariation,
  rankImageVariationCandidates,
  summarizeImageVariationRanking,
  buildImageVariationPublishPrepLink,
  computeLaunchReadiness,
} from "../../../lib/imageVariation/scoring";
import type {
  ImageVariationScorecard,
  ImageVariationRanking,
  ImageVariationRankingSummary,
  ImageVariationLaunchReadiness,
  ImageVariationPublishPrepLink,
} from "../../../lib/imageVariation/scoringTypes";
import type { ImageVariationContext } from "../../../lib/imageVariation/types";

export type ScoredSelectionResult = {
  rankings:       ImageVariationRanking[];
  summary:        ImageVariationRankingSummary;
  launchReadiness: ImageVariationLaunchReadiness;
  requestId:      string;
};

export async function scoreAndRankCandidatesAction(
  requestId: string,
): Promise<{ ok: true; data: ScoredSelectionResult } | { ok: false; error: string }> {
  try {
    const record = await prisma.imageVariationRequest.findUnique({ where: { id: requestId } });
    if (!record) return { ok: false, error: "Request not found." };

    let candidates: ImageVariationCandidate[] = [];
    try { candidates = JSON.parse(record.candidatesJson); } catch {
      return { ok: false, error: "Could not parse candidates." };
    }

    // Only score approved candidates
    const approved = candidates.filter((c) => c.reviewState === "approved");
    if (approved.length === 0) {
      return { ok: false, error: "No approved candidates to score." };
    }

    let context: ImageVariationContext | null = null;
    try { context = JSON.parse(record.contextJson); } catch { /* empty */ }

    const scorecards = approved.map((c) => scoreImageVariation(c, context, requestId));
    const rankings = rankImageVariationCandidates(scorecards);
    const summary = summarizeImageVariationRanking(requestId, scorecards);
    const launchReadiness = computeLaunchReadiness(requestId, scorecards);

    return { ok: true, data: { rankings, summary, launchReadiness, requestId } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

export async function selectForPublishPrepAction(
  requestId:   string,
  candidateId: string,
  note?:       string,
): Promise<{ ok: boolean; error?: string; link?: ImageVariationPublishPrepLink }> {
  try {
    const record = await prisma.imageVariationRequest.findUnique({ where: { id: requestId } });
    if (!record) return { ok: false, error: "Request not found." };

    let candidates: ImageVariationCandidate[] = [];
    try { candidates = JSON.parse(record.candidatesJson); } catch {
      return { ok: false, error: "Could not parse candidates." };
    }

    const idx = candidates.findIndex((c) => c.id === candidateId);
    if (idx === -1) return { ok: false, error: "Candidate not found." };

    const candidate = candidates[idx];
    if (candidate.reviewState !== "approved") {
      return { ok: false, error: "Candidate must be approved before selecting for publish prep." };
    }

    let context: ImageVariationContext | null = null;
    try { context = JSON.parse(record.contextJson); } catch { /* empty */ }

    const scorecard = scoreImageVariation(candidate, context, requestId);
    const link = buildImageVariationPublishPrepLink(candidate, scorecard, requestId);

    // Update candidate with selection state
    candidates[idx] = {
      ...candidates[idx],
      reviewerNote: note ?? candidates[idx].reviewerNote ?? null,
    };

    await prisma.imageVariationRequest.update({
      where: { id: requestId },
      data:  { candidatesJson: JSON.stringify(candidates) },
    });

    revalidatePath("/creative-lab/image-variations/selection");
    return { ok: true, link };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

export async function loadApprovedRequestsAction(): Promise<Array<{
  id:              string;
  variationIntent: string;
  triggerType:     string;
  status:          string;
  approvedCount:   number;
  totalCount:      number;
  createdAt:       string;
  clientName:      string | null;
}>> {
  try {
    const records = await prisma.imageVariationRequest.findMany({
      where: { status: { in: ["completed", "partial"] }, candidateCount: { gt: 0 } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const results: Array<{
      id: string; variationIntent: string; triggerType: string; status: string;
      approvedCount: number; totalCount: number; createdAt: string; clientName: string | null;
    }> = [];

    for (const r of records) {
      let candidates: ImageVariationCandidate[] = [];
      try { candidates = JSON.parse(r.candidatesJson); } catch { continue; }
      const approved = candidates.filter((c) => c.reviewState === "approved");
      if (approved.length === 0) continue;

      let ctx: { clientName?: string } | null = null;
      try { ctx = JSON.parse(r.contextJson); } catch { /* empty */ }

      results.push({
        id:              r.id,
        variationIntent: r.variationIntent,
        triggerType:     r.triggerType,
        status:          r.status,
        approvedCount:   approved.length,
        totalCount:      candidates.length,
        createdAt:       r.createdAt.toISOString(),
        clientName:      ctx?.clientName ?? null,
      });
    }

    return results;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Experiment launch actions
// ---------------------------------------------------------------------------

import {
  buildImageVariationExperimentLaunchPlan,
  saveImageVariationExperimentLaunchPlan,
  loadImageVariationExperimentLaunchPlans,
} from "../../../lib/imageVariation/experimentLaunch";
import type { CreativeExperimentLaunchPlan } from "../../../types/experimentLaunch";

export async function createExperimentLaunchPlanAction(
  requestId:          string,
  candidateId:        string,
  controlCreativeId?: string,
  controlCreativeName?: string,
  hypothesis?:        string,
): Promise<{ ok: true; plan: CreativeExperimentLaunchPlan } | { ok: false; error: string }> {
  try {
    const record = await prisma.imageVariationRequest.findUnique({ where: { id: requestId } });
    if (!record) return { ok: false, error: "Request not found." };

    let candidates: ImageVariationCandidate[] = [];
    try { candidates = JSON.parse(record.candidatesJson); } catch {
      return { ok: false, error: "Could not parse candidates." };
    }

    const candidate = candidates.find((c) => c.id === candidateId);
    if (!candidate) return { ok: false, error: "Candidate not found." };
    if (candidate.reviewState !== "approved") {
      return { ok: false, error: "Candidate must be approved before creating a launch plan." };
    }

    let context: ImageVariationContext | null = null;
    try { context = JSON.parse(record.contextJson); } catch { /* empty */ }

    let scorecard: ImageVariationScorecard | null = null;
    try {
      scorecard = scoreImageVariation(candidate, context, requestId);
    } catch { /* scoring is optional */ }

    const plan = buildImageVariationExperimentLaunchPlan({
      candidate,
      context,
      scorecard,
      requestId,
      controlCreativeId,
      controlCreativeName,
      hypothesis,
    });

    const saveResult = await saveImageVariationExperimentLaunchPlan(plan);
    if (!saveResult.ok) {
      return { ok: false, error: saveResult.error ?? "Failed to save plan." };
    }

    revalidatePath("/creative-lab/image-variations/launch");
    return { ok: true, plan };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

export async function loadExperimentLaunchPlansAction(): Promise<CreativeExperimentLaunchPlan[]> {
  try {
    return await loadImageVariationExperimentLaunchPlans({ limit: 50 });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Results ingestion actions
// ---------------------------------------------------------------------------

import {
  ingestImageVariationResults,
  summarizeImageVariationResults,
} from "../../../lib/imageVariation/results";
import type {
  ImageVariationTestResult,
  ImageVariationResultSummary,
} from "../../../lib/imageVariation/resultsTypes";

export async function ingestResultsForPlanAction(
  planId: string,
): Promise<{ ok: true; result: ImageVariationTestResult } | { ok: false; error: string }> {
  try {
    const plan = await loadImageVariationExperimentLaunchPlanById(planId);
    if (!plan) return { ok: false, error: "Launch plan not found." };
    const result = await ingestImageVariationResults(plan);
    return { ok: true, result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

import { loadImageVariationExperimentLaunchPlanById } from "../../../lib/imageVariation/experimentLaunch";

export async function ingestAllResultsAction(): Promise<{
  results: ImageVariationTestResult[];
  summary: ImageVariationResultSummary;
}> {
  try {
    const plans = await loadImageVariationExperimentLaunchPlans({ limit: 50 });
    const results: ImageVariationTestResult[] = [];
    for (const plan of plans) {
      try {
        const result = await ingestImageVariationResults(plan);
        results.push(result);
      } catch {
        // Skip plans that fail to ingest
      }
    }
    const summary = summarizeImageVariationResults(results);
    return { results, summary };
  } catch {
    return {
      results: [],
      summary: {
        totalTests: 0, inProgress: 0, completed: 0, challengerWins: 0,
        controlHolds: 0, noClearWinner: 0, insufficientData: 0,
        failedTests: 0, averageConfidence: 0,
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Learning memory actions
// ---------------------------------------------------------------------------

import { queryLearningMemory, buildLearningSummary } from "../../../lib/learningMemory/aggregator";
import { extractImageVariationLearnings } from "../../../lib/learningMemory/extractor";
import type { LearningMemoryEntry, LearningSummary, LearningCategory, LearningConfidence } from "../../../lib/learningMemory/types";

export async function loadImageVariationInsightsAction(opts?: {
  clientId?:   string;
  category?:   string;
  confidence?: string;
  dateFrom?:   string;
  dateTo?:     string;
}): Promise<{ entries: LearningMemoryEntry[]; summary: LearningSummary }> {
  try {
    // Load image-variation-specific learnings plus experiment learnings tagged to image variants
    const entries = await queryLearningMemory({
      clientId:   opts?.clientId,
      sourceType: "image_variation_outcome",
      category:   (opts?.category as LearningCategory) ?? undefined,
      confidence: (opts?.confidence as LearningConfidence) ?? undefined,
      dateFrom:   opts?.dateFrom,
      dateTo:     opts?.dateTo,
      limit: 100,
    });

    const clients = await prisma.clientAccount.findMany({
      where: { status: "active" },
      select: { id: true, name: true },
    });

    const summary = buildLearningSummary(entries, clients);
    return { entries, summary };
  } catch {
    return {
      entries: [],
      summary: {
        totalEntries: 0, highConfidenceCount: 0, experimentCount: 0,
        creativeCount: 0, usableForBriefsCount: 0, topPatterns: [],
        topInsight: null, clientsWithLearnings: [], isSparse: true,
      },
    };
  }
}
