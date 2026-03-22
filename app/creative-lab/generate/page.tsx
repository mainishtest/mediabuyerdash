// app/creative-lab/generate/page.tsx
// Creative Lab — AI generation pipeline.
//
// Loads real synced ad data from Meta to populate the creative generator.
// Falls back to mock data only if no real ads are available yet.

export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import {
  loadCreativePerformanceData,
  buildCreativePerformanceSnapshots,
} from "../../../lib/creativelab/performance";
import { mockCreativeDiagnosisInputs } from "../../../lib/data/mockCreativeDiagnosisInputs";
import {
  diagnoseCreative,
  generateCopyRecommendation,
  generateImageRecommendation,
} from "../../../lib/creativeDiagnosisUtils";
import type { CreativeDiagnosisInput, CreativeLabEntry } from "../../../types/creativeDiagnosis";
import type { JobWithVariations, ApprovalMap } from "../../../types/aiProvider";
import type { CreativePerformanceSnapshot } from "../../../lib/creativelab/types";
import { prisma } from "../../../lib/db";
import { getProviderConfigStatusAction } from "../actions";
import { CreativeLabView } from "../CreativeLabView";

export const metadata = {
  title: "Creative Generator — Creative Lab",
};

/**
 * Convert a real CreativePerformanceSnapshot into the CreativeDiagnosisInput
 * the generator expects.
 *
 * For standard ads, body = primary text, title = headline.
 * For dynamic product ads (DPA), body may be empty and name contains
 * {{product.name}} template variables — we use whatever is available.
 */
function snapshotToDiagnosisInput(s: CreativePerformanceSnapshot): CreativeDiagnosisInput {
  // Resolve the best available ad copy fields.
  // Meta stores: body = primary text, title = headline, name = creative name.
  // DPAs may have empty body/title with {{product.name}} in name.
  const rawBody  = s.adCopy?.trim() || null;
  const rawTitle = s.adTitle?.trim() || null;
  const rawName  = s.creativeName?.trim() || null;

  // Check if a string is a Meta template variable (not real copy)
  const isTemplate = (str: string | null) =>
    str != null && str.includes("{{");

  // Use real copy values, skip template variables
  const body  = rawBody && !isTemplate(rawBody) ? rawBody : null;
  const title = rawTitle && !isTemplate(rawTitle) ? rawTitle : null;
  const name  = rawName && !isTemplate(rawName) ? rawName : null;

  // Hook: prefer title (headline), fall back to first sentence of body
  const hook = title
    ?? body?.split(/[.!?\n]/)?.[0]?.trim()
    ?? name
    ?? "(Dynamic product ad — copy varies by product)";

  // Body: use actual body text, fall back to name context
  const copyBody = body
    ?? (name ? `Ad: ${name}` : "(Dynamic product ad — copy varies by product)");

  // Display name: prefer non-template name, fall back to ID
  const adName = name ?? title ?? `Creative ${s.externalCreativeId.slice(-8)}`;

  // Image context: use non-template values
  const imageHeadline = title ?? name ?? adName;

  return {
    adId:          s.externalCreativeId,
    adName,
    campaignId:    s.externalCampaignId,
    campaignName:  s.campaignName,
    actualCpa:     s.campaignCpa ?? 0,
    actualRoas:    s.campaignRoas ?? 0,
    spend:         s.spend,
    conversions:   s.campaignCpa && s.campaignCpa > 0 ? Math.round(s.spend / s.campaignCpa) : 0,
    cpaGoalValue:  s.campaignCpa ? s.campaignCpa * 0.8 : 25,
    cpaGoalType:   "low",
    roasGoalValue: s.campaignRoas ? Math.max(s.campaignRoas * 1.2, 2.0) : 3.0,
    roasGoalType:  "high",
    copy: {
      hook,
      body:         copyBody,
      callToAction: s.callToAction ?? "Shop Now",
    },
    image: {
      imageHeadline,
      imageStyle:      s.imageUrl || s.thumbnailUrl ? "product" : "unknown",
      dominantMessage: imageHeadline,
      visualTheme:     s.imageUrl || s.thumbnailUrl ? "product-photo" : "unknown",
    },
  };
}

export default async function CreativeLabGeneratePage() {
  const session = await getServerSession(authOptions);
  const workspaceId = session?.user?.workspaceId ?? null;

  // Try to load real synced ad data
  let inputs: CreativeDiagnosisInput[] = [];
  try {
    const perfData = await loadCreativePerformanceData(workspaceId);
    const snapshots = buildCreativePerformanceSnapshots(perfData);
    if (snapshots.length > 0) {
      inputs = snapshots
        .filter((s) => s.spend > 0) // Only include ads with actual spend
        .slice(0, 20) // Cap at 20 to keep page manageable
        .map(snapshotToDiagnosisInput);
    }
  } catch {
    // Fall through to mock data
  }

  // Fall back to mock data if no real ads are synced yet
  if (inputs.length === 0) {
    inputs = mockCreativeDiagnosisInputs;
  }

  const entries: CreativeLabEntry[] = inputs.map((input) => {
    const diagnosis = diagnoseCreative(input);
    const copyRecommendation =
      diagnosis.causeType === "copy" || diagnosis.causeType === "mixed"
        ? generateCopyRecommendation(input)
        : null;
    const imageRecommendation =
      diagnosis.causeType === "image" || diagnosis.causeType === "mixed"
        ? generateImageRecommendation(input)
        : null;

    return { input, diagnosis, copyRecommendation, imageRecommendation };
  });

  const [jobs, approvals] = await Promise.all([
    prisma.aIGenerationJob
      .findMany({ orderBy: { createdAt: "desc" }, include: { approvals: true } })
      .catch(() => []),
    prisma.creativeApproval.findMany().catch(() => []),
  ]);

  const jobsByAd: Record<
    string,
    { copyJobs: JobWithVariations[]; imageJobs: JobWithVariations[] }
  > = {};
  for (const entry of entries) {
    jobsByAd[entry.input.adId] = { copyJobs: [], imageJobs: [] };
  }
  for (const job of jobs) {
    const parsed: JobWithVariations = {
      id:          job.id,
      requestType: job.requestType as "copy" | "image",
      provider:    job.provider,
      status:      job.status,
      createdAt:   job.createdAt,
      variations:  job.responseSnapshot ? JSON.parse(job.responseSnapshot) : [],
    };
    const bucket = job.requestType === "copy" ? "copyJobs" : "imageJobs";
    if (jobsByAd[job.entityId]) jobsByAd[job.entityId][bucket].push(parsed);
  }

  const approvalMap: ApprovalMap = {};
  for (const a of approvals) {
    approvalMap[`${a.jobId}_${a.variationId}`] = a.status as "draft" | "approved" | "rejected";
  }

  const allJobs: JobWithVariations[] = jobs.map((job) => ({
    id:          job.id,
    requestType: job.requestType as "copy" | "image",
    provider:    job.provider,
    status:      job.status,
    createdAt:   job.createdAt,
    variations:  job.responseSnapshot ? JSON.parse(job.responseSnapshot) : [],
  }));

  const providerConfig = await getProviderConfigStatusAction();

  return (
    <CreativeLabView
      entries={entries}
      jobsByAd={jobsByAd}
      approvalMap={approvalMap}
      allJobs={allJobs}
      providerConfig={providerConfig}
    />
  );
}
