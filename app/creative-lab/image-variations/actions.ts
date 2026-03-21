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
