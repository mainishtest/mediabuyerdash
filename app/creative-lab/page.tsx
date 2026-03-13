import { mockCreativeDiagnosisInputs } from "../../lib/data/mockCreativeDiagnosisInputs";
import {
  diagnoseCreative,
  generateCopyRecommendation,
  generateImageRecommendation
} from "../../lib/creativeDiagnosisUtils";
import type { CreativeLabEntry, CopyVariation, ImageVariationConcept } from "../../types/creativeDiagnosis";
import type { JobWithVariations, ApprovalMap } from "../../types/aiProvider";
import { prisma } from "../../lib/db";
import { CreativeLabView } from "./CreativeLabView";

export const metadata = {
  title: "Creative Optimization Lab — Media Buying Dashboard"
};

export default async function CreativeLabPage() {
  const entries: CreativeLabEntry[] = mockCreativeDiagnosisInputs.map((input) => {
    const diagnosis          = diagnoseCreative(input);
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

  // Fetch generation jobs and approvals from DB
  const [jobs, approvals] = await Promise.all([
    prisma.aIGenerationJob.findMany({
      orderBy: { createdAt: "desc" },
      include: { approvals: true }
    }),
    prisma.creativeApproval.findMany()
  ]);

  // Build jobsByAd: adId -> { copyJobs, imageJobs }
  const jobsByAd: Record<string, { copyJobs: JobWithVariations[]; imageJobs: JobWithVariations[] }> = {};
  for (const entry of entries) {
    jobsByAd[entry.input.adId] = { copyJobs: [], imageJobs: [] };
  }
  for (const job of jobs) {
    const parsed = job.responseSnapshot ? JSON.parse(job.responseSnapshot) : [];
    const jobWithVars: JobWithVariations = {
      id:          job.id,
      requestType: job.requestType as "copy" | "image",
      provider:    job.provider,
      status:      job.status,
      createdAt:   job.createdAt,
      variations:  parsed
    };
    const bucket = job.requestType === "copy" ? "copyJobs" : "imageJobs";
    if (jobsByAd[job.entityId]) {
      jobsByAd[job.entityId][bucket].push(jobWithVars);
    }
  }

  // Build approvalMap: "jobId_variationId" -> status
  const approvalMap: ApprovalMap = {};
  for (const a of approvals) {
    approvalMap[`${a.jobId}_${a.variationId}`] = a.status as "draft" | "approved" | "rejected";
  }

  // All jobs for the "Generation Jobs and Approvals" section
  const allJobs: JobWithVariations[] = jobs.map((job) => {
    const parsed = job.responseSnapshot ? JSON.parse(job.responseSnapshot) : [];
    return {
      id:          job.id,
      requestType: job.requestType as "copy" | "image",
      provider:    job.provider,
      status:      job.status,
      createdAt:   job.createdAt,
      variations:  parsed
    };
  });

  return (
    <CreativeLabView
      entries={entries}
      jobsByAd={jobsByAd}
      approvalMap={approvalMap}
      allJobs={allJobs}
    />
  );
}
